// backend/services/pdr1/calculations/section2/SourcesOfFunds.ts

import { PrismaClient, Prisma } from '@prisma/client';
import { Pdr1CalculatedValues } from '../../pdr1Types';

export class SourcesOfFundsCalculator {
    private prisma: PrismaClient;
    private readonly DIVISION_FACTOR = 10000000; // 10^7
    private imDealDates: Set<string> = new Set();
    
    constructor(prisma: PrismaClient) {
        this.prisma = prisma;
    }
    
    async calculate(batchId: string): Promise<Pdr1CalculatedValues> {
        const results: Pdr1CalculatedValues = {};
        
        console.log('=== Starting Sources of Funds Calculation ===');
        
        // First, get the dates from IM Deal to filter results
        await this.loadImDealDates(batchId);
        console.log(`Loaded ${this.imDealDates.size} dates from IM Deal`);
        
        // Debug: Check what dates we have in the MM Deal Outstanding table
        const debugQuery = await this.prisma.$queryRaw<Array<{date: Date | null}>>`
        SELECT DISTINCT "date" 
        FROM pdr1_mm_deals_outstanding 
        WHERE "uploadBatchId" = ${batchId} 
        AND "date" IS NOT NULL
        ORDER BY "date" ASC
        LIMIT 5
        `;
        
        console.log('Sample dates from MM Deal Outstanding:', debugQuery.map(d => 
            d.date ? this.formatDate(d.date) : null
        ));
        
        // 2A1 - Net Owned Funds (check file first, then use static)
        results['2A1'] = await this.calculateNetOwnedFunds(batchId);
        
        // 2A2 - Call money borrowings (outstanding)
        results['2A2'] = await this.calculateCallMoneyBorrowingsOutstanding(batchId);
        
        // 2A3 - Notice money borrowings (outstanding)
        results['2A3'] = await this.calculateNoticeMoneyBorrowingsOutstanding(batchId);
        
        // 2A4 - Term money borrowings (outstanding)
        results['2A4'] = await this.calculateTermMoneyBorrowingsOutstanding(batchId);
        
        // 2A5 - Borrowing from RBI under SLF
        results['2A5'] = await this.calculateRBIBorrowingSLF(batchId);
        
        // 2A6 - Repo borrowing from market (outstanding)
        results['2A6'] = await this.calculateRepoBorrowingMarketOutstanding(batchId);
        
        // 2A7 - Borrowing under CBLO/TREPS
        results['2A7'] = await this.calculateCBLOBorrowing(batchId);
        
        // 2A8 - Inter-Corporate Deposits (Total)
        results['2A8'] = await this.calculateInterCorporateDeposits(batchId);
        
        // 2A9 - Inter-Corporate Deposits - maturing upto 14 days
        results['2A9'] = await this.calculateInterCorporateDepositsShortTerm(batchId);
        
        // 2A10 - Inter-Corporate Deposits - maturing beyond 14 days
        results['2A10'] = await this.calculateInterCorporateDepositsLongTerm(batchId);
        
        // 2A11 - FCNR(B) Loans
        // results['2A11'] = await this.calculateFCNRLoans(batchId);
        
        // 2A12 - Commercial Paper issuances
        // results['2A12'] = await this.calculateCommercialPaper(batchId);
        
        // 2A13 - Bond issuances
        // results['2A13'] = await this.calculateBondIssuances(batchId);
        
        // 2A14 - Others
        // results['2A14'] = await this.calculateOthers(batchId);
        
        // Log summary of results
        console.log('=== Sources of Funds Calculation Summary ===');
        Object.entries(results).forEach(([section, data]) => {
            const dates = Object.keys(data);
            if (dates.length > 0) {
                const total = Object.values(data).reduce((sum, val) => sum + val, 0);
                console.log(`${section}: ${dates.length} dates, Total: ${total.toFixed(2)} Cr`);
            } else {
                console.log(`${section}: No data`);
            }
        });
        console.log('=== End Sources of Funds Calculation ===');
        
        return results;
    }
    
    private async loadImDealDates(batchId: string): Promise<void> {
        const dates = await this.prisma.pdr1ImDeal.findMany({
            where: {
                uploadBatchId: batchId,
                valueDate: { not: null }
            },
            select: { valueDate: true },
            distinct: ['valueDate']
        });
        
        this.imDealDates = new Set(
            dates
            .map(d => d.valueDate)
            .filter((date): date is Date => date !== null)
            .map(date => this.formatDate(date))
        );
    }
    
