// backend/services/pdr1/processors/MMDealProcessor.ts

import * as XLSX from 'xlsx';
import { PrismaClient } from '@prisma/client';
import { ProcessingResult, MM_DEAL_COLUMN_MAPPING, MM_DEAL_OUTSTANDING_COLUMN_MAPPING } from '../pdr1Types';
import { BaseFileProcessor } from './BaseFileProcessor';

export class MMDealProcessor extends BaseFileProcessor {
  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  async processFile(file: Express.Multer.File, batchId: string, isOutstanding: boolean = false): Promise<ProcessingResult> {
    try {
      console.log(`Processing MM Deal file - Outstanding: ${isOutstanding}`);
      
      const { dealRecords, outstandingRecords } = await this.parseFile(file, isOutstanding);
      
      let totalRecords = 0;
      let processedCount = 0;
      let errorCount = 0;
      
      // Process based on file type
      if (isOutstanding) {
        // This is specifically an MM Deal Outstanding file
        console.log(`Processing ${outstandingRecords.length} outstanding records`);
        
        // Clear existing outstanding data for this batch
        await this.prisma.pdr1MmDealOutstanding.deleteMany({
          where: { uploadBatchId: batchId }
        });
        
        const processedRecords = [];
        
        for (const record of outstandingRecords) {
          try {
            const processedRecord = this.processOutstandingRecord(record, batchId);
            if (processedRecord) {
              processedRecords.push(processedRecord);
              processedCount++;
            }
          } catch (error) {
            console.error('Error processing MM Deal Outstanding record:', error);
            errorCount++;
          }
        }
        
        if (processedRecords.length > 0) {
          await this.prisma.pdr1MmDealOutstanding.createMany({
            data: processedRecords
          });
          console.log(`Inserted ${processedRecords.length} outstanding records`);
        }
        
        totalRecords = outstandingRecords.length;
        
      } else {
        // This is a regular MM Deal file
        console.log(`Processing ${dealRecords.length} deal records`);
        
        // Clear existing deal data for this batch
        await this.prisma.pdr1MmDeal.deleteMany({
          where: { uploadBatchId: batchId }
        });
        
        const processedRecords = [];
        
        for (const record of dealRecords) {
          try {
            const processedRecord = this.processRecord(record, batchId);
            if (processedRecord) {
              processedRecords.push(processedRecord);
              processedCount++;
            }
          } catch (error) {
            console.error('Error processing MM Deal record:', error);
            errorCount++;
          }
        }
        
        if (processedRecords.length > 0) {
          await this.prisma.pdr1MmDeal.createMany({
            data: processedRecords
          });
          console.log(`Inserted ${processedRecords.length} deal records`);
        }
        
        totalRecords = dealRecords.length;
      }
      
      return {
        totalRecords,
        processedRecords: processedCount,
        errorRecords: errorCount
      };
      
    } catch (error) {
      console.error('Error processing MM Deal file:', error);
      throw error;
    }
  }
  
  private async parseFile(file: Express.Multer.File, forceOutstanding: boolean = false): Promise<{
    dealRecords: any[];
    outstandingRecords: any[];
  }> {
    const workbook = XLSX.read(file.buffer, { 
      type: 'buffer',
      cellDates: true,
      dateNF: 'dd-mmm-yyyy'
    });
    
    const dealRecords = [];
    const outstandingRecords = [];
    
    console.log(`Parsing MM Deal file with ${workbook.SheetNames.length} sheets, forceOutstanding: ${forceOutstanding}`);
    console.log('Available sheets:', workbook.SheetNames);
    
    // Process each sheet
    for (const sheetName of workbook.SheetNames) {
      console.log(`Processing MM Deal sheet: ${sheetName}`);
      
      // Skip summary sheets
      if (sheetName.toLowerCase().includes('summary') || 
          sheetName.toLowerCase().includes('total')) {
        console.log(`Skipping summary sheet: ${sheetName}`);
        continue;
      }
      
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
        header: 1,
        raw: false,
        dateNF: 'dd-mmm-yyyy'
      });
      
      console.log(`Sheet ${sheetName}: ${jsonData.length} total rows`);
      
      const headerRowIndex = this.findHeaderRow(jsonData);
      if (headerRowIndex === -1) {
        console.log(`No header found in sheet: ${sheetName}`);
        continue;
      }
      
      const headers = (jsonData[headerRowIndex] as string[]).map(h => 
        h ? h.toString().toLowerCase().trim() : ''
      );
      
      console.log(`Headers found:`, headers.slice(0, 10)); // Log first 10 headers
      
      // Determine if this sheet contains outstanding data
      let isOutstandingSheet = forceOutstanding;
      
