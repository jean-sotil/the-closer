# The Closer - User Guide

**Version**: 1.0
**Last Updated**: February 3, 2026

Welcome to The Closer! This guide will walk you through using the dashboard to discover leads, audit websites, and create email campaigns.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Dashboard Overview](#dashboard-overview)
3. [Lead Discovery](#lead-discovery)
4. [Managing Leads](#managing-leads)
5. [Understanding Audit Results](#understanding-audit-results)
6. [Creating Email Campaigns](#creating-email-campaigns)
7. [Outreach & Analytics](#outreach--analytics)
8. [Account Settings](#account-settings)
9. [FAQ & Troubleshooting](#faq--troubleshooting)

---

## Getting Started

### Creating Your Account

1. Navigate to the signup page at `https://app.thecloser.ai/signup`
2. Enter your email address
3. Create a password (must include uppercase, lowercase, number, and special character)
4. Click **Create Account**
5. Check your email for a confirmation link
6. Click the link to verify your account

### Logging In

1. Go to `https://app.thecloser.ai/login`
2. Enter your email and password
3. Click **Sign In**

### Password Reset

Forgot your password?

1. Click **Forgot Password?** on the login page
2. Enter your email address
3. Check your inbox for a reset link
4. Click the link and create a new password

---

## Dashboard Overview

After logging in, you'll see the main dashboard with navigation:

```
┌─────────────────────────────────────────────────────────────┐
│  [Logo]   Discovery   Leads   Audits   Outreach   Settings  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   Welcome back!                                             │
│                                                             │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│   │ Total Leads  │  │ Audits Today │  │ Emails Sent  │     │
│   │    1,247     │  │      32      │  │     456      │     │
│   └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                             │
│   Recent Activity...                                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Navigation Tabs

| Tab | Purpose |
|-----|---------|
| **Discovery** | Find new leads from Google Maps |
| **Leads** | View and manage your lead database |
| **Audits** | See website audit results and evidence |
| **Outreach** | Create and manage email campaigns |
| **Settings** | Account and integration settings |

---

## Lead Discovery

The Discovery page helps you find potential customers from Google Maps.

### Running a Discovery Search

1. Navigate to **Discovery**
2. Enter your search criteria:
   - **Location**: City or area (e.g., "Austin, TX")
   - **Business Type**: Category (e.g., "Dentists", "Attorneys", "Restaurants")
   - **Rating Filter**: Filter by star rating (e.g., "Below 4.0 stars")
3. Click **Start Discovery**
4. Wait for results (typically 2-5 minutes for 100 leads)

### Search Tips

| Criteria | Example | Why It Works |
|----------|---------|--------------|
| Low ratings (< 4.0) | Dentists with 3.5 stars | More likely to need help |
| Competitive industries | "injury lawyers austin" | High demand for services |
| Specific neighborhoods | "plumbers Brooklyn" | Hyper-local targeting |

### Understanding Discovery Results

Each discovered lead shows:
- **Business Name** - Company name from Google Maps
- **Rating** - Star rating (1.0 - 5.0)
- **Reviews** - Number of Google reviews
- **Category** - Business type
- **Website** - Link to their website (if available)

Leads without websites are excluded (no website = no audit possible).

---

## Managing Leads

The Leads page is your CRM for managing prospects.

### Lead Table View

```
┌────┬──────────────────┬──────────┬────────┬───────────┬────────────┐
│ ☐  │ Business Name    │ Category │ Rating │ Status    │ Actions    │
├────┼──────────────────┼──────────┼────────┼───────────┼────────────┤
│ ☐  │ Joe's Plumbing   │ Plumber  │ 3.2    │ Pending   │ View Audit │
│ ☐  │ Smith Dental     │ Dentist  │ 3.8    │ Emailed   │ View Audit │
│ ☐  │ Quick Auto       │ Mechanic │ 4.1    │ Booked    │ View Audit │
└────┴──────────────────┴──────────┴────────┴───────────┴────────────┘
```

### Lead Statuses

| Status | Meaning |
|--------|---------|
| **Pending** | New lead, not yet contacted |
| **Emailed** | Initial email sent |
| **Replied** | Lead responded to email |
| **Called** | Phone call attempted |
| **Booked** | Meeting scheduled |
| **Converted** | Became a paying customer |
| **Declined** | Not interested |

### Filtering Leads

Use the filter controls to narrow your view:

1. **Status Filter**: Show only leads with specific status
2. **Category Filter**: Filter by business type
3. **Rating Filter**: Filter by star rating range
4. **Performance Score**: Filter by website performance
5. **Search**: Search by business name

### Bulk Actions

Select multiple leads using checkboxes, then:

- **Change Status**: Update status for all selected leads
- **Add to Campaign**: Add selected leads to an email campaign
- **Export**: Download selected leads as CSV

### Individual Lead Actions

Click on a lead row to:
- View full business details
- See audit results and evidence
- View contact history
- Add notes

---

## Understanding Audit Results

The Audits page shows detailed website analysis for each lead.

### Audit Summary

Each audit displays:

```
┌─────────────────────────────────────────────────────────────┐
│  Joe's Plumbing - joesplumbing.com                         │
│  Audited: Feb 2, 2026 at 3:45 PM                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Performance: 32/100  ████████░░░░░░░░░░░░  POOR           │
│  Accessibility: 58/100 ███████████░░░░░░░░  NEEDS WORK     │
│  SEO: 72/100          ██████████████░░░░░░  FAIR           │
│  Best Practices: 67/100 █████████████░░░░░  FAIR           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Score Ranges

| Score | Rating | Color |
|-------|--------|-------|
| 90-100 | Excellent | Green |
| 70-89 | Good | Light Green |
| 50-69 | Needs Improvement | Yellow |
| 0-49 | Poor | Red |

### Pain Points

Pain points are specific issues found during the audit:

| Pain Point | Severity | What It Means |
|------------|----------|---------------|
| **SLOW_LOAD** | Critical | Page takes > 3 seconds to load |
| **UNUSED_CODE** | High | 60%+ of code is never used |
| **WCAG_VIOLATION** | High | Accessibility law compliance issues |
| **MOBILE_BROKEN** | High | Site doesn't work on phones |
| **NO_HTTPS** | Medium | Site lacks security certificate |
| **MISSING_META** | Low | SEO metadata incomplete |

### Core Web Vitals

These are Google's key performance metrics:

| Metric | Good | Needs Work | Poor |
|--------|------|------------|------|
| **LCP** (Largest Contentful Paint) | < 2.5s | 2.5-4s | > 4s |
| **FID** (First Input Delay) | < 100ms | 100-300ms | > 300ms |
| **CLS** (Cumulative Layout Shift) | < 0.1 | 0.1-0.25 | > 0.25 |

### Evidence Gallery

Each audit includes visual evidence:

- **Screenshots**: Mobile and desktop views of the website
- **Videos**: Page load recordings showing slow performance
- **Reports**: Full technical audit reports

Click on any evidence item to view full-size or download.

### Using Audit Data in Outreach

The pain points and evidence are automatically included in email templates. This gives you:

1. **Credibility**: You've done your homework
2. **Specificity**: You can cite exact numbers ("Your site takes 6.2 seconds to load")
3. **Proof**: Video evidence shows the problem is real

---

## Creating Email Campaigns

The Outreach page lets you create automated email sequences.

### Creating Your First Campaign

1. Navigate to **Outreach**
2. Click **Create Campaign**
3. Fill in campaign details:
   - **Campaign Name**: Internal reference name
   - **Description**: Notes about the campaign goal

### Setting Lead Filters

Choose which leads to include:

```
┌─────────────────────────────────────────────────────────────┐
│  Lead Filters                                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Status: [ Pending ▼ ]                                      │
│                                                             │
│  Performance Score:  0 ──────●────── 60                     │
│                                                             │
│  Categories: [☑ Dentist] [☑ Attorney] [☐ Restaurant]        │
│                                                             │
│  Rating: Below [ 4.0 ▼ ] stars                              │
│                                                             │
│  Matching Leads: 127                                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Building Email Sequences

Add steps to your campaign:

**Step 1: Initial Outreach (Day 0)**
```
Subject: Quick question about {business_name}'s website

Hi {business_name},

I noticed your website takes {load_time} to load on mobile devices.
Here's a quick video showing the issue: {evidence_link}

This is likely costing you customers. Would you be open to a 15-minute
call to discuss a quick fix?

Book a time here: {calendar_link}

Best,
{your_name}
```

**Step 2: Follow-up (Day 3)**
```
Subject: Re: {business_name} website speed

Following up on my earlier email. Did you get a chance to watch the
video showing your site's performance issue?

I've helped similar businesses in {city} improve their load times by
70%+ in under a week.

Let me know if you'd like to chat: {calendar_link}

{your_name}
```

### Campaign Settings

Configure campaign behavior:

| Setting | Description | Recommended |
|---------|-------------|-------------|
| **Daily Send Limit** | Max emails per day | 50-100 |
| **Timezone** | Recipient timezone | Your target market |
| **Track Opens** | Monitor who opens emails | Yes |
| **Track Clicks** | Monitor link clicks | Yes |
| **Send Window** | Hours to send emails | 9 AM - 5 PM |

### Launching a Campaign

1. Review all settings
2. Click **Save as Draft** to save without starting
3. Click **Start Campaign** to begin sending

**Important**: Once started, a campaign cannot be deleted, only paused.

---

## Outreach & Analytics

### Campaign Dashboard

View all your campaigns and their performance:

```
┌─────────────────────────────────────────────────────────────┐
│  Campaign: Austin Dentists Q1                               │
│  Status: Active                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐       │
│  │  Sent   │  │ Opened  │  │ Clicked │  │ Booked  │       │
│  │   89    │  │   23    │  │    8    │  │    2    │       │
│  │         │  │  25.8%  │  │   9.0%  │  │   2.2%  │       │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘       │
│                                                             │
│  Open Rate: ████████████░░░░░░░░░░░░░░░░░░░  25.8%         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Key Metrics

| Metric | Target | What It Means |
|--------|--------|---------------|
| **Open Rate** | > 20% | % of recipients who opened email |
| **Click Rate** | > 5% | % who clicked a link |
| **Reply Rate** | > 2% | % who responded |
| **Booking Rate** | > 1% | % who scheduled a call |

### Email Event Timeline

See detailed events for each email:

```
Feb 2, 3:45 PM - Email sent to contact@joesplumbing.com
Feb 2, 4:12 PM - Email opened (IP: Austin, TX)
Feb 2, 4:13 PM - Link clicked: calendar_link
Feb 2, 4:15 PM - Meeting booked: Feb 5 at 2:00 PM
```

### Pausing & Resuming Campaigns

To pause a running campaign:
1. Click on the campaign
2. Click the **Pause** button
3. All pending emails will be held

To resume:
1. Click the **Resume** button
2. Emails will continue from where they stopped

### Handling Replies

When a lead replies:
1. Their status automatically changes to "Replied"
2. You receive a notification
3. The campaign pauses future emails to that lead
4. Follow up manually via your email client

---

## Account Settings

### Profile Settings

Update your profile:
- Display name
- Email address (requires re-verification)
- Profile picture

### Integration Settings

Configure third-party services:

**Mailgun**
- API Key
- Sending Domain
- From Email Address

**Google Calendar** (for scheduling)
- Connect Google Account
- Select calendar for bookings

### Notification Settings

Control email notifications:
- New lead discovered
- Email opened
- Meeting booked
- Weekly summary report

### Security Settings

- Change password
- View active sessions
- Enable two-factor authentication (coming soon)

---

## FAQ & Troubleshooting

### General Questions

**Q: How many leads can I discover per day?**
A: There's no hard limit, but we recommend 100-500 leads per search to ensure data quality.

**Q: How long does an audit take?**
A: Most audits complete in 15-30 seconds. Complex sites may take up to 2 minutes.

**Q: Can I import my own leads?**
A: CSV import is coming soon. For now, use the Discovery feature.

### Email Questions

**Q: Why are my emails going to spam?**
A: Common causes:
1. New sending domain (needs warming up)
2. High complaint rate
3. Spammy subject lines

Solutions:
- Start with 10-20 emails/day and gradually increase
- Ensure your domain has proper SPF/DKIM/DMARC records
- Use personalized, value-focused subject lines

**Q: What's a good open rate?**
A: For cold outreach, 15-25% is good, 25%+ is excellent.

**Q: How do I avoid being marked as spam?**
A:
- Always include an unsubscribe link (automatic)
- Don't use ALL CAPS or excessive punctuation
- Personalize each email with the business name
- Provide value, not just a sales pitch

### Technical Issues

**Q: The dashboard is loading slowly**
A: Try:
1. Clear your browser cache
2. Check your internet connection
3. Try a different browser

**Q: I'm getting a "Session expired" error**
A: Your login session has timed out. Click "Sign In" to log in again.

**Q: An audit failed**
A: Some websites block automated access. This is normal for about 5% of sites. The lead remains in your database with a "Audit Failed" note.

**Q: My emails aren't sending**
A: Check:
1. Mailgun API key is correct
2. Sending domain is verified
3. Campaign is not paused
4. Daily limit hasn't been reached

### Getting Support

If you can't find an answer:

1. **Help Center**: docs.thecloser.ai
2. **Email Support**: support@thecloser.ai
3. **Live Chat**: Click the chat bubble in the bottom right
4. **Response Time**: Within 24 hours (usually much faster)

---

## Quick Reference

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `G` then `L` | Go to Leads |
| `G` then `A` | Go to Audits |
| `G` then `O` | Go to Outreach |
| `G` then `D` | Go to Discovery |
| `/` | Focus search |
| `?` | Show keyboard shortcuts |

### Status Colors

| Color | Meaning |
|-------|---------|
| Gray | Pending/New |
| Blue | In Progress |
| Yellow | Needs Attention |
| Green | Completed/Success |
| Red | Error/Declined |

---

**Need more help?** Contact support@thecloser.ai

---

**Document Version**: 1.0
**Last Updated**: February 3, 2026