    private filterByImDealDates(results: Record<string, number>): Record<string, number> {
        const filtered: Record<string, number> = {};
        
        Object.entries(results).forEach(([dateStr, value]) => {
            if (this.imDealDates.has(dateStr)) {
                filtered[dateStr] = value;
            }
        });
        
        return filtered;
    }
    
    // todo : put static values only 
    private async calculateNetOwnedFunds(batchId: string): Promise<Record<string, number>> {
        console.log('Using static 0 for Net Owned Funds');
        const result: Record<string, number> = {};
        
        this.imDealDates.forEach(dateStr => {
            result[dateStr] = 0;
        });
        
        return result;
    }
    
    private async calculateCallMoneyBorrowingsOutstanding(batchId: string): Promise<Record<string, number>> {
        console.log('Calculating 2A2 - Call Money Borrowings Outstanding');
        
        const results = await this.prisma.$queryRaw<Array<{
            date: Date | null;
            sum_baseEqvlnt: number | null;
            sum_outstandingAmount: number | null;
        }>>`
        SELECT 
          "date",
          SUM("baseEqvlnt") as "sum_baseEqvlnt",
          SUM("outstandingAmount") as "sum_outstandingAmount"
        FROM pdr1_mm_deals_outstanding
        WHERE "uploadBatchId" = ${batchId}
          AND "instrumentName" = 'CALL BORROWING (NDS)'
          AND "date" IS NOT NULL
          AND ("baseEqvlnt" IS NOT NULL OR "outstandingAmount" IS NOT NULL)
        GROUP BY "date"
        ORDER BY "date" ASC
      `;
        
        const formattedResults: Record<string, number> = {};
        
        results.forEach(result => {
            if (result.date) {
                const dateStr = this.formatDate(result.date);
                const value = result.sum_baseEqvlnt || result.sum_outstandingAmount || 0;
                formattedResults[dateStr] = Math.round((value / this.DIVISION_FACTOR) * 100) / 100;
            }
        });
        
        const filtered = this.filterByImDealDates(formattedResults);
        console.log('2A2 Results:', Object.keys(filtered).length, 'dates');
        return filtered;
    }
    
    private async calculateNoticeMoneyBorrowingsOutstanding(batchId: string): Promise<Record<string, number>> {
        console.log('Calculating 2A3 - Notice Money Borrowings Outstanding');
        
        const results = await this.prisma.$queryRaw<Array<{
            date: Date | null;
            sum_baseEqvlnt: number | null;
            sum_outstandingAmount: number | null;
        }>>`
      SELECT 
        "date",
        SUM("baseEqvlnt") as "sum_baseEqvlnt",
        SUM("outstandingAmount") as "sum_outstandingAmount"
      FROM pdr1_mm_deals_outstanding
      WHERE "uploadBatchId" = ${batchId}
        AND "instrumentName" = 'NOTICE BORROWING (NDS)'
        AND "date" IS NOT NULL
        AND ("baseEqvlnt" IS NOT NULL OR "outstandingAmount" IS NOT NULL)
      GROUP BY "date"
      ORDER BY "date" ASC
    `;
        
        const formattedResults: Record<string, number> = {};
        
        results.forEach(result => {
            if (result.date) {
                const dateStr = this.formatDate(result.date);
                const value = result.sum_baseEqvlnt || result.sum_outstandingAmount || 0;
                formattedResults[dateStr] = Math.round((value / this.DIVISION_FACTOR) * 100) / 100;
            }
        });
        
        return this.filterByImDealDates(formattedResults);
    }
    
