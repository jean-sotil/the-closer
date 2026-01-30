import { z } from "zod";

// Re-export all constants
export * from "./constants.js";

// ============================================
// Environment Configuration Schema
// ============================================

/**
 * Environment configuration schema with Zod validation
 */
export const EnvConfigSchema = z.object({
  // Supabase (Required for data storage)
  SUPABASE_URL: z.string().url().describe("Supabase project URL"),
  SUPABASE_ANON_KEY: z.string().min(1).describe("Supabase anonymous key"),
  SUPABASE_SERVICE_KEY: z
    .string()
    .min(1)
    .optional()
    .describe("Supabase service role key (for admin operations)"),

  // Mailgun (Required for email outreach)
  MAILGUN_API_KEY: z.string().min(1).optional().describe("Mailgun API key"),
  MAILGUN_DOMAIN: z.string().min(1).optional().describe("Mailgun domain"),

  // Google Calendar (Optional - for scheduling)
  GOOGLE_CLIENT_ID: z.string().min(1).optional().describe("Google OAuth client ID"),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional().describe("Google OAuth client secret"),
  GOOGLE_REFRESH_TOKEN: z.string().min(1).optional().describe("Google OAuth refresh token"),

  // VAPI Voice AI (Optional - Phase 3)
  VAPI_API_KEY: z.string().min(1).optional().describe("VAPI.ai API key for voice calls"),

  // Browserbase (Optional - cloud browser alternative)
  BROWSERBASE_API_KEY: z.string().min(1).optional().describe("Browserbase API key"),
  BROWSERBASE_PROJECT_ID: z.string().min(1).optional().describe("Browserbase project ID"),

  // Application settings
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development")
    .describe("Node environment"),

  // Optional feature flags
  ENABLE_VOICE_CALLS: z
    .string()
    .transform((v) => v === "true")
    .default("false")
    .describe("Enable VAPI voice calls"),
  ENABLE_CALENDAR_BOOKING: z
    .string()
    .transform((v) => v === "true")
    .default("false")
    .describe("Enable Google Calendar booking"),
  USE_BROWSERBASE: z
    .string()
    .transform((v) => v === "true")
    .default("false")
    .describe("Use Browserbase instead of local Puppeteer"),
});

export type EnvConfig = z.infer<typeof EnvConfigSchema>;

// ============================================
// Configuration Singleton
// ============================================

let cachedConfig: EnvConfig | null = null;

/**
 * Load and validate environment configuration.
 * Throws descriptive error if required variables are missing.
 */
export function loadEnvConfig(): EnvConfig {
  const result = EnvConfigSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.issues.map((issue) => {
      const path = issue.path.join(".");
      return `  - ${path}: ${issue.message}`;
    });

    throw new Error(
      `Environment configuration error:\n${errors.join("\n")}\n\n` +
        `Please check your .env file and ensure all required variables are set.`
    );
  }

  return result.data;
}

/**
 * Get the application configuration (singleton pattern).
 * Loads and caches the config on first call.
 */
export function getConfig(): EnvConfig {
  if (!cachedConfig) {
    cachedConfig = loadEnvConfig();
  }
  return cachedConfig;
}

/**
 * Reset the cached configuration (useful for testing).
 */
export function resetConfig(): void {
  cachedConfig = null;
}

/**
 * Check if a feature is enabled based on config.
 */
export function isFeatureEnabled(
  feature: "voiceCalls" | "calendarBooking" | "browserbase"
): boolean {
  const config = getConfig();
  switch (feature) {
    case "voiceCalls":
      return config.ENABLE_VOICE_CALLS && !!config.VAPI_API_KEY;
    case "calendarBooking":
      return (
        config.ENABLE_CALENDAR_BOOKING &&
        !!config.GOOGLE_CLIENT_ID &&
        !!config.GOOGLE_CLIENT_SECRET
      );
    case "browserbase":
      return (
        config.USE_BROWSERBASE &&
        !!config.BROWSERBASE_API_KEY &&
        !!config.BROWSERBASE_PROJECT_ID
      );
    default:
      return false;
  }
}

/**
 * Validate that required services are configured.
 * Returns an array of missing service configurations.
 */
export function validateRequiredServices(
  services: Array<"supabase" | "mailgun" | "google" | "vapi" | "browserbase">
): string[] {
  const config = getConfig();
  const missing: string[] = [];

  for (const service of services) {
    switch (service) {
      case "supabase":
        if (!config.SUPABASE_URL || !config.SUPABASE_ANON_KEY) {
          missing.push("Supabase (SUPABASE_URL, SUPABASE_ANON_KEY)");
        }
        break;
      case "mailgun":
        if (!config.MAILGUN_API_KEY || !config.MAILGUN_DOMAIN) {
          missing.push("Mailgun (MAILGUN_API_KEY, MAILGUN_DOMAIN)");
        }
        break;
      case "google":
        if (
          !config.GOOGLE_CLIENT_ID ||
          !config.GOOGLE_CLIENT_SECRET ||
          !config.GOOGLE_REFRESH_TOKEN
        ) {
          missing.push(
            "Google Calendar (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN)"
          );
        }
        break;
      case "vapi":
        if (!config.VAPI_API_KEY) {
          missing.push("VAPI (VAPI_API_KEY)");
        }
        break;
      case "browserbase":
        if (!config.BROWSERBASE_API_KEY || !config.BROWSERBASE_PROJECT_ID) {
          missing.push(
            "Browserbase (BROWSERBASE_API_KEY, BROWSERBASE_PROJECT_ID)"
          );
        }
        break;
    }
  }

  return missing;
}
