// backend/services/pdr1/calculations/section2/ApplicationOfFunds.ts

import { PrismaClient, Prisma } from '@prisma/client';
import { Pdr1CalculatedValues } from '../../pdr1Types';

export class ApplicationOfFundsCalculator {
  private prisma: PrismaClient;
  private readonly DIVISION_FACTOR = 10000000; // 10^7 for FIMMDA Val
  private readonly LAKHS_FACTOR = 100; // For SLR files

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async calculate(batchId: string): Promise<Pdr1CalculatedValues> {
    const results: Pdr1CalculatedValues = {};

    // 2B1 - Government Securities and Treasury bills (Book Value)
    // 2B1a1 - Dated Gsec (excluding IIBs)
    results['2B1a1'] = await this.calculateDatedGsec(batchId);
    
    // 2B1a2 - SDL
    results['2B1a2'] = await this.calculateSDL(batchId);
    
    // 2B1a3 - 91 Day T Bills
    results['2B1a3'] = await this.calculateTBills(batchId, 91);
    
    // 2B1a4 - 182 Day T Bills
    results['2B1a4'] = await this.calculateTBills(batchId, 182);
    
    // 2B1a5 - 364 Day T Bills
    results['2B1a5'] = await this.calculateTBills(batchId, 364);
    
    // 2B1b - Stock with RBI under Assured Support
    results['2B1b'] = await this.calculateStockWithRBIAssured(batchId);
    
    // 2B1c - Stock with market for repo borrowing
    results['2B1c'] = await this.calculateStockWithMarketRepo(batchId);

    // Other sections would be implemented similarly...

    return results;
  }

  private async calculateDatedGsec(batchId: string): Promise<Record<string, number>> {
    // Step 1: Get book values from FIMMDA Val
    const bookValues = await this.prisma.pdr1FimmdaVal.groupBy({
      by: ['valueDate'],
      where: {
        uploadBatchId: batchId,
        category: {
          equals: 'Central Government Bond',
          mode: 'insensitive'
        },
        portfolio: {
          equals: 'FVLG',
          mode: 'insensitive'
        },
        valueDate: { not: null },
        bookValue: { not: null }
      },
      _sum: {
        bookValue: true
      },
      orderBy: {
        valueDate: 'asc'
      }
    });

    // Step 2: Calculate pledge amounts from SLR data
    const pledgeAmounts = await this.calculatePledgeAmounts(batchId, 'GOVT');

    // Step 3: Calculate final values (Book Value - Pledge)
    const results: Record<string, number> = {};

    for (const record of bookValues) {
      if (record.valueDate && record._sum.bookValue) {
        const dateStr = this.formatDate(record.valueDate);
        const bookVal = record._sum.bookValue;
        const pledge = pledgeAmounts[dateStr] || 0;
        
        // Convert to crores
        results[dateStr] = Math.round(((bookVal - pledge) / this.DIVISION_FACTOR) * 100) / 100;
      }
    }

    return results;
  }

  private async calculateSDL(batchId: string): Promise<Record<string, number>> {
    const bookValues = await this.prisma.pdr1FimmdaVal.groupBy({
      by: ['valueDate'],
      where: {
        uploadBatchId: batchId,
        category: {
          equals: 'State Government Bond',
          mode: 'insensitive'
        },
        portfolio: {
          in: ['FVLG', 'AMRT', 'NC/NNC'],
          mode: 'insensitive'
        },
        valueDate: { not: null },
        bookValue: { not: null }
      },
      _sum: {
        bookValue: true
      },
      orderBy: {
        valueDate: 'asc'
      }
    });

    const pledgeAmounts = await this.calculatePledgeAmounts(batchId, 'SDL');

    const results: Record<string, number> = {};

    for (const record of bookValues) {
      if (record.valueDate && record._sum.bookValue) {
        const dateStr = this.formatDate(record.valueDate);
        const bookVal = record._sum.bookValue;
        const pledge = pledgeAmounts[dateStr] || 0;
        
        results[dateStr] = Math.round(((bookVal - pledge) / this.DIVISION_FACTOR) * 100) / 100;
      }
    }

    return results;
  }

  private async calculateTBills(batchId: string, days: number): Promise<Record<string, number>> {
    const subCategory = `${days} DAYS TBILL`;
    
    const bookValues = await this.prisma.pdr1FimmdaVal.groupBy({
      by: ['valueDate'],
      where: {
        uploadBatchId: batchId,
        category: {
          equals: 'Treasury Bills',
          mode: 'insensitive'
        },
        subCategory: {
          equals: subCategory,
          mode: 'insensitive'
        },
        portfolio: {
          equals: 'FVLG',
          mode: 'insensitive'
        },
        valueDate: { not: null },
        bookValue: { not: null }
      },
      _sum: {
        bookValue: true
      },
      orderBy: {
        valueDate: 'asc'
      }
    });

    const pledgeAmounts = await this.calculatePledgeAmounts(batchId, `${days} DTB`);

    const results: Record<string, number> = {};

    for (const record of bookValues) {
      if (record.valueDate && record._sum.bookValue) {
        const dateStr = this.formatDate(record.valueDate);
        const bookVal = record._sum.bookValue;
        const pledge = pledgeAmounts[dateStr] || 0;
        
        results[dateStr] = Math.round(((bookVal - pledge) / this.DIVISION_FACTOR) * 100) / 100;
      }
    }

    return results;
  }

