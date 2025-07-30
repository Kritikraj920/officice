import { z } from "zod";
import { EntityType, Theme, LevelOfDocumentation, LevelOfAutomationOfControl, ComplianceStatus, RiskRating, MapStatus, Status } from "@prisma/client";

const dateSchema = z.string()
  .refine(
    (date) => {
      return (
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/.test(date) || // ISO format
        /^\d{4}-\d{2}-\d{2}$/.test(date) // YYYY-MM-DD format
      );
    },
    { message: "Invalid date format. Use YYYY-MM-DD or ISO 8601." }
  )
  .refine(
    (date) => !isNaN(new Date(date).getTime()),
    { message: "Invalid date value." }
  )
  .nullable();

const scoreSchema = z.number().int().min(0).max(100).nullable();

// For /rbi/repository and /rbi/ GET endpointsin
export const getRBIDataSchema = z.object({
  entityName: z
    .string({
      required_error: "Entity name is required.",
      invalid_type_error: "Entity name must be a string.",
    })
    .trim(),
  entityType: z.enum([...Object.values(EntityType)] as [string, ...string[]], {
    required_error: "Entity type is required.",
    invalid_type_error: "Invalid entity type provided.",
  }),
  entityYear: z
    .union([z.string(), z.number()])
    .transform((val) => Number(val))
    .refine((val) => Number.isInteger(val) && val > 0, {
      message: "Entity year must be a positive integer.",
    }),
});

// RBI row base schema for reuse
const rbiRowBaseSchema = {
  applicability: z.enum([
    "NOT_APPLICABLE",
    "APPLICABLE"
  ]).nullable(),
  policyReference: z.string().nullable(),
  policyExtract: z.string().nullable(),
  processCoverage: z.string().nullable(),
  keyControls: z.string().nullable(),
  observationReference: z.string().nullable(),
  checkerRemarks: z.string().nullable(),
  theme: z.enum([...Object.values(Theme)] as [string, ...string[]]).nullable(),
  levelOfDocumentationOfControl: z.enum([...Object.values(LevelOfDocumentation)] as [string, ...string[]]).nullable(),
  levelOfAutomationOfControl: z.enum([...Object.values(LevelOfAutomationOfControl)] as [string, ...string[]]).nullable(),
  overallControlDesignScore: scoreSchema,
  complianceStatus: z.enum([...Object.values(ComplianceStatus)] as [string, ...string[]]).nullable(),
  complianceScore: scoreSchema,
  finalRiskScore: scoreSchema,
  riskRating: z.enum([...Object.values(RiskRating)] as [string, ...string[]]).nullable(),
  managementResponses: z.string().nullable(),
  managementActionPlanTimelineDate: dateSchema,
  mapAgeing: z.string().nullable(),
  mapStatus: z.enum([...Object.values(MapStatus)] as [string, ...string[]]).nullable(),
};

// For /rbi/ POST endpoint (Update row)
export const updateRBIRowSchema = z.object({
  id: z.number({
    required_error: "ID is required.",
    invalid_type_error: "ID must be a number.",
  }),
  // RBICommon fields (optional, as they’re sent but not updated)
  srNo: z.number().optional(),
  circularReference: z.string().optional(),
  regulator: z.string().optional(),
  sectionReference: z.string().optional().nullable(),
  circularExtract: z.string().optional(),
  // RBIApplicability fields (all optional except id)
  status: z.enum([...Object.values(Status)] as [string, ...string[]]).optional(),
  applicability: z.enum(["NOT_APPLICABLE", "APPLICABLE"]).nullable().optional(),
  policyReference: z.string().nullable().optional(),
  policyExtract: z.string().nullable().optional(),
  processCoverage: z.string().nullable().optional(),
  keyControls: z.string().nullable().optional(),
  observationReference: z.string().nullable().optional(),
  checkerRemarks: z.string().nullable().optional(),
  theme: z.enum([...Object.values(Theme)] as [string, ...string[]]).nullable().optional(),
  levelOfDocumentationOfControl: z
    .enum([...Object.values(LevelOfDocumentation)] as [string, ...string[]])
    .nullable()
    .optional(),
  levelOfAutomationOfControl: z
    .enum([...Object.values(LevelOfAutomationOfControl)] as [string, ...string[]])
    .nullable()
    .optional(),
  overallControlDesignScore: scoreSchema.optional(),
  complianceStatus: z
    .enum([...Object.values(ComplianceStatus)] as [string, ...string[]])
    .nullable()
    .optional(),
  complianceScore: scoreSchema.optional(),
  finalRiskScore: scoreSchema.optional(),
  riskRating: z.enum([...Object.values(RiskRating)] as [string, ...string[]]).nullable().optional(),
  managementResponses: z.string().nullable().optional(),
  managementActionPlanTimelineDate: dateSchema.optional(),
  mapAgeing: z.string().nullable().optional(),
  mapStatus: z.enum([...Object.values(MapStatus)] as [string, ...string[]]).nullable().optional(),
  // Frontend-only fields
  isEditable: z.boolean().optional(),
  isSubmitDisabled: z.boolean().optional(),
});

