CREATE TABLE docs (
  id          TEXT PRIMARY KEY,
  slug        TEXT NOT NULL UNIQUE,
  title       TEXT NOT NULL,
  category    TEXT NOT NULL DEFAULT '',
  body        TEXT NOT NULL DEFAULT '',
  updated_at  INTEGER NOT NULL
);

CREATE TABLE contacts (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT '',
  phone       TEXT NOT NULL DEFAULT '',
  notes       TEXT NOT NULL DEFAULT '',
  sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE checklist_items (
  id          TEXT PRIMARY KEY,
  label       TEXT NOT NULL,
  section     TEXT NOT NULL DEFAULT '',
  sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE checklist_sessions (
  id            TEXT PRIMARY KEY,
  started_at    INTEGER NOT NULL,
  completed_at  INTEGER,
  checked_ids   TEXT NOT NULL DEFAULT '[]',
  notes         TEXT
);

CREATE TABLE photo_categories (
  id          TEXT PRIMARY KEY,
  label       TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE photos (
  id            TEXT PRIMARY KEY,
  category_id   TEXT NOT NULL REFERENCES photo_categories(id),
  session_id    TEXT REFERENCES checklist_sessions(id),
  r2_key        TEXT NOT NULL,
  taken_at      INTEGER NOT NULL,
  notes         TEXT
);

CREATE INDEX idx_docs_category     ON docs(category);
CREATE INDEX idx_photos_category   ON photos(category_id);
CREATE INDEX idx_photos_session    ON photos(session_id);
CREATE INDEX idx_photos_taken_at   ON photos(taken_at);
