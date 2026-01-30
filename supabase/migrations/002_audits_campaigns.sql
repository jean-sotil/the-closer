-- ============================================
-- Audits Table
-- Stores website audit results for each lead
-- ============================================

CREATE TABLE audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES lead_profiles(id) ON DELETE CASCADE,

  -- Target URL
  url TEXT NOT NULL,

  -- Performance Metrics
  performance_score INTEGER CHECK (performance_score >= 0 AND performance_score <= 100),
  accessibility_score INTEGER CHECK (accessibility_score >= 0 AND accessibility_score <= 100),
  seo_score INTEGER CHECK (seo_score >= 0 AND seo_score <= 100),
  best_practices_score INTEGER CHECK (best_practices_score >= 0 AND best_practices_score <= 100),

  -- Core Web Vitals
  first_contentful_paint_ms INTEGER,
  largest_contentful_paint_ms INTEGER,
  cumulative_layout_shift DECIMAL(5,3),
  time_to_interactive_ms INTEGER,
  total_blocking_time_ms INTEGER,

  -- Coverage Analysis
  unused_js_percent DECIMAL(5,2) CHECK (unused_js_percent >= 0 AND unused_js_percent <= 100),
  unused_css_percent DECIMAL(5,2) CHECK (unused_css_percent >= 0 AND unused_css_percent <= 100),
  unused_js_bytes INTEGER,
  unused_css_bytes INTEGER,

  -- Mobile Analysis
  mobile_friendly BOOLEAN,
  viewport_width INTEGER,
  body_scroll_width INTEGER,

  -- Issues Found
  wcag_violations JSONB DEFAULT '[]',
  -- Example: [{"ruleId": "color-contrast", "severity": "serious", "description": "..."}]

  responsive_issues JSONB DEFAULT '[]',
  -- Example: [{"type": "HORIZONTAL_SCROLL", "description": "...", "viewportWidth": 375}]

  pain_points JSONB DEFAULT '[]',
  -- Summarized pain points for sales outreach

  -- Evidence
  evidence_urls JSONB DEFAULT '[]',
  -- Example: [{"type": "screenshot", "url": "...", "description": "Mobile view"}]

  -- Metadata
  duration_ms INTEGER,
  error TEXT,
  audited_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for audits
CREATE INDEX idx_audit_lead ON audits(lead_id);
CREATE INDEX idx_audit_date ON audits(audited_at DESC);
CREATE INDEX idx_audit_performance ON audits(performance_score);

-- Trigger for updated_at (reuse existing function)
CREATE TRIGGER update_audits_updated_at
  BEFORE UPDATE ON audits
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS for audits
ALTER TABLE audits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated users" ON audits
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================
-- Email Templates Table
-- Stores reusable email templates
-- ============================================

CREATE TABLE email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  html_body TEXT NOT NULL,
  text_body TEXT,

  -- Template variables (for validation)
  variables TEXT[] DEFAULT '{}',
  -- Example: ['business_name', 'pain_point', 'evidence_link']

  -- Metadata
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_template_active ON email_templates(is_active) WHERE is_active = true;

CREATE TRIGGER update_email_templates_updated_at
  BEFORE UPDATE ON email_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated users" ON email_templates
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================
-- Campaigns Table
-- Stores email campaign configurations
-- ============================================

CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  name TEXT NOT NULL,
  description TEXT,

  -- Lead targeting
  lead_filters JSONB DEFAULT '{}',
  -- Example: {"minPerformanceScore": 0, "maxPerformanceScore": 50, "categories": ["dentist"]}

  -- Email sequence
  sequence JSONB DEFAULT '[]',
  -- Example: [
  --   {"stepNumber": 1, "delayDays": 0, "templateId": "...", "sendCondition": "always"},
  --   {"stepNumber": 2, "delayDays": 3, "templateId": "...", "sendCondition": "no_reply"}
  -- ]

  -- Settings
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'active', 'paused', 'completed', 'cancelled')),
  daily_send_limit INTEGER DEFAULT 50,
  timezone TEXT DEFAULT 'America/New_York',

  -- Tracking settings
  track_opens BOOLEAN DEFAULT true,
  track_clicks BOOLEAN DEFAULT true,

  -- Statistics (denormalized for quick access)
  total_leads INTEGER DEFAULT 0,
  emails_sent INTEGER DEFAULT 0,
  emails_opened INTEGER DEFAULT 0,
  emails_clicked INTEGER DEFAULT 0,
  replies INTEGER DEFAULT 0,
  booked INTEGER DEFAULT 0,

  -- Timestamps
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_campaign_status ON campaigns(status);
CREATE INDEX idx_campaign_active ON campaigns(status) WHERE status = 'active';

