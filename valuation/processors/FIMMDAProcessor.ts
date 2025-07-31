// backend/services/pdr1/processors/IMDealProcessor.ts

import * as XLSX from 'xlsx';
import { PrismaClient } from '@prisma/client';
import { ProcessingResult, G_SEC_COLUMN_MAPPING, FIMMDA_COLUMN_MAPPING } from '../valuationTypes';
import { BaseFileProcessor } from './BaseFileProcessor';
import { difference } from 'lodash';

export class FIMMDAProcessor extends BaseFileProcessor {
  constructor(prisma: PrismaClient) {
    super(prisma);
  }

 async processFile(file: Express.Multer.File, batchId: string): Promise<ProcessingResult> {
  try {
    const workbook = XLSX.read(file.buffer, {
      type: 'buffer',
      cellDates: true,
      dateNF: 'dd-mmm-yyyy'
    });

    const sheetsToProcess = ['details'];
    let allRecords: any[] = [];

    // Step 1: Extract and parse both sheets
    for (const sheetNameKey of sheetsToProcess) {
      const sheetName = Object.keys(workbook.Sheets).find(
        name => name.toLowerCase() === sheetNameKey
      );

      if (!sheetName) {
        console.warn(`Sheet "${sheetNameKey}" not found.`);
        continue;
      }

      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        raw: false,
        dateNF: 'dd-mmm-yyyy'
      });

      const headerRowIndex = this.findHeaderRow(jsonData);
      if (headerRowIndex === -1) {
        console.warn(`Header row not found in "${sheetNameKey}" sheet.`);
        continue;
      }

      const headers = (jsonData[headerRowIndex] as string[]).map(h =>
        h ? h.toString().toLowerCase().trim() : ''
      );

      for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
        const row = jsonData[i] as any[];
        if (!row || row.length === 0) continue;

        const record = this.mapRowToRecord(headers, row);
        if (record) {
          allRecords.push(record);
        }
      }
    }
    // Step 2: Clear old data for the batch
      await this.prisma.FIMMDA.deleteMany({ where: { uploadBatchId: batchId } });
    // Step 3: Process and insert records
    let processedRecords = 0;
    let errorRecords = 0;

    for (const record of allRecords) {
      try {
        const processedRecord = this.processRecord(record, batchId);

        
          await this.prisma.FIMMDA.create({ data: processedRecord });
          processedRecords++;
        
      } catch (error) {
        console.error('Error processing FIMDDA record:', error);
        errorRecords++;
      }
    }

    return {
      totalRecords: allRecords.length,
      processedRecords,
      errorRecords
    };

  } catch (error) {
    console.error('Error processing FIMMDA file:', error);
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
      throw new Error('Details sheet not found in FIMDDA file');
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
      throw new Error('Could not find header row in FIMMDA file');
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
    const hasMarketPrice = lowerRow.some(h => h.includes('market price'));
    const hasCategory = lowerRow.some(h => h.includes('category'));
    const hasMarketValu = lowerRow.some(h => h.includes('mp as per valuation')); 
    const hasDiffrence = lowerRow.some(h => h.includes('difference'));
    // console.log("ISIN",hasISIN,"MarketPrice",hasMarketPrice,"Category",hasCategory,"MarketValu",hasMarketValu,"diff",hasDiffrence);
    if (hasISIN && hasMarketPrice && hasCategory && hasMarketValu && hasDiffrence) {
      return i;
    }
  }
  return -1;
}
  
  private mapRowToRecord(headers: string[], row: any[]): any {
    const record: any = {};
    headers.forEach((header, index) => {
      const dbColumn = FIMMDA_COLUMN_MAPPING[header];
      if (dbColumn && row[index] !== undefined) {
        const value = this.processValue(dbColumn, row[index]);
        record[dbColumn] = value;
      }
    });
    // Ensure required fields are present
    if (!record.isin || !record.marketPrice || !record.category) {
      return null;
    }
    
    return record;
  }
  
  private processRecord(record: any, batchId: string): any {
    // Add batch ID
    record.uploadBatchId = batchId;
    // Ensure opnType is uppercase
    record={
      isin: record.isin,
      instrumentId:record.instrumentId,
      portfolio:record.portfolio,
      securityName:record.securityName,
      category:record.category,
      subCategory:record.subCategory,
      instrumentType:record.instrumentType,
      slrNslr:record.slrNslr,
      issuer:record.issuer,
      quantity:parseFloat(record.quantity),
      faceValue:parseFloat(record.faceValue),
      wap:parseFloat(record.wap),
      bookValue:parseFloat(record.bookValue),
      maturityDate:this.parseDate(record.maturityDate),
      coupon:parseFloat(record.coupon),
      marketValue:parseFloat(record.marketValue),
      marketPrice:parseFloat(record.marketPrice),
      marketPriceValuation:parseFloat(record.marketPriceValuation),
      difference:parseFloat(record.difference),
      marketYield:parseFloat(record.marketYield),
      appreciation:parseFloat(record.appreciation),
      depreciation:parseFloat(record.depreciation),
      valuationDate:this.parseDate(record.valuationDate),
      faceValuePerUnit:parseFloat(record.faceValuePerUnit),
      currentYield:parseFloat(record.currentYield),
      uploadBatchId:record.uploadBatchId,
    }
    // console.log(record);
    return record;
  }
}