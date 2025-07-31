export interface UploadedFiles {
    FIMMDA_VAL?: Express.Multer.File;
    G_SEC?: Express.Multer.File;
    SDL?: Express.Multer.File;
    NSE?: Express.Multer.File;
    Treasury_Curve?: Express.Multer.File;
    CD_CURVE?: Express.Multer.File;
    // FIMMDA_VAL?: Express.Multer.File;
    SLV?: Express.Multer.File;
}
export interface ValuationProcessResult {
    success: boolean;
    batchId?: string;
    summary: {
        totalRecords: number;
        processedRecords: number;
        errorRecords: number;
        processingTime: number;
    };
}
export interface ValuationCalculatedValues {
    [sectionId: string]: {
        [date: string]: number;
    };
}
export interface ProcessingResult {
    totalRecords: number;
    processedRecords: number;
    errorRecords: number;
}

export const FIMMDA_COLUMN_MAPPING: Record<string, string> = {
  'valuation date': 'valuationDate',
  'instrument id': 'instrumentId',
  'portfolio': 'portfolio',
  'isin': 'isin',
  'security name': 'securityName',
  'category': 'category',
  'sub category': 'subCategory',
  'instrument type': 'instrumentType',
  'slr/ nslr': 'slrNslr',
  'issuer': 'issuer',
  'face value per unit': 'faceValuePerUnit',
  'quantity': 'quantity',
  'face value': 'faceValue',
  'wap': 'wap',
  'current yield': 'currentYield',
  'book value': 'bookValue',
  'maturity date': 'maturityDate',
  'coupon': 'coupon',
  'market value': 'marketValue',
  'market price': 'marketPrice',
  'mp as per valuation': 'marketPriceValuation',
  'difference': 'difference',
  'market yield': 'marketYield',
  'appreciation': 'appreciation',
  'depreciation': 'depreciation',
};

export const G_SEC_COLUMN_MAPPING: Record<string, string> = {
    'isin':'ISIN',
    'description':'Description',
    'coupon':'Coupon',
    'maturity(dd-mmm-yyyy)':'Maturity',
    'price(rs)':'Price',
    'ytm% p.a. (semi-annual)':'YTM',

    // Note: Removed operationType, dealCurrency, interestPractice, etc. 
    // as they don't exist in the Prisma schema
};
export const SDL_COLUMN_MAPPING: Record<string, string> = {
    'isin':'ISIN',
    'description':'Description',
    'coupon':'Coupon',
    'maturity(dd-mmm-yyyy)':'Maturity',
    'price(rs)':'Price',
    'ytm% p.a. (semi-annual)':'YTM',

    // Note: Removed operationType, dealCurrency, interestPractice, etc. 
    // as they don't exist in the Prisma schema
};
export const FIMDDA_COLUMN_MAPPING: Record<string, string> = {
    'isin':'ISIN',
    'description':'Description',
    'coupon':'Coupon',
    'maturity(dd-mmm-yyyy)':'Maturity',
    'price(rs)':'Price',
    'ytm% p.a. (semi-annual)':'YTM',

    // Note: Removed operationType, dealCurrency, interestPractice, etc. 
    // as they don't exist in the Prisma schema
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