    private async calculateTermMoneyBorrowingsOutstanding(batchId: string): Promise<Record<string, number>> {
        console.log('Calculating 2A4 - Term Money Borrowings Outstanding');
        
        const results = await this.prisma.$queryRaw<Array<{
            date: Date | null;
            sum_baseEqvlnt: number | null;
            sum_outstandingAmount: number | null;
        }>>`
      SELECT 
        "date",
        SUM("baseEqvlnt") as "sum_baseEqvlnt",
        SUM("outstandingAmount") as "sum_outstandingAmount"
      FROM pdr1_mm_deals_outstanding
      WHERE "uploadBatchId" = ${batchId}
        AND "instrumentName" = 'TERM BORROWING (NDS)'
        AND "date" IS NOT NULL
        AND ("baseEqvlnt" IS NOT NULL OR "outstandingAmount" IS NOT NULL)
      GROUP BY "date"
      ORDER BY "date" ASC
    `;
        
        const formattedResults: Record<string, number> = {};
        
        results.forEach(result => {
            if (result.date) {
                const dateStr = this.formatDate(result.date);
                const value = result.sum_baseEqvlnt || result.sum_outstandingAmount || 0;
                formattedResults[dateStr] = Math.round((value / this.DIVISION_FACTOR) * 100) / 100;
            }
        });
        
        return this.filterByImDealDates(formattedResults);
    }
    
    private async calculateRBIBorrowingSLF(batchId: string): Promise<Record<string, number>> {
        console.log('Calculating 2A5 - RBI Borrowing under SLF');
        
        const results = await this.prisma.$queryRaw<Array<{
            date: Date | null;
            sum_baseEqvlnt: number | null;
            sum_outstandingAmount: number | null;
        }>>`
      SELECT 
        "date",
        SUM("baseEqvlnt") as "sum_baseEqvlnt",
        SUM("outstandingAmount") as "sum_outstandingAmount"
      FROM pdr1_mm_deals_outstanding
      WHERE "uploadBatchId" = ${batchId}
        AND "instrumentName" = 'RBI - REFINANCE'
        AND "date" IS NOT NULL
        AND ("baseEqvlnt" IS NOT NULL OR "outstandingAmount" IS NOT NULL)
      GROUP BY "date"
      ORDER BY "date" ASC
    `;
        
        const formattedResults: Record<string, number> = {};
        
        results.forEach(result => {
            if (result.date) {
                const dateStr = this.formatDate(result.date);
                const value = result.sum_baseEqvlnt || result.sum_outstandingAmount || 0;
                formattedResults[dateStr] = Math.round((value / this.DIVISION_FACTOR) * 100) / 100;
            }
        });
        
        return this.filterByImDealDates(formattedResults);
    }
    
    // todo : need to update the query
    private async calculateRepoBorrowingMarketOutstanding(batchId: string): Promise<Record<string, number>> {
        console.log('Calculating 2A6 - Repo Borrowing from Market Outstanding');
        
        // First, let's debug what instruments we have in the repo deals table
        const allInstruments = await this.prisma.pdr1RepoDeal.groupBy({
            by: ['instrument'],
            where: {
                uploadBatchId: batchId,
                instrument: { not: null }
            },
            _count: { instrument: true }
        });
        
        console.log('Available instruments in Repo Deals:');
        allInstruments.forEach(item => {
            console.log(`  "${item.instrument}": ${item._count.instrument} records`);
        });
        
        // More robust query that handles common data issues
        const results = await this.prisma.$queryRaw<Array<{
            valueDate: Date | null;
            sum_settlementAmountLeg1: number | null;
        }>>`
        SELECT 
        "valueDate",
        SUM("settlementAmountLeg1") as "sum_settlementAmountLeg1"
        FROM pdr1_repo_deals
        WHERE "uploadBatchId" = ${batchId}
        AND UPPER(TRIM("instrument")) = 'MARKET REPO'
        AND "valueDate" IS NOT NULL
        AND "settlementAmountLeg1" IS NOT NULL
        GROUP BY "valueDate"
        ORDER BY "valueDate" ASC
        `;

        // Alternative approach using Prisma's built-in methods (if the above doesn't work)
        const alternativeResults = await this.prisma.pdr1RepoDeal.groupBy({
            by: ['valueDate'],
            where: {
                uploadBatchId: batchId,
                instrument: {
                    in: ['MARKET REPO', 'Market Repo', 'market repo']
                },
                valueDate: { not: null },
                settlementAmountLeg1: { not: null }
            },
            _sum: {
                settlementAmountLeg1: true
            },
            orderBy: {
                valueDate: 'asc'
            }
        });
        
        console.log(`Found ${results.length} records for Repo Borrowing Market Outstanding`);
        
        const formattedResults: Record<string, number> = {};
        
        results.forEach(result => {
            if (result.valueDate && result.sum_settlementAmountLeg1) {
                const dateStr = this.formatDate(result.valueDate);
                const value = result.sum_settlementAmountLeg1;
                formattedResults[dateStr] = Math.round((value / this.DIVISION_FACTOR) * 100) / 100;
                console.log(`2A6 - ${dateStr}: ${formattedResults[dateStr]} Cr (from Settlement Amt Leg1: ${value})`);
            }
        });
        
        const filtered = this.filterByImDealDates(formattedResults);
        console.log(`2A6 Results: ${Object.keys(filtered).length} dates after IM Deal date filtering`);
        return filtered;
    }
    
