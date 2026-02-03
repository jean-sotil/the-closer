# API Keys Setup Guide

**Version**: 1.0
**Last Updated**: February 3, 2026

This guide walks you through obtaining and configuring all required API keys for The Closer.

---

## Table of Contents

1. [Supabase Setup](#supabase-setup)
2. [Mailgun Setup](#mailgun-setup)
3. [Google Calendar Setup](#google-calendar-setup)
4. [Optional Services](#optional-services)
5. [Environment Configuration](#environment-configuration)
6. [Verification Checklist](#verification-checklist)

---

## Supabase Setup

Supabase provides the database, authentication, and file storage for The Closer.

### Step 1: Create a Supabase Account

1. Go to [supabase.com](https://supabase.com)
2. Click **Start your project**
3. Sign up with GitHub or email

### Step 2: Create a New Project

1. Click **New Project**
2. Fill in the details:
   - **Organization**: Select or create one
   - **Name**: `the-closer-prod` (or your preferred name)
   - **Database Password**: Generate a strong password and **save it securely**
   - **Region**: Choose the region closest to your users
3. Click **Create new project**
4. Wait 2-3 minutes for provisioning

### Step 3: Get API Credentials

1. Go to **Settings** (gear icon) → **API**
2. Copy the following values:

| Setting | Environment Variable | Location in Dashboard |
|---------|---------------------|----------------------|
| Project URL | `SUPABASE_URL` | Under "Project URL" |
| anon public | `SUPABASE_ANON_KEY` | Under "Project API keys" |
| service_role | `SUPABASE_SERVICE_KEY` | Under "Project API keys" (click "Reveal") |

**Security Warning**: The `service_role` key has full database access. Never expose it in frontend code or commit it to version control.

### Step 4: Configure Authentication

1. Go to **Authentication** → **Settings**
2. Set **Site URL**: `https://your-domain.com`
3. Add **Redirect URLs**:
   ```
   https://your-domain.com/auth/callback
   http://localhost:5173/auth/callback
   ```
4. Under **Email Auth**:
   - Enable **Email** provider
   - Enable **Confirm email**

### Step 5: Set Up Row Level Security (RLS)

RLS policies are defined in the database migrations. To verify they're active:

1. Go to **Table Editor**
2. Select any table (e.g., `lead_profiles`)
3. Click the **shield icon** next to the table name
4. Verify "RLS enabled" is shown

If RLS is not enabled, run the migrations:

```bash
supabase db push
```

### Step 6: Create Storage Bucket

1. Go to **Storage**
2. Click **New bucket**
3. Configure:
   - **Name**: `evidence`
   - **Public bucket**: No (private)
   - **File size limit**: 52428800 (50 MB)
   - **Allowed MIME types**: `image/*,video/*,application/pdf`
4. Click **Create bucket**

### Step 7: Configure Storage Policies

In the SQL Editor, run:

```sql
-- Allow authenticated users to upload to their own folder
CREATE POLICY "Users can upload evidence"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'evidence');

-- Allow authenticated users to read evidence
CREATE POLICY "Users can read evidence"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'evidence');
```

---

## Mailgun Setup

Mailgun handles email delivery for outreach campaigns.

### Step 1: Create a Mailgun Account

1. Go to [mailgun.com](https://www.mailgun.com)
2. Click **Start Sending** or **Sign Up**
3. Complete the registration form
4. Verify your email address

### Step 2: Add a Sending Domain

1. Go to **Sending** → **Domains**
2. Click **Add New Domain**
3. Enter your domain: `mail.yourdomain.com` (subdomain recommended)
4. Select your region (US or EU)
5. Click **Add Domain**

### Step 3: Configure DNS Records

Mailgun will show required DNS records. Add these to your domain registrar:

**TXT Records (for SPF and DKIM):**

| Type | Name | Value |
|------|------|-------|
| TXT | `mail` | `v=spf1 include:mailgun.org ~all` |
| TXT | `smtp._domainkey.mail` | `k=rsa; p=MIGf...` (provided by Mailgun) |

**MX Records (for receiving):**

| Type | Priority | Name | Value |
|------|----------|------|-------|
| MX | 10 | `mail` | `mxa.mailgun.org` |
| MX | 10 | `mail` | `mxb.mailgun.org` |

**CNAME Record (for tracking):**

| Type | Name | Value |
|------|------|-------|
| CNAME | `email.mail` | `mailgun.org` |

### Step 4: Verify Domain

1. After adding DNS records, click **Verify DNS Settings**
2. DNS propagation can take up to 48 hours (usually 1-2 hours)
3. All checks should show green checkmarks

### Step 5: Get API Key

1. Go to **Settings** → **API Keys**
2. Copy your **Private API key** (starts with `key-`)

| Setting | Environment Variable |
|---------|---------------------|
| Private API Key | `MAILGUN_API_KEY` |
| Domain | `MAILGUN_DOMAIN` |

**Example:**
```bash
MAILGUN_API_KEY="key-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
MAILGUN_DOMAIN="mail.yourdomain.com"
```

### Step 6: Configure Webhooks (Optional)

To track email events (opens, clicks, bounces):

1. Go to **Sending** → **Webhooks**
2. Click **Add webhook**
3. Configure:
   - **URL**: `https://your-domain.com/api/webhooks/mailgun`
   - **Events**: Select all relevant events
4. Click **Create Webhook**

---

## Google Calendar Setup

Google Calendar integration enables meeting scheduling.

### Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Click the project dropdown → **New Project**
3. Enter project name: `the-closer`
4. Click **Create**

### Step 2: Enable Calendar API

1. Go to **APIs & Services** → **Library**
2. Search for "Google Calendar API"
3. Click on it, then click **Enable**

### Step 3: Configure OAuth Consent Screen

1. Go to **APIs & Services** → **OAuth consent screen**
2. Select **External** (unless using Google Workspace)
3. Click **Create**
4. Fill in required fields:
   - **App name**: The Closer
   - **User support email**: your-email@domain.com
   - **Developer contact**: your-email@domain.com
5. Click **Save and Continue**
6. Add scopes:
   - `https://www.googleapis.com/auth/calendar`
   - `https://www.googleapis.com/auth/calendar.events`
7. Click **Save and Continue**
8. Add test users (your email)
9. Click **Save and Continue**

### Step 4: Create OAuth Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth client ID**
3. Select **Web application**
4. Configure:
   - **Name**: The Closer Web Client
   - **Authorized redirect URIs**:
     - `https://your-domain.com/auth/google/callback`
     - `http://localhost:5173/auth/google/callback`
5. Click **Create**
6. Copy **Client ID** and **Client Secret**

### Step 5: Get Refresh Token

To get a long-lived refresh token, use the OAuth 2.0 Playground:

1. Go to [OAuth 2.0 Playground](https://developers.google.com/oauthplayground)
2. Click the gear icon (settings) in top right
3. Check **Use your own OAuth credentials**
4. Enter your Client ID and Client Secret
5. In the left panel, select:
   - `Google Calendar API v3` → `https://www.googleapis.com/auth/calendar`
6. Click **Authorize APIs**
7. Sign in with your Google account
8. Click **Exchange authorization code for tokens**
9. Copy the **Refresh token**

| Setting | Environment Variable |
|---------|---------------------|
| Client ID | `GOOGLE_CLIENT_ID` |
| Client Secret | `GOOGLE_CLIENT_SECRET` |
| Refresh Token | `GOOGLE_REFRESH_TOKEN` |

---

## Optional Services

### Browserbase (Cloud Browser Automation)

For running browser automation in the cloud instead of locally:

1. Go to [browserbase.com](https://www.browserbase.com)
2. Sign up for an account
3. Create a new project
4. Get your API key and Project ID from the dashboard

```bash
BROWSERBASE_API_KEY="bb_live_xxxxxxxxxx"
BROWSERBASE_PROJECT_ID="proj_xxxxxxxxxx"
```

### VAPI (Voice AI)

For automated voice calling (Phase 3):

1. Go to [vapi.ai](https://vapi.ai)
2. Sign up for an account
3. Create an API key in the dashboard

```bash
VAPI_API_KEY="your_vapi_api_key"
```

---

## Environment Configuration

### Complete `.env` File

```bash
# ===================================
# Node Environment
# ===================================
NODE_ENV="production"

# ===================================
# Supabase (Required)
# ===================================
SUPABASE_URL="https://xxxxxxxxxxxx.supabase.co"
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
SUPABASE_SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# ===================================
# Mailgun (Required)
# ===================================
MAILGUN_API_KEY="key-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
MAILGUN_DOMAIN="mail.yourdomain.com"

# ===================================
# Google Calendar (Optional)
# ===================================
GOOGLE_CLIENT_ID="xxxxxxxxxxxx.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="GOCSPX-xxxxxxxxxxxxxxxx"
GOOGLE_REFRESH_TOKEN="1//xxxxxxxxxxxxxxxxxxxxxx"

# ===================================
# Browserbase (Optional)
# ===================================
BROWSERBASE_API_KEY="bb_live_xxxxxxxxxx"
BROWSERBASE_PROJECT_ID="proj_xxxxxxxxxx"

# ===================================
# VAPI (Optional - Phase 3)
# ===================================
VAPI_API_KEY="your_vapi_api_key"
```

### Dashboard `.env` File

Create `apps/dashboard/.env`:

```bash
VITE_SUPABASE_URL="https://xxxxxxxxxxxx.supabase.co"
VITE_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

## Verification Checklist

After setting up all services, verify each one:

### Supabase

```bash
# Test connection
curl "${SUPABASE_URL}/rest/v1/" \
  -H "apikey: ${SUPABASE_ANON_KEY}"
```

Expected: `{}` (empty object, no error)

### Mailgun

```bash
# Test API key
curl -s --user "api:${MAILGUN_API_KEY}" \
  "https://api.mailgun.net/v3/domains/${MAILGUN_DOMAIN}"
```

Expected: JSON with domain details

### Google Calendar

```bash
# Test with refresh token (requires gcloud or OAuth library)
# The app will test this on first calendar access
```

### Environment Variables Summary

| Service | Variables | Required |
|---------|-----------|----------|
| Supabase | `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Yes |
| Supabase (admin) | `SUPABASE_SERVICE_KEY` | Backend only |
| Mailgun | `MAILGUN_API_KEY`, `MAILGUN_DOMAIN` | Yes |
| Google Calendar | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN` | Optional |
| Browserbase | `BROWSERBASE_API_KEY`, `BROWSERBASE_PROJECT_ID` | Optional |
| VAPI | `VAPI_API_KEY` | Optional |

---

## Troubleshooting

### Supabase Connection Failed

- Verify the URL is correct (includes `https://`)
- Check the anon key matches your project
- Ensure the project is not paused (free tier pauses after 7 days inactivity)

### Mailgun Emails Not Sending

- Verify domain is fully verified (all DNS records)
- Check API key is the private key (starts with `key-`)
- Ensure you're not in sandbox mode (verify recipient emails)

### Google Calendar "Access Denied"

- Ensure all required scopes are approved
- Check the refresh token hasn't expired
- Verify OAuth consent screen is configured

### "Invalid API Key" Errors

- Keys are case-sensitive - copy exactly
- Remove any trailing whitespace
- Ensure `.env` file is in the correct directory

---

## Security Best Practices

1. **Never commit API keys** to version control
2. Use `.env` files and add them to `.gitignore`
3. Use different keys for development and production
4. Rotate keys periodically
5. Set minimum required permissions
6. Monitor usage for anomalies

---

## Related Documentation

- [Deployment Guide](./deployment.md) - Full deployment instructions
- [Architecture](./architecture.md) - System architecture overview
- [API Reference](./api-reference.md) - API documentation

---

**Document Version**: 1.0
**Last Updated**: February 3, 2026
**Maintained By**: Engineering Team
