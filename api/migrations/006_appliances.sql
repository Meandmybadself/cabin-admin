CREATE TABLE IF NOT EXISTS appliances (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  model TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS appliance_events (
  id TEXT PRIMARY KEY,
  appliance_id TEXT NOT NULL REFERENCES appliances(id) ON DELETE CASCADE,
  date TEXT NOT NULL,       -- YYYY-MM-DD
  description TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
