// backend/services/pdr1/calculations/section1/OutrightTransactions.ts

import { PrismaClient, Prisma } from '@prisma/client';
import { Pdr1CalculatedValues, TransactionType, SecurityCategory, GOVERNMENT_CATEGORIES } from '../../pdr1Types';

export class OutrightTransactionsCalculator {
  private prisma: PrismaClient;
  private readonly DIVISION_FACTOR = 10000000; // 10^7

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async calculate(batchId: string): Promise<Pdr1CalculatedValues> {
    const results: Pdr1CalculatedValues = {};

    // 1A - Outright Purchases
    results['1A1'] = await this.calculateOutright(batchId, TransactionType.BUY, SecurityCategory.GOVERNMENT);
    results['1A2'] = await this.calculateOutright(batchId, TransactionType.BUY, SecurityCategory.OTHER);
    
    // 1B - Outright Sales
    results['1B1'] = await this.calculateOutright(batchId, TransactionType.SELL, SecurityCategory.GOVERNMENT);
    results['1B2'] = await this.calculateOutright(batchId, TransactionType.SELL, SecurityCategory.OTHER);

    console.log('Calculated Data:', results);
    return results;
  }

  private async calculateOutright(
    batchId: string,
    transactionType: TransactionType,
    securityCategory: SecurityCategory
  ): Promise<Record<string, number>> {
    
    const whereClause: Prisma.Pdr1ImDealWhereInput = {
      uploadBatchId: batchId,
      opnType: transactionType,
      valueDate: { not: null },
      quantity: { not: null },
      // Portfolio starts with FVLG or FVSS
      OR: [
        { portfolio: { startsWith: 'FVLG', mode: 'insensitive' } },
        { portfolio: { startsWith: 'FVSS', mode: 'insensitive' } }
      ]
    };

    // Add category filter
    if (securityCategory === SecurityCategory.GOVERNMENT) {
      whereClause.AND = [
        {
          OR: [
            {
              category: {
                in: GOVERNMENT_CATEGORIES,
                mode: 'insensitive'
              }
            },
            {
              AND: [
                { category: { contains: 'GOVT', mode: 'insensitive' } },
                { category: { contains: 'BOND', mode: 'insensitive' } }
              ]
            },
            {
              AND: [
                { category: { contains: 'TREASURY', mode: 'insensitive' } },
                { category: { contains: 'BILL', mode: 'insensitive' } }
              ]
            }
          ]
        }
      ];
    } else {
      // Other securities - NOT government
      whereClause.AND = [
        {
          NOT: {
            OR: [
              {
                category: {
                  in: GOVERNMENT_CATEGORIES,
                  mode: 'insensitive'
                }
              },
              {
                AND: [
                  { category: { contains: 'GOVT', mode: 'insensitive' } },
                  { category: { contains: 'BOND', mode: 'insensitive' } }
                ]
              },
              {
                AND: [
                  { category: { contains: 'TREASURY', mode: 'insensitive' } },
                  { category: { contains: 'BILL', mode: 'insensitive' } }
                ]
              }
            ]
          }
        }
      ];
    }

    // Group by value date and sum quantity
    const results = await this.prisma.pdr1ImDeal.groupBy({
      by: ['valueDate'],
      where: whereClause,
      _sum: {
        quantity: true
      },
      orderBy: {
        valueDate: 'asc'
      }
    });

    // Convert to required format
    const formattedResults: Record<string, number> = {};
    
    results.forEach(result => {
      if (result.valueDate && result._sum.quantity) {
        const dateStr = this.formatDate(result.valueDate);
        // Convert to crores and round to 2 decimal places
        formattedResults[dateStr] = Math.round((result._sum.quantity / this.DIVISION_FACTOR) * 100) / 100;
      }
    });

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