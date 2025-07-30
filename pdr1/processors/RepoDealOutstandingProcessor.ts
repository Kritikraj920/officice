// backend/services/pdr1/processors/RepoDealOutstandingProcessor.ts

import * as XLSX from 'xlsx';
import { PrismaClient } from '@prisma/client';
import { ProcessingResult, REPO_DEAL_OUTSTANDING_COLUMN_MAPPING } from '../pdr1Types';
import { BaseFileProcessor } from './BaseFileProcessor';

export class RepoDealOutstandingProcessor extends BaseFileProcessor {
  constructor(prisma: PrismaClient) {
    super(prisma);
    console.log('RepoDealOutstandingProcessor instantiated');
  }

  async processFile(file: Express.Multer.File, batchId: string): Promise<ProcessingResult> {
    try {
      const records = await this.parseFile(file);
      
      // Clear existing data for this batch
      await this.prisma.pdr1RepoDealOutstanding.deleteMany({
        where: { uploadBatchId: batchId }
      });
      
      const processedRecords = [];
      let errorCount = 0;
      
      for (const record of records) {
        try {
          const processedRecord = this.processRecord(record, batchId);
          if (processedRecord) {
            processedRecords.push(processedRecord);
          }
        } catch (error) {
          console.error('Error processing Repo Deal Outstanding record:', error);
          errorCount++;
        }
      }
      
      if (processedRecords.length > 0) {
        await this.prisma.pdr1RepoDealOutstanding.createMany({
          data: processedRecords,
          skipDuplicates: true
        });
      }
      
      return {
        totalRecords: records.length,
        processedRecords: processedRecords.length,
        errorRecords: errorCount
      };
      
    } catch (error) {
      console.error('Error processing Repo Deal Outstanding file:', error);
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
      // Skip summary sheets
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
        
        // Skip end of report markers
        if (row.some(cell => cell && cell.toString().includes('*** END OF THE REPORT ***'))) {
          break;
        }
        
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
      if (rowStr.includes('instrument') && 
          rowStr.includes('value date') && 
          (rowStr.includes('base settlement') || rowStr.includes('face value'))) {
        return i;
      }
    }
    return -1;
  }
  
  private mapRowToRecord(headers: string[], row: any[]): any {
    const record: any = {};
    
    headers.forEach((header, index) => {
      const dbColumn = REPO_DEAL_OUTSTANDING_COLUMN_MAPPING[header];
      if (dbColumn && row[index] !== undefined) {
        const value = this.processValue(dbColumn, row[index]);
        // Handle 'blank' values
        if (value === 'blank' || value === '') {
          record[dbColumn] = null;
        } else {
          record[dbColumn] = value;
        }
      }
    });
    
    // Ensure required fields
    if (!record.valueDate) {
      return null;
    }
    
    // For outstanding repo deals, we need the leg1 amount
    if (!record.outstandingAmountLeg1 && record.settlementAmountLeg1) {
      record.outstandingAmountLeg1 = record.settlementAmountLeg1;
    }
    
    return record;
  }
  
  private processRecord(record: any, batchId: string): any {
    // Remove remarks field temporarily to avoid schema error
    const { remarks, ...cleanRecord } = record;
    
    cleanRecord.uploadBatchId = batchId;
    
    // Ensure instrument name is uppercase for consistent filtering
    if (cleanRecord.instrument) {
      cleanRecord.instrument = cleanRecord.instrument.toUpperCase();
    }
    
    return cleanRecord;
  }
  
  protected processValue(column: string, value: any): any {
    // Handle blank values explicitly
    if (value === 'blank' || value === '' || value === null || value === undefined) {
      return null;
    }
    
    // Handle 'float' string (from your Excel analysis)
    if (value === 'float') {
      return null;
    }
    
    // Handle special date formats for tenor/repo period
    if (column === 'tenor' && typeof value === 'string') {
      const match = value.match(/(\d+)\s*Day/i);
      if (match) {
        return parseInt(match[1]);
      }
    }
    
    // Use parent class method for standard processing
    return super.processValue(column, value);
  }
}