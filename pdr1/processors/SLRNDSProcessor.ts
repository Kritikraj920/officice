// backend/services/pdr1/processors/SLRNDSProcessor.ts

import * as XLSX from 'xlsx';
import { PrismaClient } from '@prisma/client';
import { ProcessingResult, SLR_NDS_COLUMN_MAPPING } from '../pdr1Types';
import { BaseFileProcessor } from './BaseFileProcessor';

export class SLRNDSProcessor extends BaseFileProcessor {
  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  async processFile(file: Express.Multer.File, batchId: string): Promise<ProcessingResult> {
    try {
      const records = await this.parseFile(file);
      
      // Clear existing data for this batch
      await this.prisma.pdr1SlrNds.deleteMany({
        where: { uploadBatchId: batchId }
      });
      
      const processedRecords = [];
      let errorCount = 0;
      
      // Extract value date
      const valueDate = this.extractValueDate(records) || new Date();
      
      for (const record of records) {
        try {
          const processedRecord = this.processRecord(record, batchId, valueDate);
          if (processedRecord) {
            processedRecords.push(processedRecord);
          }
        } catch (error) {
          console.error('Error processing SLR NDS record:', error);
          errorCount++;
        }
      }
      
      if (processedRecords.length > 0) {
        await this.prisma.pdr1SlrNds.createMany({
          data: processedRecords
        });
      }
      
      return {
        totalRecords: records.length,
        processedRecords: processedRecords.length,
        errorRecords: errorCount
      };
      
    } catch (error) {
      console.error('Error processing SLR NDS file:', error);
      throw error;
    }
  }
  
  private async parseFile(file: Express.Multer.File): Promise<any[]> {
    const workbook = XLSX.read(file.buffer, { 
      type: 'buffer',
      cellDates: true,
      dateNF: 'dd-mmm-yyyy'
    });
    
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
      header: 1,
      raw: false,
      dateNF: 'dd-mmm-yyyy'
    });
    
    const headerRowIndex = this.findHeaderRow(jsonData);
    if (headerRowIndex === -1) {
      throw new Error('Could not find header row in SLR NDS file');
    }
    
    const headers = (jsonData[headerRowIndex] as string[]).map(h => 
      h ? h.toString().toLowerCase().trim() : ''
    );
    
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
      
      const rowStr = row.join(',').toLowerCase();
      if (rowStr.includes('isin') && 
          rowStr.includes('instrument') && 
          (rowStr.includes('repo') || rowStr.includes('own stock'))) {
        return i;
      }
    }
    return -1;
  }
  
  private mapRowToRecord(headers: string[], row: any[]): any {
    const record: any = {};
    
    headers.forEach((header, index) => {
      const dbColumn = SLR_NDS_COLUMN_MAPPING[header];
      if (dbColumn && row[index] !== undefined) {
        const value = this.processValue(dbColumn, row[index]);
        record[dbColumn] = value;
      }
    });
    
    // Ensure required fields
    if (!record.isin || !record.instrumentName) {
      return null;
    }
    
    // Calculate total pledged if not provided
    if (record.totalPledged === null || record.totalPledged === undefined) {
      record.totalPledged = (record.repo || 0) + 
                           (record.rbiRefinance || 0) + 
                           (record.collateral || 0) + 
                           (record.lien || 0) + 
                           (record.sgf || 0) + 
                           (record.derivative || 0) + 
                           (record.treps || 0) + 
                           (record.deflt || 0);
    }
    
    // Calculate net position if not provided
    if (record.netPosition === null || record.netPosition === undefined) {
      record.netPosition = (record.ownStock || 0) - (record.totalPledged || 0);
    }
    
    return record;
  }
  
  private processRecord(record: any, batchId: string, valueDate: Date): any {
    record.uploadBatchId = batchId;
    
    // Add value date if not present
    if (!record.valueDate) {
      record.valueDate = valueDate;
    }
    
    // Convert values from lakhs to absolute units if needed
    // SLR files typically have values in lakhs
    const fieldsInLakhs = [
      'ownStock', 'repo', 'rbiRefinance', 'collateral', 
      'lien', 'sgf', 'derivative', 'treps', 'deflt',
      'totalPledged', 'netPosition'
    ];
    
    fieldsInLakhs.forEach(field => {
      if (record[field] !== null && record[field] !== undefined) {
        record[field] = record[field] * 100000; // Convert lakhs to absolute
      }
    });
    
    return record;
  }
  
  private extractValueDate(records: any[]): Date | null {
    for (const record of records) {
      if (record.valueDate) {
        return record.valueDate;
      }
    }
    return null;
  }
}