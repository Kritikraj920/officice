// backend/services/pdr1/calculations/section5/VaRCalculation.ts

import { PrismaClient, Prisma } from '@prisma/client';
import { Pdr1CalculatedValues } from '../../pdr1Types';

export class VaRCalculator {
  private prisma: PrismaClient;
  private readonly DIVISION_FACTOR = 10000000; // 10^7

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async calculate(batchId: string): Promise<Pdr1CalculatedValues> {
    const results: Pdr1CalculatedValues = {};

    // 6A - VaR as % of Portfolio
    results['6A'] = await this.calculateVaRPercentage(batchId);
    
    // 7A - Leverage Ratio
    results['7A'] = await this.calculateLeverageRatio(batchId);

    return results;
  }

  private async calculateVaRPercentage(batchId: string): Promise<Record<string, number>> {
    // As per PDR1 specifications:
    // 1. Calculate Total Portfolio Value = Securities MV + FnO MV + OIS PV
    // 2. Get 1-Day VaR from FVTPL Report
    // 3. Calculate 15-day holding period VaR = (15^0.5) * 1-Day VaR
    // 4. VaR as % = (15-day VaR / Total Portfolio Value) * 100

    const portfolioValues = await this.calculateTotalPortfolioValue(batchId);
    
    // Note: VaR FVTPL data would need to be imported from a separate file/table
    // For now, using placeholder calculation
    const results: Record<string, number> = {};

    for (const [dateStr, portfolioValue] of Object.entries(portfolioValues)) {
      // Placeholder: Assuming 1-day VaR is 0.5% of portfolio value
      const oneDayVaR = portfolioValue * 0.005;
      
      // Calculate 15-day holding period VaR
      const fifteenDayVaR = Math.sqrt(15) * oneDayVaR;
      
      // Calculate VaR as percentage
      if (portfolioValue > 0) {
        const varPercentage = (fifteenDayVaR / portfolioValue) * 100;
        results[dateStr] = Math.round(varPercentage * 100) / 100;
      }
    }

    return results;
  }

  private async calculateLeverageRatio(batchId: string): Promise<Record<string, number>> {
    // Leverage Ratio calculation would depend on specific formula
    // Typically: Total Assets / Net Owned Funds
    
    const dates = await this.getUniqueDates(batchId);
    const results: Record<string, number> = {};
    
    // Placeholder implementation
    const LEVERAGE_RATIO_VALUE = 14.42; // Example value from images
    
    dates.forEach(dateStr => {
      results[dateStr] = LEVERAGE_RATIO_VALUE;
    });
    
    return results;
  }

  private async calculateTotalPortfolioValue(batchId: string): Promise<Record<string, number>> {
    const query = Prisma.sql`
      SELECT 
        value_date,
        SUM(market_value + COALESCE(accrued_interest, 0)) as total_value
      FROM pdr1_fimmda_vals
      WHERE upload_batch_id = ${batchId}
        AND value_date IS NOT NULL
        AND market_value IS NOT NULL
      GROUP BY value_date
      ORDER BY value_date ASC
    `;

    const results = await this.prisma.$queryRaw<Array<{
      value_date: Date;
      total_value: number;
    }>>(query);

    const portfolioValues: Record<string, number> = {};

    results.forEach(result => {
      const dateStr = this.formatDate(result.value_date);
      // Convert to crores
      portfolioValues[dateStr] = result.total_value / this.DIVISION_FACTOR;
    });

    return portfolioValues;
  }

  private async getUniqueDates(batchId: string): Promise<string[]> {
    const dates = await this.prisma.pdr1ImDeal.findMany({
      where: {
        uploadBatchId: batchId,
        valueDate: { not: null }
      },
      select: { valueDate: true },
      distinct: ['valueDate'],
      orderBy: { valueDate: 'asc' }
    });

    return dates
      .map(d => d.valueDate)
      .filter((date): date is Date => date !== null)
      .map(date => this.formatDate(date));
  }

  private formatDate(date: Date): string {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const day = date.getUTCDate().toString().padStart(2, '0');
    const month = months[date.getUTCMonth()];
    const year = date.getUTCFullYear();
    return `${day}-${month}-${year}`;
  }
}