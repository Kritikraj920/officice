// backend/services/pdr1/calculations/section4/PortfolioDuration.ts

import { PrismaClient, Prisma } from '@prisma/client';
import { Pdr1CalculatedValues } from '../../pdr1Types';

export class PortfolioDurationCalculator {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async calculate(batchId: string): Promise<Pdr1CalculatedValues> {
    const results: Pdr1CalculatedValues = {};

    // 4A - Portfolio Duration for all securities
    results['4A'] = await this.calculatePortfolioDurationAllSecurities(batchId);
    
    // 5A - Portfolio Duration for dated G-Sec (keeping same section ID as per images)
    results['5A'] = await this.calculatePortfolioDurationDatedSecurities(batchId);

    return results;
  }

  private async calculatePortfolioDurationAllSecurities(batchId: string): Promise<Record<string, number>> {
    // Complex calculation as per PDR1 specifications
    // P = (FVLG Sum of MV*MD + FVSS Sum of MV*MD + OIS Short Sum of MTM*MD - OIS Long Sum of MTM*MD)
    // Q = (FVLG Sum of MV + OIS Long Sum of MTM + FVSS Sum of MV + OIS Short Sum of MTM)
    // Portfolio Duration = P/Q

    const query = Prisma.sql`
      WITH fvlg_data AS (
        SELECT 
          value_date,
          SUM(market_value) as sum_mv,
          SUM(market_value * m_duration) as sum_mv_md
        FROM pdr1_fimmda_vals
        WHERE upload_batch_id = ${batchId}
          AND portfolio = 'FVLG'
          AND category NOT LIKE '%Equity%'
          AND market_value IS NOT NULL
          AND m_duration IS NOT NULL
        GROUP BY value_date
      ),
      fvss_data AS (
        SELECT 
          value_date,
          SUM(market_value) as sum_mv,
          SUM(market_value * m_duration) as sum_mv_md
        FROM pdr1_fimmda_vals
        WHERE upload_batch_id = ${batchId}
          AND portfolio = 'FVSS'
          AND category NOT LIKE '%Equity%'
          AND market_value IS NOT NULL
          AND m_duration IS NOT NULL
        GROUP BY value_date
      )
      SELECT 
        COALESCE(f1.value_date, f2.value_date) as value_date,
        COALESCE(f1.sum_mv, 0) as fvlg_mv,
        COALESCE(f1.sum_mv_md, 0) as fvlg_mv_md,
        COALESCE(f2.sum_mv, 0) as fvss_mv,
        COALESCE(f2.sum_mv_md, 0) as fvss_mv_md
      FROM fvlg_data f1
      FULL OUTER JOIN fvss_data f2 ON f1.value_date = f2.value_date
      ORDER BY value_date ASC
    `;

    const results = await this.prisma.$queryRaw<Array<{
      value_date: Date;
      fvlg_mv: number;
      fvlg_mv_md: number;
      fvss_mv: number;
      fvss_mv_md: number;
    }>>(query);

    const formattedResults: Record<string, number> = {};

    results.forEach(result => {
      // For now, OIS data would come from a separate table/calculation
      // Placeholder: assuming OIS values are 0
      const oisLongMTM = 0;
      const oisLongMTM_MD = 0;
      const oisShortMTM = 0;
      const oisShortMTM_MD = 0;

      const P = result.fvlg_mv_md + result.fvss_mv_md + oisShortMTM_MD - oisLongMTM_MD;
      const Q = result.fvlg_mv + oisLongMTM + result.fvss_mv + oisShortMTM;

      if (Q !== 0) {
        const dateStr = this.formatDate(result.value_date);
        const duration = P / Q;
        formattedResults[dateStr] = Math.round(duration * 100) / 100; // Round to 2 decimal places
      }
    });

    return formattedResults;
  }

  private async calculatePortfolioDurationDatedSecurities(batchId: string): Promise<Record<string, number>> {
    // Only for Government Securities and T-Bills
    // P = (FVLG Sum of MV*MD + FVSS Sum of MV*MD)
    // Q = (FVLG Sum of MV + FVSS Sum of MV)

    const query = Prisma.sql`
      WITH portfolio_data AS (
        SELECT 
          value_date,
          portfolio,
          SUM(market_value) as sum_mv,
          SUM(market_value * m_duration) as sum_mv_md
        FROM pdr1_fimmda_vals
        WHERE upload_batch_id = ${batchId}
          AND category IN ('Central Government Sec', 'State Government Sec', 'Treasury Bills')
          AND portfolio IN ('FVLG', 'FVSS')
          AND market_value IS NOT NULL
          AND m_duration IS NOT NULL
        GROUP BY value_date, portfolio
      )
      SELECT 
        value_date,
        SUM(sum_mv) as total_mv,
        SUM(sum_mv_md) as total_mv_md
      FROM portfolio_data
      GROUP BY value_date
      ORDER BY value_date ASC
    `;

    const results = await this.prisma.$queryRaw<Array<{
      value_date: Date;
      total_mv: number;
      total_mv_md: number;
    }>>(query);

    const formattedResults: Record<string, number> = {};

    results.forEach(result => {
      if (result.total_mv !== 0) {
        const dateStr = this.formatDate(result.value_date);
        const duration = result.total_mv_md / result.total_mv;
        formattedResults[dateStr] = Math.round(duration * 100) / 100;
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