CREATE TABLE IF NOT EXISTS appliance_manuals (
  id TEXT PRIMARY KEY,
  appliance_id TEXT NOT NULL REFERENCES appliances(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT,       -- external link (null if uploaded to R2)
  r2_key TEXT,    -- R2 key (null if external link)
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
