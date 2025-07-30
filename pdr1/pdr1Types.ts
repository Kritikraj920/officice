// backend/services/pdr1/pdr1Types.ts

export interface Pdr1ProcessResult {
    success: boolean;
    batchId?: string;
    summary: {
        totalRecords: number;
        processedRecords: number;
        errorRecords: number;
        processingTime: number;
    };
    processedData: Pdr1CalculatedValues;
    dealDates: string[];
    error?: string;
}

export interface Pdr1CalculatedValues {
    [sectionId: string]: {
        [date: string]: number;
    };
}

export interface ProcessingResult {
    totalRecords: number;
    processedRecords: number;
    errorRecords: number;
}

export interface UploadedFiles {
    IM_DEAL?: Express.Multer.File;
    REPO_DEAL?: Express.Multer.File;
    MM_DEAL?: Express.Multer.File;
    MM_DEAL_OUTSTANDING?: Express.Multer.File;
    REPO_DEAL_OUTSTANDING?: Express.Multer.File;
    FIMMDA_VAL?: Express.Multer.File;
    SLR_NDS?: Express.Multer.File;
}

export enum TransactionType {
    BUY = 'BUY',
    SELL = 'SELL'
}

export enum SecurityCategory {
    GOVERNMENT = 'GOVERNMENT',
    OTHER = 'OTHER'
}

// IM Deal column mappings
export const IM_DEAL_COLUMN_MAPPING: Record<string, string> = {
    'security name': 'securityName',
    'identification no': 'identificationNo',
    'instrument type': 'instrumentType',
    'portfolio': 'portfolio',
    'deal ref': 'dealRef',
    'category': 'category',
    'sub category': 'subCategory',
    'counterparty': 'counterparty',
    'deal date': 'dealDate',
    'deal time': 'dealTime',
    'value date': 'valueDate',
    'maturity date': 'maturityDate',
    'opn type': 'opnType',
    'quantity': 'quantity',
    'mkt nominal val': 'mktNominalVal',
    'price': 'price',
    'rate/yield': 'rateYield',
    'book value': 'bookValue',
    'accrued interest-days': 'accruedInterestDays',
    'accrued interest-amount': 'accruedInterestAmount',
    'ccy': 'ccy',
    'settlement amount': 'settlementAmount',
    'dealer': 'dealer',
    'broker name': 'brokerName',
    'brokerage amount': 'brokerageAmount',
    'tax/other charges': 'taxOtherCharges',
    'holding cost': 'holdingCost',
    'profit/loss': 'profitLoss',
    'slr/ nslr': 'slrNslr',
    'authorizer time': 'authorizerTime',
    'authorizer date': 'authorizerDate',
    'authorizer name': 'authorizerName',
    'remarks': 'remarks'
};

// Repo Deal column mappings
export const REPO_DEAL_COLUMN_MAPPING: Record<string, string> = {
    'deal ref': 'dealNo',
    'deal reference': 'dealNo',
    'instrument': 'instrument',
    'security name': 'securityName',
    'isin': 'isin',
    'deal date': 'dealDate',
    'value date': 'valueDate',
    'maturity date': 'maturityDate',
    'face value': 'faceValue',
    'leg1 price': 'leg1Price',
    'leg2 price': 'leg2Price',
    'repo rate': 'rate',
    'repo period': 'tenor',
    'settlement amt leg1': 'settlementAmountLeg1',
    'settlement amt leg2': 'settlementAmountLeg2',
    'settlement amount leg1': 'settlementAmountLeg1',
    'settlement amount leg2': 'settlementAmountLeg2',
    'counterparty': 'counterparty',
    'remarks': 'remarks'
    // Note: Other fields like portfolio, deal status, etc. are not in the current schema
    // and have been removed from this mapping
  };

// MM Deal column mappings
export const MM_DEAL_COLUMN_MAPPING: Record<string, string> = {
    'deal ref': 'dealNo',
    'deal reference': 'dealNo',
    'instrument name': 'instrumentName',
    'instrument type': 'instrumentType',
    'deal date': 'dealDate',
    'value date': 'valueDate',
    'maturity date': 'maturityDate',
    'principal amt(acpt-plc)': 'principal',
    'principal amount(acpt-plc)': 'principal',
    'principal amt (acpt-plc)': 'principal',
    'deal rate': 'rate',
    'tenor': 'tenor',
    'base eqvlnt(acpt-plc)': 'baseEqvlnt',  // Main column for calculations
    'base eqvlnt (acpt-plc)': 'baseEqvlnt',
    'base equivalent(acpt-plc)': 'baseEqvlnt',
    'base equivalent (acpt-plc)': 'baseEqvlnt',
    'counterparty': 'counterparty',
    'deal status': 'status',
    'remarks': 'remarks'
    // Note: Removed operationType, dealCurrency, interestPractice, etc. 
    // as they don't exist in the Prisma schema
};


