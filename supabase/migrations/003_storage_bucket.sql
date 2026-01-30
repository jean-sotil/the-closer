-- ============================================
-- Storage Bucket for Evidence Files
-- Screenshots, videos, and audit reports
-- ============================================

-- Create the evidence storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'evidence',
  'evidence',
  true,  -- Public access for evidence URLs in emails
  52428800,  -- 50MB max file size
  ARRAY[
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
    'video/webm',
    'video/mp4',
    'application/pdf'
  ]
) ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage policies for the evidence bucket

-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload evidence"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'evidence');

-- Allow authenticated users to update their uploads
CREATE POLICY "Authenticated users can update evidence"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'evidence');

-- Allow authenticated users to delete
CREATE POLICY "Authenticated users can delete evidence"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'evidence');

-- Allow public read access (for email links)
CREATE POLICY "Public read access for evidence"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'evidence');

-- ============================================
-- Helper Functions
-- ============================================

-- Function to get full evidence URL
CREATE OR REPLACE FUNCTION get_evidence_url(file_path TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN CONCAT(
    current_setting('app.settings.supabase_url', true),
    '/storage/v1/object/public/evidence/',
    file_path
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to calculate lead qualification score
CREATE OR REPLACE FUNCTION calculate_lead_score(
  p_performance_score INTEGER,
  p_accessibility_score INTEGER,
  p_pain_points_count INTEGER,
  p_rating DECIMAL
)
RETURNS INTEGER AS $$
DECLARE
  score INTEGER := 0;
BEGIN
  -- Lower performance = higher opportunity (inverted)
  IF p_performance_score IS NOT NULL THEN
    score := score + (100 - p_performance_score) / 2;
  END IF;

  -- Lower accessibility = higher opportunity (inverted)
  IF p_accessibility_score IS NOT NULL THEN
    score := score + (100 - p_accessibility_score) / 4;
  END IF;

  -- More pain points = higher score
  IF p_pain_points_count IS NOT NULL THEN
    score := score + LEAST(p_pain_points_count * 5, 25);
  END IF;

  -- Lower rating = higher opportunity (businesses wanting to improve)
  IF p_rating IS NOT NULL AND p_rating < 4.0 THEN
    score := score + ((4.0 - p_rating) * 5)::INTEGER;
  END IF;

  RETURN LEAST(score, 100);  -- Cap at 100
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- Views for Common Queries
-- ============================================

-- View: Leads ready for outreach (good opportunities, not yet contacted)
CREATE OR REPLACE VIEW leads_ready_for_outreach AS
SELECT
  lp.*,
  a.performance_score AS latest_performance_score,
  a.accessibility_score AS latest_accessibility_score,
  a.audited_at AS latest_audit_date,
  calculate_lead_score(
    a.performance_score,
    a.accessibility_score,
    jsonb_array_length(COALESCE(lp.pain_points, '[]'::jsonb)),
    lp.rating
  ) AS qualification_score
FROM lead_profiles lp
LEFT JOIN LATERAL (
  SELECT * FROM audits
  WHERE lead_id = lp.id
  ORDER BY audited_at DESC
  LIMIT 1
) a ON true
WHERE lp.contact_status = 'pending'
  AND lp.website_url IS NOT NULL
ORDER BY qualification_score DESC;

-- View: Campaign performance summary
CREATE OR REPLACE VIEW campaign_performance AS
SELECT
  c.id,
  c.name,
  c.status,
  c.total_leads,
  c.emails_sent,
  c.emails_opened,
  c.emails_clicked,
  c.replies,
  c.booked,
  CASE WHEN c.emails_sent > 0
    THEN ROUND((c.emails_opened::DECIMAL / c.emails_sent) * 100, 2)
    ELSE 0
  END AS open_rate,
  CASE WHEN c.emails_sent > 0
    THEN ROUND((c.emails_clicked::DECIMAL / c.emails_sent) * 100, 2)
    ELSE 0
  END AS click_rate,
  CASE WHEN c.emails_sent > 0
    THEN ROUND((c.replies::DECIMAL / c.emails_sent) * 100, 2)
    ELSE 0
  END AS reply_rate,
  CASE WHEN c.emails_sent > 0
    THEN ROUND((c.booked::DECIMAL / c.emails_sent) * 100, 2)
    ELSE 0
  END AS booking_rate,
  c.created_at,
  c.started_at,
  c.completed_at
FROM campaigns c;

-- View: Emails due to be sent
CREATE OR REPLACE VIEW emails_due AS
SELECT
  cl.id AS campaign_lead_id,
  cl.campaign_id,
  cl.lead_id,
  cl.current_step,
  cl.next_email_at,
  c.name AS campaign_name,
  c.sequence,
  lp.business_name,
  lp.website_url,
  lp.pain_points
FROM campaign_leads cl
JOIN campaigns c ON c.id = cl.campaign_id
JOIN lead_profiles lp ON lp.id = cl.lead_id
WHERE cl.status = 'in_sequence'
  AND cl.next_email_at <= NOW()
  AND c.status = 'active'
ORDER BY cl.next_email_at;
