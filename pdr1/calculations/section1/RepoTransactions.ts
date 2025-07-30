// backend/services/pdr1/calculations/section1/RepoTransactions.ts

import { PrismaClient } from '@prisma/client';
import { Pdr1CalculatedValues } from '../../pdr1Types';

export class RepoTransactionsCalculator {
  private prisma: PrismaClient;
  private readonly DIVISION_FACTOR = 10000000; // 10^7

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async calculate(batchId: string): Promise<Pdr1CalculatedValues> {
    const results: Pdr1CalculatedValues = {};

    // 1C1 - Borrowing from Market
    results['1C1'] = await this.calculateBorrowingFromMarket(batchId);
    
    // 1C2 - Lending to RBI (Market Reverse Repo)
    results['1C2'] = await this.calculateLendingToRBI(batchId);

    console.log('Repo Transactions Results:', {
      '1C1': Object.keys(results['1C1']).length,
      '1C2': Object.keys(results['1C2']).length
    });

    return results;
  }

  private async calculateBorrowingFromMarket(batchId: string): Promise<Record<string, number>> {
    console.log('Calculating 1C1 - Borrowing from Market (Market Repo)');
    
    // First, let's debug what instruments we have
    const allInstruments = await this.prisma.pdr1RepoDeal.groupBy({
      by: ['instrument'],
      where: {
        uploadBatchId: batchId,
        instrument: { not: null }
      },
      _count: { instrument: true }
    });
    
    console.log('Available instruments in Repo Deals for 1C1:');
    allInstruments.forEach(item => {
      const name = item.instrument?.toLowerCase() || '';
      if (name.includes('market') && name.includes('repo') && !name.includes('reverse')) {
        console.log(`  MATCH: "${item.instrument}": ${item._count.instrument} records`);
      } else {
        console.log(`  "${item.instrument}": ${item._count.instrument} records`);
      }
    });
    
    // Calculate Face Value * Leg1 Price for Market Repo transactions
    const results = await this.prisma.$queryRaw<Array<{
      valueDate: Date | null;
      total_amount: number | null;
      record_count: number;
    }>>`
    SELECT 
      "valueDate",
      SUM("faceValue" * "leg1Price" / 100) as "total_amount",
      COUNT(*) as record_count
    FROM pdr1_repo_deals
    WHERE "uploadBatchId" = ${batchId}
      AND ("instrument" = 'MARKET REPO' 
           OR "instrument" = 'Market Repo'
           OR UPPER("instrument") = 'MARKET REPO')
      AND "valueDate" IS NOT NULL
      AND "faceValue" IS NOT NULL
      AND "leg1Price" IS NOT NULL
    GROUP BY "valueDate"
    ORDER BY "valueDate" ASC
    `;
    
    console.log(`1C1: Found ${results.length} value dates for Market Repo`);
    
    const formattedResults: Record<string, number> = {};
    
    results.forEach(result => {
      if (result.valueDate && result.total_amount) {
        const dateStr = this.formatDate(result.valueDate);
        // Convert to crores
        formattedResults[dateStr] = Math.round((result.total_amount / this.DIVISION_FACTOR) * 100) / 100;
        console.log(`1C1 - ${dateStr}: ${formattedResults[dateStr]} Cr (${result.record_count} records, total: ${result.total_amount})`);
      }
    });
    
    console.log(`1C1 Results: ${Object.keys(formattedResults).length} dates`);
    return formattedResults;
  }

  private async calculateLendingToRBI(batchId: string): Promise<Record<string, number>> {
    console.log('Calculating 1C2 - Lending to RBI (Market Reverse Repo)');
    
    // Debug available instruments for reverse repo
    const allInstruments = await this.prisma.pdr1RepoDeal.groupBy({
      by: ['instrument'],
      where: {
        uploadBatchId: batchId,
        instrument: { not: null }
      },
      _count: { instrument: true }
    });
    
    console.log('Available instruments in Repo Deals for 1C2:');
    allInstruments.forEach(item => {
      const name = item.instrument?.toLowerCase() || '';
      if (name.includes('reverse') && name.includes('repo')) {
        console.log(`  MATCH: "${item.instrument}": ${item._count.instrument} records`);
      } else {
        console.log(`  "${item.instrument}": ${item._count.instrument} records`);
      }
    });
    
    // Calculate Face Value * Leg1 Price for Market Reverse Repo transactions
    const results = await this.prisma.$queryRaw<Array<{
      valueDate: Date | null;
      total_amount: number | null;
      record_count: number;
    }>>`
    SELECT 
      "valueDate",
      SUM("faceValue" * "leg1Price" / 100) as "total_amount",
      COUNT(*) as record_count
    FROM pdr1_repo_deals
    WHERE "uploadBatchId" = ${batchId}
      AND ("instrument" = 'MARKET REVERSE REPO' 
           OR "instrument" = 'Market Reverse Repo'
           OR UPPER("instrument") = 'MARKET REVERSE REPO')
      AND "valueDate" IS NOT NULL
      AND "faceValue" IS NOT NULL
      AND "leg1Price" IS NOT NULL
    GROUP BY "valueDate"
    ORDER BY "valueDate" ASC
    `;
    
    console.log(`1C2: Found ${results.length} value dates for Market Reverse Repo`);
    
    const formattedResults: Record<string, number> = {};
    
    results.forEach(result => {
      if (result.valueDate && result.total_amount) {
        const dateStr = this.formatDate(result.valueDate);
        // Convert to crores
        formattedResults[dateStr] = Math.round((result.total_amount / this.DIVISION_FACTOR) * 100) / 100;
        console.log(`1C2 - ${dateStr}: ${formattedResults[dateStr]} Cr (${result.record_count} records, total: ${result.total_amount})`);
      }
    });
    
    console.log(`1C2 Results: ${Object.keys(formattedResults).length} dates`);
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