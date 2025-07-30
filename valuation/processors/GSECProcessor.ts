// backend/services/pdr1/processors/IMDealProcessor.ts

import * as XLSX from 'xlsx';
import { PrismaClient } from '@prisma/client';
import { ProcessingResult, G_SEC_COLUMN_MAPPING } from '../valuationTypes';
import { BaseFileProcessor } from './BaseFileProcessor';

export class GSECProcessor extends BaseFileProcessor {
  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  async processFile(file: Express.Multer.File, batchId: string): Promise<ProcessingResult> {
    try {
      // Parse Excel file
      const records = await this.parseFile(file);
      
      // Clear existing data for this batch
      await this.prisma.G_Sec.deleteMany({
        where: { uploadBatchId: batchId }
      });
      
      // Insert new records
      const processedRecords = [];
      let errorCount = 0;
      for (const record of records) {
        try {
          const processedRecord = this.processRecord(record, batchId);
          if (processedRecord) {
            processedRecords.push(processedRecord);
          }
        } catch (error) {
          console.error('Error processing G_SEC record:', error);
          errorCount++;
        }
      }
      
      // Bulk insert

        for (const record of processedRecords) {
          const existing = await this.prisma.G_Sec.findUnique({
            where: { isin: record.isin } // Assuming ISIN is a unique field
          });

          if (!existing) {
            await this.prisma.G_Sec.create({
              data: record
            });
          }
        } 
      return {
        totalRecords: records.length,
        processedRecords: processedRecords.length,
        errorRecords: errorCount
      };
      
    } catch (error) {
      console.error('Error processing IM Deal file:', error);
      throw error;
    }
  }
  
  private async parseFile(file: Express.Multer.File): Promise<any[]> {
    const workbook = XLSX.read(file.buffer, { 
      type: 'buffer',
      cellDates: true,
      dateNF: 'dd-mmm-yyyy'
    });
    // Find the "Details" sheet
    const sheetName = Object.keys(workbook.Sheets).find(
      name => name.toLowerCase() === 'g-sec'
    );
    if (!sheetName) {
      throw new Error('Details sheet not found in G_SEC file');
    }
    
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
      header: 1,
      raw: false,
      dateNF: 'dd-mmm-yyyy'
    });
    // Find header row
    const headerRowIndex = this.findHeaderRow(jsonData);
    if (headerRowIndex === -1) {
      throw new Error('Could not find header row in IM Deal file');
    }
    
    
    // Extract headers
    const headers = (jsonData[headerRowIndex] as string[]).map(h => 
      h ? h.toString().toLowerCase().trim() : ''
    );
    // Process data row
    const records = [];
    for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
      const row = jsonData[i] as any[];
      if (!row || row.length === 0) continue;
      const record = this.mapRowToRecord(headers, row);
      if (record) {
        records.push(record);
      }
    }

    return records;
  }
  
  private findHeaderRow(data: any[]): number {
  for (let i = 0; i < Math.min(data.length, 20); i++) {
    const row = data[i];
    if (!row || !Array.isArray(row)) continue;

    const lowerRow = row.map(cell =>
      cell ? cell.toString().toLowerCase().trim() : ''
    );

    const hasISIN = lowerRow.some(h => h.includes('isin'));
    const hasPrice = lowerRow.some(h => h.includes('price'));
    const hasMaturity = lowerRow.some(h => h.includes('maturity'));
  
    const hasYTM = lowerRow.some(h => h.includes('ytm')); 
    if (hasISIN && hasPrice && hasMaturity && hasYTM) {
      return i;
    }
  }
  return -1;
}
  
  private mapRowToRecord(headers: string[], row: any[]): any {
    const record: any = {};
    headers.forEach((header, index) => {
      const dbColumn = G_SEC_COLUMN_MAPPING[header];
      if (dbColumn && row[index] !== undefined) {
        const value = this.processValue(dbColumn, row[index]);
        record[dbColumn] = value;
      }
    });
    // Ensure required fields are present
    if (!record.ISIN || !record.Coupon || !record.Price) {
      return null;
    }
    
    return record;
  }
  
  private processRecord(record: any, batchId: string): any {
    // Add batch ID
    record.uploadBatchId = batchId;
    
    // Ensure opnType is uppercase
    record={
      isin: record.ISIN,
      coupon: parseFloat(record.Coupon),
      priceRs: parseFloat(record.Price),
      ytm: parseFloat(record.YTM),
      maturityDate:this.parseDate(record.Maturity),
      uploadBatchId:record.uploadBatchId,
    }
    
    return record;
  }
}