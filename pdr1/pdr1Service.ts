// backend/services/pdr1/pdr1Service.ts

import { PrismaClient } from '@prisma/client';
import { 
  Pdr1ProcessResult, 
  UploadedFiles,
  Pdr1CalculatedValues 
} from './pdr1Types';

// File Processors
import { IMDealProcessor } from './processors/IMDealProcessor';
import { RepoDealProcessor } from './processors/RepoDealProcessor';
import { MMDealProcessor } from './processors/MMDealProcessor';
import { FIMDDAValProcessor } from './processors/FIMDDAValProcessor';
import { SLRNDSProcessor } from './processors/SLRNDSProcessor';

// Calculation Modules
import { OutrightTransactionsCalculator } from './calculations/section1/OutrightTransactions';
import { RepoTransactionsCalculator } from './calculations/section1/RepoTransactions';
import { RepoDealOutstandingProcessor } from './processors/RepoDealOutstandingProcessor';
import { CallMoneyCalculator } from './calculations/section1/CallMoney';
import { SourcesOfFundsCalculator } from './calculations/section2/SourcesOfFunds';
import { ApplicationOfFundsCalculator } from './calculations/section2/ApplicationOfFunds';
import { StockPositionCalculator } from './calculations/section3/StockPosition';
import { PortfolioDurationCalculator } from './calculations/section4/PortfolioDuration';
import { VaRCalculator } from './calculations/section5/VaRCalculation';

const prisma = new PrismaClient();

export class Pdr1Service {
  private imDealProcessor: IMDealProcessor;
  private repoDealProcessor: RepoDealProcessor;
  private mmDealProcessor: MMDealProcessor;
  private fimmdaValProcessor: FIMDDAValProcessor;
  private slrNdsProcessor: SLRNDSProcessor;

  // Calculators
  private outrightCalculator: OutrightTransactionsCalculator;
  private repoCalculator: RepoTransactionsCalculator;
  private callMoneyCalculator: CallMoneyCalculator;
  private sourcesOfFundsCalculator: SourcesOfFundsCalculator;
  private applicationOfFundsCalculator: ApplicationOfFundsCalculator;
  private stockPositionCalculator: StockPositionCalculator;
  private portfolioDurationCalculator: PortfolioDurationCalculator;
  private varCalculator: VaRCalculator;

  constructor() {
    // Initialize processors
    this.imDealProcessor = new IMDealProcessor(prisma);
    this.repoDealProcessor = new RepoDealProcessor(prisma);
    this.mmDealProcessor = new MMDealProcessor(prisma);
    this.fimmdaValProcessor = new FIMDDAValProcessor(prisma);
    this.slrNdsProcessor = new SLRNDSProcessor(prisma);

    // Initialize calculators
    this.outrightCalculator = new OutrightTransactionsCalculator(prisma);
    this.repoCalculator = new RepoTransactionsCalculator(prisma);
    this.callMoneyCalculator = new CallMoneyCalculator(prisma);
    this.sourcesOfFundsCalculator = new SourcesOfFundsCalculator(prisma);
    this.applicationOfFundsCalculator = new ApplicationOfFundsCalculator(prisma);
    this.stockPositionCalculator = new StockPositionCalculator(prisma);
    this.portfolioDurationCalculator = new PortfolioDurationCalculator(prisma);
    this.varCalculator = new VaRCalculator(prisma);
  }

  /**
   * Main method to process all PDR1 files
   */
  async processFiles(files: UploadedFiles, userId?: string): Promise<Pdr1ProcessResult> {
    const startTime = Date.now();
    
    // Create processing batch
    const batch = await prisma.pdr1ProcessingBatch.create({
      data: {
        uploadedBy: userId?.toString() || null,
        status: 'uploading'
      }
    });

    try {
      // Update batch status
      await prisma.pdr1ProcessingBatch.update({
        where: { id: batch.id },
        data: { 
          status: 'processing',
          processingStartedAt: new Date()
        }
      });

      // Process each file type
      const processingResults = await this.processAllFiles(files, batch.id);
      
      // Run all calculations
      console.log('Running PDR1 calculations...');
      const calculatedData = await this.runAllCalculations(batch.id);
      console.log("calculated Data" ,calculatedData)
      
      // Get unique dates from all processed data
      const dealDates = await this.getUniqueDates();
      
      // Save calculated results to database
      await this.saveCalculatedResults(batch.id, calculatedData);
      
      // Update batch status
      await prisma.pdr1ProcessingBatch.update({
        where: { id: batch.id },
        data: {
          status: 'completed',
          processingCompletedAt: new Date(),
          totalRecords: processingResults.totalRecords,
          processedRecords: processingResults.processedRecords,
          errorRecords: processingResults.errorRecords
        }
      });

      const processingTime = Date.now() - startTime;

      return {
        success: true,
        batchId: batch.id,
        summary: {
          totalRecords: processingResults.totalRecords,
          processedRecords: processingResults.processedRecords,
          errorRecords: processingResults.errorRecords,
          processingTime
        },
        processedData: calculatedData,
        dealDates: dealDates.map(date => this.formatDate(date))
      };

    } catch (error:any) {
      // Update batch status on error
      await prisma.pdr1ProcessingBatch.update({
        where: { id: batch.id },
        data: {
          status: 'failed',
          errors: { message: error.message, stack: error.stack }
        }
      });

      console.error('Error processing PDR1 files:', error);
      throw error;
    }
  }

