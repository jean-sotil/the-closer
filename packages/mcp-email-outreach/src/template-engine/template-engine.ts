import Handlebars from "handlebars";
import { AppError, ValidationError, ErrorCode } from "@the-closer/shared";
import type { LeadProfile, AuditResult } from "@the-closer/shared";
import {
  type EmailContext,
  type TemplateVariables,
  type RenderedEmail,
  type StoredTemplate,
  type TemplateEngineConfig,
  type ToneSeverity,
  type ToneReplacements,
  TemplateEngineConfigSchema,
  getTopPainPoint,
  formatLoadTime,
  formatScore,
} from "./types.js";
import { DEFAULT_TEMPLATES } from "./default-templates.js";

/**
 * Word replacements for tone adjustment
 */
const TONE_REPLACEMENTS: ToneReplacements = {
  issue: {
    urgent: "critical problem",
    normal: "issue",
    friendly: "area for improvement",
  },
  problem: {
    urgent: "serious concern",
    normal: "problem",
    friendly: "opportunity",
  },
  fix: {
    urgent: "resolve immediately",
    normal: "fix",
    friendly: "address",
  },
  broken: {
    urgent: "critically broken",
    normal: "broken",
    friendly: "not working optimally",
  },
  slow: {
    urgent: "dangerously slow",
    normal: "slow",
    friendly: "a bit sluggish",
  },
  bad: {
    urgent: "unacceptable",
    normal: "poor",
    friendly: "could be better",
  },
  failing: {
    urgent: "failing critically",
    normal: "failing",
    friendly: "needs attention",
  },
  must: {
    urgent: "must immediately",
    normal: "should",
    friendly: "might want to",
  },
  urgent: {
    urgent: "extremely urgent",
    normal: "important",
    friendly: "worth looking at",
  },
};

/**
 * Email Template Engine
 *
 * Renders dynamic email templates with audit findings and lead data.
 * Uses Handlebars for variable substitution and conditional blocks.
 */
export class TemplateEngine {
  private readonly config: TemplateEngineConfig;
  private readonly templates = new Map<string, StoredTemplate>();
  private readonly handlebars: typeof Handlebars;

  constructor(config: Partial<TemplateEngineConfig> = {}) {
    // Validate and apply defaults
    const parseResult = TemplateEngineConfigSchema.safeParse(config);
    if (!parseResult.success) {
      throw new ValidationError("Invalid template engine configuration", {
        context: { errors: parseResult.error.errors },
      });
    }
    this.config = parseResult.data;

    // Create isolated Handlebars instance
    this.handlebars = Handlebars.create();

    // Register custom helpers
    this.registerHelpers();

    // Load default templates
    this.loadDefaultTemplates();
  }

  // ============================================
  // Template Rendering
  // ============================================

  /**
   * Render an email template with the given context
   */
  async renderEmail(templateId: string, context: EmailContext): Promise<RenderedEmail> {
    const template = await this.getTemplate(templateId);
    const variables = this.buildTemplateVariables(context);

    try {
      // Compile and render subject
      const subjectTemplate = this.handlebars.compile(template.subject);
      const subject = subjectTemplate(variables);

      // Compile and render HTML body
      const htmlTemplate = this.handlebars.compile(template.htmlBody);
      let html = htmlTemplate(variables);

      // Compile and render text body (use HTML stripped if not provided)
      let text: string;
      if (template.textBody) {
        const textTemplate = this.handlebars.compile(template.textBody);
        text = textTemplate(variables);
      } else {
        text = this.stripHtml(html);
      }

      // Apply tone adjustment if needed
      if (this.config.defaultTone !== "normal") {
        html = this.adjustTone(html, this.config.defaultTone);
        text = this.adjustTone(text, this.config.defaultTone);
      }

      return { subject, html, text };
    } catch (error) {
      throw new AppError(`Failed to render template: ${templateId}`, {
        code: ErrorCode.INTERNAL_ERROR,
        statusCode: 500,
        context: { templateId, error: String(error) },
      });
    }
  }

