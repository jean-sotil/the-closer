-- Status history table for tracking lead status transitions
-- This provides an audit trail of all status changes

CREATE TABLE IF NOT EXISTS status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Reference to the lead
    lead_id UUID NOT NULL REFERENCES lead_profiles(id) ON DELETE CASCADE,

    -- Status transition
    from_status TEXT NOT NULL,
    to_status TEXT NOT NULL,

    -- Optional reason for the change
    reason TEXT,

    -- Who made the change (could be user ID, system, or agent)
    changed_by TEXT,

    -- When the change occurred
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT valid_from_status CHECK (from_status IN ('pending', 'emailed', 'called', 'booked', 'converted', 'declined')),
    CONSTRAINT valid_to_status CHECK (to_status IN ('pending', 'emailed', 'called', 'booked', 'converted', 'declined'))
);

-- Index for fast lookup by lead
CREATE INDEX IF NOT EXISTS idx_status_history_lead_id ON status_history(lead_id);

-- Index for temporal queries
CREATE INDEX IF NOT EXISTS idx_status_history_changed_at ON status_history(changed_at DESC);

-- Composite index for status transition queries
CREATE INDEX IF NOT EXISTS idx_status_history_transitions ON status_history(from_status, to_status);

-- Enable Row Level Security
ALTER TABLE status_history ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Allow authenticated users to read history
CREATE POLICY "Allow authenticated read status_history"
    ON status_history
    FOR SELECT
    TO authenticated
    USING (true);

-- RLS Policy: Allow authenticated users to insert history
CREATE POLICY "Allow authenticated insert status_history"
    ON status_history
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Comment for documentation
COMMENT ON TABLE status_history IS 'Audit trail of lead status transitions for tracking sales pipeline progression';
COMMENT ON COLUMN status_history.lead_id IS 'Reference to the lead whose status changed';
COMMENT ON COLUMN status_history.from_status IS 'Previous contact status';
COMMENT ON COLUMN status_history.to_status IS 'New contact status';
COMMENT ON COLUMN status_history.reason IS 'Optional reason or notes for the status change';
COMMENT ON COLUMN status_history.changed_by IS 'Identifier of who/what made the change (user ID, system, agent name)';
COMMENT ON COLUMN status_history.changed_at IS 'Timestamp when the status change occurred';