    private async calculateCBLOBorrowing(batchId: string): Promise<Record<string, number>> {
        console.log('Calculating 2A7 - CBLO/TREPS Borrowing');
        
        const results = await this.prisma.$queryRaw<Array<{
            date: Date | null;
            sum_baseEqvlnt: number | null;
            sum_outstandingAmount: number | null;
        }>>`
      SELECT 
        "date",
        SUM("baseEqvlnt") as "sum_baseEqvlnt",
        SUM("outstandingAmount") as "sum_outstandingAmount"
      FROM pdr1_mm_deals_outstanding
      WHERE "uploadBatchId" = ${batchId}
        AND "instrumentName" = 'TREPS BORROWING'
        AND "date" IS NOT NULL
        AND ("baseEqvlnt" IS NOT NULL OR "outstandingAmount" IS NOT NULL)
      GROUP BY "date"
      ORDER BY "date" ASC
    `;
        
        const formattedResults: Record<string, number> = {};
        
        results.forEach(result => {
            if (result.date) {
                const dateStr = this.formatDate(result.date);
                const value = result.sum_baseEqvlnt || result.sum_outstandingAmount || 0;
                formattedResults[dateStr] = Math.round((value / this.DIVISION_FACTOR) * 100) / 100;
            }
        });
        
        return this.filterByImDealDates(formattedResults);
    }
    
    private async calculateInterCorporateDeposits(batchId: string): Promise<Record<string, number>> {
        console.log('Calculating 2A8 - Inter-Corporate Deposits (Total)');
        
        const results = await this.prisma.$queryRaw<Array<{
            date: Date | null;
            sum_baseEqvlnt: number | null;
            sum_outstandingAmount: number | null;
        }>>`
      SELECT 
        "date",
        SUM("baseEqvlnt") as "sum_baseEqvlnt",
        SUM("outstandingAmount") as "sum_outstandingAmount"
      FROM pdr1_mm_deals_outstanding
      WHERE "uploadBatchId" = ${batchId}
        AND "instrumentName" = 'INTER CORPORATE DEPOSIT BORROWING'
        AND "date" IS NOT NULL
        AND ("baseEqvlnt" IS NOT NULL OR "outstandingAmount" IS NOT NULL)
      GROUP BY "date"
      ORDER BY "date" ASC
    `;
        
        const formattedResults: Record<string, number> = {};
        
        results.forEach(result => {
            if (result.date) {
                const dateStr = this.formatDate(result.date);
                const value = result.sum_baseEqvlnt || result.sum_outstandingAmount || 0;
                formattedResults[dateStr] = Math.round((value / this.DIVISION_FACTOR) * 100) / 100;
            }
        });
        
        return this.filterByImDealDates(formattedResults);
    }
    
    private async calculateInterCorporateDepositsShortTerm(batchId: string): Promise<Record<string, number>> {
        console.log('Calculating 2A9 - Inter-Corporate Deposits (Maturing up to 14 days)');
        
        const results = await this.prisma.$queryRaw<Array<{
            date: Date | null;
            sum_baseEqvlnt: number | null;
            sum_outstandingAmount: number | null;
        }>>`
      SELECT 
        "date",
        SUM("baseEqvlnt") as "sum_baseEqvlnt",
        SUM("outstandingAmount") as "sum_outstandingAmount"
      FROM pdr1_mm_deals_outstanding
      WHERE "uploadBatchId" = ${batchId}
        AND "instrumentName" = 'INTER CORPORATE DEPOSIT BORROWING'
        AND "date" IS NOT NULL
        AND "tenor" <= 14
        AND ("baseEqvlnt" IS NOT NULL OR "outstandingAmount" IS NOT NULL)
      GROUP BY "date"
      ORDER BY "date" ASC
    `;
        
        const formattedResults: Record<string, number> = {};
        
        results.forEach(result => {
            if (result.date) {
                const dateStr = this.formatDate(result.date);
                const value = result.sum_baseEqvlnt || result.sum_outstandingAmount || 0;
                formattedResults[dateStr] = Math.round((value / this.DIVISION_FACTOR) * 100) / 100;
            }
        });
        
        return this.filterByImDealDates(formattedResults);
    }
    
