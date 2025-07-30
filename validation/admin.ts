// validation/admin.ts
import { z } from "zod";
import { EntityType } from "@prisma/client";

export const addEntitySchema = z.object({
 name: z.string({
   required_error: "Entity name is required.",
   invalid_type_error: "Entity name is required."
 })
 .regex(/^[A-Za-z0-9\s]+$/, "Entity name can only contain letters, numbers, and spaces."),
 
 type: z.enum([...Object.values(EntityType)] as [string, ...string[]], {
   required_error: "Entity type is required.",
   invalid_type_error: "Invalid entity type provided."
 }),

 year: z.number({
   required_error: "Entity year is required.",
   invalid_type_error: "Year must be a number."
 }),

 previousData: z.boolean().optional()
});

export const deleteEntitySchema = z.object({
 id: z.number({
   required_error: "Entity ID is required.",
   invalid_type_error: "ID must be a number."
 })
});

export const uploadFileSchema = z.object({
 entityId: z.number({
   required_error: "Entity ID is required.", 
   invalid_type_error: "Entity ID must be a number."
 })
});

export const getEntitiesFilesSchema = z.object({
 entityId: z.union([
   z.string(),
   z.literal('all')
 ]),
 page: z.string().min(1).optional(),
 pageSize: z.string().min(1).optional()
});

export const deleteFileSchema = z.object({
 fileId: z.string({
   required_error: "File ID is required.",
   invalid_type_error: "File ID must be a string."
 })
});

// validation/user.ts
export const getPaginatedEntitySchema = z.object({
 page: z.number({
   required_error: "Page is required.",
   invalid_type_error: "Page must be a number."
 }).min(1, "Page must be greater than 0."),

 pageSize: z.number({
   required_error: "Page size is required.",
   invalid_type_error: "Page size must be a number."
 }).min(1, "Page size must be greater than 0."),

 search: z.string().optional()
});