      if (!forceOutstanding) {
        // Only use automatic detection if not explicitly set
        const hasDateColumn = headers.includes('date');
        const hasOutstandingInName = sheetName.toLowerCase().includes('outstanding');
        const hasOutstandingInHeaders = headers.some(h => h.includes('outstanding'));
        
        isOutstandingSheet = hasOutstandingInName || hasOutstandingInHeaders || hasDateColumn;
        console.log(`Auto-detection: hasDate=${hasDateColumn}, hasOutstandingName=${hasOutstandingInName}, hasOutstandingHeaders=${hasOutstandingInHeaders} -> isOutstanding=${isOutstandingSheet}`);
      }
      
      console.log(`Sheet ${sheetName} will be processed as: ${isOutstandingSheet ? 'Outstanding' : 'Regular'}`);
      
      let recordCount = 0;
      for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
        const row = jsonData[i] as any[];
        if (!row || row.length === 0) continue;
        
        const record = this.mapRowToRecord(headers, row, isOutstandingSheet);
        if (record) {
          if (isOutstandingSheet) {
            outstandingRecords.push(record);
          } else {
            dealRecords.push(record);
          }
          recordCount++;
        }
      }
      
      console.log(`Sheet ${sheetName}: Processed ${recordCount} records as ${isOutstandingSheet ? 'Outstanding' : 'Regular'}`);
    }
    
    console.log(`Total parsed: ${dealRecords.length} deal records, ${outstandingRecords.length} outstanding records`);
    return { dealRecords, outstandingRecords };
  }
  
  private findHeaderRow(data: any[]): number {
    for (let i = 0; i < Math.min(data.length, 20); i++) {
      const row = data[i];
      if (!row || !Array.isArray(row)) continue;
      
      const rowStr = row.join(',').toLowerCase();
      console.log(`MM Deal Row ${i}:`, rowStr.substring(0, 150)); // Debug first 150 chars
      
      // Look for key columns that indicate this is a header row
      // For MM Deal: Deal Ref, Instrument Name, Value Date, Base Eqvlnt(Acpt-Plc)
      if ((rowStr.includes('instrument name') || rowStr.includes('deal ref')) && 
          (rowStr.includes('value date') || rowStr.includes('date')) &&
          (rowStr.includes('base eqvlnt') || rowStr.includes('principal'))) {
        console.log(`MM Deal header row detected at index ${i}`);
        return i;
      }
      
      // Alternative check for specific MM Deal columns
      if (rowStr.includes('base eqvlnt(acpt-plc)') || 
          (rowStr.includes('instrument name') && rowStr.includes('counterparty'))) {
        console.log(`MM Deal header row detected at index ${i} (alternative)`);
        return i;
      }
    }
    return -1;
  }
  
  private mapRowToRecord(headers: string[], row: any[], isOutstanding: boolean): any {
    const record: any = {};
    const mapping = isOutstanding ? MM_DEAL_OUTSTANDING_COLUMN_MAPPING : MM_DEAL_COLUMN_MAPPING;
    
    headers.forEach((header, index) => {
      const dbColumn = mapping[header];
      if (dbColumn && row[index] !== undefined) {
        const value = this.processValue(dbColumn, row[index]);
        record[dbColumn] = value;
      }
    });
    
    // For outstanding records, ensure we have the required fields
    if (isOutstanding) {
      // Ensure date field is present for outstanding records
      if (!record.date && record.valueDate) {
        record.date = record.valueDate;
      }
      
      // Ensure outstanding amount
      if (!record.outstandingAmount && record.baseEqvlnt) {
        record.outstandingAmount = record.baseEqvlnt;
      }
      
      // Must have instrumentName and date for outstanding records
      if (!record.instrumentName || !record.date) {
        return null;
      }
    } else {
      // For regular deals, ensure required fields
      if (!record.instrumentName || !record.valueDate) {
        return null;
      }
    }
    
    return record;
  }
  
  private processRecord(record: any, batchId: string): any {
    record.uploadBatchId = batchId;
    return record;
  }
  
  private processOutstandingRecord(record: any, batchId: string): any {
    record.uploadBatchId = batchId;
    
    // Ensure date field is populated
    if (!record.date && record.valueDate) {
      record.date = record.valueDate;
    }
    
    // Log sample record for debugging (1% of records)
    if (Math.random() < 0.01) {
      console.log('Sample outstanding record:', {
        instrumentName: record.instrumentName,
        date: record.date ? this.formatDate(record.date) : 'null',
        baseEqvlnt: record.baseEqvlnt,
        outstandingAmount: record.outstandingAmount
      });
    }
    
    return record;
  }
}