  /**
   * Render a template with custom tone
   */
  async renderEmailWithTone(
    templateId: string,
    context: EmailContext,
    tone: ToneSeverity
  ): Promise<RenderedEmail> {
    const rendered = await this.renderEmail(templateId, context);

    if (tone !== "normal") {
      return {
        subject: rendered.subject,
        html: this.adjustTone(rendered.html, tone),
        text: this.adjustTone(rendered.text, tone),
      };
    }

    return rendered;
  }

  // ============================================
  // Template Storage
  // ============================================

  /**
   * Get a template by ID
   */
  async getTemplate(id: string): Promise<StoredTemplate> {
    const template = this.templates.get(id);

    if (!template) {
      throw new AppError(`Template not found: ${id}`, {
        code: ErrorCode.NOT_FOUND,
        statusCode: 404,
        context: { templateId: id },
      });
    }

    return template;
  }

  /**
   * Save a template
   */
  async saveTemplate(template: StoredTemplate): Promise<void> {
    // Validate template compiles
    try {
      this.handlebars.compile(template.subject);
      this.handlebars.compile(template.htmlBody);
      if (template.textBody) {
        this.handlebars.compile(template.textBody);
      }
    } catch (error) {
      throw new AppError("Invalid template syntax", {
        code: ErrorCode.VALIDATION_ERROR,
        statusCode: 400,
        context: { templateId: template.id, error: String(error) },
      });
    }

    template.updatedAt = new Date();
    this.templates.set(template.id, template);
  }

  /**
   * Delete a template
   */
  async deleteTemplate(id: string): Promise<void> {
    if (!this.templates.has(id)) {
      throw new AppError(`Template not found: ${id}`, {
        code: ErrorCode.NOT_FOUND,
        statusCode: 404,
        context: { templateId: id },
      });
    }

    this.templates.delete(id);
  }

  /**
   * List all templates
   */
  async listTemplates(): Promise<StoredTemplate[]> {
    return Array.from(this.templates.values());
  }

  /**
   * Check if a template exists
   */
  async templateExists(id: string): Promise<boolean> {
    return this.templates.has(id);
  }

  // ============================================
  // Tone Adjustment
  // ============================================

  /**
   * Adjust the tone of content
   */
  adjustTone(content: string, severity: ToneSeverity): string {
    if (severity === "normal") return content;

    let adjusted = content;

    for (const [original, replacements] of Object.entries(TONE_REPLACEMENTS)) {
      const replacement = replacements[severity];
      // Case-insensitive replacement, preserving original case
      const regex = new RegExp(`\\b${original}\\b`, "gi");
      adjusted = adjusted.replace(regex, (match) => {
        // Preserve capitalization
        if (match[0] === match[0]?.toUpperCase()) {
          return replacement.charAt(0).toUpperCase() + replacement.slice(1);
        }
        return replacement;
      });
    }

    return adjusted;
  }

  // ============================================
  // Variable Building
  // ============================================

  /**
   * Build template variables from context
   */
  private buildTemplateVariables(context: EmailContext): TemplateVariables {
    const { lead, audit, calendarLink, customVariables = {} } = context;

    // Get top pain point
    const topPainPoint = audit ? getTopPainPoint(audit.painPoints) : null;

    // Get first evidence link
    const evidenceLink = audit?.evidence[0]?.url ?? "";

    // Calculate load time from metrics
    const loadTimeMs = audit?.metrics.largestContentfulPaint ?? audit?.metrics.loadComplete;

    // Calculate flags for conditionals
    const hasAudit = audit !== null;
    const slowLoad = loadTimeMs !== undefined && loadTimeMs > this.config.slowLoadThresholdMs;
    const poorPerformance =
      audit?.metrics.performanceScore !== undefined &&
      audit.metrics.performanceScore < this.config.poorPerformanceThreshold;
    const poorAccessibility =
      audit?.accessibilityScore !== undefined &&
      audit.accessibilityScore < this.config.poorAccessibilityThreshold;
    const hasMobileIssues = audit ? !audit.mobileFriendly || audit.responsiveIssues.length > 0 : false;
    const hasCriticalIssues = audit
      ? audit.painPoints.some((p) => p.severity === "CRITICAL" || p.severity === "HIGH")
      : false;

    return {
      // Lead variables
      business_name: lead.businessName,
      address: lead.address ?? "",
      phone_number: lead.phoneNumber ?? "",
      website_url: lead.websiteUrl ?? "",
      rating: lead.rating !== undefined ? String(lead.rating) : "N/A",
      review_count: lead.reviewCount !== undefined ? String(lead.reviewCount) : "N/A",
      business_category: lead.businessCategory ?? "",

      // Audit variables
      performance_score: formatScore(audit?.metrics.performanceScore),
      accessibility_score: formatScore(audit?.accessibilityScore),
      load_time: formatLoadTime(loadTimeMs),
      top_issue: topPainPoint?.type ?? "",
      top_issue_description: topPainPoint?.description ?? topPainPoint?.value ?? "",
      total_issues: audit ? String(audit.painPoints.length) : "0",
      evidence_link: evidenceLink,
      mobile_friendly: audit?.mobileFriendly ? "Yes" : "No",

      // Action variables
      calendar_link: calendarLink || this.config.defaultCalendarLink || "",

      // Computed flags
      has_audit: hasAudit,
      slow_load: slowLoad,
      poor_accessibility: poorAccessibility,
      poor_performance: poorPerformance,
      has_mobile_issues: hasMobileIssues,
      has_critical_issues: hasCriticalIssues,

      // Merge custom variables
      ...customVariables,
    };
  }

