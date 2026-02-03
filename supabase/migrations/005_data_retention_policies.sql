-- ============================================
-- Data Retention Policies
-- GDPR/CCPA Compliance
-- ============================================

-- Function to delete old leads (365 days retention)
CREATE OR REPLACE FUNCTION cleanup_old_leads()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  WITH deleted AS (
    DELETE FROM lead_profiles
    WHERE discovered_at < NOW() - INTERVAL '365 days'
      AND contact_status NOT IN ('converted', 'booked')
    RETURNING *
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to delete old audit results (180 days retention)
CREATE OR REPLACE FUNCTION cleanup_old_audits()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  WITH deleted AS (
    DELETE FROM audits
    WHERE audited_at < NOW() - INTERVAL '180 days'
    RETURNING *
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to delete old email events (90 days retention)
CREATE OR REPLACE FUNCTION cleanup_old_email_events()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  WITH deleted AS (
    DELETE FROM email_events
    WHERE occurred_at < NOW() - INTERVAL '90 days'
    RETURNING *
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to delete old discovery sessions (90 days retention)
CREATE OR REPLACE FUNCTION cleanup_old_discovery_sessions()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  WITH deleted AS (
    DELETE FROM discovery_sessions
    WHERE created_at < NOW() - INTERVAL '90 days'
    RETURNING *
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Master cleanup function (runs all cleanup tasks)
CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS TABLE(
  table_name TEXT,
  deleted_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 'lead_profiles'::TEXT, cleanup_old_leads()
  UNION ALL
  SELECT 'audits'::TEXT, cleanup_old_audits()
  UNION ALL
  SELECT 'email_events'::TEXT, cleanup_old_email_events()
  UNION ALL
  SELECT 'discovery_sessions'::TEXT, cleanup_old_discovery_sessions();
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Unsubscribe Management
-- ============================================

-- Unsubscribe list table
CREATE TABLE IF NOT EXISTS email_unsubscribes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  reason TEXT,
  unsubscribed_at TIMESTAMPTZ DEFAULT NOW(),

  -- Track original lead if available
  lead_id UUID REFERENCES lead_profiles(id) ON DELETE SET NULL,

  -- Compliance tracking
  ip_address INET,
  user_agent TEXT
);

CREATE INDEX idx_unsubscribe_email ON email_unsubscribes(email);
CREATE INDEX idx_unsubscribe_date ON email_unsubscribes(unsubscribed_at DESC);

-- Enable RLS
ALTER TABLE email_unsubscribes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated users" ON email_unsubscribes
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Function to check if email is unsubscribed
CREATE OR REPLACE FUNCTION is_email_unsubscribed(check_email TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM email_unsubscribes
    WHERE email = check_email
  );
END;
$$ LANGUAGE plpgsql;

-- Function to unsubscribe an email
CREATE OR REPLACE FUNCTION unsubscribe_email(
  p_email TEXT,
  p_reason TEXT DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  unsubscribe_id UUID;
  related_lead_id UUID;
BEGIN
  -- Find related lead
  SELECT id INTO related_lead_id
  FROM lead_profiles
  WHERE business_name ILIKE '%' || p_email || '%'
    OR notes ILIKE '%' || p_email || '%'
  LIMIT 1;

  -- Insert unsubscribe record
  INSERT INTO email_unsubscribes (
    email,
    reason,
    lead_id,
    ip_address,
    user_agent
  )
  VALUES (
    p_email,
    p_reason,
    related_lead_id,
    p_ip_address,
    p_user_agent
  )
  ON CONFLICT (email) DO UPDATE
  SET unsubscribed_at = NOW()
  RETURNING id INTO unsubscribe_id;

  -- Update lead status if found
  IF related_lead_id IS NOT NULL THEN
    UPDATE lead_profiles
    SET contact_status = 'declined',
        notes = COALESCE(notes, '') || E'\nUnsubscribed: ' || NOW()::TEXT
    WHERE id = related_lead_id;
  END IF;

  RETURN unsubscribe_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Backup Verification
-- ============================================

-- Table to track backup verifications
CREATE TABLE IF NOT EXISTS backup_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_date DATE NOT NULL,
  verified_at TIMESTAMPTZ DEFAULT NOW(),
  verified_by TEXT NOT NULL,

  -- Verification results
  status TEXT CHECK (status IN ('success', 'failed', 'partial')) NOT NULL,
  tables_verified TEXT[] DEFAULT '{}',
  records_sampled INTEGER DEFAULT 0,

  -- Issues found
  issues JSONB DEFAULT '[]',

  notes TEXT
);

CREATE INDEX idx_backup_verification_date ON backup_verifications(backup_date DESC);

-- Enable RLS
ALTER TABLE backup_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated users" ON backup_verifications
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Function to record backup verification
CREATE OR REPLACE FUNCTION record_backup_verification(
  p_backup_date DATE,
  p_verified_by TEXT,
  p_status TEXT,
  p_tables_verified TEXT[],
  p_records_sampled INTEGER DEFAULT 0,
  p_issues JSONB DEFAULT '[]',
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  verification_id UUID;
BEGIN
  INSERT INTO backup_verifications (
    backup_date,
    verified_by,
    status,
    tables_verified,
    records_sampled,
    issues,
    notes
  )
  VALUES (
    p_backup_date,
    p_verified_by,
    p_status,
    p_tables_verified,
    p_records_sampled,
    p_issues,
    p_notes
  )
  RETURNING id INTO verification_id;

  RETURN verification_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- GDPR Right to Erasure
-- ============================================

-- Function to completely delete a lead and all related data
CREATE OR REPLACE FUNCTION gdpr_delete_lead_data(p_lead_id UUID)
RETURNS TABLE(
  table_name TEXT,
  deleted_count INTEGER
) AS $$
DECLARE
  lead_email TEXT;
BEGIN
  -- Get email before deletion
  SELECT business_name INTO lead_email
  FROM lead_profiles
  WHERE id = p_lead_id;

  -- Delete from email_events
  RETURN QUERY
  WITH deleted AS (
    DELETE FROM email_events WHERE lead_id = p_lead_id RETURNING *
  )
  SELECT 'email_events'::TEXT, COUNT(*)::INTEGER FROM deleted;

  -- Delete from campaign_leads
  RETURN QUERY
  WITH deleted AS (
    DELETE FROM campaign_leads WHERE lead_id = p_lead_id RETURNING *
  )
  SELECT 'campaign_leads'::TEXT, COUNT(*)::INTEGER FROM deleted;

  -- Delete from audits
  RETURN QUERY
  WITH deleted AS (
    DELETE FROM audits WHERE lead_id = p_lead_id RETURNING *
  )
  SELECT 'audits'::TEXT, COUNT(*)::INTEGER FROM deleted;

  -- Delete from lead_profiles
  RETURN QUERY
  WITH deleted AS (
    DELETE FROM lead_profiles WHERE id = p_lead_id RETURNING *
  )
  SELECT 'lead_profiles'::TEXT, COUNT(*)::INTEGER FROM deleted;

  -- Add to unsubscribe list
  IF lead_email IS NOT NULL THEN
    PERFORM unsubscribe_email(
      lead_email,
      'GDPR Right to Erasure',
      NULL,
      'System'
    );
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to export all data for a lead (GDPR Right to Access)
CREATE OR REPLACE FUNCTION gdpr_export_lead_data(p_lead_id UUID)
RETURNS JSONB AS $$
DECLARE
  export_data JSONB;
BEGIN
  SELECT jsonb_build_object(
    'lead_profile', (
      SELECT row_to_json(lp.*)
      FROM lead_profiles lp
      WHERE lp.id = p_lead_id
    ),
    'audits', (
      SELECT jsonb_agg(row_to_json(a.*))
      FROM audits a
      WHERE a.lead_id = p_lead_id
    ),
    'email_events', (
      SELECT jsonb_agg(row_to_json(ee.*))
      FROM email_events ee
      WHERE ee.lead_id = p_lead_id
    ),
    'campaign_enrollments', (
      SELECT jsonb_agg(row_to_json(cl.*))
      FROM campaign_leads cl
      WHERE cl.lead_id = p_lead_id
    ),
    'exported_at', NOW()
  ) INTO export_data;

  RETURN export_data;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Comments
-- ============================================

COMMENT ON FUNCTION cleanup_old_data IS 'Master function to clean up data older than retention periods. Run via cron job.';
COMMENT ON FUNCTION is_email_unsubscribed IS 'Check if an email address has unsubscribed from communications.';
COMMENT ON FUNCTION unsubscribe_email IS 'Add an email to the unsubscribe list and update related leads.';
COMMENT ON FUNCTION gdpr_delete_lead_data IS 'Completely delete all data for a lead (GDPR Right to Erasure).';
COMMENT ON FUNCTION gdpr_export_lead_data IS 'Export all data for a lead in JSON format (GDPR Right to Access).';
