-- Lead Profiles table
-- Central data model for the Autonomous Revenue Engine

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

  performance_score INTEGER CHECK (performance_score >= 0 AND performance_score <= 100),
  accessibility_score INTEGER CHECK (accessibility_score >= 0 AND accessibility_score <= 100),
  mobile_friendly BOOLEAN,

  -- Evidence
  evidence_urls JSONB DEFAULT '[]',
  -- Example: [
  --   {"type": "screenshot", "url": "https://storage.../mobile.png"},
  --   {"type": "video", "url": "https://storage.../slow-load.webm"},
  --   {"type": "report", "url": "https://storage.../audit.pdf"}
  -- ]

  -- Outreach Status
  contact_status TEXT DEFAULT 'pending' CHECK (contact_status IN ('pending', 'emailed', 'called', 'booked', 'converted', 'declined')),

  last_contacted_at TIMESTAMPTZ,
  next_followup_at TIMESTAMPTZ,
  notes TEXT,

  -- Metadata
  discovered_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  source_query TEXT
);

-- Indexes for common queries
CREATE INDEX idx_lead_status ON lead_profiles(contact_status);
CREATE INDEX idx_lead_score ON lead_profiles(performance_score);
CREATE INDEX idx_lead_rating ON lead_profiles(rating);
CREATE INDEX idx_lead_category ON lead_profiles(business_category);
CREATE INDEX idx_lead_discovered ON lead_profiles(discovered_at DESC);
CREATE INDEX idx_lead_followup ON lead_profiles(next_followup_at) WHERE next_followup_at IS NOT NULL;

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to auto-update updated_at
CREATE TRIGGER update_lead_profiles_updated_at
  BEFORE UPDATE ON lead_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE lead_profiles ENABLE ROW LEVEL SECURITY;

-- Policy for authenticated users (full access for now, can be refined)
CREATE POLICY "Allow all for authenticated users" ON lead_profiles
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
