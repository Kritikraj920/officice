// backend/services/pdr1/calculations/section1/CallMoney.ts

import { PrismaClient } from '@prisma/client';
import { Pdr1CalculatedValues } from '../../pdr1Types';

export class CallMoneyCalculator {
  private prisma: PrismaClient;
  private readonly DIVISION_FACTOR = 10000000; // 10^7

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async calculate(batchId: string): Promise<Pdr1CalculatedValues> {
    const results: Pdr1CalculatedValues = {};

    // 1D1 - Call Money Borrowing (includes Call, Notice, and Term Borrowing)
    results['1D1'] = await this.calculateCallMoneyBorrowing(batchId);

    console.log('Call Money Results:', {
      '1D1': Object.keys(results['1D1']).length
    });

    return results;
  }

  private async calculateCallMoneyBorrowing(batchId: string): Promise<Record<string, number>> {
    console.log('Calculating 1D1 - Call Money Borrowing (Call, Notice, Term)');
    
    // First, let's debug what data exists in MM Deals table
    const totalRecords = await this.prisma.pdr1MmDeal.count({
      where: { uploadBatchId: batchId }
    });
    console.log(`Total MM Deal records for batch: ${totalRecords}`);
    
    if (totalRecords === 0) {
      console.log('No MM Deal records found for this batch!');
      return {};
    }
    
    // Check what instrument names we have
    const allInstruments = await this.prisma.pdr1MmDeal.groupBy({
      by: ['instrumentName'],
      where: {
        uploadBatchId: batchId,
        instrumentName: { not: null }
      },
      _count: { instrumentName: true }
    });
    
    console.log('Available instrument names in MM Deals:');
    allInstruments.forEach(item => {
      console.log(`  "${item.instrumentName}": ${item._count.instrumentName} records`);
    });
    
    // Check for records with baseEqvlnt
    const recordsWithBaseEqvlnt = await this.prisma.pdr1MmDeal.count({
      where: {
        uploadBatchId: batchId,
        baseEqvlnt: { not: null }
      }
    });
    console.log(`Records with baseEqvlnt: ${recordsWithBaseEqvlnt}`);
    
    // Check for records with valueDate
    const recordsWithValueDate = await this.prisma.pdr1MmDeal.count({
      where: {
        uploadBatchId: batchId,
        valueDate: { not: null }
      }
    });
    console.log(`Records with valueDate: ${recordsWithValueDate}`);
    
    // Sample a few records to see the data
    const sampleRecords = await this.prisma.pdr1MmDeal.findMany({
      where: { uploadBatchId: batchId },
      take: 3,
      select: {
        instrumentName: true,
        valueDate: true,
        baseEqvlnt: true,
        dealNo: true
      }
    });
    
    console.log('Sample MM Deal records:');
    sampleRecords.forEach((record, index) => {
      console.log(`  ${index + 1}: ${record.instrumentName} | ${record.valueDate ? this.formatDate(record.valueDate) : 'null'} | baseEqvlnt: ${record.baseEqvlnt} | dealNo: ${record.dealNo}`);
    });
    
    // Try a broader query first to see if any call/notice/term records exist
    const broadResults = await this.prisma.$queryRaw<Array<{
      instrumentName: string | null;
      record_count: number;
      sample_baseEqvlnt: number | null;
    }>>`
    SELECT 
      "instrumentName",
      COUNT(*) as record_count,
      MAX("baseEqvlnt") as sample_baseEqvlnt
    FROM pdr1_mm_deals
    WHERE "uploadBatchId" = ${batchId}
      AND (UPPER("instrumentName") LIKE '%CALL%' 
           OR UPPER("instrumentName") LIKE '%NOTICE%' 
           OR UPPER("instrumentName") LIKE '%TERM%')
      AND "instrumentName" IS NOT NULL
    GROUP BY "instrumentName"
    ORDER BY record_count DESC
    `;
    
    console.log('Instruments containing CALL/NOTICE/TERM:');
    broadResults.forEach(result => {
      console.log(`  "${result.instrumentName}": ${result.record_count} records, sample baseEqvlnt: ${result.sample_baseEqvlnt}`);
    });
    
    if (broadResults.length === 0) {
      console.log('No instruments found containing CALL, NOTICE, or TERM');
      return {};
    }
    
    // Now try the specific calculation with exact instrument names from your data
    const results = await this.prisma.$queryRaw<Array<{
      valueDate: Date | null;
      total_amount: number | null;
      record_count: number;
      instrument_breakdown: string | null;
    }>>`
    SELECT 
      "valueDate",
      SUM("baseEqvlnt") as "total_amount",
      COUNT(*) as record_count,
      STRING_AGG(DISTINCT "instrumentName", ', ') as instrument_breakdown
    FROM pdr1_mm_deals
    WHERE "uploadBatchId" = ${batchId}
      AND "instrumentName" IN (
        'CALL BORROWING (NDS)',
        'NOTICE BORROWING (NDS)', 
        'TERM BORROWING (NDS)',
        'CALL BORROWING',
        'NOTICE BORROWING',
        'TERM BORROWING'
      )
      AND "valueDate" IS NOT NULL
      AND "baseEqvlnt" IS NOT NULL
    GROUP BY "valueDate"
    ORDER BY "valueDate" ASC
    `;
    
    console.log(`1D1 Exact Match: Found ${results.length} value dates`);
    
    // If exact match fails, try pattern matching
    if (results.length === 0) {
      console.log('Exact match failed, trying pattern matching...');
      
      const patternResults = await this.prisma.$queryRaw<Array<{
        valueDate: Date | null;
        total_amount: number | null;
        record_count: number;
        instrument_breakdown: string | null;
      }>>`
      SELECT 
        "valueDate",
        SUM("baseEqvlnt") as "total_amount",
        COUNT(*) as record_count,
        STRING_AGG(DISTINCT "instrumentName", ', ') as instrument_breakdown
      FROM pdr1_mm_deals
      WHERE "uploadBatchId" = ${batchId}
        AND (UPPER("instrumentName") LIKE '%CALL%BORROW%' OR
             UPPER("instrumentName") LIKE '%NOTICE%BORROW%' OR
             UPPER("instrumentName") LIKE '%TERM%BORROW%')
        AND "valueDate" IS NOT NULL
        AND "baseEqvlnt" IS NOT NULL
      GROUP BY "valueDate"
      ORDER BY "valueDate" ASC
      `;
      
      console.log(`1D1 Pattern Match: Found ${patternResults.length} value dates`);
      
      const formattedResults: Record<string, number> = {};
      
      patternResults.forEach(result => {
        if (result.valueDate && result.total_amount) {
          const dateStr = this.formatDate(result.valueDate);
          formattedResults[dateStr] = Math.round((result.total_amount / this.DIVISION_FACTOR) * 100) / 100;
          console.log(`1D1 - ${dateStr}: ${formattedResults[dateStr]} Cr (${result.record_count} records)`);
          console.log(`  Instruments: ${result.instrument_breakdown}`);
          console.log(`  Total Base Eqvlnt: ${result.total_amount}`);
        }
      });
      
      return formattedResults;
    }
    
    const formattedResults: Record<string, number> = {};
    
    results.forEach(result => {
      if (result.valueDate && result.total_amount) {
        const dateStr = this.formatDate(result.valueDate);
        formattedResults[dateStr] = Math.round((result.total_amount / this.DIVISION_FACTOR) * 100) / 100;
        console.log(`1D1 - ${dateStr}: ${formattedResults[dateStr]} Cr (${result.record_count} records)`);
        console.log(`  Instruments: ${result.instrument_breakdown}`);
        console.log(`  Total Base Eqvlnt: ${result.total_amount}`);
      }
    });
    
    console.log(`1D1 Results: ${Object.keys(formattedResults).length} dates`);
    return formattedResults;
  }

  private formatDate(date: Date): string {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const day = date.getUTCDate().toString().padStart(2, '0');
    const month = months[date.getUTCMonth()];
    const year = date.getUTCFullYear();
    return `${day}-${month}-${year}`;
  }
}