  // ============================================
  // Handlebars Setup
  // ============================================

  /**
   * Register custom Handlebars helpers
   */
  private registerHelpers(): void {
    // Comparison helpers
    this.handlebars.registerHelper("eq", (a, b) => a === b);
    this.handlebars.registerHelper("neq", (a, b) => a !== b);
    this.handlebars.registerHelper("gt", (a, b) => a > b);
    this.handlebars.registerHelper("gte", (a, b) => a >= b);
    this.handlebars.registerHelper("lt", (a, b) => a < b);
    this.handlebars.registerHelper("lte", (a, b) => a <= b);

    // Logical helpers
    this.handlebars.registerHelper("and", (...args) => {
      // Remove options object from args
      const values = args.slice(0, -1);
      return values.every(Boolean);
    });

    this.handlebars.registerHelper("or", (...args) => {
      const values = args.slice(0, -1);
      return values.some(Boolean);
    });

    this.handlebars.registerHelper("not", (value) => !value);

    // String helpers
    this.handlebars.registerHelper("uppercase", (str) =>
      typeof str === "string" ? str.toUpperCase() : str
    );

    this.handlebars.registerHelper("lowercase", (str) =>
      typeof str === "string" ? str.toLowerCase() : str
    );

    this.handlebars.registerHelper("capitalize", (str) =>
      typeof str === "string" ? str.charAt(0).toUpperCase() + str.slice(1) : str
    );

    // Format helpers
    this.handlebars.registerHelper("formatNumber", (num) =>
      typeof num === "number" ? num.toLocaleString() : num
    );

    this.handlebars.registerHelper("formatPercent", (num) =>
      typeof num === "number" ? `${num}%` : num
    );

    // Default value helper
    this.handlebars.registerHelper("default", (value, defaultValue) =>
      value || defaultValue
    );

    // Conditional class helper
    this.handlebars.registerHelper("ifCond", function (this: unknown, v1, operator, v2, options) {
      const opts = options as { fn: (ctx: unknown) => string; inverse: (ctx: unknown) => string };
      switch (operator) {
        case "==":
          return v1 == v2 ? opts.fn(this) : opts.inverse(this);
        case "===":
          return v1 === v2 ? opts.fn(this) : opts.inverse(this);
        case "!=":
          return v1 != v2 ? opts.fn(this) : opts.inverse(this);
        case "!==":
          return v1 !== v2 ? opts.fn(this) : opts.inverse(this);
        case "<":
          return v1 < v2 ? opts.fn(this) : opts.inverse(this);
        case "<=":
          return v1 <= v2 ? opts.fn(this) : opts.inverse(this);
        case ">":
          return v1 > v2 ? opts.fn(this) : opts.inverse(this);
        case ">=":
          return v1 >= v2 ? opts.fn(this) : opts.inverse(this);
        case "&&":
          return v1 && v2 ? opts.fn(this) : opts.inverse(this);
        case "||":
          return v1 || v2 ? opts.fn(this) : opts.inverse(this);
        default:
          return opts.inverse(this);
      }
    });
  }

