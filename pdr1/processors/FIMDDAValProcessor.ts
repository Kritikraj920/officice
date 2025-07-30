// backend/services/pdr1/processors/FIMDDAValProcessor.ts

import * as XLSX from 'xlsx';
import { PrismaClient } from '@prisma/client';
import { ProcessingResult, FIMMDA_VAL_COLUMN_MAPPING } from '../pdr1Types';
import { BaseFileProcessor } from './BaseFileProcessor';

export class FIMDDAValProcessor extends BaseFileProcessor {
  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  async processFile(file: Express.Multer.File, batchId: string): Promise<ProcessingResult> {
    try {
      const records = await this.parseFile(file);
      
      // Clear existing data for this batch
      await this.prisma.pdr1FimmdaVal.deleteMany({
        where: { uploadBatchId: batchId }
      });
      
      const processedRecords = [];
      let errorCount = 0;
      
      // Extract value date from file or use current date
      const valueDate = this.extractValueDate(records) || new Date();
      
      for (const record of records) {
        try {
          const processedRecord = this.processRecord(record, batchId, valueDate);
          if (processedRecord) {
            processedRecords.push(processedRecord);
          }
        } catch (error) {
          console.error('Error processing FIMMDA Val record:', error);
          errorCount++;
        }
      }
      
      if (processedRecords.length > 0) {
        await this.prisma.pdr1FimmdaVal.createMany({
          data: processedRecords
        });
      }
      
      return {
        totalRecords: records.length,
        processedRecords: processedRecords.length,
        errorRecords: errorCount
      };
      
    } catch (error) {
      console.error('Error processing FIMMDA Val file:', error);
      throw error;
    }
  }
  
  private async parseFile(file: Express.Multer.File): Promise<any[]> {
    const workbook = XLSX.read(file.buffer, { 
      type: 'buffer',
      cellDates: true,
      dateNF: 'dd-mmm-yyyy'
    });
    
    const records = [];
    
    // Process each sheet
    for (const sheetName of workbook.SheetNames) {
      // Skip non-data sheets
      if (sheetName.toLowerCase().includes('summary') || 
          sheetName.toLowerCase().includes('total')) {
        continue;
      }
      
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
        header: 1,
        raw: false,
        dateNF: 'dd-mmm-yyyy'
      });
      
      const headerRowIndex = this.findHeaderRow(jsonData);
      if (headerRowIndex === -1) continue;
      
      const headers = (jsonData[headerRowIndex] as string[]).map(h => 
        h ? h.toString().toLowerCase().trim() : ''
      );
      
      for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
        const row = jsonData[i] as any[];
        if (!row || row.length === 0) continue;
        
        const record = this.mapRowToRecord(headers, row);
        if (record) {
          records.push(record);
        }
      }
    }
    
    return records;
  }
  
  private findHeaderRow(data: any[]): number {
    for (let i = 0; i < Math.min(data.length, 20); i++) {
      const row = data[i];
      if (!row || !Array.isArray(row)) continue;
      
      const rowStr = row.join(',').toLowerCase();
      if ((rowStr.includes('security') || rowStr.includes('isin')) && 
          rowStr.includes('portfolio') && 
          (rowStr.includes('book value') || rowStr.includes('market value'))) {
        return i;
      }
    }
    return -1;
  }
  
  private mapRowToRecord(headers: string[], row: any[]): any {
    const record: any = {};
    
    headers.forEach((header, index) => {
      const dbColumn = FIMMDA_VAL_COLUMN_MAPPING[header];
      if (dbColumn && row[index] !== undefined) {
        const value = this.processValue(dbColumn, row[index]);
        record[dbColumn] = value;
      }
    });
    
    // Ensure required fields
    if (!record.identificationNo || !record.portfolio) {
      return null;
    }
    
    return record;
  }
  
  private processRecord(record: any, batchId: string, valueDate: Date): any {
    record.uploadBatchId = batchId;
    
    // Add value date if not present
    if (!record.valueDate) {
      record.valueDate = valueDate;
    }
    
    return record;
  }
  
  private extractValueDate(records: any[]): Date | null {
    // Try to extract value date from the first valid record
    for (const record of records) {
      if (record.valueDate) {
        return record.valueDate;
      }
    }
    return null;
  }
}