CREATE TRIGGER update_campaigns_updated_at
  BEFORE UPDATE ON campaigns
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated users" ON campaigns
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================
-- Campaign Leads Junction Table
-- Tracks which leads are in which campaigns
-- ============================================

CREATE TABLE campaign_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES lead_profiles(id) ON DELETE CASCADE,

  -- Current status in this campaign
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_sequence', 'completed', 'replied', 'booked', 'unsubscribed', 'bounced')),
  current_step INTEGER DEFAULT 0,

  -- Timestamps
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  last_email_at TIMESTAMPTZ,
  next_email_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  UNIQUE(campaign_id, lead_id)
);

CREATE INDEX idx_campaign_lead_campaign ON campaign_leads(campaign_id);
CREATE INDEX idx_campaign_lead_lead ON campaign_leads(lead_id);
CREATE INDEX idx_campaign_lead_next ON campaign_leads(next_email_at) WHERE next_email_at IS NOT NULL;
CREATE INDEX idx_campaign_lead_status ON campaign_leads(campaign_id, status);

ALTER TABLE campaign_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated users" ON campaign_leads
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================
-- Email Events Table
-- Tracks all email interactions
-- ============================================

CREATE TABLE email_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES lead_profiles(id) ON DELETE SET NULL,
  template_id UUID REFERENCES email_templates(id) ON DELETE SET NULL,

  -- Email details
  message_id TEXT, -- Mailgun message ID
  recipient TEXT NOT NULL,
  subject TEXT,

  -- Event type
  event_type TEXT NOT NULL CHECK (event_type IN (
    'queued', 'sent', 'delivered', 'opened', 'clicked',
    'replied', 'bounced', 'complained', 'unsubscribed', 'failed'
  )),

  -- Event metadata
  metadata JSONB DEFAULT '{}',
  -- For clicks: {"url": "..."}
  -- For bounces: {"code": "550", "message": "..."}
  -- For failures: {"error": "..."}

  -- Sequence info
  sequence_step INTEGER,

  -- Timestamps
  occurred_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_email_event_campaign ON email_events(campaign_id);
CREATE INDEX idx_email_event_lead ON email_events(lead_id);
CREATE INDEX idx_email_event_type ON email_events(event_type);
CREATE INDEX idx_email_event_message ON email_events(message_id);
CREATE INDEX idx_email_event_date ON email_events(occurred_at DESC);

ALTER TABLE email_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated users" ON email_events
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================
-- Discovery Sessions Table
-- Tracks lead discovery runs
-- ============================================

CREATE TABLE discovery_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Search criteria
  query TEXT NOT NULL,
  location JSONB,
  -- Example: {"city": "Austin", "state": "TX", "country": "US"}

  category TEXT,
  max_rating DECIMAL(2,1),
  radius_miles INTEGER DEFAULT 25,

  -- Results
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  total_found INTEGER DEFAULT 0,
  total_processed INTEGER DEFAULT 0,

  -- Error handling
  error TEXT,

  -- Timestamps
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_discovery_status ON discovery_sessions(status);
CREATE INDEX idx_discovery_date ON discovery_sessions(created_at DESC);

ALTER TABLE discovery_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated users" ON discovery_sessions
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================
-- Update lead_profiles to link to discovery
-- ============================================

ALTER TABLE lead_profiles
  ADD COLUMN IF NOT EXISTS discovery_session_id UUID REFERENCES discovery_sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_lead_discovery ON lead_profiles(discovery_session_id);
