ALTER TABLE checklist_items ADD COLUMN photo_prompt TEXT;

INSERT OR IGNORE INTO photo_categories (id, label, sort_order)
VALUES ('checkout', 'Checkout', 0);
