import { PrismaClient } from '@prisma/client';
import { 
  ValuationProcessResult, 
  UploadedFiles,
  ValuationCalculatedValues 
} from './valuationTypes';
import { GSECProcessor } from './processors/GSECProcessor';

const prisma = new PrismaClient();

export class valuationService{
  private G_SecProcessor: GSECProcessor;

  constructor(){
    this.G_SecProcessor = new GSECProcessor(prisma);
  }
    async processFiles(files: UploadedFiles, userId?: string): Promise<ValuationProcessResult> {
      const startTime = Date.now();
      
      // Create processing batch
      // const batch = await prisma.pdr1ProcessingBatch.create({
      //   data: {
      //     uploadedBy: userId?.toString() || null,
      //     status: 'uploading'
      //   }
      // });
  
      // try {
      //   // Update batch status
      //   await prisma.pdr1ProcessingBatch.update({
      //     where: { id: batch.id },
      //     data: { 
      //       status: 'processing',
      //       processingStartedAt: new Date()
      //     }
      //   });
  
      //   // Process each file type
      //   const processingResults = await this.processAllFiles(files, batch.id);
        
      //   // Run all calculations
      //   console.log('Running PDR1 calculations...');
      //   const calculatedData = await this.runAllCalculations(batch.id);
      //   console.log("calculated Data" ,calculatedData)
        
      //   // Get unique dates from all processed data
      //   const dealDates = await this.getUniqueDates();
        
      //   // Save calculated results to database
      //   // await this.saveCalculatedResults(batch.id, calculatedData);
        
      //   // Update batch status
      //   // await prisma.pdr1ProcessingBatch.update({
      //   //   where: { id: batch.id },
      //   //   data: {
      //   //     status: 'completed',
      //   //     processingCompletedAt: new Date(),
      //   //     totalRecords: processingResults.totalRecords,
      //   //     processedRecords: processingResults.processedRecords,
      //   //     errorRecords: processingResults.errorRecords
      //   //   }
      //   // });
  
      //   const processingTime = Date.now() - startTime;
  
      //   return {
      //     success: true,
      //     batchId: batch.id,
      //     summary: {
      //       totalRecords: processingResults.totalRecords,
      //       processedRecords: processingResults.processedRecords,
      //       errorRecords: processingResults.errorRecords,
      //       processingTime
      //     },
      //     processedData: calculatedData,
      //     dealDates: dealDates.map(date => this.formatDate(date))
      //   };
  
      // } catch (error:any) {
      //   // Update batch status on error
      //   // await prisma.pdr1ProcessingBatch.update({
      //   //   where: { id: batch.id },
      //   //   data: {
      //   //     status: 'failed',
      //   //     errors: { message: error.message, stack: error.stack }
      //   //   }
      //   // });
  
      //   console.error('Error processing Valutaion files:', error);
      //   throw error;
      // }
    }
}