    private async calculateInterCorporateDepositsLongTerm(batchId: string): Promise<Record<string, number>> {
        console.log('Calculating 2A10 - Inter-Corporate Deposits (Maturing beyond 14 days)');
        
        const results = await this.prisma.$queryRaw<Array<{
            date: Date | null;
            sum_baseEqvlnt: number | null;
            sum_outstandingAmount: number | null;
        }>>`
      SELECT 
        "date",
        SUM("baseEqvlnt") as "sum_baseEqvlnt",
        SUM("outstandingAmount") as "sum_outstandingAmount"
      FROM pdr1_mm_deals_outstanding
      WHERE "uploadBatchId" = ${batchId}
        AND "instrumentName" = 'INTER CORPORATE DEPOSIT BORROWING'
        AND "date" IS NOT NULL
        AND "tenor" > 14
        AND ("baseEqvlnt" IS NOT NULL OR "outstandingAmount" IS NOT NULL)
      GROUP BY "date"
      ORDER BY "date" ASC
    `;
        
        const formattedResults: Record<string, number> = {};
        
        results.forEach(result => {
            if (result.date) {
                const dateStr = this.formatDate(result.date);
                const value = result.sum_baseEqvlnt || result.sum_outstandingAmount || 0;
                formattedResults[dateStr] = Math.round((value / this.DIVISION_FACTOR) * 100) / 100;
            }
        });
        
        return this.filterByImDealDates(formattedResults);
    }
    
    private async calculateFCNRLoans(batchId: string): Promise<Record<string, number>> {
        console.log('Calculating 2A11 - FCNR(B) Loans');
        
        const results = await this.prisma.$queryRaw<Array<{
            date: Date | null;
            sum_baseEqvlnt: number | null;
            sum_outstandingAmount: number | null;
        }>>`
      SELECT 
        "date",
        SUM("baseEqvlnt") as "sum_baseEqvlnt",
        SUM("outstandingAmount") as "sum_outstandingAmount"
      FROM pdr1_mm_deals_outstanding
      WHERE "uploadBatchId" = ${batchId}
        AND "instrumentName" IN ('FCNR(B) LOANS', 'FCNR LOANS', 'FCNR(B)')
        AND "date" IS NOT NULL
        AND ("baseEqvlnt" IS NOT NULL OR "outstandingAmount" IS NOT NULL)
      GROUP BY "date"
      ORDER BY "date" ASC
    `;
        
        const formattedResults: Record<string, number> = {};
        
        results.forEach(result => {
            if (result.date) {
                const dateStr = this.formatDate(result.date);
                const value = result.sum_baseEqvlnt || result.sum_outstandingAmount || 0;
                formattedResults[dateStr] = Math.round((value / this.DIVISION_FACTOR) * 100) / 100;
            }
        });
        
        return this.filterByImDealDates(formattedResults);
    }
    
    private async calculateCommercialPaper(batchId: string): Promise<Record<string, number>> {
        console.log('Calculating 2A12 - Commercial Paper issuances');
        
        const results = await this.prisma.$queryRaw<Array<{
            date: Date | null;
            sum_baseEqvlnt: number | null;
            sum_outstandingAmount: number | null;
        }>>`
      SELECT 
        "date",
        SUM("baseEqvlnt") as "sum_baseEqvlnt",
        SUM("outstandingAmount") as "sum_outstandingAmount"
      FROM pdr1_mm_deals_outstanding
      WHERE "uploadBatchId" = ${batchId}
        AND "instrumentName" IN ('COMMERCIAL PAPER', 'CP', 'COMMERCIAL PAPER ISSUANCE')
        AND "date" IS NOT NULL
        AND ("baseEqvlnt" IS NOT NULL OR "outstandingAmount" IS NOT NULL)
      GROUP BY "date"
      ORDER BY "date" ASC
    `;
        
        const formattedResults: Record<string, number> = {};
        
        results.forEach(result => {
            if (result.date) {
                const dateStr = this.formatDate(result.date);
                const value = result.sum_baseEqvlnt || result.sum_outstandingAmount || 0;
                formattedResults[dateStr] = Math.round((value / this.DIVISION_FACTOR) * 100) / 100;
            }
        });
        
        return this.filterByImDealDates(formattedResults);
    }
    