// For /rbi/upload-excel POST endpoint
export const uploadExcelSchema = z.object({
  entityId: z.number({
    required_error: "Entity ID is required.",
    invalid_type_error: "Entity ID must be a number.",
  }),
  data: z
    .array(
      z.object({
        rbiCommonSrNo: z.number(),
        rbiCommonCircularReference: z.string(),
        status: z.enum([...Object.values(Status)] as [string, ...string[]]).default("NONE"),
        applicability: z.enum(["NOT_APPLICABLE", "APPLICABLE"]).nullable().optional(),
        policyReference: z.string().nullable().optional(),
        policyExtract: z.string().nullable().optional(),
        processCoverage: z.string().nullable().optional(),
        keyControls: z.string().nullable().optional(),
        observationReference: z.string().nullable().optional(),
        checkerRemarks: z.string().nullable().optional(),
        theme: z
          .enum([...Object.values(Theme)] as [string, ...string[]])
          .nullable()
          .optional(),
        levelOfDocumentationOfControl: z
          .enum([...Object.values(LevelOfDocumentation)] as [string, ...string[]])
          .nullable()
          .optional(),
        levelOfAutomationOfControl: z
          .enum([...Object.values(LevelOfAutomationOfControl)] as [string, ...string[]])
          .nullable()
          .optional(),
        overallControlDesignScore: scoreSchema.optional(),
        complianceStatus: z
          .enum([...Object.values(ComplianceStatus)] as [string, ...string[]])
          .nullable()
          .optional(),
        complianceScore: scoreSchema.optional(),
        finalRiskScore: scoreSchema.optional(),
        riskRating: z
          .enum([...Object.values(RiskRating)] as [string, ...string[]])
          .nullable()
          .optional(),
        managementResponses: z.string().nullable().optional(),
        managementActionPlanTimelineDate: dateSchema.optional(),
        mapAgeing: z.string().nullable().optional(),
        mapStatus: z
          .enum([...Object.values(MapStatus)] as [string, ...string[]])
          .nullable()
          .optional(),
      })
    )
    .min(1, "Data array cannot be empty.")
    .describe("Excel upload data"),
});

// Checker routes validation schemas
export const checkerStatusUpdateSchema = z.object({
  id: z.number({
    required_error: "ID is required.",
    invalid_type_error: "ID must be a number.",
  }),
  status: z.enum(["APPROVED", "REJECTED"], {
    required_error: "Status is required.",
    invalid_type_error: "Invalid status. Only APPROVED or REJECTED allowed.",
  }),
  checkerRemarks: z
    .string({
      required_error: "Checker remarks are required.",
      invalid_type_error: "Checker remarks must be a string.",
    })
    .min(1, "Checker remarks cannot be empty."),
});

export const checkerStatusFilterSchema = z.object({
  entityName: z
    .string({
      required_error: "Entity name is required.",
      invalid_type_error: "Entity name must be a string.",
    })
    .trim(),
  entityType: z.enum([...Object.values(EntityType)] as [string, ...string[]], {
    required_error: "Entity type is required.",
    invalid_type_error: "Invalid entity type.",
  }),
  entityYear: z
    .union([z.string(), z.number()])
    .transform((val) => Number(val))
    .refine((val) => Number.isInteger(val) && val > 0, {
      message: "Entity year must be a positive integer.",
    }),
  status: z.enum([...Object.values(Status)] as [string, ...string[]], {
    required_error: "Status is required.",
    invalid_type_error: "Invalid status.",
  }),
});