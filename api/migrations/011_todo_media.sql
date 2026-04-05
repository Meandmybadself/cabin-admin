CREATE TABLE todo_media (
  id          TEXT    PRIMARY KEY,
  todo_id     TEXT    NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
  r2_key      TEXT    NOT NULL,
  media_type  TEXT    NOT NULL DEFAULT 'image',
  filename    TEXT    NOT NULL DEFAULT '',
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);
