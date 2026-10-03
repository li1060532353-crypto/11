CREATE TABLE owner_sessions (token_hash TEXT PRIMARY KEY, credential_version TEXT NOT NULL, expires_at INTEGER NOT NULL);
CREATE INDEX idx_owner_sessions_expiry ON owner_sessions(expires_at);
CREATE TABLE owner_login_limits (key TEXT PRIMARY KEY, attempts INTEGER NOT NULL, window_start INTEGER NOT NULL);
