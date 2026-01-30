import { z } from "zod";

// Re-export shared types
export type { EmailTemplate, CampaignConfig } from "@the-closer/shared";

/**
 * Send email request
 */
export const SendEmailRequestSchema = z.object({
  to: z.string().email(),
  leadId: z.string().uuid().optional(),
  campaignId: z.string().uuid().optional(),
  templateId: z.string().uuid().optional(),
  subject: z.string().optional(),
  htmlBody: z.string().optional(),
  textBody: z.string().optional(),
  variables: z.record(z.string()).default({}),
  scheduledAt: z.string().datetime().optional(),
  trackOpens: z.boolean().default(true),
  trackClicks: z.boolean().default(true),
});

export type SendEmailRequest = z.infer<typeof SendEmailRequestSchema>;

/**
 * Email send result
 */
export const EmailSendResultSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["queued", "sent", "delivered", "opened", "clicked", "failed"]),
  to: z.string().email(),
  leadId: z.string().uuid().optional(),
  campaignId: z.string().uuid().optional(),
  sentAt: z.string().datetime().optional(),
  deliveredAt: z.string().datetime().optional(),
  openedAt: z.string().datetime().optional(),
  clickedAt: z.string().datetime().optional(),
  error: z.string().optional(),
});

export type EmailSendResult = z.infer<typeof EmailSendResultSchema>;
