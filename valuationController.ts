import { Request, Response } from 'express';
import { ValuationService } from '../services/valuation';
import { UploadedFiles } from '../services/valuation';
import { PrismaClient } from '@prisma/client';
import * as ExcelJS from 'exceljs';

export const uploadAndProcessFiles = async (req: Request, res: Response): Promise<void> => {
    try {
        // Extract files from multer
        const files = req.files as { [fieldname: string]: Express.Multer.File[] };
        console.log(files);
        if (!files || Object.keys(files).length === 0) {
            res.status(400).json({ 
                success: false,
                error: 'No files uploaded'
            });
            return;
        }
        
        // Check for required FIMMDA file
        if (!files['FIMMDA_VAL'] || files['FIMMDA_VAL'].length === 0) {
            res.status(400).json({ 
                success: false,
                error: 'FIMMDA Valuation file is required'
            });
            return;
        }
        
        // Prepare files object
        const uploadedFiles: UploadedFiles = {
            FIMMDA_VAL: files['FIMMDA_VAL'][0],
            G_SEC: files['G_SEC']?.[0],
            SDL: files['SDL']?.[0],
            NSE: files['NSE']?.[0],
            Treasury_Curve: files['Treasury_Curve']?.[0],
            CD_CURVE: files['CD_CURVE']?.[0],
            SLV: files['SLV']?.[0]
        };
        
        console.log('Processing valuation files:', Object.keys(uploadedFiles).filter(k => uploadedFiles[k]));
        
        // Process files
        const valuationService = new ValuationService();
        const result = await valuationService.ProcessFiles(uploadedFiles, req.user?.id);

        
        // res.json(result);
        
    } catch (error: any) {
        console.error('PDR1 processing error:', error);
        res.status(500).json({ 
            success: false,
            error: error.message || 'An error occurred during PDR1 processing',
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};