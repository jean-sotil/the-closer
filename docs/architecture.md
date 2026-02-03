# The Closer - System Architecture

**Version**: 1.0
**Last Updated**: February 2, 2026
**Status**: Production Ready

---

## Executive Summary

The Closer is an **audit-to-outreach sales automation platform** that automates the entire B2B sales cycle for web agencies and SaaS companies. The system autonomously discovers local business leads, audits their websites for technical issues, generates evidence-based outreach campaigns, and books sales appointments.

**Core Value Proposition**: Transform 40+ hours of manual sales work into 2-3 hours of automated lead generation with 60-75% qualification accuracy.

---

## System Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                     USER INTERFACE LAYER                            │
│              React Dashboard (Command & Control)                    │
│         ┌──────────────────────────────────────────────┐            │
│         │  Discovery  │  Audits  │  Outreach  │  Settings │         │
│         └──────────────────────────────────────────────┘            │
└────────────────────────────┬────────────────────────────────────────┘
                             │ REST API / Supabase Client
┌────────────────────────────┴────────────────────────────────────────┐
│                     MCP ORCHESTRATION LAYER                         │
│              (Model Context Protocol Servers)                       │
├──────────────┬──────────────┬──────────────┬───────────────────────┤
│ Lead Discovery│  Site Audit  │Email Outreach│   Lead Storage        │
│     MCP       │     MCP      │     MCP      │      MCP              │
│               │              │              │                       │
│ - Maps scrape │ - Lighthouse │ - Mailgun    │ - Supabase CRUD      │
│ - Data extract│ - Puppeteer  │ - Templates  │ - Evidence store     │
│ - Qualify     │ - Coverage   │ - Campaigns  │ - Analytics          │
└──────────────┴──────────────┴──────────────┴───────────────────────┘
                             │
┌────────────────────────────┴────────────────────────────────────────┐
│                     DATA & EXECUTION LAYER                          │
├──────────────┬──────────────┬──────────────┬───────────────────────┤
│  Supabase    │  Puppeteer/  │   Mailgun    │   Google Calendar     │
│  PostgreSQL  │  Browserbase │   Email API  │   Scheduling API      │
│              │              │              │                       │
│ - RLS        │ - Stealth    │ - Templates  │ - Availability        │
│ - Auth       │ - Network    │ - Tracking   │ - Booking             │
│ - Storage    │ - Screenshots│ - Webhooks   │ - Reminders           │
└──────────────┴──────────────┴──────────────┴───────────────────────┘
```

---

## Core Components

### 1. React Dashboard (Frontend)

**Technology**: React 18 + TypeScript + Vite
**Location**: `apps/dashboard/`

**Purpose**: User interface for controlling the sales automation pipeline.

**Key Features**:
- Real-time lead discovery monitoring
- Audit result visualization with charts
- Campaign management and analytics
- Evidence viewer (screenshots, videos, reports)
- User authentication and settings

**Architecture Patterns**:
- **Component Structure**: Atomic design (atoms → molecules → organisms → pages)
- **State Management**: React Query for server state, Context API for global UI state
- **Routing**: React Router with protected routes
- **Data Fetching**: React Query with Supabase client
- **Styling**: Tailwind CSS utility-first approach

**File Structure**:
```
apps/dashboard/
├── src/
│   ├── components/        # Reusable UI components
│   │   ├── leads/        # Lead management components
│   │   ├── campaigns/    # Campaign analytics components
│   │   └── ui/           # Base UI components
│   ├── pages/            # Route pages
│   │   ├── Discovery.tsx # Lead discovery interface
│   │   ├── Audits.tsx    # Audit results viewer
│   │   ├── Leads.tsx     # Lead management
│   │   ├── Outreach.tsx  # Campaign management
│   │   └── Login.tsx     # Authentication
│   ├── contexts/         # React contexts
│   │   └── AuthContext.tsx
│   ├── hooks/            # Custom React hooks
│   ├── api/              # API client layer
│   ├── config/           # Configuration
│   └── utils/            # Utility functions
├── public/               # Static assets
└── vite.config.ts       # Build configuration
```

---

### 2. MCP Server Layer (Orchestration)

**Technology**: Node.js + TypeScript + MCP SDK
**Location**: `packages/mcp-*/`

The MCP (Model Context Protocol) servers act as specialized microservices that Claude Code can invoke directly.

#### 2.1 Lead Discovery MCP (`mcp-lead-discovery`)

**Purpose**: Scrape Google Maps for local business leads.

**Key Components**:
- `MapsScraper`: Stealth web scraping engine
- `DataExtractor`: Parse JSON from network requests
- `ProspectQualifier`: Filter leads by criteria
- `ResilientScraper`: Retry logic and rate limiting

**Data Flow**:
```
User Query → MapsScraper → Network Interception → JSON Extract →
Qualification → LeadProfile → Supabase
```

**Critical Implementation**:
- Uses network interception (NOT HTML scraping) to avoid detection
- ExtensionTransport for stealth fingerprinting
- Locator-based waiting for dynamic content
- Batch processing with BrowserContexts

**Output**: `LeadProfile` objects with business data + qualification scores

---

#### 2.2 Site Audit MCP (`mcp-site-audit`)

**Purpose**: Generate technical audit reports with visual evidence.

**Key Components**:
- `AuditEngine`: Orchestrates audit workflow
- `PerformanceAuditor`: Lighthouse metrics, Core Web Vitals
- `AccessibilityAuditor`: WCAG compliance, a11y tree analysis
- `CoverageAnalyzer`: Unused CSS/JS detection
- `EvidenceGenerator`: Screenshots, videos, reports

**Audit Categories**:
1. **Performance Debt**: Unused code, slow load times
2. **Accessibility Violations**: Missing alt text, low contrast, unlabeled forms
3. **Mobile UX Issues**: Horizontal scroll, viewport overflow
4. **SEO Problems**: Missing metadata, broken links

**Data Flow**:
```
Website URL → Puppeteer Launch → Lighthouse Audit →
Coverage Analysis → Screenshot/Video → Pain Points →
Evidence URLs → AuditResult → Supabase
```

**Output**: `AuditResult` with scores, violations, and evidence URLs

---

#### 2.3 Email Outreach MCP (`mcp-email-outreach`)

**Purpose**: Automated email campaigns with personalization.

**Key Components**:
- `MailgunClient`: Email delivery via Mailgun API
- `TemplateEngine`: Dynamic template rendering
- `CampaignManager`: Multi-step email sequences
- `DeliveryTracker`: Webhook processing for opens/clicks
- `CalendarIntegration`: Meeting booking flow

**Template System**:
```typescript
const emailContext = {
  business_name: "Joe's Plumbing",
  pain_point: "6.2 second load time",
  evidence_link: "https://storage.../slow-load.webm",
  calendar_link: "https://cal.com/book/..."
};

