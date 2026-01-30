# CLAUDE.md - Autonomous AI Revenue Engine

## Project Overview

This is an **Audit-to-Outreach Sales Automation System** that automates the full B2B sales cycle for web agencies and SaaS companies. The system finds local businesses with website problems, generates technical evidence of their pain points, and initiates personalized outreach to book sales appointments.

**Target Customers**: Web agencies, digital marketing agencies, SaaS companies serving local businesses (restaurants, dentists, law firms, etc.)

**Business Model**: SaaS at $297-597/month delivering 100-500 qualified leads

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                     REACT DASHBOARD (Command & Control)             │
├─────────────────────────────────────────────────────────────────────┤
│                              MCP LAYER                               │
├──────────────┬──────────────┬──────────────┬───────────────────────┤
│ Lead Discovery│  Site Audit  │Email Outreach│   Lead Storage        │
│     MCP       │     MCP      │     MCP      │      MCP              │
├──────────────┴──────────────┴──────────────┴───────────────────────┤
│                        EXECUTION LAYER                               │
├──────────────┬──────────────┬──────────────┬───────────────────────┤
│  Puppeteer/  │  Lighthouse  │   Mailgun    │     Supabase          │
│  Browserbase │  DevTools    │              │    PostgreSQL         │
└──────────────┴──────────────┴──────────────┴───────────────────────┘
```

---

## Technology Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| Frontend | React + TypeScript | Dashboard for command & control |
| Browser Automation | @anthropic-ai/mcp-server-puppeteer OR Browserbase MCP | Stealth web scraping & auditing |
| Database | @supabase/mcp-server-postgrest | Managed PostgreSQL with real-time |
| Email | @mailgun/mailgun-mcp-server | Enterprise email delivery |
| Calendar | @cocal/google-calendar-mcp | Meeting scheduling |
| Voice (Phase 3) | VAPI.ai via custom HTTP connector | Automated calling |

---

## Development Phases

### Phase 1: Stealth Discovery Engine (Lead Mining)

**Goal**: Scrape Google Maps without detection using network interception.

**Critical Implementation Details**:

1. **DO NOT scrape HTML text** - Intercept raw JSON from network requests
2. **Use ExtensionTransport** for stealth browser fingerprinting
3. **Implement Locator-based waiting** - Never fail on dynamic content, always wait

**Key Code Patterns**:

```javascript
// Network interception for Google Maps data
page.on('response', async (response) => {
  const url = response.url();
  if (url.includes('maps.googleapis.com') || url.includes('/search')) {
    const json = await response.json();
    // Extract: business_name, phone, website, rating, review_count
  }
});

// Resilient scrolling with Locator
const listLocator = page.locator('.business-list-item');
await listLocator.waitFor({ state: 'visible', timeout: 10000 });
```

**Data to Extract**:
- business_name
- address
- phone_number
- website_url
- rating (filter for < 4.0 stars = opportunity)
- review_count
- business_category

---

### Phase 2: Sentient Auditor (Evidence Generation)

**Goal**: Visit each lead's website and generate "irrefutable proof" of technical failures.

**Audit Checklist**:

#### A. Visual QA (Mobile Viewport)
```javascript
// Set iPhone X viewport
await page.setViewport({ width: 375, height: 812, isMobile: true });

// Check for horizontal overflow (broken mobile UX)
const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
if (bodyWidth > 375) {
  painPoints.push({ type: 'BROKEN_MOBILE_UX', severity: 'HIGH' });
}

// Screenshot the broken layout
await page.screenshot({ path: `evidence/${businessId}-mobile.png` });
```

#### B. Performance Debt (Code Coverage)
```javascript
// Start coverage collection
await page.coverage.startJSCoverage();
await page.coverage.startCSSCoverage();

await page.reload({ waitUntil: 'networkidle0' });

const jsCoverage = await page.coverage.stopJSCoverage();
const cssCoverage = await page.coverage.stopCSSCoverage();

// Calculate unused percentage
const unusedJS = calculateUnusedPercentage(jsCoverage);
const unusedCSS = calculateUnusedPercentage(cssCoverage);

// Report as "Performance Debt"
// Example output: "80% of your JavaScript is never executed"
```

#### C. Accessibility Audit (Legal Risk)
```javascript
// Get Accessibility Tree
const accessibilityTree = await page.accessibility.snapshot();

// Flag violations:
// - Buttons without labels
// - Images without alt text
// - Low contrast text
// - Unlabeled form fields

// These become "Legal Risk" pain points in sales pitch
```

#### D. Performance Recording (The Smoking Gun)
```javascript
// If site loads > 3 seconds, record video evidence
await page.tracing.start({ screenshots: true });
const startTime = Date.now();

await page.goto(url, { waitUntil: 'networkidle0' });

const loadTime = Date.now() - startTime;
await page.tracing.stop();

