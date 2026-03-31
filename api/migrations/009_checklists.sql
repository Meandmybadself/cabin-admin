CREATE TABLE checklists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

INSERT INTO checklists (id, name, sort_order) VALUES ('shutdown', 'Shutdown', 0);

ALTER TABLE checklist_items ADD COLUMN checklist_id TEXT NOT NULL DEFAULT 'shutdown';
ALTER TABLE checklist_sessions ADD COLUMN checklist_id TEXT NOT NULL DEFAULT 'shutdown';
