// backend/services/pdr1/processors/RepoDealProcessor.ts

import * as XLSX from 'xlsx';
import { PrismaClient } from '@prisma/client';
import { ProcessingResult, REPO_DEAL_COLUMN_MAPPING } from '../pdr1Types';
import { BaseFileProcessor } from './BaseFileProcessor';

export class RepoDealProcessor extends BaseFileProcessor {
  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  async processFile(file: Express.Multer.File, batchId: string): Promise<ProcessingResult> {
    try {
      const records = await this.parseFile(file);
      
      // Clear existing data for this batch
      await this.prisma.pdr1RepoDeal.deleteMany({
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
          console.error('Error processing Repo Deal record:', error);
          errorCount++;
        }
      }
      
      if (processedRecords.length > 0) {
        await this.prisma.pdr1RepoDeal.createMany({
          data: processedRecords
        });
      }
      
      return {
        totalRecords: records.length,
        processedRecords: processedRecords.length,
        errorRecords: errorCount
      };
      
    } catch (error) {
      console.error('Error processing Repo Deal file:', error);
      throw error;
    }
  }
  
  private async parseFile(file: Express.Multer.File): Promise<any[]> {
    const workbook = XLSX.read(file.buffer, { 
      type: 'buffer',
      cellDates: true,
      dateNF: 'dd-mmm-yyyy'
    });
    
    console.log('Available sheets:', workbook.SheetNames);
    
    // Find the "Detail" sheet (note: not "Details")
    const sheetName = workbook.SheetNames.find(name => 
      name.toLowerCase() === 'detail' || 
      name.toLowerCase() === 'details'
    ) || workbook.SheetNames[0];
    
    console.log(`Processing sheet: ${sheetName}`);
    
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
      header: 1,
      raw: false,
      dateNF: 'dd-mmm-yyyy'
    });
    
    console.log(`Total rows in sheet: ${jsonData.length}`);
    
    // Find header row
    const headerRowIndex = this.findHeaderRow(jsonData);
    console.log(`Header row found at index: ${headerRowIndex}`);
    
    if (headerRowIndex === -1) {
      // Debug: show first few rows to understand structure
      console.log('First 5 rows for debugging:');
      jsonData.slice(0, 5).forEach((row, index) => {
        console.log(`Row ${index}:`, row);
      });
      throw new Error('Could not find header row in Repo Deal file');
    }
    
    // Extract headers
    const headers = (jsonData[headerRowIndex] as string[]).map(h => 
      h ? h.toString().toLowerCase().trim() : ''
    );
    
    console.log('Found headers:', headers.slice(0, 10)); // Show first 10 headers
    
    // Process data rows
    const records = [];
    for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
      const row = jsonData[i] as any[];
      if (!row || row.length === 0) continue;
      
      // Skip end of report markers
      if (row.some(cell => cell && cell.toString().includes('*** END OF THE REPORT ***'))) {
        console.log(`Stopping at row ${i} - found end of report marker`);
        break;
      }
      
      const record = this.mapRowToRecord(headers, row);
      if (record) {
        records.push(record);
      }
    }
    
    console.log(`Parsed ${records.length} records from Repo Deal file`);
    return records;
  }
  
  private findHeaderRow(data: any[]): number {
    for (let i = 0; i < Math.min(data.length, 20); i++) {
      const row = data[i];
      if (!row || !Array.isArray(row)) continue;
      
      const rowStr = row.join(',').toLowerCase();
      console.log(`Row ${i}:`, rowStr.substring(0, 100)); // Debug first 100 chars
      
      // Look for key columns that indicate this is a header row
      // Based on your file structure: Deal Ref, Instrument, Value Date, Face Value
      if ((rowStr.includes('deal ref') || rowStr.includes('deal reference')) && 
          rowStr.includes('instrument') && 
          rowStr.includes('value date')) {
        console.log(`Header row detected at index ${i}`);
        return i;
      }
      
      // Alternative check for repo-specific headers
      if (rowStr.includes('settlement amt leg1') && 
          rowStr.includes('face value') && 
          rowStr.includes('instrument')) {
        console.log(`Repo header row detected at index ${i}`);
        return i;
      }
    }
    return -1;
  }
  
  private mapRowToRecord(headers: string[], row: any[]): any {
    const record: any = {};
    
    // Valid database columns for Pdr1RepoDeal
    const validColumns = [
      'dealNo', 'instrument', 'securityName', 'isin', 'dealDate', 
      'valueDate', 'maturityDate', 'faceValue', 'leg1Price', 'leg2Price', 
      'rate', 'tenor', 'settlementAmountLeg1', 'settlementAmountLeg2',
      'counterparty', 'remarks'
    ];
    
    headers.forEach((header, index) => {
      const dbColumn = REPO_DEAL_COLUMN_MAPPING[header];
      if (dbColumn && validColumns.includes(dbColumn) && row[index] !== undefined) {
        const value = this.processValue(dbColumn, row[index]);
        // Handle 'blank' values explicitly
        if (value === 'blank' || value === '') {
          record[dbColumn] = null;
        } else {
          record[dbColumn] = value;
        }
      }
    });
    
    // Ensure required fields
    if (!record.instrument || !record.valueDate) {
      return null;
    }
    
    // Calculate settlement amounts if not provided
    if (!record.settlementAmountLeg1 && record.faceValue && record.leg1Price) {
      record.settlementAmountLeg1 = record.faceValue * record.leg1Price / 100;
    }
    
    if (!record.settlementAmountLeg2 && record.faceValue && record.leg2Price) {
      record.settlementAmountLeg2 = record.faceValue * record.leg2Price / 100;
    }
    
    return record;
  }
  
  private processRecord(record: any, batchId: string): any {
    record.uploadBatchId = batchId;
    
    // Handle repo period conversion (e.g., "1 Day" -> 1)
    if (record.tenor && typeof record.tenor === 'string') {
      const match = record.tenor.match(/(\d+)\s*Day/i);
      if (match) {
        record.tenor = parseInt(match[1]);
      }
    }
    
    return record;
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
    
    // Use parent class method for standard processing
    return super.processValue(column, value);
  }
}