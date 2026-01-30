import { z, type ZodSchema, type ZodError, type ZodTypeDef } from "zod";

import { ValidationError } from "../errors/index.js";
import {
  LeadProfileSchema,
  AuditResultSchema,
  CampaignConfigSchema,
  LeadFiltersSchema,
} from "../types/index.js";

import { SearchCriteriaSchema, CampaignSubmissionSchema } from "./schemas.js";

/**
 * Convert Zod error to field-level error map
 */
function zodErrorToFields(error: ZodError): Record<string, string[]> {
  const fields: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const path = issue.path.join(".");
    const key = path || "_root";

    if (!fields[key]) {
      fields[key] = [];
    }

    fields[key].push(issue.message);
  }

  return fields;
}

/**
 * Generic validation function that throws ValidationError on failure
 * Returns the Zod output type (after transforms and defaults are applied)
 */
export function validate<Output, Def extends ZodTypeDef, Input>(
  schema: z.ZodType<Output, Def, Input>,
  data: unknown,
  entityName: string = "data"
): Output {
  const result = schema.safeParse(data);

  if (!result.success) {
    const fields = zodErrorToFields(result.error);
    throw new ValidationError(`Invalid ${entityName}`, { fields });
  }

  return result.data;
}

/**
 * Generic safe validation that returns Result type
 */
export function validateSafe<Output, Def extends ZodTypeDef, Input>(
  schema: z.ZodType<Output, Def, Input>,
  data: unknown
):
  | { success: true; data: Output }
  | {
      success: false;
      error: ValidationError;
      fields: Record<string, string[]>;
    } {
  const result = schema.safeParse(data);

  if (!result.success) {
    const fields = zodErrorToFields(result.error);
    return {
      success: false,
      error: new ValidationError("Validation failed", { fields }),
      fields,
    };
  }

  return { success: true, data: result.data };
}

/**
 * Validate a LeadProfile
 */
export function validateLeadProfile(
  data: unknown
): z.output<typeof LeadProfileSchema> {
  return validate(LeadProfileSchema, data, "LeadProfile");
}

/**
 * Validate an AuditResult
 */
export function validateAuditResult(
  data: unknown
): z.output<typeof AuditResultSchema> {
  return validate(AuditResultSchema, data, "AuditResult");
}

/**
 * Validate a CampaignConfig
 */
export function validateCampaignConfig(
  data: unknown
): z.output<typeof CampaignConfigSchema> {
  return validate(CampaignConfigSchema, data, "CampaignConfig");
}

/**
 * Validate LeadFilters
 */
export function validateLeadFilters(
  data: unknown
): z.output<typeof LeadFiltersSchema> {
  return validate(LeadFiltersSchema, data, "LeadFilters");
}

/**
 * Validate SearchCriteria
 */
export function validateSearchCriteria(
  data: unknown
): z.output<typeof SearchCriteriaSchema> {
  return validate(SearchCriteriaSchema, data, "SearchCriteria");
}

/**
 * Validate CampaignSubmission
 */
export function validateCampaignSubmission(
  data: unknown
): z.output<typeof CampaignSubmissionSchema> {
  return validate(CampaignSubmissionSchema, data, "CampaignSubmission");
}

/**
 * Validate an array of items
 */
export function validateArray<T>(
  schema: ZodSchema<T>,
  data: unknown,
  entityName: string = "items"
): T[] {
  const arraySchema = z.array(schema);
  return validate(arraySchema, data, entityName);
}

/**
 * Type guard for checking if value is a valid LeadProfile
 */
export function isValidLeadProfile(
  data: unknown
): data is z.output<typeof LeadProfileSchema> {
  return LeadProfileSchema.safeParse(data).success;
}

/**
 * Type guard for checking if value is a valid AuditResult
 */
export function isValidAuditResult(
  data: unknown
): data is z.output<typeof AuditResultSchema> {
  return AuditResultSchema.safeParse(data).success;
}

/**
 * Type guard for checking if value is a valid CampaignConfig
 */
export function isValidCampaignConfig(
  data: unknown
): data is z.output<typeof CampaignConfigSchema> {
  return CampaignConfigSchema.safeParse(data).success;
}