// Result:
"Hi Joe's Plumbing, I noticed your site takes 6.2 seconds to load..."
```

**Campaign Flow**:
```
Lead Selected → Template Rendered → Email Sent →
Webhook (Opened) → Delay 3 Days → Follow-up Email →
Webhook (Clicked) → Calendar Booking → Meeting Booked
```

**Compliance**:
- CAN-SPAM: Unsubscribe links in all emails
- List-Unsubscribe headers (RFC 2369, RFC 8058)
- Tracking webhooks for engagement metrics

---

#### 2.4 Lead Storage MCP (`mcp-lead-storage`)

**Purpose**: CRUD operations for lead data in Supabase.

**Key Components**:
- `LeadRepository`: Lead profile management
- `EvidenceStore`: File upload to Supabase Storage
- `StatusTracker`: Contact status transitions
- `AnalyticsService`: Conversion metrics

**Database Schema** (see Supabase section)

---

### 3. Database Layer (Supabase PostgreSQL)

**Technology**: PostgreSQL 14 + Row Level Security
**Location**: `supabase/migrations/`

**Core Tables**:

#### `lead_profiles`
```sql
- id (UUID, PK)
- business_name, address, phone, website, rating
- pain_points (JSONB)
- performance_score, accessibility_score
- evidence_urls (JSONB)
- contact_status (pending|emailed|called|booked|converted|declined)
- discovered_at, updated_at
```

#### `audits`
```sql
- id (UUID, PK)
- lead_id (FK → lead_profiles)
- performance metrics (FCP, LCP, CLS, TTI)
- coverage data (unused_js_percent, unused_css_percent)
- wcag_violations (JSONB)
- evidence_urls (JSONB)
- audited_at
```

#### `campaigns`
```sql
- id (UUID, PK)
- name, description
- lead_filters (JSONB)
- sequence (JSONB) - multi-step email flow
- status (draft|scheduled|active|paused|completed)
- statistics (emails_sent, opened, clicked, booked)
```

#### `email_events`
```sql
- id (UUID, PK)
- campaign_id (FK)
- lead_id (FK)
- event_type (queued|sent|delivered|opened|clicked|replied|bounced)
- occurred_at
```

**Security**:
- Row Level Security (RLS) enabled on ALL tables
- JWT-based authentication via Supabase Auth
- Service role key for admin operations only

---

## Data Flow Diagrams

### Complete Sales Automation Flow

```
┌─────────────┐
│  User Input │ "Find dentists in Austin with rating < 4.0"
└──────┬──────┘
       │
       ▼
┌────────────────────────┐
│  Lead Discovery MCP    │
│  - Google Maps scrape  │
│  - Qualify prospects   │
└──────┬─────────────────┘
       │ LeadProfile[]
       ▼