  private async calculateStockWithRBIAssured(batchId: string): Promise<Record<string, number>> {
    // Raw SQL query for complex calculation
    const query = Prisma.sql`
      SELECT 
        s.value_date,
        SUM(s.rbi_refinance * f.wap) as total_value
      FROM pdr1_slr_nds s
      JOIN pdr1_fimmda_vals f ON s.isin = f."identificationNo" 
        AND s.value_date = f.value_date
        AND s.upload_batch_id = f.upload_batch_id
      WHERE s.upload_batch_id = ${batchId}
        AND s.rbi_refinance > 0
        AND s.rbi_refinance IS NOT NULL
        AND f.wap IS NOT NULL
      GROUP BY s.value_date
      ORDER BY s.value_date ASC
    `;

    const results = await this.prisma.$queryRaw<Array<{
      value_date: Date;
      total_value: number;
    }>>(query);

    const formattedResults: Record<string, number> = {};

    results.forEach(result => {
      const dateStr = this.formatDate(result.value_date);
      // Convert from lakhs to crores (SLR is in lakhs, then divide by 100 for crores)
      formattedResults[dateStr] = Math.round((result.total_value / this.LAKHS_FACTOR) * 100) / 100;
    });

    return formattedResults;
  }

  private async calculateStockWithMarketRepo(batchId: string): Promise<Record<string, number>> {
    const query = Prisma.sql`
      SELECT 
        s.value_date,
        SUM(s.repo * f.wap) as total_value
      FROM pdr1_slr_nds s
      JOIN pdr1_fimmda_vals f ON s.isin = f."identificationNo" 
        AND s.value_date = f.value_date
        AND s.upload_batch_id = f.upload_batch_id
      WHERE s.upload_batch_id = ${batchId}
        AND s.repo > 0
        AND s.repo IS NOT NULL
        AND f.wap IS NOT NULL
      GROUP BY s.value_date
      ORDER BY s.value_date ASC
    `;

    const results = await this.prisma.$queryRaw<Array<{
      value_date: Date;
      total_value: number;
    }>>(query);

    const formattedResults: Record<string, number> = {};

    results.forEach(result => {
      const dateStr = this.formatDate(result.value_date);
      formattedResults[dateStr] = Math.round((result.total_value / this.LAKHS_FACTOR) * 100) / 100;
    });

    return formattedResults;
  }

  private async calculatePledgeAmounts(batchId: string, instrumentType: string): Promise<Record<string, number>> {
    let whereClause = '';
    
    if (instrumentType === 'GOVT') {
      whereClause = `AND (s.instrument_name LIKE '%GOI%' OR s.instrument_name LIKE '%GS%')`;
    } else if (instrumentType === 'SDL') {
      whereClause = `AND (s.instrument_name LIKE '%SDL%' OR s.instrument_name LIKE '%SGS%' OR s.instrument_name LIKE '%UDAY%')`;
    } else if (instrumentType.includes('DTB')) {
      whereClause = `AND s.instrument_name LIKE '%${instrumentType}%'`;
    }

    const query = Prisma.sql`
      SELECT 
        s.value_date,
        SUM((s.repo + s.rbi_refinance) * f.wap) as pledge_amount
      FROM pdr1_slr_nds s
      JOIN pdr1_fimmda_vals f ON s.isin = f."identificationNo" 
        AND s.value_date = f.value_date
        AND s.upload_batch_id = f.upload_batch_id
      WHERE s.upload_batch_id = ${batchId}
        AND (s.repo + s.rbi_refinance) > 0
        AND f.wap IS NOT NULL
        ${Prisma.raw(whereClause)}
      GROUP BY s.value_date
    `;

    const results = await this.prisma.$queryRaw<Array<{
      value_date: Date;
      pledge_amount: number;
    }>>(query);

    const pledgeMap: Record<string, number> = {};

    results.forEach(result => {
      const dateStr = this.formatDate(result.value_date);
      // Already in absolute units from calculation
      pledgeMap[dateStr] = result.pledge_amount || 0;
    });

    return pledgeMap;
  }

  private formatDate(date: Date): string {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const day = date.getUTCDate().toString().padStart(2, '0');
    const month = months[date.getUTCMonth()];
    const year = date.getUTCFullYear();
    return `${day}-${month}-${year}`;
  }
}