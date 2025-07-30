export interface UploadedFiles {
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
    processedData: ValuationCalculatedValues;
    dealDates: string[];
    error?: string;
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

export const G_SEC_COLUMN_MAPPING: Record<string, string> = {
    'ISIN':'ISIN',
    'Description':'Description',
    'Coupon':'Coupon',
    'Maturity':'Maturity (dd-mmm-yyyy)',
    'Price':'Price(Rs)',
    'YTM%':'YTM% p.a. (Semi-Annual)'

    // Note: Removed operationType, dealCurrency, interestPractice, etc. 
    // as they don't exist in the Prisma schema
};
