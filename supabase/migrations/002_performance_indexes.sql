-- Performance optimization indexes for The Closer
-- Run: supabase db push

-- =====================================================
-- Lead Profiles Indexes
-- =====================================================

-- Composite index for filtering and sorting leads
CREATE INDEX IF NOT EXISTS idx_lead_profiles_status_discovered
ON lead_profiles(contact_status, discovered_at DESC);

-- Index for business category filtering
CREATE INDEX IF NOT EXISTS idx_lead_profiles_category
ON lead_profiles(business_category);

-- Index for rating-based queries (finding low-rated businesses)
CREATE INDEX IF NOT EXISTS idx_lead_profiles_rating
ON lead_profiles(rating) WHERE rating < 4.0;

-- Index for performance score filtering
CREATE INDEX IF NOT EXISTS idx_lead_profiles_performance
ON lead_profiles(performance_score);

-- Index for last contacted (follow-up queries)
CREATE INDEX IF NOT EXISTS idx_lead_profiles_last_contacted
ON lead_profiles(last_contacted_at) WHERE last_contacted_at IS NOT NULL;

-- Partial index for pending leads (most common query)
CREATE INDEX IF NOT EXISTS idx_lead_profiles_pending
ON lead_profiles(discovered_at DESC) WHERE contact_status = 'pending';

-- Full-text search index for business name
CREATE INDEX IF NOT EXISTS idx_lead_profiles_name_search
ON lead_profiles USING gin(to_tsvector('english', business_name));

-- =====================================================
-- Audit Results Indexes
-- =====================================================

-- Composite index for lead audits timeline
CREATE INDEX IF NOT EXISTS idx_audit_results_lead_time
ON audit_results(lead_id, audited_at DESC);

-- Index for performance score filtering
CREATE INDEX IF NOT EXISTS idx_audit_results_performance
ON audit_results(performance_score);

-- Index for finding poor performing sites
CREATE INDEX IF NOT EXISTS idx_audit_results_low_score
ON audit_results(performance_score, audited_at DESC) WHERE performance_score < 50;

-- Index for mobile-unfriendly sites
CREATE INDEX IF NOT EXISTS idx_audit_results_mobile
ON audit_results(audited_at DESC) WHERE mobile_friendly = false;

-- =====================================================
-- Campaigns Indexes
-- =====================================================

-- Index for active campaigns
CREATE INDEX IF NOT EXISTS idx_campaigns_active
ON campaigns(created_at DESC) WHERE status = 'active';

-- Composite index for campaign status and timestamps
CREATE INDEX IF NOT EXISTS idx_campaigns_status_time
ON campaigns(status, started_at DESC);

-- =====================================================
-- Campaign Metrics Indexes (if table exists)
-- =====================================================

-- Index for campaign metrics timeline
CREATE INDEX IF NOT EXISTS idx_campaign_metrics_campaign_date
ON campaign_metrics(campaign_id, recorded_at DESC);

-- =====================================================
-- Email Events Indexes (if table exists)
-- =====================================================

-- Composite index for email event lookup
CREATE INDEX IF NOT EXISTS idx_email_events_campaign_lead
ON email_events(campaign_id, lead_id, event_type);

-- Index for event timeline
CREATE INDEX IF NOT EXISTS idx_email_events_time
ON email_events(created_at DESC);

-- =====================================================
-- Query Optimization - Materialized View for Dashboard Stats
-- =====================================================

-- Drop existing view if exists
DROP MATERIALIZED VIEW IF EXISTS mv_dashboard_stats;

-- Create materialized view for dashboard statistics
CREATE MATERIALIZED VIEW mv_dashboard_stats AS
SELECT
    COUNT(*) as total_leads,
    COUNT(*) FILTER (WHERE contact_status = 'pending') as pending_leads,
    COUNT(*) FILTER (WHERE contact_status = 'emailed') as emailed_leads,
    COUNT(*) FILTER (WHERE contact_status = 'called') as called_leads,
    COUNT(*) FILTER (WHERE contact_status = 'booked') as booked_leads,
    COUNT(*) FILTER (WHERE contact_status = 'converted') as converted_leads,
    AVG(performance_score) FILTER (WHERE performance_score IS NOT NULL) as avg_performance_score,
    COUNT(*) FILTER (WHERE rating < 4.0) as low_rated_businesses,
    COUNT(DISTINCT business_category) as unique_categories
FROM lead_profiles;

-- Create index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_dashboard_stats
ON mv_dashboard_stats (total_leads);

-- Function to refresh dashboard stats
CREATE OR REPLACE FUNCTION refresh_dashboard_stats()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_dashboard_stats;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Analyze tables for query planner optimization
-- =====================================================

ANALYZE lead_profiles;
ANALYZE audit_results;
ANALYZE campaigns;

-- =====================================================
-- Comments for documentation
-- =====================================================

COMMENT ON INDEX idx_lead_profiles_status_discovered IS 'Optimizes lead list queries filtered by status and sorted by date';
COMMENT ON INDEX idx_lead_profiles_pending IS 'Partial index for the most common query - pending leads';
COMMENT ON INDEX idx_audit_results_lead_time IS 'Optimizes audit history lookup for individual leads';
COMMENT ON MATERIALIZED VIEW mv_dashboard_stats IS 'Cached dashboard statistics - refresh with refresh_dashboard_stats()';
