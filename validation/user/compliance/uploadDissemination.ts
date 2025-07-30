import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

// Helper function to validate date format remains the same
const isValidDate = (dateStr: string): boolean => {
  const date = new Date(dateStr);
  return date instanceof Date && !isNaN(date.getTime());
};

// Schema definition remains the same
const DisseminationSchema = z.object({
  circularReference: z.string().min(1, 'Circular reference is required'),
  circularTitle: z.string().min(1, 'Circular title is required'),
  regulator: z.string().min(1, 'Regulator is required'),
  regulatorSubDepartment: z.string().min(1, 'Regulator sub department is required'),
  gist: z.string().min(1, 'Gist is required'),
  financialYear: z.string().min(1, 'Financial year is required'),
  customRegulator: z.string().optional(),
  circularWebsiteLink: z.string().url('Invalid URL format').optional(),
  circularDate: z.string().refine(isValidDate, 'Invalid circular date format'),
  regulatoryDeadline: z.string().refine(
    (val) => !val || isValidDate(val),
    'Invalid regulatory deadline format'
  ).optional(),
  applicable: z.enum(['APPLICABLE', 'NOT_APPLICABLE']),
  policyToUpdate: z.enum(['YES', 'NO']),
  regulatoryTimelines: z.enum(['YES', 'NO']),
  linkedToEarlierCircular: z.enum(['YES', 'NO']),
  relatedCircularNumbers: z.array(z.number()).optional(),
  searchedResult: z.array(z.any()).optional(),
  searchTerm: z.string().optional(),
  actionType: z.enum(['YES', 'NO']).optional(),
});

// The corrected middleware function
export const validateDissemination = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Parse the disseminations from the request body
    const disseminationsData = JSON.parse(req.body.disseminations);
    
    if (!Array.isArray(disseminationsData)) {
      res.status(400).json({
        success: false,
        message: 'Invalid data format. Expected an array of disseminations.'
      });
      return;
    }

    // Validate files
    const files = req.files as Express.Multer.File[];
    if (!files || files.length !== disseminationsData.length) {
      res.status(400).json({
        success: false,
        message: 'Please attach the attachment with the dissemination.'
      });
      return;
    }

    // Collect all validation errors
    const allErrors: string[] = [];

    // Validate each dissemination entry
    for (let index = 0; index < disseminationsData.length; index++) {
      const dissemination = disseminationsData[index];
      
      try {
        // Schema validation
        await DisseminationSchema.parseAsync(dissemination);
        
        // Business logic validations
        if (dissemination.regulatoryTimelines === 'YES' && !dissemination.regulatoryDeadline) {
          allErrors.push(`Row ${index + 1}: Regulatory deadline is required when regulatory timelines is YES`);
        }
        
        if (dissemination.linkedToEarlierCircular === 'YES' && 
            (!dissemination.relatedCircularNumbers || dissemination.relatedCircularNumbers.length === 0)) {
          allErrors.push(`Row ${index + 1}: Related circular numbers are required when linked to earlier circular is YES`);
        }
        
        const circularDate = new Date(dissemination.circularDate);
        if (circularDate > new Date()) {
          allErrors.push(`Row ${index + 1}: Circular date cannot be in the future`);
        }
        
        if (dissemination.regulatoryDeadline) {
          const regulatoryDeadline = new Date(dissemination.regulatoryDeadline);
          if (regulatoryDeadline < circularDate) {
            allErrors.push(`Row ${index + 1}: Regulatory deadline must be after circular date`);
          }
        }
        
        // File type validation
        const allowedMimeTypes = [
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'image/jpeg',
          'image/png'
        ];
        
        if (!allowedMimeTypes.includes(files[index].mimetype)) {
          allErrors.push(`Row ${index + 1}: Invalid file type. Allowed types are PDF, XLSX, DOC, DOCX, JPEG, and PNG`);
        }

      } catch (error) {
        if (error instanceof z.ZodError) {
          allErrors.push(...error.errors.map(err => `Row ${index + 1}: ${err.message}`));
        } else {
          allErrors.push(`Row ${index + 1}: Invalid data format`);
        }
      }
    }

    // If there are validation errors, send them back
    if (allErrors.length > 0) {
      res.status(400).json({
        success: false,
        message: 'Fill all the fields correctly',
        errors: allErrors
      });
      return;
    }

    // If all validations pass, attach the validated data and continue
    req.body.validatedDisseminations = disseminationsData;
    next();
    
  } catch (error:any) {
    res.status(400).json({
      success: false,
      message: 'Error processing request',
      error: error.message
    });
    return;
  }
};