    private async calculateBondIssuances(batchId: string): Promise<Record<string, number>> {
        console.log('Calculating 2A13 - Bond issuances');
        
        const results = await this.prisma.$queryRaw<Array<{
            date: Date | null;
            sum_baseEqvlnt: number | null;
            sum_outstandingAmount: number | null;
        }>>`
      SELECT 
        "date",
        SUM("baseEqvlnt") as "sum_baseEqvlnt",
        SUM("outstandingAmount") as "sum_outstandingAmount"
      FROM pdr1_mm_deals_outstanding
      WHERE "uploadBatchId" = ${batchId}
        AND "instrumentName" IN ('BOND ISSUANCE', 'BONDS', 'CORPORATE BOND')
        AND "date" IS NOT NULL
        AND ("baseEqvlnt" IS NOT NULL OR "outstandingAmount" IS NOT NULL)
      GROUP BY "date"
      ORDER BY "date" ASC
    `;
        
        const formattedResults: Record<string, number> = {};
        
        results.forEach(result => {
            if (result.date) {
                const dateStr = this.formatDate(result.date);
                const value = result.sum_baseEqvlnt || result.sum_outstandingAmount || 0;
                formattedResults[dateStr] = Math.round((value / this.DIVISION_FACTOR) * 100) / 100;
            }
        });
        
        return this.filterByImDealDates(formattedResults);
    }
    
    private async calculateOthers(batchId: string): Promise<Record<string, number>> {
        console.log('Calculating 2A14 - Others');
        
        const results = await this.prisma.$queryRaw<Array<{
            date: Date | null;
            sum_baseEqvlnt: number | null;
            sum_outstandingAmount: number | null;
        }>>`
      SELECT 
        "date",
        SUM("baseEqvlnt") as "sum_baseEqvlnt",
        SUM("outstandingAmount") as "sum_outstandingAmount"
      FROM pdr1_mm_deals_outstanding
      WHERE "uploadBatchId" = ${batchId}
        AND "instrumentName" NOT IN (
          'CALL BORROWING (NDS)',
          'NOTICE BORROWING (NDS)',
          'TERM BORROWING (NDS)',
          'RBI - REFINANCE',
          'AMC REPO',
          'TREPS BORROWING',
          'INTER CORPORATE DEPOSIT BORROWING',
          'FCNR(B) LOANS',
          'FCNR LOANS',
          'FCNR(B)',
          'COMMERCIAL PAPER',
          'CP',
          'COMMERCIAL PAPER ISSUANCE',
          'BOND ISSUANCE',
          'BONDS',
          'CORPORATE BOND',
          'NOF(ASSET)',
          'FIXED DEPOSIT LENDING',
          'CASH CLTRL - DFLT FUND DERIVATIVES',
          'CASH CLTRL - DFLT FUND SECURITIES',
          'CASH CLTRL - DFLT FUND TREPS',
          'CASH CLTRL - SGF',
          'CASH CLTRL - SHCIL CURRENCY',
          'CASH CLTRL - SHCIL EQUITY',
          'CASH CLTRL - SHCIL F&O',
          'CASH CLTRL - TREPS'
        )
        AND "date" IS NOT NULL
        AND ("baseEqvlnt" IS NOT NULL OR "outstandingAmount" IS NOT NULL)
      GROUP BY "date"
      ORDER BY "date" ASC
    `;
        
        const formattedResults: Record<string, number> = {};
        
        results.forEach(result => {
            if (result.date) {
                const dateStr = this.formatDate(result.date);
                const value = result.sum_baseEqvlnt || result.sum_outstandingAmount || 0;
                formattedResults[dateStr] = Math.round((value / this.DIVISION_FACTOR) * 100) / 100;
            }
        });
        
        return this.filterByImDealDates(formattedResults);
    }
    
    private formatDate(date: Date): string {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const day = date.getUTCDate().toString().padStart(2, '0');
        const month = months[date.getUTCMonth()];
        const year = date.getUTCFullYear();
        return `${day}-${month}-${year}`;
    }
}