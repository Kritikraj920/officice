// backend/services/pdr1/calculations/section3/StockPosition.ts

import { PrismaClient, Prisma } from '@prisma/client';
import { Pdr1CalculatedValues } from '../../pdr1Types';

export class StockPositionCalculator {
  private prisma: PrismaClient;
  private readonly DIVISION_FACTOR = 10000000; // 10^7

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async calculate(batchId: string): Promise<Pdr1CalculatedValues> {
    const results: Pdr1CalculatedValues = {};

    // 3A - T-Bills
    results['3A'] = await this.calculateTBillsPosition(batchId);
    
    // 3B - Dated Securities
    results['3B'] = await this.calculateDatedSecuritiesPosition(batchId);
    
    // 3C - SDL (State Development Loans)
    results['3C'] = await this.calculateSDLPosition(batchId);

    return results;
  }

  private async calculateTBillsPosition(batchId: string): Promise<Record<string, number>> {
    // Step 1: Get face values from FIMMDA Val
    const faceValues = await this.prisma.pdr1FimmdaVal.groupBy({
      by: ['valueDate'],
      where: {
        uploadBatchId: batchId,
        category: {
          equals: 'Treasury Bills',
          mode: 'insensitive'
        },
        portfolio: {
          equals: 'FVLG',
          mode: 'insensitive'
        },
        valueDate: { not: null },
        faceValue: { not: null }
      },
      _sum: {
        faceValue: true
      },
      orderBy: {
        valueDate: 'asc'
      }
    });

    // Step 2: Get pledged amounts from SLR
    const pledgedAmounts = await this.calculatePledgedAmounts(batchId, 'DTB');

    // Step 3: Calculate net position (Face Value - Pledged)
    const results: Record<string, number> = {};

    for (const record of faceValues) {
      if (record.valueDate && record._sum.faceValue) {
        const dateStr = this.formatDate(record.valueDate);
        const faceVal = record._sum.faceValue;
        const pledged = pledgedAmounts[dateStr] || 0;
        
        // Convert to crores
        results[dateStr] = Math.round(((faceVal - pledged) / this.DIVISION_FACTOR) * 100) / 100;
      }
    }

    return results;
  }

  private async calculateDatedSecuritiesPosition(batchId: string): Promise<Record<string, number>> {
    const faceValues = await this.prisma.pdr1FimmdaVal.groupBy({
      by: ['valueDate'],
      where: {
        uploadBatchId: batchId,
        category: {
          equals: 'Central Government Securities',
          mode: 'insensitive'
        },
        portfolio: {
          equals: 'FVLG',
          mode: 'insensitive'
        },
        valueDate: { not: null },
        faceValue: { not: null }
      },
      _sum: {
        faceValue: true
      },
      orderBy: {
        valueDate: 'asc'
      }
    });

    const pledgedAmounts = await this.calculatePledgedAmounts(batchId, 'GOVT');

    const results: Record<string, number> = {};

    for (const record of faceValues) {
      if (record.valueDate && record._sum.faceValue) {
        const dateStr = this.formatDate(record.valueDate);
        const faceVal = record._sum.faceValue;
        const pledged = pledgedAmounts[dateStr] || 0;
        
        results[dateStr] = Math.round(((faceVal - pledged) / this.DIVISION_FACTOR) * 100) / 100;
      }
    }

    return results;
  }

  private async calculateSDLPosition(batchId: string): Promise<Record<string, number>> {
    const faceValues = await this.prisma.pdr1FimmdaVal.groupBy({
      by: ['valueDate'],
      where: {
        uploadBatchId: batchId,
        category: {
          equals: 'State Government Securities',
          mode: 'insensitive'
        },
        portfolio: {
          in: ['FVLG', 'AMRT', 'NC/NNC'],
          mode: 'insensitive'
        },
        valueDate: { not: null },
        faceValue: { not: null }
      },
      _sum: {
        faceValue: true
      },
      orderBy: {
        valueDate: 'asc'
      }
    });

    const pledgedAmounts = await this.calculatePledgedAmounts(batchId, 'SDL');

    const results: Record<string, number> = {};

    for (const record of faceValues) {
      if (record.valueDate && record._sum.faceValue) {
        const dateStr = this.formatDate(record.valueDate);
        const faceVal = record._sum.faceValue;
        const pledged = pledgedAmounts[dateStr] || 0;
        
        results[dateStr] = Math.round(((faceVal - pledged) / this.DIVISION_FACTOR) * 100) / 100;
      }
    }

    return results;
  }

  private async calculatePledgedAmounts(batchId: string, instrumentType: string): Promise<Record<string, number>> {
    let whereClause = '';
    
    if (instrumentType === 'DTB') {
      whereClause = `AND s.instrument_name LIKE '%DTB%'`;
    } else if (instrumentType === 'GOVT') {
      whereClause = `AND (s.instrument_name LIKE '%GOI%' OR s.instrument_name LIKE '%GS%')`;
    } else if (instrumentType === 'SDL') {
      whereClause = `AND (s.instrument_name LIKE '%SDL%' OR s.instrument_name LIKE '%SGS%' OR s.instrument_name LIKE '%UDAY%')`;
    }

    // Sum of all pledged positions
    const query = Prisma.sql`
      SELECT 
        s.value_date,
        SUM(
          COALESCE(s.repo, 0) + 
          COALESCE(s.rbi_refinance, 0) + 
          COALESCE(s.collateral, 0) + 
          COALESCE(s.lien, 0) + 
          COALESCE(s.sgf, 0) + 
          COALESCE(s.derivative, 0) + 
          COALESCE(s.treps, 0) + 
          COALESCE(s.deflt, 0)
        ) as total_pledged
      FROM pdr1_slr_nds s
      WHERE s.upload_batch_id = ${batchId}
        ${Prisma.raw(whereClause)}
      GROUP BY s.value_date
      ORDER BY s.value_date ASC
    `;

    const results = await this.prisma.$queryRaw<Array<{
      value_date: Date;
      total_pledged: number;
    }>>(query);

    const pledgedMap: Record<string, number> = {};

    results.forEach(result => {
      const dateStr = this.formatDate(result.value_date);
      // Convert from lakhs to absolute units
      pledgedMap[dateStr] = (result.total_pledged || 0) * 100000;
    });

    return pledgedMap;
  }

  private formatDate(date: Date): string {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const day = date.getUTCDate().toString().padStart(2, '0');
    const month = months[date.getUTCMonth()];
    const year = date.getUTCFullYear();
    return `${day}-${month}-${year}`;
  }
}