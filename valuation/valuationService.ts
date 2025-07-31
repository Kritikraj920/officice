import { PrismaClient } from '@prisma/client';
import { 
  ValuationProcessResult, 
  UploadedFiles,
  ValuationCalculatedValues 
} from './valuationTypes';
import { GSECProcessor } from './processors/GSECProcessor';
import { FIMMDAProcessor } from './processors/FIMMDAProcessor';
import { SDLProcessor } from './processors/SDLProcessor';

const prisma = new PrismaClient();

export class ValuationService{
  private G_SecProcessor: GSECProcessor;
  private SDLProcessor: SDLProcessor;
  private FIMMDAProcessor: FIMMDAProcessor;

  constructor(){
    this.G_SecProcessor = new GSECProcessor(prisma);
    this.SDLProcessor = new SDLProcessor(prisma);
    this.FIMMDAProcessor = new FIMMDAProcessor(prisma);
  }
    async ProcessFiles(files: UploadedFiles, userId?: string): Promise<ValuationProcessResult> {
      const startTime = Date.now();
      
      // Create processing batch
      const batch = await prisma.ValuationProcessingBatch.create({
        data: {
          uploadedBy: userId?.toString() || null,
          status: 'uploading'
        }
      });
  
      try {
        // Update batch status
        await prisma.ValuationProcessingBatch.update({
          where: { id: batch.id },
          data: { 
            status: 'processing',
            processingStartedAt: new Date()
          }
        });
  
        // Process each file type
        const processingResults = await this.processAllFiles(files, batch.id);
        console.log("Processing Result",processingResults);
        // Run all calculations
        console.log('Running PDR1 calculations...');
        // const calculatedData = await this.runAllCalculations(batch.id);
        // console.log("calculated Data" ,calculatedData)
        
        // Get unique dates from all processed data
        // const dealDates = await this.getUniqueDates();
        
        // Save calculated results to database
        // await this.saveCalculatedResults(batch.id, calculatedData);
        
        // Update batch status
        // await prisma.pdr1ProcessingBatch.update({
        //   where: { id: batch.id },
        //   data: {
        //     status: 'completed',
        //     processingCompletedAt: new Date(),
        //     totalRecords: processingResults.totalRecords,
        //     processedRecords: processingResults.processedRecords,
        //     errorRecords: processingResults.errorRecords
        //   }
        // });
  
        const processingTime = Date.now() - startTime;
  
        return {
          success: true,
          batchId: batch.id,
          summary: {
            totalRecords: processingResults.totalRecords,
            processedRecords: processingResults.processedRecords,
            errorRecords: processingResults.errorRecords,
            processingTime
          }
        };
  
      } catch (error:any) {
        // Update batch status on error
        await prisma.ValuationProcessingBatch.update({
          where: { id: batch.id },
          data: {
            status: 'failed',
            errors: { message: error.message, stack: error.stack }
          }
        });
  
        console.error('Error processing Valutaion files:', error);
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
    
        console.log('Processing Valuation files in processallfiles:', Object.keys(files).filter((k) => files[k]));
    
        // Process IM Deal file 
        if (files.G_SEC) {
          console.log('Processing G_SEC Deal file...');
          const result = await this.G_SecProcessor.processFile(files.G_SEC, batchId);
          totalRecords += result.totalRecords;
          processedRecords += result.processedRecords;
          errorRecords += result.errorRecords;
          
          await prisma.ValuationProcessingBatch.update({
            where: { id: batchId },
            data: { gsecFileUploaded: true }
          });
        }
        if (files.SDL) {
          console.log('Processing SDL Deal file...');
          const result = await this.SDLProcessor.processFile(files.SDL, batchId);
          totalRecords += result.totalRecords;
          processedRecords += result.processedRecords;
          errorRecords += result.errorRecords;
          
          await prisma.ValuationProcessingBatch.update({
            where: { id: batchId },
            data: { sdlFileUploaded: true }
          });
        }
        if (files.FIMMDA_VAL) {
          console.log('Processing FIMDDA Deal file...');
          const result = await this.FIMMDAProcessor.processFile(files.FIMMDA_VAL, batchId);
          totalRecords += result.totalRecords;
          processedRecords += result.processedRecords;
          errorRecords += result.errorRecords;
          
          await prisma.ValuationProcessingBatch.update({
            where: { id: batchId },
            data: { fimmdaFileUploaded: true }
          });
        }
        return { totalRecords, processedRecords, errorRecords };
}
}
