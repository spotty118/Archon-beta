-- CSRF Tokens Table for Persistent Token Storage
-- This table stores CSRF tokens with expiration times for security

CREATE TABLE IF NOT EXISTS csrf_tokens (
    id BIGSERIAL PRIMARY KEY,
    token VARCHAR(255) UNIQUE NOT NULL,
    session_id VARCHAR(255),
    created_at BIGINT NOT NULL,
    expires_at BIGINT NOT NULL,
    created_timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast token lookups
CREATE INDEX IF NOT EXISTS idx_csrf_tokens_token ON csrf_tokens(token);

-- Index for session-based cleanup
CREATE INDEX IF NOT EXISTS idx_csrf_tokens_session ON csrf_tokens(session_id);

-- Index for expiration cleanup
CREATE INDEX IF NOT EXISTS idx_csrf_tokens_expires ON csrf_tokens(expires_at);

-- Add RLS (Row Level Security) policies
ALTER TABLE csrf_tokens ENABLE ROW LEVEL SECURITY;

-- Policy to allow service role full access
CREATE POLICY "Service role can manage CSRF tokens" ON csrf_tokens
    FOR ALL USING (auth.role() = 'service_role');

-- Automatic cleanup function for expired tokens
CREATE OR REPLACE FUNCTION cleanup_expired_csrf_tokens()
RETURNS void AS $$
BEGIN
    DELETE FROM csrf_tokens WHERE expires_at < EXTRACT(EPOCH FROM NOW());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a scheduled job to clean up expired tokens (every hour)
-- Note: This requires pg_cron extension which may not be available in all environments
-- If pg_cron is not available, the application will handle cleanup
DO $$
BEGIN
    -- Try to create the cron job, but don't fail if pg_cron is not available
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        PERFORM cron.schedule('cleanup-csrf-tokens', '0 * * * *', 'SELECT cleanup_expired_csrf_tokens();');
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        -- pg_cron not available, application will handle cleanup
        NULL;
END;
$$;