  /**
   * Process all uploaded files
   */
  private async processAllFiles(files: UploadedFiles, batchId: string) {
    let totalRecords = 0;
    let processedRecords = 0;
    let errorRecords = 0;

    console.log('Processing PDR1 files in processallfiles:', Object.keys(files).filter((k) => files[k]));


    // Process IM Deal file 
    if (files.IM_DEAL) {
      console.log('Processing IM Deal file...');
      const result = await this.imDealProcessor.processFile(files.IM_DEAL, batchId);
      totalRecords += result.totalRecords;
      processedRecords += result.processedRecords;
      errorRecords += result.errorRecords;
      
      await prisma.pdr1ProcessingBatch.update({
        where: { id: batchId },
        data: { imDealUploaded: true }
      });
    }

    // Process Repo Deal file 
    if (files.REPO_DEAL) {
      console.log('Processing Repo Deal file...');
      const result = await this.repoDealProcessor.processFile(files.REPO_DEAL, batchId);
      totalRecords += result.totalRecords;
      processedRecords += result.processedRecords;
      errorRecords += result.errorRecords;
      
      await prisma.pdr1ProcessingBatch.update({
        where: { id: batchId },
        data: { repoDealUploaded: true }
      });
    }

    // Process Repo Deal file 
    if (files.MM_DEAL) {
        console.log('Processing MM Deal file (for 1D1 Call Money)...');
        try {
          const result = await this.mmDealProcessor.processFile(files.MM_DEAL, batchId, false);
          totalRecords += result.totalRecords;
          processedRecords += result.processedRecords;
          errorRecords += result.errorRecords;
          
          console.log(`MM Deal processed: ${result.processedRecords}/${result.totalRecords} records`);
          
          await prisma.pdr1ProcessingBatch.update({
            where: { id: batchId },
            data: { mmDealUploaded: true }
          });
        } catch (error) {
          console.error('Error processing MM Deal file:', error);
          errorRecords += 1;
        }
      }
  
      // Process MM Deal Outstanding file (for 2A2-2A10 calculations) - SEPARATE FROM MM DEAL
      if (files.MM_DEAL_OUTSTANDING) {
        console.log('Processing MM Deal Outstanding file (for 2A Sources of Funds)...');
        try {
          const result = await this.mmDealProcessor.processFile(files.MM_DEAL_OUTSTANDING, batchId, true);
          totalRecords += result.totalRecords;
          processedRecords += result.processedRecords;
          errorRecords += result.errorRecords;
          
          console.log(`MM Deal Outstanding processed: ${result.processedRecords}/${result.totalRecords} records`);
          
          // Don't overwrite if MM_DEAL already set the flag
          const batch = await prisma.pdr1ProcessingBatch.findUnique({
            where: { id: batchId },
            select: { mmDealUploaded: true }
          });
          
          if (!batch?.mmDealUploaded) {
            await prisma.pdr1ProcessingBatch.update({
              where: { id: batchId },
              data: { mmDealUploaded: true }
            });
          }
        } catch (error) {
          console.error('Error processing MM Deal Outstanding file:', error);
          errorRecords += 1;
        }
      }

    // Process FIMMDA Val file (optional)
    if (files.FIMMDA_VAL) {
      console.log('Processing FIMMDA Val file...');
      const result = await this.fimmdaValProcessor.processFile(files.FIMMDA_VAL, batchId);
      totalRecords += result.totalRecords;
      processedRecords += result.processedRecords;
      errorRecords += result.errorRecords;
      
      await prisma.pdr1ProcessingBatch.update({
        where: { id: batchId },
        data: { fimmdaValUploaded: true }
      });
    }

    // Process SLR NDS file (optional)
    if (files.SLR_NDS) {
      console.log('Processing SLR NDS file...');
      const result = await this.slrNdsProcessor.processFile(files.SLR_NDS, batchId);
      totalRecords += result.totalRecords;
      processedRecords += result.processedRecords;
      errorRecords += result.errorRecords;
      
      await prisma.pdr1ProcessingBatch.update({
        where: { id: batchId },
        data: { slrNdsUploaded: true }
      });
    }

    return { totalRecords, processedRecords, errorRecords };
  }

