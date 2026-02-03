/**
 * Unsubscribe Link Generator
 *
 * CAN-SPAM compliant unsubscribe functionality for email templates
 */

import { z } from "zod";

export const UnsubscribeLinkSchema = z.object({
  recipientEmail: z.string().email(),
  campaignId: z.string().uuid().optional(),
  leadId: z.string().uuid().optional(),
  baseUrl: z.string().url(),
});

export type UnsubscribeLinkParams = z.infer<typeof UnsubscribeLinkSchema>;

/**
 * Generate an unsubscribe link with tracking parameters
 */
export function generateUnsubscribeLink(params: UnsubscribeLinkParams): string {
  const validated = UnsubscribeLinkSchema.parse(params);

  const url = new URL('/unsubscribe', validated.baseUrl);

  // Add email parameter (URL-encoded)
  url.searchParams.set('email', validated.recipientEmail);

  // Add optional tracking parameters
  if (validated.campaignId) {
    url.searchParams.set('campaign', validated.campaignId);
  }

  if (validated.leadId) {
    url.searchParams.set('lead', validated.leadId);
  }

  // Add timestamp for tracking
  url.searchParams.set('t', Date.now().toString());

  return url.toString();
}

/**
 * Generate unsubscribe footer HTML
 */
export function generateUnsubscribeFooter(params: UnsubscribeLinkParams): string {
  const unsubscribeLink = generateUnsubscribeLink(params);

  return `
<div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; text-align: center;">
  <p style="margin: 0 0 8px 0;">
    This email was sent to <strong>${params.recipientEmail}</strong>
  </p>
  <p style="margin: 0 0 8px 0;">
    If you no longer wish to receive these emails, you can <a href="${unsubscribeLink}" style="color: #3b82f6; text-decoration: underline;">unsubscribe here</a>.
  </p>
  <p style="margin: 0; font-size: 11px; color: #9ca3af;">
    [Your Company Name] | [Company Address] | [Company City, State ZIP]
  </p>
</div>
`.trim();
}

/**
 * Generate unsubscribe footer (plain text)
 */
export function generateUnsubscribeFooterText(params: UnsubscribeLinkParams): string {
  const unsubscribeLink = generateUnsubscribeLink(params);

  return `

---

This email was sent to ${params.recipientEmail}

If you no longer wish to receive these emails, unsubscribe here:
${unsubscribeLink}

[Your Company Name]
[Company Address]
[Company City, State ZIP]
`.trim();
}

/**
 * Add unsubscribe footer to HTML email
 */
export function addUnsubscribeFooter(
  htmlBody: string,
  params: UnsubscribeLinkParams
): string {
  const footer = generateUnsubscribeFooter(params);

  // Check if HTML has a closing </body> tag
  if (htmlBody.includes('</body>')) {
    return htmlBody.replace('</body>', `${footer}</body>`);
  }

  // Otherwise append to end
  return `${htmlBody}\n${footer}`;
}

/**
 * Add unsubscribe footer to plain text email
 */
export function addUnsubscribeFooterText(
  textBody: string,
  params: UnsubscribeLinkParams
): string {
  const footer = generateUnsubscribeFooterText(params);
  return `${textBody}\n${footer}`;
}

/**
 * Validate unsubscribe link format (for testing)
 */
export function parseUnsubscribeLink(link: string): {
  email: string;
  campaignId?: string;
  leadId?: string;
  timestamp: number;
} | null {
  try {
    const url = new URL(link);

    const email = url.searchParams.get('email');
    const campaignId = url.searchParams.get('campaign') || undefined;
    const leadId = url.searchParams.get('lead') || undefined;
    const timestamp = parseInt(url.searchParams.get('t') || '0', 10);

    if (!email || !timestamp) {
      return null;
    }

    return {
      email,
      campaignId,
      leadId,
      timestamp,
    };
  } catch {
    return null;
  }
}

/**
 * List-Unsubscribe header for email clients (RFC 2369)
 */
export function generateListUnsubscribeHeader(params: UnsubscribeLinkParams): string {
  const link = generateUnsubscribeLink(params);
  return `<${link}>`;
}

/**
 * List-Unsubscribe-Post header (RFC 8058 - One-Click Unsubscribe)
 */
export function generateListUnsubscribePostHeader(): string {
  return 'List-Unsubscribe=One-Click';
}