// MM Deal Outstanding column mappings
export const MM_DEAL_OUTSTANDING_COLUMN_MAPPING: Record<string, string> = {
    'date': 'date',  // Key field for grouping by date
    'deal ref': 'dealNo',
    'dealer': 'dealer',
    'counterparty': 'counterparty',
    'portfolio': 'portfolio',
    'instrument name': 'instrumentName',
    'instrument type': 'instrumentType',
    'instrument category': 'instrumentCategory',
    'deal date': 'dealDate',
    'deal time': 'dealTime',
    'value date': 'valueDate',
    'tenor': 'tenor',
    'maturity date': 'maturityDate',
    'operation type': 'operationType',
    'deal crncy': 'dealCurrency',
    'interest practice': 'interestPractice',
    'interest basis': 'interestBasis',
    'benchmark': 'benchmark',
    'spread': 'spread',
    'intrsettfreq': 'interestSettlementFreq',
    'intr fixing freq': 'interestFixingFreq',
    'deal rate': 'rate',
    'principal amt(acpt-plc)': 'principal',
    'base eqvlnt(acpt-plc)': 'baseEqvlnt',
    'interest amount': 'interestAmount',
    '(principal + interest)': 'principalPlusInterest',
    'deal status': 'status',
    'remarks': 'remarks',
    'last interest date': 'lastInterestDate',
    'next interest date': 'nextInterestDate',
    'accrued interest': 'accruedInterest'
};

// Repo Deal Outstanding column mappings
export const REPO_DEAL_OUTSTANDING_COLUMN_MAPPING: Record<string, string> = {
    'deal ref': 'dealNo',
    'instrument': 'instrument',
    'security name': 'securityName',
    'isin': 'isin',
    'deal date': 'dealDate',
    'value date': 'valueDate',
    'maturity date': 'maturityDate',
    'face value': 'faceValue',
    'leg1 price': 'leg1Price',
    'leg2 price': 'leg2Price',
    'repo rate': 'rate',
    'repo period': 'tenor',
    'settlement amt leg1': 'settlementAmountLeg1',
    'settlement amt leg2': 'settlementAmountLeg2',
    'base settlement amnt leg1': 'outstandingAmountLeg1', // For outstanding
    'base settlement amnt leg2': 'outstandingAmountLeg2',
    'counterparty': 'counterparty',
    'remarks': 'remarks'
};

// FIMMDA Val column mappings
export const FIMMDA_VAL_COLUMN_MAPPING: Record<string, string> = {
    'security name': 'securityName',
    'identification no': 'identificationNo',
    'isin': 'identificationNo',
    'category': 'category',
    'sub category': 'subCategory',
    'portfolio': 'portfolio',
    'face value': 'faceValue',
    'book value': 'bookValue',
    'market value': 'marketValue',
    'market price': 'marketPrice',
    'wap': 'wap',
    'mduration': 'mDuration',
    'pvbp': 'pvbp',
    'accrued interest': 'accruedInterest'
};

// SLR NDS column mappings
export const SLR_NDS_COLUMN_MAPPING: Record<string, string> = {
    'instrument name': 'instrumentName',
    'isin': 'isin',
    'own stock': 'ownStock',
    'repo': 'repo',
    'rbi refinance': 'rbiRefinance',
    'collateral': 'collateral',
    'lien': 'lien',
    'sgf': 'sgf',
    'derivative': 'derivative',
    'treps': 'treps',
    'deflt': 'deflt',
    'total pledged': 'totalPledged',
    'net position': 'netPosition'
};

export const GOVERNMENT_CATEGORIES = [
    'CENTRAL GOVT BONDS',
    'STATE GOVT BONDS',
    'TREASURY BILLS',
    'CENTRAL GOVERNMENT BONDS',
    'STATE GOVERNMENT BONDS',
    'T-BILLS'
];

export const VALID_PORTFOLIOS = ['FVLG', 'FVSS', 'AMRT', 'NC/NNC'];

export const CALL_MONEY_INSTRUMENTS = [
    'Call',
    'Notice',
    'Term Borrowing',
    'Call Money Borrowings',
    'Notice Money Borrowings',
    'Term Money Borrowings'
];

// Instrument names for Outstanding Sources of Funds
export const SOURCE_OF_FUNDS_INSTRUMENTS = {
    CALL_MONEY: ['Call Money Borrowings', 'CALL MONEY BORROWINGS'],
    NOTICE_MONEY: ['Notice Money Borrowings', 'NOTICE BORROWING', 'NOTICE BORROWING (NDS)'],
    TERM_MONEY: ['Term Money Borrowings', 'TERM BORROWING', 'TERM BORROWING (NDS)'],
    RBI_REFINANCE: ['RBI-Refinance', 'RBI - REFINANCE', 'RBI-REFINANCE'],
    TREPS: ['TREPS Borrowing', 'TREPS BORROWING'],
    INTER_CORPORATE: ['Inter-Corporate Deposits', 'INTER-CORPORATE DEPOSITS'],
    MARKET_REPO: ['Market Repo', 'MARKET REPO']
};

export const NUMERIC_COLUMNS = [
    'quantity', 'mktNominalVal', 'price', 'rateYield', 
    'bookValue', 'accruedInterestDays', 'accruedInterestAmount',
    'settlementAmount', 'brokerageAmount', 'taxOtherCharges',
    'holdingCost', 'profitLoss', 'faceValue', 'leg1Price',
    'leg2Price', 'rate', 'principal', 'baseEqvlnt',
    'marketValue', 'marketPrice', 'wap', 'mDuration',
    'pvbp', 'accruedInterest', 'ownStock', 'repo',
    'rbiRefinance', 'collateral', 'lien', 'sgf',
    'derivative', 'treps', 'deflt', 'totalPledged',
    'netPosition', 'settlementAmountLeg1', 'settlementAmountLeg2',
    'outstandingAmount', 'tenor', 'interestAmount',
    'principalPlusInterest', 'spread'
  ];
  
  // For date columns
  export const DATE_COLUMNS = [
    'valueDate', 'dealDate', 'maturityDate', 'authorizerDate',
    'date', 'lastInterestDate', 'nextInterestDate'
  ];
  