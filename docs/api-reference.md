# The Closer - API Reference

**Version**: 1.0
**Last Updated**: February 2, 2026
**Base URL**: `https://your-project.supabase.co`

---

## Overview

The Closer uses **Supabase** for all database operations, which provides a RESTful API automatically generated from PostgreSQL tables. This document describes the API endpoints, schemas, and usage patterns.

**Authentication**: All API requests require a valid Supabase JWT token obtained via authentication.

---

## Table of Contents

1. [Authentication](#authentication)
2. [Leads API](#leads-api)
3. [Audits API](#audits-api)
4. [Campaigns API](#campaigns-api)
5. [Email Events API](#email-events-api)
6. [Error Handling](#error-handling)
7. [Rate Limiting](#rate-limiting)

---

## Authentication

### Sign Up

**Endpoint**: `POST /auth/v1/signup`

**Request**:
```json
{
  "email": "user@example.com",
  "password": "SecureP@ssw0rd123"
}
```

**Response** (200):
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 3600,
  "refresh_token": "...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "created_at": "2026-02-02T12:00:00Z"
  }
}
```

**Password Requirements**:
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character

---

### Sign In

**Endpoint**: `POST /auth/v1/token?grant_type=password`

**Request**:
```json
{
  "email": "user@example.com",
  "password": "SecureP@ssw0rd123"
}
```

**Response** (200):
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 3600,
  "refresh_token": "..."
}
```

**Rate Limiting**: 5 requests per 15 minutes
**Account Lockout**: 5 failed attempts = 15-minute lockout

---

### Sign Out

**Endpoint**: `POST /auth/v1/logout`

**Headers**:
```
Authorization: Bearer {access_token}
```

**Response** (204): No content

---

## Leads API

### Get Leads (Paginated)

**Endpoint**: `GET /rest/v1/lead_profiles`

**Query Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `select` | string | No | Columns to return (default: `*`) |
| `business_name` | string | No | Filter by business name (ilike) |
| `contact_status` | enum | No | Filter by status |
| `rating` | string | No | Filter by rating (`gte.4.0`) |
| `limit` | integer | No | Page size (default: 25, max: 100) |
| `offset` | integer | No | Pagination offset |
| `order` | string | No | Sort order (e.g., `discovered_at.desc`) |

**Headers**:
```
Authorization: Bearer {access_token}
apikey: {supabase_anon_key}
```

**Example Request**:
```bash
curl -X GET "https://your-project.supabase.co/rest/v1/lead_profiles?contact_status=eq.pending&rating=lt.4.0&limit=10&order=discovered_at.desc" \
  -H "Authorization: Bearer {token}" \
  -H "apikey: {anon_key}"
```

**Response** (200):
```json
[
  {
    "id": "uuid",
    "business_name": "Joe's Plumbing",
    "address": "123 Main St, Austin, TX",
    "phone_number": "+1-512-555-0123",
    "website_url": "https://joesplumbing.com",
    "rating": 3.2,
    "review_count": 45,
    "business_category": "Plumber",
    "pain_points": [
      {
        "type": "SLOW_LOAD",
        "value": "6.2s",
        "severity": "CRITICAL"
      }
    ],
    "performance_score": 32,
    "accessibility_score": 58,
    "mobile_friendly": false,
    "evidence_urls": [
      {
        "type": "screenshot",
        "url": "https://storage.../mobile-broken.png"
      }
    ],
    "contact_status": "pending",
    "discovered_at": "2026-02-01T10:00:00Z",
    "updated_at": "2026-02-01T10:00:00Z"
  }
]
```

---

### Get Single Lead

**Endpoint**: `GET /rest/v1/lead_profiles?id=eq.{uuid}`

**Example Request**:
```bash
curl -X GET "https://your-project.supabase.co/rest/v1/lead_profiles?id=eq.{uuid}" \
  -H "Authorization: Bearer {token}" \
  -H "apikey: {anon_key}"
```

**Response** (200): Single lead object (array with 1 item)

---

### Create Lead

**Endpoint**: `POST /rest/v1/lead_profiles`

**Request Body**:
```json
{
  "business_name": "Smith's Auto Repair",
  "address": "456 Oak Ave, Austin, TX",
  "phone_number": "+1-512-555-0456",
  "website_url": "https://smithsauto.com",
  "rating": 3.8,
  "review_count": 32,
  "business_category": "Auto Repair",
  "source_query": "auto repair austin rating < 4.0"
}
```

**Response** (201):
```json
{
  "id": "uuid",
  "business_name": "Smith's Auto Repair",
  ...
}
```

---

### Update Lead

**Endpoint**: `PATCH /rest/v1/lead_profiles?id=eq.{uuid}`

**Request Body**:
```json
{
  "contact_status": "emailed",
  "last_contacted_at": "2026-02-02T14:30:00Z",
  "notes": "Sent initial outreach email with audit evidence"
}
```

**Response** (200): Updated lead object

---

### Bulk Update Leads

**Endpoint**: `PATCH /rest/v1/lead_profiles?id=in.({uuid1},{uuid2},{uuid3})`

**Request Body**:
```json
{
  "contact_status": "emailed"
}
```

**Response** (200): Array of updated leads

**Rate Limiting**: 20 requests per minute

---

### Delete Lead

**Endpoint**: `DELETE /rest/v1/lead_profiles?id=eq.{uuid}`

**Response** (204): No content

**GDPR Compliance**: Use `gdpr_delete_lead_data()` function for complete erasure:

```sql
SELECT * FROM gdpr_delete_lead_data('uuid');
```

---

## Audits API

### Get Audits for Lead

**Endpoint**: `GET /rest/v1/audits?lead_id=eq.{uuid}`

**Query Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `order` | string | Sort order (`audited_at.desc`) |
| `limit` | integer | Max results |

**Example Request**:
```bash
curl -X GET "https://your-project.supabase.co/rest/v1/audits?lead_id=eq.{uuid}&order=audited_at.desc&limit=1" \
  -H "Authorization: Bearer {token}" \
  -H "apikey: {anon_key}"
```

**Response** (200):
```json
[
  {
    "id": "uuid",
    "lead_id": "uuid",
    "url": "https://joesplumbing.com",
    "performance_score": 32,
    "accessibility_score": 58,
    "seo_score": 45,
    "best_practices_score": 67,
    "first_contentful_paint_ms": 3200,
    "largest_contentful_paint_ms": 6200,
    "cumulative_layout_shift": 0.25,
    "time_to_interactive_ms": 8500,
    "total_blocking_time_ms": 1200,
    "unused_js_percent": 78.5,
    "unused_css_percent": 82.3,
    "mobile_friendly": false,
    "viewport_width": 375,
    "body_scroll_width": 420,
    "wcag_violations": [
      {
        "ruleId": "color-contrast",
        "severity": "serious",
        "description": "Low contrast text"
      }
    ],
    "responsive_issues": [
      {
        "type": "HORIZONTAL_SCROLL",
        "description": "Page wider than viewport",
        "viewportWidth": 375
      }
    ],
    "pain_points": [
      {
        "type": "SLOW_LOAD",
        "value": "6.2s",
        "severity": "CRITICAL",
        "description": "LCP exceeds 6 seconds on mobile"
      }
    ],
    "evidence_urls": [
      {
        "type": "screenshot",
        "url": "https://storage.../mobile-view.png",
        "description": "Mobile viewport showing horizontal scroll"
      },
      {
        "type": "video",
        "url": "https://storage.../slow-load.webm",
        "description": "5-second video of page load"
      }
    ],
    "duration_ms": 18500,
    "audited_at": "2026-02-01T11:00:00Z"
  }
]
```

---

### Create Audit

**Endpoint**: `POST /rest/v1/audits`

**Request Body**:
```json
{
  "lead_id": "uuid",
  "url": "https://example.com",
  "performance_score": 45,
  "accessibility_score": 70,
  "seo_score": 85,
  "best_practices_score": 90,
  "first_contentful_paint_ms": 2100,
  "largest_contentful_paint_ms": 4200,
  "cumulative_layout_shift": 0.12,
  "unused_js_percent": 65.0,
  "unused_css_percent": 70.0,
  "mobile_friendly": true,
  "pain_points": [],
  "evidence_urls": []
}
```

**Response** (201): Created audit object

---

## Campaigns API

### Get All Campaigns

**Endpoint**: `GET /rest/v1/campaigns`

**Query Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | enum | Filter by status |
| `order` | string | Sort order (`created_at.desc`) |

**Example Request**:
```bash
curl -X GET "https://your-project.supabase.co/rest/v1/campaigns?status=eq.active&order=created_at.desc" \
  -H "Authorization: Bearer {token}" \
  -H "apikey: {anon_key}"
```

**Response** (200):
```json
[
  {
    "id": "uuid",
    "name": "Austin Dentists - Low Rating Outreach",
    "description": "Target dentists with < 4.0 rating and slow websites",
    "lead_filters": {
      "minPerformanceScore": 0,
      "maxPerformanceScore": 50,
      "categories": ["Dentist"],
      "maxRating": 4.0
    },
    "sequence": [
      {
        "stepNumber": 1,
        "delayDays": 0,
        "templateId": "initial_outreach",
        "sendCondition": "always"
      },
      {
        "stepNumber": 2,
        "delayDays": 3,
        "templateId": "follow_up_1",
        "sendCondition": "no_reply"
      }
    ],
    "status": "active",
    "daily_send_limit": 50,
    "timezone": "America/Chicago",
    "track_opens": true,
    "track_clicks": true,
    "total_leads": 127,
    "emails_sent": 89,
    "emails_opened": 23,
    "emails_clicked": 8,
    "replies": 3,
    "booked": 1,
    "created_at": "2026-02-01T09:00:00Z",
    "updated_at": "2026-02-02T15:00:00Z"
  }
]
```

---

### Create Campaign

**Endpoint**: `POST /rest/v1/campaigns`

**Request Body**:
```json
{
  "name": "Campaign Name",
  "description": "Campaign description",
  "lead_filters": {
    "maxPerformanceScore": 60,
    "categories": ["Dentist", "Medical"]
  },
  "sequence": [
    {
      "stepNumber": 1,
      "delayDays": 0,
      "templateId": "initial_outreach",
      "sendCondition": "always"
    }
  ],
  "daily_send_limit": 50,
  "timezone": "America/New_York"
}
```

**Response** (201): Created campaign object

---

### Update Campaign Status

**Endpoint**: `PATCH /rest/v1/campaigns?id=eq.{uuid}`

**Request Body**:
```json
{
  "status": "paused"
}
```

**Valid Status Transitions**:
- `draft` → `scheduled` | `active`
- `scheduled` → `active` | `cancelled`
- `active` → `paused` | `completed`
- `paused` → `active` | `cancelled`

**Response** (200): Updated campaign object

---

## Email Events API

### Get Events for Campaign

**Endpoint**: `GET /rest/v1/email_events?campaign_id=eq.{uuid}`

**Query Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `event_type` | enum | Filter by event type |
| `limit` | integer | Max results |
| `order` | string | Sort order |

**Event Types**:
- `queued` - Email queued for sending
- `sent` - Email accepted by Mailgun
- `delivered` - Email delivered to inbox
- `opened` - Recipient opened email
- `clicked` - Recipient clicked link
- `replied` - Recipient replied
- `bounced` - Email bounced
- `complained` - Marked as spam
- `unsubscribed` - Recipient unsubscribed
- `failed` - Delivery failed

**Example Request**:
```bash
curl -X GET "https://your-project.supabase.co/rest/v1/email_events?campaign_id=eq.{uuid}&event_type=eq.opened&order=occurred_at.desc" \
  -H "Authorization: Bearer {token}" \
  -H "apikey: {anon_key}"
```

**Response** (200):
```json
[
  {
    "id": "uuid",
    "campaign_id": "uuid",
    "lead_id": "uuid",
    "template_id": "uuid",
    "message_id": "mailgun-message-id",
    "recipient": "contact@business.com",
    "subject": "Quick question about your website",
    "event_type": "opened",
    "metadata": {
      "ip": "192.0.2.1",
      "user_agent": "Mozilla/5.0...",
      "timestamp": 1675354800
    },
    "sequence_step": 1,
    "occurred_at": "2026-02-02T16:30:00Z"
  }
]
```

---

## Error Handling

### Standard Error Response

```json
{
  "code": "23505",
  "message": "duplicate key value violates unique constraint",
  "details": "Key (email)=(user@example.com) already exists.",
  "hint": "Use a different email address"
}
```

### Common Error Codes

| Status | Code | Description |
|--------|------|-------------|
| 400 | `PGRST102` | Invalid query parameter |
| 401 | `401` | Invalid or expired JWT token |
| 403 | `403` | Insufficient permissions (RLS) |
| 404 | `PGRST116` | Resource not found |
| 409 | `23505` | Unique constraint violation |
| 429 | `429` | Rate limit exceeded |
| 500 | `500` | Internal server error |

### Error Handling Best Practices

```typescript
try {
  const { data, error } = await supabase
    .from('lead_profiles')
    .select('*')
    .eq('id', leadId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // Handle not found
      console.error('Lead not found');
    } else {
      // Handle other errors
      throw error;
    }
  }

  return data;
} catch (error) {
  // Log to error monitoring service
  captureError(error);
  throw error;
}
```

---

## Rate Limiting

### Global Rate Limits

| Endpoint Category | Limit | Window |
|-------------------|-------|--------|
| Authentication | 5 requests | 15 minutes |
| Read Operations (GET) | 60 requests | 1 minute |
| Write Operations (POST/PATCH/DELETE) | 20 requests | 1 minute |
| Bulk Operations | 10 requests | 1 minute |

### Rate Limit Headers

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1675354800
```

### Handling Rate Limits

```typescript
const { remaining, resetIn } = rateLimiter.checkLimit(
  'api:getLeads',
  60,  // max requests
  60000 // window (1 minute)
);

if (!allowed) {
  throw new RateLimitError(
    `Rate limit exceeded. Try again in ${Math.ceil(resetIn / 1000)} seconds.`
  );
}
```

---

## Database Functions

### GDPR Data Export

**Function**: `gdpr_export_lead_data(lead_id UUID)`

**Usage**:
```sql
SELECT * FROM gdpr_export_lead_data('uuid');
```

**Response**: JSON object with all lead data

---

### GDPR Data Deletion

**Function**: `gdpr_delete_lead_data(lead_id UUID)`

**Usage**:
```sql
SELECT * FROM gdpr_delete_lead_data('uuid');
```

**Response**: Table showing deleted record counts

---

### Unsubscribe Email

**Function**: `unsubscribe_email(email TEXT, reason TEXT)`

**Usage**:
```sql
SELECT * FROM unsubscribe_email('user@example.com', 'No longer interested');
```

**Response**: UUID of unsubscribe record

---

## Pagination Best Practices

### Cursor-Based Pagination (Recommended)

```typescript
// First page
const { data: page1 } = await supabase
  .from('lead_profiles')
  .select('*')
  .order('created_at', { ascending: false })
  .limit(25);

// Next page (using last item's created_at)
const lastCreatedAt = page1[page1.length - 1].created_at;

const { data: page2 } = await supabase
  .from('lead_profiles')
  .select('*')
  .order('created_at', { ascending: false })
  .lt('created_at', lastCreatedAt)
  .limit(25);
```

### Offset-Based Pagination

```typescript
// Page 1 (offset 0)
const { data, count } = await supabase
  .from('lead_profiles')
  .select('*', { count: 'exact' })
  .range(0, 24);

// Page 2 (offset 25)
const { data: page2 } = await supabase
  .from('lead_profiles')
  .select('*')
  .range(25, 49);
```

---

## Webhooks

### Mailgun Webhooks

**Endpoint**: `POST /api/webhooks/mailgun`

**Events**: `delivered`, `opened`, `clicked`, `bounced`, `complained`, `unsubscribed`

**Verification**: HMAC signature verification

```typescript
const signature = crypto
  .createHmac('sha256', process.env.MAILGUN_WEBHOOK_KEY)
  .update(`${timestamp}${token}`)
  .digest('hex');

if (signature !== providedSignature) {
  throw new Error('Invalid webhook signature');
}
```

---

## Client Libraries

### JavaScript/TypeScript (Official)

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

// Query leads
const { data, error } = await supabase
  .from('lead_profiles')
  .select('*')
  .eq('contact_status', 'pending')
  .order('discovered_at', { ascending: false })
  .limit(10);
```

### Example: Create and Audit Lead

```typescript
// 1. Create lead
const { data: lead, error: leadError } = await supabase
  .from('lead_profiles')
  .insert({
    business_name: 'Example Business',
    website_url: 'https://example.com',
  })
  .select()
  .single();

if (leadError) throw leadError;

// 2. Run audit (via MCP)
const auditResult = await runAudit(lead.website_url);

// 3. Save audit
const { error: auditError } = await supabase
  .from('audits')
  .insert({
    lead_id: lead.id,
    ...auditResult,
  });

// 4. Update lead with audit results
const { error: updateError } = await supabase
  .from('lead_profiles')
  .update({
    performance_score: auditResult.performance_score,
    pain_points: auditResult.pain_points,
  })
  .eq('id', lead.id);
```

---

## API Versioning

**Current Version**: `v1`

All Supabase REST API endpoints use `/rest/v1/` prefix.

**Deprecation Policy**:
- 6-month notice for breaking changes
- Versioned endpoints maintained for 12 months after deprecation

---

## Additional Resources

- **Supabase REST API Docs**: https://supabase.com/docs/guides/api
- **PostgREST Documentation**: https://postgrest.org/
- **OpenAPI Specification**: `https://your-project.supabase.co/rest/v1/`

---

**Document Version**: 1.0
**Last Updated**: February 2, 2026
**Maintained By**: Engineering Team