  /**
   * Load default templates into memory
   */
  private loadDefaultTemplates(): void {
    for (const template of DEFAULT_TEMPLATES) {
      this.templates.set(template.id, template);
    }
  }

  // ============================================
  // Utility Methods
  // ============================================

  /**
   * Strip HTML tags from content
   */
  private stripHtml(html: string): string {
    return html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  /**
   * Extract variables used in a template
   */
  extractVariables(template: StoredTemplate): string[] {
    const variables = new Set<string>();
    const pattern = /\{\{([^#/}][^}]*)\}\}/g;

    const extractFromContent = (content: string) => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const variable = match[1]?.trim();
        if (variable && !variable.startsWith("if ") && !variable.startsWith("unless ")) {
          // Remove any helper prefixes
          const cleanVar = variable.split(" ").pop()?.trim();
          if (cleanVar) {
            variables.add(cleanVar);
          }
        }
      }
    };

    extractFromContent(template.subject);
    extractFromContent(template.htmlBody);
    if (template.textBody) {
      extractFromContent(template.textBody);
    }

    return Array.from(variables);
  }

  /**
   * Validate a template's syntax
   */
  validateTemplate(template: StoredTemplate): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    try {
      this.handlebars.compile(template.subject);
    } catch (error) {
      errors.push(`Subject syntax error: ${String(error)}`);
    }

    try {
      this.handlebars.compile(template.htmlBody);
    } catch (error) {
      errors.push(`HTML body syntax error: ${String(error)}`);
    }

    if (template.textBody) {
      try {
        this.handlebars.compile(template.textBody);
      } catch (error) {
        errors.push(`Text body syntax error: ${String(error)}`);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Preview a template render with sample data
   */
  async previewTemplate(templateId: string, sampleContext?: Partial<EmailContext>): Promise<RenderedEmail> {
    // Verify template exists first
    await this.getTemplate(templateId);

    // Create sample lead
    const sampleLead: LeadProfile = {
      id: "sample-lead-id",
      businessName: sampleContext?.lead?.businessName ?? "Sample Business",
      address: sampleContext?.lead?.address ?? "123 Main St, City, ST 12345",
      phoneNumber: sampleContext?.lead?.phoneNumber ?? "(555) 123-4567",
      websiteUrl: sampleContext?.lead?.websiteUrl ?? "https://example.com",
      rating: sampleContext?.lead?.rating ?? 3.5,
      reviewCount: sampleContext?.lead?.reviewCount ?? 42,
      businessCategory: sampleContext?.lead?.businessCategory ?? "Restaurant",
      painPoints: [],
      evidenceUrls: [],
      contactStatus: "pending",
      discoveredAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Create sample audit
    const sampleAudit: AuditResult = {
      id: "sample-audit-id",
      leadId: sampleLead.id,
      url: sampleLead.websiteUrl ?? "https://example.com",
      auditedAt: new Date().toISOString(),
      metrics: {
        performanceScore: 45,
        accessibilityScore: 65,
        largestContentfulPaint: 4500,
        loadComplete: 5200,
      },
      wcagViolations: [],
      mobileFriendly: false,
      responsiveIssues: [],
      testedViewports: [],
      painPoints: [
        {
          type: "SLOW_LOAD",
          value: "4.5s",
          severity: "HIGH",
          description: "Page takes over 4 seconds to become interactive",
        },
      ],
      evidence: [
        {
          type: "screenshot",
          url: "https://example.com/evidence/screenshot.png",
        },
      ],
    };

    // Build context with explicit handling of optional customVariables
    const context: EmailContext = {
      lead: sampleContext?.lead ?? sampleLead,
      audit: sampleContext?.audit ?? sampleAudit,
      calendarLink: sampleContext?.calendarLink ?? "https://calendly.com/sample",
    };

    if (sampleContext?.customVariables !== undefined) {
      context.customVariables = sampleContext.customVariables;
    }

    return this.renderEmail(templateId, context);
  }
}