if (loadTime > 3000) {
  // Use ScreenRecorder to capture 5-second video
  // This video is the MOST POWERFUL sales asset
  await recordPageLoad(page, `evidence/${businessId}-slow-load.webm`);
}
```

---

### Phase 3: State Management (The Brain)

**Database**: Supabase PostgreSQL via MCP

**LeadProfile Schema**:

```sql
CREATE TABLE lead_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Discovery Data
  business_name TEXT NOT NULL,
  address TEXT,
  phone_number TEXT,
  website_url TEXT,
  rating DECIMAL(2,1),
  review_count INTEGER,
  business_category TEXT,
  
  -- Audit Results
  pain_points JSONB DEFAULT '[]',
  -- Example: [
  --   {"type": "SLOW_LOAD", "value": "6.2s", "severity": "CRITICAL"},
  --   {"type": "UNUSED_CSS", "value": "80%", "severity": "HIGH"},
  --   {"type": "WCAG_VIOLATION", "value": "12 errors", "severity": "MEDIUM"}
  -- ]
  
  performance_score INTEGER, -- 0-100 Lighthouse score
  accessibility_score INTEGER,
  mobile_friendly BOOLEAN,
  
  -- Evidence
  evidence_urls JSONB DEFAULT '[]',
  -- Example: [
  --   {"type": "screenshot", "url": "https://storage.../mobile.png"},
  --   {"type": "video", "url": "https://storage.../slow-load.webm"},
  --   {"type": "report", "url": "https://storage.../audit.pdf"}
  -- ]
  
  -- Outreach Status
  contact_status TEXT DEFAULT 'pending',
  -- Values: pending | emailed | called | booked | converted | declined
  
  last_contacted_at TIMESTAMPTZ,
  next_followup_at TIMESTAMPTZ,
  notes TEXT,
  
  -- Metadata
  discovered_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  source_query TEXT -- "dentists in Austin with rating < 4.0"
);

-- Index for fast filtering
CREATE INDEX idx_lead_status ON lead_profiles(contact_status);
CREATE INDEX idx_lead_score ON lead_profiles(performance_score);
```

---

### Phase 4: The Closer (Outreach Automation)

#### A. Email Outreach (Mailgun MCP)

**Dynamic Template Variables**:
```javascript
const emailContext = {
  business_name: lead.business_name,
  specific_issue: lead.pain_points[0].type, // "6.2 second load time"
  evidence_link: lead.evidence_urls[0].url,
  calendar_link: generateBookingLink()
};

// Template: "Hi {business_name}, I noticed your site takes {specific_issue}
// to load on mobile. Here's a video showing the issue: {evidence_link}
// I can fix this in under a week. Book a quick call: {calendar_link}"
```

#### B. Voice AI (VAPI - Custom HTTP Connector)

**IMPORTANT**: VAPI does not have a native MCP server. Build a custom HTTP tool connector using the MCP SDK.

**Dynamic Sales Prompt Construction**:
```javascript
const vapiPrompt = `
System: You are a web optimization expert calling ${lead.business_name}.

Context from audit:
- Site load time: ${lead.pain_points.find(p => p.type === 'SLOW_LOAD')?.value}
- Unused code: ${lead.pain_points.find(p => p.type === 'UNUSED_CSS')?.value}
- Accessibility errors: ${lead.pain_points.find(p => p.type === 'WCAG_VIOLATION')?.value}

If they doubt you, offer to email the video evidence.

Goal: Book a 15-minute discovery call.

Available slots: ${availableSlots.join(', ')}
`;
```

#### C. Calendar Integration (Google Calendar MCP)

```javascript
// Check availability
const events = await calendar.events.list({
  calendarId: 'primary',
  timeMin: new Date().toISOString(),
  timeMax: addDays(new Date(), 7).toISOString(),
  singleEvents: true
});

// Book slot when lead agrees
await calendar.events.insert({
  calendarId: 'primary',
  resource: {
    summary: `Discovery Call: ${lead.business_name}`,
    description: `Pain points: ${JSON.stringify(lead.pain_points)}`,
    start: { dateTime: selectedSlot },
    end: { dateTime: addMinutes(selectedSlot, 15) }
  }
});
```

---

## MCP Server Configuration

### Required MCP Servers

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
        "SUPABASE_URL": "YOUR_SUPABASE_URL",
        "SUPABASE_ANON_KEY": "YOUR_ANON_KEY"
      }
    },
    "mailgun": {
      "command": "npx",
      "args": ["-y", "@mailgun/mailgun-mcp-server"],
      "env": {
        "MAILGUN_API_KEY": "YOUR_API_KEY",
        "MAILGUN_DOMAIN": "YOUR_DOMAIN"
      }
    },
    "google-calendar": {
      "command": "npx",
      "args": ["-y", "@cocal/google-calendar-mcp"],
      "env": {
        "GOOGLE_CLIENT_ID": "YOUR_CLIENT_ID",
        "GOOGLE_CLIENT_SECRET": "YOUR_CLIENT_SECRET"
      }
    }
  }
}
```

---

## Key Implementation Rules

