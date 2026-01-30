#!/usr/bin/env node

/**
 * MCP Email Outreach Server
 *
 * Handles automated email campaigns via Mailgun
 * with personalized templates based on audit data.
 */

export { EmailOutreachServer } from "./server.js";
export type { EmailTemplate, SendEmailRequest } from "./types.js";
