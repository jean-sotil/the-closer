/**
 * Email Template Engine Module
 *
 * Dynamic email template system with Handlebars rendering,
 * conditional blocks, and tone customization.
 */

// Main template engine class
export { TemplateEngine } from "./template-engine.js";

// Default templates
export {
  DEFAULT_TEMPLATES,
  DEFAULT_TEMPLATE_IDS,
  INITIAL_OUTREACH_TEMPLATE,
  FOLLOWUP_1_TEMPLATE,
  FOLLOWUP_2_TEMPLATE,
  getDefaultTemplate,
} from "./default-templates.js";

// Types and schemas
export type {
  EmailContext,
  TemplateVariables,
  RenderedEmail,
  StoredTemplate,
  TemplateEngineConfig,
  ToneSeverity,
  ToneReplacements,
  TemplateEngineErrorCodeType,
} from "./types.js";

export {
  RenderedEmailSchema,
  StoredTemplateSchema,
  TemplateEngineConfigSchema,
  TemplateEngineErrorCode,
  getTopPainPoint,
  formatLoadTime,
  formatScore,
} from "./types.js";