  /**
   * Run all PDR1 calculations
   */
  private async runAllCalculations(batchId: string): Promise<Pdr1CalculatedValues> {
    const results: Pdr1CalculatedValues = {};

    // Section 1 - Daily Transactions Summary
    console.log('Calculating Section 1 - Daily Transactions...');
    Object.assign(results, await this.outrightCalculator.calculate(batchId));
    Object.assign(results, await this.repoCalculator.calculate(batchId));
    Object.assign(results, await this.callMoneyCalculator.calculate(batchId));

    // Section 2 - Outstanding Balances
    // console.log('Calculating Section 2 - Outstanding Balances...');
    Object.assign(results, await this.sourcesOfFundsCalculator.calculate(batchId));
    // Object.assign(results, await this.applicationOfFundsCalculator.calculate(batchId));

    // Section 3 - Own Stock Position
    // console.log('Calculating Section 3 - Own Stock Position...');
    // Object.assign(results, await this.stockPositionCalculator.calculate(batchId));

    // Section 4 - Portfolio Duration
    // console.log('Calculating Section 4 - Portfolio Duration...');
    // Object.assign(results, await this.portfolioDurationCalculator.calculate(batchId));

    // Section 5 - VaR
    // console.log('Calculating Section 5 - VaR...');
    // Object.assign(results, await this.varCalculator.calculate(batchId));

    return results;
  }

  /**
   * Save calculated results to database
   */
  private async saveCalculatedResults(batchId: string, results: Pdr1CalculatedValues) {
    const records = [];

    for (const [sectionId, dateValues] of Object.entries(results)) {
      for (const [dateStr, value] of Object.entries(dateValues)) {
        records.push({
          batchId,
          sectionId,
          valueDate: this.parseDate(dateStr),
          calculatedValue: value
        });
      }
    }

    if (records.length > 0) {
      await prisma.pdr1CalculatedResult.createMany({
        data: records,
        skipDuplicates: true
      });
    }
  }

  /**
   * Get unique value dates from all tables
   */
  private async getUniqueDates(): Promise<Date[]> {
    const dates = await prisma.pdr1ImDeal.findMany({
      where: { valueDate: { not: null } },
      select: { valueDate: true },
      distinct: ['valueDate'],
      orderBy: { valueDate: 'asc' }
    });

    return dates
      .map(d => d.valueDate)
      .filter((date): date is Date => date !== null);
  }

  /**
   * Get results by batch ID
   */
  async getResultsByBatchId(batchId: string): Promise<Pdr1ProcessResult> {
    const batch = await prisma.pdr1ProcessingBatch.findUnique({
      where: { id: batchId }
    });

    if (!batch) {
      throw new Error('Batch not found');
    }

    const results = await prisma.pdr1CalculatedResult.findMany({
      where: { batchId }
    });

    // Transform results back to the expected format
    const processedData: Pdr1CalculatedValues = {};
    const dateSet = new Set<string>();

    results.forEach(result => {
      if (!processedData[result.sectionId]) {
        processedData[result.sectionId] = {};
      }
      const dateStr = this.formatDate(result.valueDate);
      processedData[result.sectionId][dateStr] = result.calculatedValue;
      dateSet.add(dateStr);
    });

    return {
      success: true,
      batchId,
      summary: {
        totalRecords: batch.totalRecords,
        processedRecords: batch.processedRecords,
        errorRecords: batch.errorRecords,
        processingTime: 0
      },
      processedData,
      dealDates: Array.from(dateSet).sort()
    };
  }

  /**
   * Format date to DD-MMM-YYYY
   */
  private formatDate(date: Date): string {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const day = date.getUTCDate().toString().padStart(2, '0');
    const month = months[date.getUTCMonth()];
    const year = date.getUTCFullYear();
    return `${day}-${month}-${year}`;
  }

  /**
   * Parse date from DD-MMM-YYYY format
   */
  private parseDate(dateStr: string): Date {
    const [day, monthStr, year] = dateStr.split('-');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months.indexOf(monthStr);
    return new Date(Date.UTC(parseInt(year), month, parseInt(day)));
  }
}