### DO:
- ✅ Use network interception for data extraction (not HTML scraping)
- ✅ Implement Locator-based waiting for all dynamic content
- ✅ Generate visual evidence (screenshots, videos) for every audit
- ✅ Store all findings in structured LeadProfile objects
- ✅ Use managed services (Supabase, Mailgun) to reduce ops burden
- ✅ Implement proper rate limiting and delays between requests

### DON'T:
- ❌ Scrape HTML text directly (gets detected/blocked)
- ❌ Fail fast on missing elements (always wait with timeout)
- ❌ Invent APIs that don't exist (use HTTP connector for VAPI)
- ❌ Store sensitive credentials in code (use environment variables)
- ❌ Launch new browser for every lead (use BrowserContexts)

---

## Performance Optimizations

### Parallel Processing with BrowserContexts
```javascript
// Launch ONE browser
const browser = await puppeteer.launch();

// Create 10 isolated contexts for parallel auditing
const contexts = await Promise.all(
  Array(10).fill().map(() => browser.createIncognitoBrowserContext())
);

// Each context has isolated cookies/storage
// Audit 10 sites simultaneously
```

### Real-Time Dashboard Streaming
```javascript
// Stream browser session to React dashboard
const client = await page.target().createCDPSession();
await client.send('Page.startScreencast', {
  format: 'jpeg',
  quality: 50,
  everyNthFrame: 5
});

client.on('Page.screencastFrame', ({ data, sessionId }) => {
  // Send frame to React via WebSocket
  ws.send(JSON.stringify({ type: 'frame', data }));
  client.send('Page.screencastFrameAck', { sessionId });
});
```

---

## Success Metrics

| Metric | Baseline | Target |
|--------|----------|--------|
| Email Response Rate | 2-3% | 8-12% |
| Lead Qualification Accuracy | 15-20% | 60-75% |
| Time to Generate 100 Leads | 40+ hours | 2-3 hours |
| Meeting Booking Rate | 0.5-1% | 3-5% |

---

## Development Timeline

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| Phase 1: MVP Foundation | Months 1-2 | Lead discovery + basic audit |
| Phase 2: Email Automation | Month 3 | Template engine + campaigns |
| Phase 3: Voice Integration | Months 4-6 | VAPI + advanced analytics |

---

## File Structure

```
autonomous-revenue-engine/
├── apps/
│   └── dashboard/              # React frontend
│       ├── src/
│       │   ├── components/
│       │   │   ├── LeadTable.tsx
│       │   │   ├── AuditViewer.tsx
│       │   │   └── CampaignBuilder.tsx
│       │   ├── hooks/
│       │   │   └── useMCP.ts
│       │   └── pages/
│       │       ├── Discovery.tsx
│       │       ├── Audits.tsx
│       │       └── Outreach.tsx
│       └── package.json
├── packages/
│   ├── mcp-lead-discovery/     # Google Maps scraping
│   ├── mcp-site-audit/         # Puppeteer auditing
│   ├── mcp-email-outreach/     # Mailgun integration
│   └── mcp-lead-storage/       # Supabase operations
├── supabase/
│   └── migrations/
│       └── 001_lead_profiles.sql
├── .env.example
├── CLAUDE.md                   # This file
└── README.md
```

---

## Environment Variables

```bash
# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_KEY=xxx

# Mailgun
MAILGUN_API_KEY=xxx
MAILGUN_DOMAIN=xxx

# Google Calendar
GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx
GOOGLE_REFRESH_TOKEN=xxx

# VAPI (Voice AI)
VAPI_API_KEY=xxx

# Optional: Browserbase (alternative to local Puppeteer)
BROWSERBASE_API_KEY=xxx
BROWSERBASE_PROJECT_ID=xxx
```

---

## Quick Start Commands

```bash
# Install dependencies
pnpm install

# Start Supabase locally (for development)
supabase start

# Run database migrations
supabase db push

# Start React dashboard
pnpm --filter dashboard dev

# Run lead discovery (example)
pnpm --filter mcp-lead-discovery start --query "dentists in Austin"

# Run site audit on discovered leads
pnpm --filter mcp-site-audit start --status pending --limit 50
```

---

## Notes for Claude

When working on this project:

1. **Always use proven MCP servers** from mcpservers.org - avoid custom implementations where official ones exist

2. **For VAPI integration**, since there's no native MCP server, create a generic HTTP tool connector using the MCP SDK

3. **Prioritize stealth** in the discovery phase - Google Maps blocking is the #1 technical risk

4. **Evidence generation is the product differentiator** - every audit should produce visual proof

5. **The LeadProfile is the central data model** - all phases read/write to this structure

6. **Rate limiting is critical** - implement delays between requests to avoid IP bans

7. **Use BrowserContexts** for parallel processing - never launch multiple browser instances

## Task Master AI Instructions
**Import Task Master's development workflow commands and guidelines, treat as if import is in the main CLAUDE.md file.**
@./.taskmaster/CLAUDE.md
