import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

// schema for checker submissions
const checkerSubmissionSchema = z.object({
  circularState: z.enum(['INITIATED', 'REJECTED', 'CLOSURE']),
  remarks: z.string().min(1, "Remarks are required")
});

// schema for maker submissions
const makerSubmissionSchema = z.object({
  // basic fields with validations
  applicable: z.enum(['APPLICABLE', 'NOT_APPLICABLE'], {
    required_error: "Applicable status is required",
    invalid_type_error: "Applicable must be either 'APPLICABLE' or 'NOT_APPLICABLE'"
  }),

  // reqd fields
  financialYear: z.string().min(1, "Financial year is required"),
  dateOfDissemination: z.string().min(1, "Date of dissemination is required"),
  actionType: z.string().min(1, "Action type is required"),
  gist: z.string().min(1, "Gist is required"),

  // boolean fields
  policyToUpdate: z.boolean({
    required_error: "Policy to update flag is required"
  }),
  toBePlacedToBoardOrCommittee: z.boolean({
    required_error: "Board/Committee placement flag is required"
  }),
  linkedToEarlierCircular: z.boolean({
    required_error: "Linked to earlier circular flag is required"
  }),
  regulatoryTimelines: z.boolean({
    required_error: "Regulatory timelines flag is required"
  }),

  // conditional fields
  applicability: z.string().optional().nullable(),
  reasonForNotApplicable: z.string().optional().nullable(),
  committeeName: z.string().optional().nullable(),
  regulatoryDeadline: z.string().optional().nullable(),
  relatedCircularNumbers: z.array(z.number()).optional(),
}).superRefine((data, ctx) => {
  if (data.applicable === 'APPLICABLE') {
    if (!data.applicability?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Applicability description is required when marked as Applicable",
        path: ["applicability"]
      });
    }
  }

  if (data.applicable === 'NOT_APPLICABLE') {
    if (!data.reasonForNotApplicable?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Reason for not applicable is required when marked as Not Applicable",
        path: ["reasonForNotApplicable"]
      });
    }
  }

  if (data.toBePlacedToBoardOrCommittee) {
    if (!data.committeeName?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Committee name is required when marked for board/committee placement",
        path: ["committeeName"]
      });
    }
  }

  if (data.regulatoryTimelines) {
    if (!data.regulatoryDeadline) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Regulatory deadline is required when regulatory timelines is true",
        path: ["regulatoryDeadline"]
      });
    }
  }

  if (data.linkedToEarlierCircular) {
    if (!data.relatedCircularNumbers || !Array.isArray(data.relatedCircularNumbers) || data.relatedCircularNumbers.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one related circular must be selected when linked to earlier circular is true",
        path: ["relatedCircularNumbers"]
      });
    }
  }

  if (data.linkedToEarlierCircular === false) {
    if (data.relatedCircularNumbers && 
        Array.isArray(data.relatedCircularNumbers) && 
        data.relatedCircularNumbers.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "No circulars should be linked when 'Linked to earlier circular' is set to No",
        path: ["relatedCircularNumbers"]
      });
    }
  }

  try {
    if (data.dateOfDissemination) {
      const date = new Date(data.dateOfDissemination);
      if (isNaN(date.getTime())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Invalid date of dissemination format",
          path: ["dateOfDissemination"]
        });
      }
    }
    
    if (data.regulatoryDeadline) {
      const date = new Date(data.regulatoryDeadline);
      if (isNaN(date.getTime())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Invalid regulatory deadline format",
          path: ["regulatoryDeadline"]
        });
      }
    }
  } catch (error) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Invalid date format",
      path: ["dateOfDissemination"]
    });
  }
}).transform((data) => {
  return {
    ...data,
    dateOfDissemination: new Date(data.dateOfDissemination),
    regulatoryDeadline: data.regulatoryDeadline ? new Date(data.regulatoryDeadline) : null,
    // for related circular numbers
    relatedCircularNumbers: data.linkedToEarlierCircular && 
      Array.isArray(data.relatedCircularNumbers) && 
      data.relatedCircularNumbers.length > 0
        ? data.relatedCircularNumbers 
        : [],
    // Remove any non-schema fields
    RelatedCircular: undefined
  };
});

// The main validation middleware
// Define interfaces for the validation response
interface ValidationErrorResponse {
  error: true;
  message: string;
  errors: {
    [key: string]: string[];
  };
}

interface ValidationSuccessResponse {
  error?: false;
  message?: string;
}

type ValidationResponse = ValidationErrorResponse | ValidationSuccessResponse;

export const validateDisseminationUpdate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const isCheckerSubmission = 'circularState' in req.body;
    
    if (isCheckerSubmission) {
      const validatedData = await checkerSubmissionSchema.parseAsync(req.body);
      req.body = validatedData;
    } else {
      const validatedData = await makerSubmissionSchema.parseAsync(req.body);
      req.body = validatedData;
    }
    
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      // Define interface for error structure
      interface ValidationErrors {
        [key: string]: string[];
      }

      // Group errors by field for better frontend handling
      const errorsByField = error.errors.reduce<ValidationErrors>((acc, err) => {
        const fieldName = String(err.path[0] || 'general');
        if (!acc[fieldName]) {
          acc[fieldName] = [];
        }
        acc[fieldName].push(err.message);
        return acc;
      }, {});

      res.status(400).json({
        error: true,
        message: "Validation failed",
        errors: errorsByField
      });
      return;
    }
    next(error);
  }
};