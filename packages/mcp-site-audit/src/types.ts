import { z } from "zod";

// Re-export shared types
export type {
  AuditResult,
  PerformanceMetrics,
  WCAGViolation,
  ResponsiveIssue,
} from "@the-closer/shared";

/**
 * Audit configuration for the MCP server
 */
export const AuditConfigSchema = z.object({
  url: z.string().url(),
  leadId: z.string().uuid().optional(),
  checkMobile: z.boolean().default(true),
  checkPerformance: z.boolean().default(true),
  checkAccessibility: z.boolean().default(true),
  checkCoverage: z.boolean().default(true),
  captureScreenshots: z.boolean().default(true),
  captureVideo: z.boolean().default(false),
  viewports: z
    .array(
      z.object({
        width: z.number().int().positive(),
        height: z.number().int().positive(),
        deviceName: z.string().optional(),
        isMobile: z.boolean().default(false),
      })
    )
    .default([
      { width: 375, height: 812, deviceName: "iPhone X", isMobile: true },
      { width: 1920, height: 1080, deviceName: "Desktop", isMobile: false },
    ]),
  timeout: z.number().int().positive().default(30000),
});

export type AuditConfig = z.infer<typeof AuditConfigSchema>;
