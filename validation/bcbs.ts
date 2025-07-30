import { z } from "zod";
import { EntityType, Status } from "@prisma/client";

// Common query params validation for entity
export const entityQuerySchema = z.object({
 entityName: z.string({
   required_error: "Entity name is required.",
   invalid_type_error: "Entity name is required."
 }),
 type: z.enum([...Object.values(EntityType)] as [string, ...string[]], {
   required_error: "Entity type is required.",
   invalid_type_error: "Invalid entity type provided."
 }),
 year:  z.union([
    z.string(),
    z.number()
  ]).transform(val => Number(val))
});

// For /bcbs/repository and /bcbs/ GET endpoints
export const getBCBSDataSchema = z.object({
    entityName: z.string({
      required_error: "Entity name is required.",
      invalid_type_error: "Entity name is required."
    }),
    entityType: z.enum([...Object.values(EntityType)] as [string, ...string[]], {
        required_error: "Entity type is required.",
        invalid_type_error: "Invalid entity type provided."
      }),
    entityYear:  z.union([
       z.string(),
       z.number()
     ]).transform(val => Number(val))
   });;

// For /bcbs/ POST endpoint (Update row)
export const updateBCBSRowSchema = z.object({
 id: z.number({
   required_error: "ID is required for updating data.",
   invalid_type_error: "ID must be a number."
 }),
 applicability: z.string().nullable().optional(),
 policyReference: z.string().nullable().optional(),
 policyExtract: z.string().nullable().optional(),
 processCoverage: z.string().nullable().optional(),
 status: z.enum([...Object.values(Status)] as [string, ...string[]])
});

// For /bcbs/status POST endpoint 
export const updateStatusSchema = z.object({
 id: z.number({
   required_error: "ID is required.",
   invalid_type_error: "ID must be a number."
 }),
 status: z.enum(['APPROVED', 'REJECTED'] as const, {
   required_error: "Status is required.",
   invalid_type_error: "Invalid status. Only APPROVED or REJECTED allowed."
 }),
 checkerRemarks: z.string({
   required_error: "Checker remarks are required.",
   invalid_type_error: "Checker remarks are required."
 })
});

// For /bcbs/pending and /bcbs/unfilled GET endpoints
export const getByEntityIdSchema = z.object({
 entityId: z.number({
   required_error: "Entity ID is required.",
   invalid_type_error: "Entity ID must be a number."
 })
});

// For /bcbs/upload-excel POST endpoint
export const uploadExcelSchema = z.object({
 entityId: z.number({
   required_error: "Entity ID is required.",
   invalid_type_error: "Entity ID must be a number."
 }),
 data: z.array(z.object({
   bcbsCommonSrNo: z.number(),
   bcbsCommonCircularReference: z.string(),
   applicability: z.string().nullable(),
   policyReference: z.string().nullable(),
   policyExtract: z.string().nullable(),
   processCoverage: z.string().nullable(),
   checkerRemarks: z.string().nullable(),
   status: z.enum([...Object.values(Status)] as [string, ...string[]]).nullable()
 }), {
   required_error: "Data array is required.",
   invalid_type_error: "Request body must contain a data array."
 }).nonempty("Data array cannot be empty.")
});

// Checker routes validation schemas
export const checkerStatusUpdateSchema = z.object({
 id: z.number({
   required_error: "ID is required.",
   invalid_type_error: "ID must be a number."
 }),
 status: z.enum(['APPROVED', 'REJECTED'] as const, {
   required_error: "Status is required.",
   invalid_type_error: "Invalid status. Only APPROVED or REJECTED allowed."
 }),
 checkerRemarks: z.string({
   required_error: "Checker remarks are required.",
   invalid_type_error: "Checker remarks are required."
 })
});

export const checkerStatusFilterSchema = z.object({
 entityName: z.string({
   required_error: "Entity name is required.",
   invalid_type_error: "Entity name is required."
 }),
 entityType: z.enum([...Object.values(EntityType)] as [string, ...string[]], {
   required_error: "Entity type is required.", 
   invalid_type_error: "Invalid entity type."
 }),
 entityYear:  z.union([
    z.string(),
    z.number()
  ]).transform(val => Number(val)),
 status: z.enum([...Object.values(Status)] as [string, ...string[]], {
   required_error: "Status is required.",
   invalid_type_error: "Invalid status."
 })
});