import type { StoredTemplate } from "./types.js";

/**
 * Default email templates for outreach campaigns
 */

const now = new Date();

/**
 * Initial outreach template - First contact with key finding
 */
export const INITIAL_OUTREACH_TEMPLATE: StoredTemplate = {
  id: "default-initial-outreach",
  name: "Initial Outreach",
  description: "First contact email highlighting the most critical issue found",
  category: "initial_outreach",
  subject: "Quick question about {{business_name}}'s website",
  htmlBody: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <p>Hi there,</p>

  <p>I came across <strong>{{business_name}}</strong> and noticed something that might be costing you customers.</p>

  {{#if slow_load}}
  <p style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 12px; margin: 16px 0;">
    <strong>Your website takes {{load_time}} to load.</strong><br>
    Studies show that 53% of visitors leave if a page takes more than 3 seconds to load.
  </p>
  {{/if}}

  {{#if poor_performance}}
  <p style="background-color: #f8d7da; border-left: 4px solid #dc3545; padding: 12px; margin: 16px 0;">
    <strong>Performance Score: {{performance_score}}</strong><br>
    {{top_issue_description}}
  </p>
  {{/if}}

  {{#if has_mobile_issues}}
  <p style="background-color: #cce5ff; border-left: 4px solid #007bff; padding: 12px; margin: 16px 0;">
    <strong>Mobile Experience Issues Detected</strong><br>
    With over 60% of web traffic coming from mobile devices, this could be affecting your conversions.
  </p>
  {{/if}}

  {{#if has_audit}}
  <p>I put together a quick analysis with screenshots showing exactly what I found:</p>
  <p style="text-align: center; margin: 20px 0;">
    <a href="{{evidence_link}}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">View Your Site Analysis</a>
  </p>
  {{/if}}

  <p>I can fix these issues in about a week. Would you have 15 minutes for a quick call to discuss?</p>

  <p style="text-align: center; margin: 20px 0;">
    <a href="{{calendar_link}}" style="background-color: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">Book a Free Consultation</a>
  </p>

  <p>Best regards,<br>
  Your Web Performance Team</p>

  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
  <p style="font-size: 12px; color: #666;">
    This analysis was generated for {{business_name}} | {{website_url}}
  </p>
</body>
</html>`,
  textBody: `Hi there,

I came across {{business_name}} and noticed something that might be costing you customers.

{{#if slow_load}}
YOUR WEBSITE TAKES {{load_time}} TO LOAD.
Studies show that 53% of visitors leave if a page takes more than 3 seconds to load.
{{/if}}

{{#if poor_performance}}
PERFORMANCE SCORE: {{performance_score}}
{{top_issue_description}}
{{/if}}

{{#if has_mobile_issues}}
MOBILE EXPERIENCE ISSUES DETECTED
With over 60% of web traffic coming from mobile devices, this could be affecting your conversions.
{{/if}}

{{#if has_audit}}
I put together a quick analysis showing exactly what I found:
{{evidence_link}}
{{/if}}

I can fix these issues in about a week. Would you have 15 minutes for a quick call to discuss?

Book a free consultation: {{calendar_link}}

Best regards,
Your Web Performance Team

---
This analysis was generated for {{business_name}} | {{website_url}}`,
  variables: [
    "business_name",
    "website_url",
    "load_time",
    "performance_score",
    "top_issue_description",
    "evidence_link",
    "calendar_link",
  ],
  createdAt: now,
  updatedAt: now,
};

/**
 * First follow-up template - Reminder with additional evidence
 */
export const FOLLOWUP_1_TEMPLATE: StoredTemplate = {
  id: "default-followup-1",
  name: "Follow-up #1",
  description: "First follow-up with additional context and urgency",
  category: "followup",
  subject: "Re: {{business_name}} website - quick update",
  htmlBody: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <p>Hi again,</p>

  <p>I wanted to follow up on my previous email about {{business_name}}'s website.</p>

  <p>I know you're busy, so I'll keep this brief:</p>

  <ul style="background-color: #f8f9fa; padding: 20px 20px 20px 40px; border-radius: 4px;">
    {{#if has_audit}}
    <li><strong>{{total_issues}} issues</strong> were found that could be affecting your business</li>
    {{/if}}
    {{#if slow_load}}
    <li>Your site loads in <strong>{{load_time}}</strong> (industry standard is under 3 seconds)</li>
    {{/if}}
    {{#if poor_accessibility}}
    <li>Accessibility score of <strong>{{accessibility_score}}</strong> could expose you to ADA compliance risks</li>
    {{/if}}
  </ul>

  <p>I've helped businesses like yours see up to 40% improvement in their website performance within just a few weeks.</p>

  <p>Would a quick 15-minute call work for you this week?</p>

  <p style="text-align: center; margin: 20px 0;">
    <a href="{{calendar_link}}" style="background-color: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">Pick a Time That Works</a>
  </p>

  <p>Best regards,<br>
  Your Web Performance Team</p>
</body>
</html>`,
  textBody: `Hi again,

I wanted to follow up on my previous email about {{business_name}}'s website.

I know you're busy, so I'll keep this brief:

{{#if has_audit}}
- {{total_issues}} issues were found that could be affecting your business
{{/if}}
{{#if slow_load}}
- Your site loads in {{load_time}} (industry standard is under 3 seconds)
{{/if}}
{{#if poor_accessibility}}
- Accessibility score of {{accessibility_score}} could expose you to ADA compliance risks
{{/if}}

I've helped businesses like yours see up to 40% improvement in their website performance within just a few weeks.

Would a quick 15-minute call work for you this week?

Pick a time that works: {{calendar_link}}

Best regards,
Your Web Performance Team`,
  variables: [
    "business_name",
    "total_issues",
    "load_time",
    "accessibility_score",
    "calendar_link",
  ],
  createdAt: now,
  updatedAt: now,
};

/**
 * Second follow-up template - Last chance with urgency
 */
export const FOLLOWUP_2_TEMPLATE: StoredTemplate = {
  id: "default-followup-2",
  name: "Follow-up #2 (Final)",
  description: "Final follow-up with urgency and value proposition",
  category: "followup",
  subject: "Last chance: Free website audit for {{business_name}}",
  htmlBody: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <p>Hi,</p>

  <p>This is my last follow-up about the website issues I found for {{business_name}}.</p>

  <p>I understand timing might not be right, but I wanted to make sure you had a chance to see this before I move on.</p>

  {{#if has_critical_issues}}
  <div style="background-color: #f8d7da; border: 1px solid #f5c6cb; border-radius: 4px; padding: 16px; margin: 20px 0;">
    <p style="margin: 0 0 8px 0; font-weight: bold; color: #721c24;">Critical Issues Detected</p>
    <p style="margin: 0; color: #721c24;">{{top_issue_description}}</p>
  </div>
  {{/if}}

  <p><strong>What you're potentially losing every month:</strong></p>
  <ul>
    <li>Customers who leave because your site is too slow</li>
    <li>Search engine rankings (Google penalizes slow sites)</li>
    <li>Mobile users who can't navigate properly</li>
  </ul>

  <p>I'm offering a <strong>free, no-obligation consultation</strong> to walk you through exactly what's happening and how to fix it.</p>

  <p style="text-align: center; margin: 24px 0;">
    <a href="{{calendar_link}}" style="background-color: #dc3545; color: white; padding: 14px 28px; text-decoration: none; border-radius: 4px; display: inline-block; font-weight: bold;">Book Your Free Call Now</a>
  </p>

  <p>If I don't hear back, I'll assume the timing isn't right and won't reach out again.</p>

  <p>Wishing you success,<br>
  Your Web Performance Team</p>

  <p style="font-size: 12px; color: #666; margin-top: 30px;">
    P.S. - Even if you're not interested in our services, I'm happy to share the audit report so you can address these issues with your current developer.
  </p>
</body>
</html>`,
  textBody: `Hi,

This is my last follow-up about the website issues I found for {{business_name}}.

I understand timing might not be right, but I wanted to make sure you had a chance to see this before I move on.

{{#if has_critical_issues}}
CRITICAL ISSUES DETECTED
{{top_issue_description}}
{{/if}}

WHAT YOU'RE POTENTIALLY LOSING EVERY MONTH:
- Customers who leave because your site is too slow
- Search engine rankings (Google penalizes slow sites)
- Mobile users who can't navigate properly

I'm offering a FREE, NO-OBLIGATION CONSULTATION to walk you through exactly what's happening and how to fix it.

Book your free call now: {{calendar_link}}

If I don't hear back, I'll assume the timing isn't right and won't reach out again.

Wishing you success,
Your Web Performance Team

P.S. - Even if you're not interested in our services, I'm happy to share the audit report so you can address these issues with your current developer.`,
  variables: [
    "business_name",
    "top_issue_description",
    "calendar_link",
  ],
  createdAt: now,
  updatedAt: now,
};

/**
 * All default templates
 */
export const DEFAULT_TEMPLATES: StoredTemplate[] = [
  INITIAL_OUTREACH_TEMPLATE,
  FOLLOWUP_1_TEMPLATE,
  FOLLOWUP_2_TEMPLATE,
];

/**
 * Get a default template by ID
 */
export function getDefaultTemplate(id: string): StoredTemplate | undefined {
  return DEFAULT_TEMPLATES.find((t) => t.id === id);
}

/**
 * Get default template IDs
 */
export const DEFAULT_TEMPLATE_IDS = {
  INITIAL_OUTREACH: "default-initial-outreach",
  FOLLOWUP_1: "default-followup-1",
  FOLLOWUP_2: "default-followup-2",
} as const;