┌────────────────────────┐
│  Supabase Storage      │
│  - Insert leads        │
└──────┬─────────────────┘
       │
       ▼
┌────────────────────────┐
│  Site Audit MCP        │
│  - Lighthouse audit    │
│  - Generate evidence   │
└──────┬─────────────────┘
       │ AuditResult
       ▼
┌────────────────────────┐
│  Supabase Storage      │
│  - Update lead profile │
│  - Insert audit result │
└──────┬─────────────────┘
       │
       ▼
┌────────────────────────┐
│  Dashboard UI          │
│  - Review pain points  │
│  - Create campaign     │
└──────┬─────────────────┘
       │ CampaignConfig
       ▼
┌────────────────────────┐
│  Email Outreach MCP    │
│  - Render templates    │
│  - Send via Mailgun    │
└──────┬─────────────────┘
       │ EmailEvent (webhooks)
       ▼
┌────────────────────────┐
│  Lead clicks link      │
│  → Calendar booking    │
└──────┬─────────────────┘
       │
       ▼
┌────────────────────────┐
│  Meeting Booked ✅     │
│  Status: converted     │
└────────────────────────┘
```

---

## Technology Choices & Rationale

### Why Supabase?

**Pros**:
- PostgreSQL (battle-tested, mature)
- Built-in authentication (JWT, RLS)
- Real-time subscriptions via WebSockets
- Generous free tier
- Row Level Security for multi-tenant safety

**Alternatives Considered**:
- Firebase: Limited query capabilities, vendor lock-in
- MongoDB: No built-in RLS, weaker type safety
- Self-hosted Postgres: High operational overhead

---

### Why MCP Architecture?

**Pros**:
- **Modularity**: Each MCP server is independently deployable
- **Claude Integration**: Direct invocation from Claude Code
- **Type Safety**: TypeScript throughout
- **Standardization**: Official Anthropic protocol
- **Testability**: Each server can be tested in isolation

**Alternatives Considered**:
- Monolithic Express API: Hard to scale, tight coupling
- Serverless functions: Cold start issues, state management complexity
- GraphQL: Over-engineering for CRUD operations

---

### Why Puppeteer over Selenium?

**Pros**:
- Native Chrome DevTools Protocol (CDP) support
- Faster execution (no WebDriver intermediary)
- Better network interception
- Code coverage collection built-in
- Smaller footprint

**Alternatives Considered**:
- Playwright: Comparable but less mature ecosystem
- Selenium: Slower, more verbose API

---

## Scalability Considerations

### Current Limits (MVP)

- **Concurrent Audits**: 10 (via BrowserContexts)
- **Lead Discovery**: 100-500 leads/search
- **Email Throughput**: 100 emails/hour (rate limit)
- **Database**: Supabase Free Tier (500 MB, 2 GB transfer)

### Scaling Strategy (Production)

**Horizontal Scaling**:
```
Load Balancer
    ├─ Dashboard Instance 1 (Vercel Edge)
    ├─ Dashboard Instance 2 (Vercel Edge)
    └─ Dashboard Instance N (Auto-scale)

MCP Server Pool
    ├─ Audit Worker 1 (Browserbase)
    ├─ Audit Worker 2 (Browserbase)
    └─ Audit Worker N (Auto-scale to 50+)

Database
    └─ Supabase Pro (Connection pooling, read replicas)
```

**Bottlenecks & Solutions**:
1. **Puppeteer Memory**: Use Browserbase (cloud browsers)
2. **Email Rate Limits**: Mailgun scales to 10K/hour
3. **Database Connections**: PgBouncer pooling
4. **Storage**: Supabase Storage (S3-compatible, unlimited)

---

## Security Architecture

### Defense in Depth

**Layer 1: Network**
- HTTPS/TLS 1.3 everywhere
- CORS whitelist
- Rate limiting (60 req/min API, 5 req/15min auth)

**Layer 2: Application**
- Input sanitization (XSS prevention)
- Output encoding
- CSRF protection (planned)
- Security headers (CSP, HSTS, X-Frame-Options)

**Layer 3: Authentication**
- Supabase Auth (JWT)
- Strong password enforcement (8+ chars, mixed case)
- Account lockout (5 attempts, 15-min lockout)
- Session management (24-hour expiry, auto-refresh)

**Layer 4: Database**
- Row Level Security (RLS) on all tables
- Parameterized queries (SQL injection prevention)
- Least privilege access
- Encrypted at rest (AES-256)

**Layer 5: Monitoring**
- Error tracking (Sentry-ready)
- Security event logging
- Anomaly detection (brute force, rate limit abuse)

See: `docs/OWASP_SECURITY_AUDIT.md` for full security audit

---

## Performance Characteristics

### Benchmarks (Development Environment)

| Operation | P50 | P95 | P99 |
|-----------|-----|-----|-----|
| Dashboard Load | 1.2s | 1.8s | 2.3s |
| API Query (Leads) | 45ms | 120ms | 250ms |
| Full Site Audit | 15s | 25s | 35s |
| Email Send | 200ms | 500ms | 1.2s |

### Optimization Strategies

**Frontend**:
- Code splitting (React.lazy)
- Image lazy loading
- Service Worker caching (planned)
- Bundle size monitoring (< 500 KB)

**Backend**:
- Database indexing on common queries
- Supabase connection pooling
- Browser context reuse
- Parallel audit processing

---

## Deployment Architecture

### Staging Environment

```
GitHub → CI/CD (GitHub Actions) → Vercel (Staging)
                                      ↓
                                  Supabase (Dev Project)
