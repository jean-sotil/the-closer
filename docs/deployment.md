# The Closer - Deployment Guide

**Version**: 1.0
**Last Updated**: February 3, 2026
**Status**: Production Ready

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Variables](#environment-variables)
3. [Supabase Setup](#supabase-setup)
4. [MCP Server Configuration](#mcp-server-configuration)
5. [Deploy to Vercel](#deploy-to-vercel)
6. [Deploy to Railway](#deploy-to-railway)
7. [Custom Domain & SSL](#custom-domain--ssl)
8. [Post-Deployment Verification](#post-deployment-verification)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Software

| Software | Version | Purpose |
|----------|---------|---------|
| Node.js | ≥20.0.0 | JavaScript runtime |
| pnpm | ≥9.0.0 | Package manager |
| Git | ≥2.30 | Version control |
| Supabase CLI | Latest | Database management (optional for local dev) |

### Verify Installation

```bash
# Check Node.js version
node --version
# Expected: v20.x.x or higher

# Check pnpm version
pnpm --version
# Expected: 9.x.x or higher

# Install pnpm if needed
npm install -g pnpm
```

### Required Accounts

Before deployment, create accounts with these services:

| Service | Purpose | Free Tier |
|---------|---------|-----------|
| [Supabase](https://supabase.com) | Database & Auth | Yes (500MB, 2GB transfer) |
| [Vercel](https://vercel.com) or [Railway](https://railway.app) | Hosting | Yes |
| [Mailgun](https://www.mailgun.com) | Email delivery | Yes (first 5,000 emails) |
| [Google Cloud Console](https://console.cloud.google.com) | Calendar API (optional) | Yes |

---

## Environment Variables

### Root Configuration (`.env`)

Create a `.env` file in the project root with the following variables:

```bash
# ===================================
# Core Settings
# ===================================
NODE_ENV="production"

# ===================================
# Supabase (Required)
# ===================================
# Get from: Supabase Dashboard → Settings → API
SUPABASE_URL="https://your-project-id.supabase.co"
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
SUPABASE_SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# ===================================
# Mailgun (Required for Email Outreach)
# ===================================
# Get from: Mailgun Dashboard → Sending → API Keys
MAILGUN_API_KEY="key-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
MAILGUN_DOMAIN="mail.yourdomain.com"

# ===================================
# Google Calendar (Optional)
# ===================================
# Get from: Google Cloud Console → APIs & Services → Credentials
GOOGLE_CLIENT_ID="xxxxx.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="GOCSPX-xxxxxxxxxxxxxxxx"
GOOGLE_REFRESH_TOKEN="1//xxxxxxxxxxxxxxxxxxxxxx"

# ===================================
# VAPI Voice AI (Optional - Phase 3)
# ===================================
VAPI_API_KEY="your_vapi_api_key"

# ===================================
# Browserbase (Optional - Cloud Browsers)
# ===================================
BROWSERBASE_API_KEY="bb_live_xxxxxxxxxx"
BROWSERBASE_PROJECT_ID="proj_xxxxxxxxxx"
```

### Dashboard Configuration (`apps/dashboard/.env`)

```bash
# Supabase Configuration (VITE_ prefix required for Vite)
VITE_SUPABASE_URL="https://your-project-id.supabase.co"
VITE_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Environment Variable Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | ✅ | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | ✅ | Public anon key (safe for frontend) |
| `SUPABASE_SERVICE_KEY` | ⚠️ Backend only | Service role key (full database access) |
| `MAILGUN_API_KEY` | ✅ | Mailgun private API key |
| `MAILGUN_DOMAIN` | ✅ | Verified sending domain |
| `GOOGLE_CLIENT_ID` | Optional | OAuth 2.0 client ID |
| `GOOGLE_CLIENT_SECRET` | Optional | OAuth 2.0 client secret |
| `GOOGLE_REFRESH_TOKEN` | Optional | Long-lived refresh token |
| `VAPI_API_KEY` | Optional | Voice AI service key |
| `BROWSERBASE_API_KEY` | Optional | Cloud browser service |
| `BROWSERBASE_PROJECT_ID` | Optional | Browserbase project |

---

## Supabase Setup

### 1. Create a New Project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard)
2. Click **New Project**
3. Fill in:
   - **Name**: `the-closer-prod`
   - **Database Password**: Generate a strong password (save this!)
   - **Region**: Choose closest to your users
4. Click **Create new project**
5. Wait 2-3 minutes for provisioning

### 2. Get API Credentials

1. Go to **Settings** → **API**
2. Copy:
   - **Project URL** → `SUPABASE_URL`
   - **anon public** key → `SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_KEY` (keep secret!)

### 3. Run Database Migrations

```bash
# Install Supabase CLI (if not installed)
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-id

# Push migrations to production
supabase db push
```

### 4. Configure Row Level Security (RLS)

Verify RLS is enabled on all tables:

```sql
-- Run in Supabase SQL Editor
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';
```

All tables should show `rowsecurity = true`.

### 5. Set Up Storage Buckets

1. Go to **Storage** → **New Bucket**
2. Create a bucket named `evidence`:
   - **Bucket name**: `evidence`
   - **Public bucket**: No (private)
   - **Allowed MIME types**: `image/*,video/*,application/pdf`
   - **File size limit**: 50MB
3. Set up storage policies (see `supabase/migrations/` for policy definitions)

### 6. Configure Authentication

1. Go to **Authentication** → **Settings**
2. Set **Site URL**: `https://your-domain.com`
3. Add **Redirect URLs**:
   - `https://your-domain.com/auth/callback`
   - `http://localhost:5173/auth/callback` (for development)
4. Enable **Email** provider
5. Configure password requirements:
   - Minimum length: 8
   - Require uppercase, lowercase, number, special character

---

## MCP Server Configuration

The MCP (Model Context Protocol) servers enable AI-powered automation.

### Configuration File (`.mcp.json`)

```json
{
  "mcpServers": {
    "puppeteer": {
      "command": "npx",
      "args": ["-y", "@anthropic-ai/mcp-server-puppeteer"]
    },
    "supabase": {
      "command": "npx",
      "args": ["-y", "@supabase/mcp-server-postgrest"],
      "env": {
        "SUPABASE_URL": "${SUPABASE_URL}",
        "SUPABASE_ANON_KEY": "${SUPABASE_ANON_KEY}"
      }
    },
    "mailgun": {
      "command": "npx",
      "args": ["-y", "@mailgun/mailgun-mcp-server"],
      "env": {
        "MAILGUN_API_KEY": "${MAILGUN_API_KEY}",
        "MAILGUN_DOMAIN": "${MAILGUN_DOMAIN}"
      }
    },
    "google-calendar": {
      "command": "npx",
      "args": ["-y", "@cocal/google-calendar-mcp"],
      "env": {
        "GOOGLE_CLIENT_ID": "${GOOGLE_CLIENT_ID}",
        "GOOGLE_CLIENT_SECRET": "${GOOGLE_CLIENT_SECRET}"
      }
    },
    "task-master-ai": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "task-master-ai"],
      "env": {
        "TASK_MASTER_TOOLS": "core"
      },
      "envFile": ".env"
    }
  }
}
```

### MCP Server Details

| Server | Purpose | Required |
|--------|---------|----------|
| `puppeteer` | Browser automation for site audits | ✅ |
| `supabase` | Database operations | ✅ |
| `mailgun` | Email campaign delivery | ✅ |
| `google-calendar` | Meeting scheduling | Optional |
| `task-master-ai` | Development task management | Dev only |

---

## Deploy to Vercel

### 1. Prepare Repository

```bash
# Ensure you're on the main branch
git checkout main

# Verify build succeeds locally
pnpm install
pnpm build
```

### 2. Connect to Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repository
3. Configure project:
   - **Framework Preset**: Vite
   - **Root Directory**: `apps/dashboard`
   - **Build Command**: `pnpm build`
   - **Output Directory**: `dist`

### 3. Configure Environment Variables

In Vercel dashboard → Settings → Environment Variables:

| Variable | Environment | Value |
|----------|-------------|-------|
| `VITE_SUPABASE_URL` | Production | `https://xxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Production | `eyJ...` |

### 4. Deploy

```bash
# Using Vercel CLI
npm i -g vercel
vercel --prod

# Or push to main branch for auto-deploy
git push origin main
```

### 5. Verify Deployment

1. Visit your Vercel deployment URL
2. Check the browser console for errors
3. Test authentication flow
4. Verify API connections

### Vercel Configuration File (`vercel.json`)

Create in `apps/dashboard/`:

```json
{
  "buildCommand": "pnpm build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [
    { "source": "/(.*)", "destination": "/" }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-XSS-Protection", "value": "1; mode=block" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Strict-Transport-Security", "value": "max-age=31536000; includeSubDomains" }
      ]
    }
  ]
}
```

---

## Deploy to Railway

### 1. Create Railway Project

1. Go to [railway.app](https://railway.app)
2. Click **New Project** → **Deploy from GitHub repo**
3. Select your repository
4. Railway auto-detects Node.js

### 2. Configure Build Settings

In Railway dashboard → Settings:

| Setting | Value |
|---------|-------|
| Root Directory | `apps/dashboard` |
| Build Command | `pnpm install && pnpm build` |
| Start Command | `npx serve dist -l $PORT` |

### 3. Add Environment Variables

Go to Variables tab and add:

```
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
PORT=3000
```

### 4. Deploy

Railway deploys automatically on push to main branch.

### 5. Custom Domain

1. Go to Settings → Domains
2. Click **Generate Domain** for `xxx.up.railway.app`
3. Or add custom domain (see below)

---

## Custom Domain & SSL

### Vercel Custom Domain

1. Go to Vercel Dashboard → Project → Settings → Domains
2. Add your domain: `app.yourdomain.com`
3. Configure DNS:

| Type | Name | Value |
|------|------|-------|
| CNAME | app | `cname.vercel-dns.com` |

Or for apex domain:

| Type | Name | Value |
|------|------|-------|
| A | @ | `76.76.21.21` |

4. Wait for DNS propagation (up to 48 hours, usually < 1 hour)
5. Vercel automatically provisions SSL certificate

### Railway Custom Domain

1. Go to Railway Dashboard → Project → Settings → Domains
2. Add custom domain
3. Configure DNS:

| Type | Name | Value |
|------|------|-------|
| CNAME | app | `your-app.up.railway.app` |

4. Railway automatically provisions SSL via Let's Encrypt

### Supabase Custom Domain (Optional)

For custom API domain (e.g., `api.yourdomain.com`):

1. Supabase Dashboard → Settings → Custom Domains
2. Add your domain
3. Follow DNS configuration instructions

### SSL/TLS Requirements

- All traffic must use HTTPS
- Minimum TLS 1.2 (TLS 1.3 preferred)
- HSTS header enabled (auto on Vercel/Railway)
- Certificate must be valid (auto-renewed)

---

## Post-Deployment Verification

### Immediate Checks (0-5 minutes)

```bash
# 1. Check homepage loads
curl -I https://your-domain.com
# Expected: HTTP/2 200

# 2. Check API health
curl https://your-domain.com/api/health
# Expected: {"status":"ok"}

# 3. Check security headers
curl -I https://your-domain.com | grep -E "(Strict-Transport|X-Frame|X-Content-Type)"
```

### Functional Checks

1. **Authentication**:
   - [ ] Sign up with new account
   - [ ] Receive confirmation email
   - [ ] Sign in with credentials
   - [ ] Password reset flow works

2. **Dashboard**:
   - [ ] Dashboard loads without errors
   - [ ] Leads page displays correctly
   - [ ] Audits page shows data
   - [ ] Settings are accessible

3. **API Integration**:
   - [ ] Supabase queries work
   - [ ] Real-time subscriptions connect
   - [ ] File uploads succeed

### Performance Checks

Run Lighthouse audit:

```bash
npx lighthouse https://your-domain.com --view
```

Target scores:
- Performance: > 90
- Accessibility: > 90
- Best Practices: > 90
- SEO: > 90

---

## Troubleshooting

### Build Failures

**Error**: `pnpm: command not found`

```bash
# Install pnpm in CI/CD
npm install -g pnpm@9
```

**Error**: `Node version not supported`

```bash
# Add to package.json
"engines": {
  "node": ">=20.0.0"
}

# Add .nvmrc file
echo "20" > .nvmrc
```

### Database Connection Issues

**Error**: `Connection refused`

1. Verify `SUPABASE_URL` is correct
2. Check IP is not blocked in Supabase settings
3. Verify anon key is correct

**Error**: `Permission denied`

1. Check RLS policies allow the operation
2. Verify user is authenticated
3. Check service key for admin operations

### Mailgun Issues

**Error**: `Invalid API key`

1. Verify API key starts with `key-`
2. Use private API key, not public validation key
3. Check domain is verified

**Error**: `Domain not verified`

1. Go to Mailgun → Sending → Domains
2. Add required DNS records
3. Click "Verify DNS settings"

### CORS Errors

**Error**: `Access-Control-Allow-Origin` missing

1. Add your domain to Supabase CORS settings
2. Supabase Dashboard → Settings → API → CORS

```
https://your-domain.com
http://localhost:5173
```

### Environment Variables Not Loading

1. Verify `.env` file exists
2. Check variable names match exactly
3. Restart the server after changes
4. For Vite, ensure frontend vars use `VITE_` prefix

---

## Appendix: Quick Reference

### Essential Commands

```bash
# Install dependencies
pnpm install

# Build for production
pnpm build

# Run locally
pnpm dev

# Type check
pnpm typecheck

# Lint
pnpm lint

# Run tests
pnpm test
```

### Important URLs

| Resource | URL |
|----------|-----|
| Supabase Dashboard | https://supabase.com/dashboard |
| Vercel Dashboard | https://vercel.com/dashboard |
| Railway Dashboard | https://railway.app/dashboard |
| Mailgun Dashboard | https://app.mailgun.com |
| Google Cloud Console | https://console.cloud.google.com |

### Support Contacts

- **Supabase**: https://supabase.com/support
- **Vercel**: https://vercel.com/support
- **Railway**: https://docs.railway.app/reference/support
- **Mailgun**: https://www.mailgun.com/support

---

**Document Version**: 1.0
**Last Updated**: February 3, 2026
**Maintained By**: Engineering Team
