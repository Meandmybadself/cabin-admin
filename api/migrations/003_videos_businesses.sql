CREATE TABLE videos (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  url         TEXT NOT NULL,
  category    TEXT NOT NULL DEFAULT '',
  notes       TEXT NOT NULL DEFAULT '',
  sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE businesses (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  category       TEXT NOT NULL DEFAULT '',
  description    TEXT NOT NULL DEFAULT '',
  address        TEXT NOT NULL DEFAULT '',
  phone          TEXT NOT NULL DEFAULT '',
  website        TEXT NOT NULL DEFAULT '',
  hours          TEXT NOT NULL DEFAULT '{}',   -- JSON: {"mon":{"open":"09:00","close":"17:00"},...}
  closed_months  TEXT NOT NULL DEFAULT '[]',   -- JSON: [11,12,1,2,3]
  sort_order     INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_videos_category     ON videos(category);
CREATE INDEX idx_businesses_category ON businesses(category);