```

### Production Environment

```
GitHub (main branch) → CI/CD → Vercel (Production)
                                  ↓
                              Supabase (Prod Project)
                                  ↓
                              Mailgun (Prod Domain)
                                  ↓
                              Google Calendar API
```

**Infrastructure Providers**:
- **Frontend Hosting**: Vercel (Edge Network, auto-scaling)
- **Database**: Supabase (Managed PostgreSQL)
- **Email**: Mailgun (Transactional email service)
- **Browser Automation**: Browserbase (optional, cloud browsers)
- **Monitoring**: Sentry (error tracking), Datadog (metrics)

---

## Development Workflow

### Local Development Setup

```bash
# 1. Clone repository
git clone https://github.com/your-org/the-closer.git
cd the-closer

# 2. Install dependencies
pnpm install

# 3. Configure environment
cp .env.example .env
# Edit .env with your Supabase credentials

# 4. Start Supabase locally (optional)
supabase start

# 5. Run migrations
supabase db push

# 6. Start dashboard
pnpm --filter dashboard dev
```

See: `docs/development-guide.md` for detailed setup

---

## Testing Strategy

### Test Pyramid

```
        /\
       /E2E\      ← 10% (Playwright)
      /──────\
     /Integration\ ← 30% (Vitest + MSW)
    /────────────\
   /  Unit Tests  \ ← 60% (Vitest)
  /────────────────\
```

**Unit Tests**: Business logic, utilities, validators
**Integration Tests**: API calls, database queries (mocked Supabase)
**E2E Tests**: Critical user flows (auth, discovery, audit, campaign)

**Test Files**:
- `apps/dashboard/tests/e2e/` - Playwright E2E tests
- `apps/dashboard/tests/load/` - K6 load tests
- `packages/*/src/**/*.test.ts` - Unit tests

---

## Monitoring & Observability

### Key Metrics

**Business Metrics**:
- Leads discovered per day
- Audit completion rate
- Email open rate (target: > 20%)
- Booking conversion rate (target: > 3%)

**Technical Metrics**:
- API response time (p95 < 200ms)
- Error rate (< 0.1%)
- Uptime (> 99.5%)
- Database query time (p95 < 100ms)

**Dashboards**:
- Sentry: Error tracking
- Vercel Analytics: Frontend performance
- Supabase Metrics: Database health

---

## Future Enhancements

### Planned Features (Roadmap)

**Phase 2** (Q2 2026):
- Voice AI outreach (VAPI integration)
- Multi-language support
- White-label customization
- Advanced analytics (cohort analysis)

**Phase 3** (Q3 2026):
- Mobile app (React Native)
- CRM integrations (Salesforce, HubSpot)
- A/B testing for email templates
- Predictive lead scoring (ML)

**Phase 4** (Q4 2026):
- Agency multi-tenancy
- Zapier/Make.com integrations
- Webhook API for custom workflows
- Marketplace for audit templates

---

## Appendix

### Glossary

- **Lead**: A potential customer (business) discovered via Google Maps
- **Audit**: Technical analysis of a website's performance, accessibility, SEO
- **Pain Point**: Specific technical issue found during audit
- **Evidence**: Visual proof (screenshot, video) of a pain point
- **Campaign**: Automated email sequence targeting qualified leads
- **Conversion**: Lead progressing to "booked" or "converted" status
- **MCP**: Model Context Protocol (Anthropic's server specification)
- **RLS**: Row Level Security (PostgreSQL access control)

### Related Documentation

- `docs/api-reference.md` - API endpoint specifications
- `docs/development-guide.md` - Developer onboarding guide
- `docs/user-guide.md` - End-user documentation
- `docs/SECURITY_IMPLEMENTATION.md` - Security technical details
- `docs/PRODUCTION_DEPLOYMENT_CHECKLIST.md` - Deployment procedures

---

**Document Version**: 1.0
**Last Updated**: February 2, 2026
**Maintained By**: Engineering Team
**Next Review**: May 2, 2026 (3 months)
