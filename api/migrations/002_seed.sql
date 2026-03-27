-- Contacts
INSERT INTO contacts (id, name, role, phone, notes, sort_order) VALUES
  ('01JQCONTACT001', 'Jeff',                 'Owner',               '415-269-2151', '', 0),
  ('01JQCONTACT002', 'Ashley',               'Owner',               '651-283-1821', '', 1),
  ('01JQCONTACT003', 'John Craddock',        'Neighbor to west',    '651-387-2441', '', 2),
  ('01JQCONTACT004', 'Patti Craddock',       'Neighbor to west',    '651-247-8405', '', 3),
  ('01JQCONTACT005', 'Rockwood Lodge',       'Neighbor to east',    '218-388-2242', '', 4),
  ('01JQCONTACT006', 'Rick Austin',          'Prior owner',         '218-370-0784', '', 5),
  ('01JQCONTACT007', 'G&G Septic',           'Septic system',       '218-387-1572', '', 6),
  ('01JQCONTACT008', 'Arrowhead',            'Electric & internet', '218-663-7239', '', 7),
  ('01JQCONTACT009', 'Como Oil',             'Propane',             '218-387-1165', '', 8),
  ('01JQCONTACT010', 'Rasmussen',            'Well drilling',       '218-834-3387', '', 9),
  ('01JQCONTACT011', 'Cook County Recycling','Recycling',           '218-387-3044', '', 10),
  ('01JQCONTACT012', 'North Shore Waste',    'Garbage',             '218-387-1029', '', 11);

-- Photo categories
INSERT INTO photo_categories (id, label, sort_order) VALUES
  ('01JQPHOTOCAT01', 'Fridge',        0),
  ('01JQPHOTOCAT02', 'Freezer',       1),
  ('01JQPHOTOCAT03', 'Pantry',        2),
  ('01JQPHOTOCAT04', 'Baking goods',  3),
  ('01JQPHOTOCAT05', 'Cabinets',      4);

-- Checklist items
INSERT INTO checklist_items (id, label, section, sort_order) VALUES
  -- Before leaving
  ('01JQCHECK0001', 'Close all windows',                        'Before leaving', 0),
  ('01JQCHECK0002', 'Lock all exterior doors',                  'Before leaving', 1),
  ('01JQCHECK0003', 'Turn off stove and oven',                  'Before leaving', 2),
  ('01JQCHECK0004', 'Run dishwasher or wash dishes by hand',    'Before leaving', 3),
  ('01JQCHECK0005', 'Empty dish rack and put dishes away',      'Before leaving', 4),
  -- Utilities
  ('01JQCHECK0006', 'Shut off water at main valve',             'Utilities', 5),
  ('01JQCHECK0007', 'Flip well breaker to OFF',                 'Utilities', 6),
  ('01JQCHECK0008', 'Set thermostat to 55°F',                   'Utilities', 7),
  ('01JQCHECK0009', 'Turn off water heater',                    'Utilities', 8),
  -- Final sweep
  ('01JQCHECK0010', 'Turn off all lights',                      'Final sweep', 9),
  ('01JQCHECK0011', 'Turn off all ceiling fans',                'Final sweep', 10),
  ('01JQCHECK0012', 'Check that refrigerator is running',       'Final sweep', 11),
  ('01JQCHECK0013', 'Check that freezer is running',            'Final sweep', 12),
  ('01JQCHECK0014', 'Empty humidifier and turn off',            'Final sweep', 13),
  ('01JQCHECK0015', 'Flush toilets and check for running water','Final sweep', 14),
  -- Make sure you have
  ('01JQCHECK0016', 'Cabin keys',                               'Make sure you have', 15),
  ('01JQCHECK0017', 'Thule keys',                               'Make sure you have', 16);

-- Docs (stub bodies — update content via the admin UI after launch)
INSERT INTO docs (id, slug, title, category, body, updated_at) VALUES
  ('01JQDOC000001', 'water-shutoff',         'How to shut water off / turn water on', 'Utilities',   '# Water Shutoff\n\n_Add content here._', strftime('%s','now')),
  ('01JQDOC000002', 'boiler-noises',         'Boiler noises',                         'Utilities',   '# Boiler Noises\n\n_Add content here._', strftime('%s','now')),
  ('01JQDOC000003', 'gfi-oddities',          'GFI oddities',                          'Utilities',   '# GFI Oddities\n\n_Add content here._', strftime('%s','now')),
  ('01JQDOC000004', 'dining-gunflint-trail', 'Dining on the Gunflint Trail',          'Local area',  '# Dining on the Gunflint Trail\n\n_Add content here._', strftime('%s','now')),
  ('01JQDOC000005', 'dining-grand-marais',   'Dining in Grand Marais',                'Local area',  '# Dining in Grand Marais\n\n_Add content here._', strftime('%s','now')),
  ('01JQDOC000006', 'grocery-stores',        'Grocery stores',                        'Local area',  '# Grocery Stores\n\n_Add content here._', strftime('%s','now')),
  ('01JQDOC000007', 'hardware-stores',       'Hardware stores',                       'Local area',  '# Hardware Stores\n\n_Add content here._', strftime('%s','now')),
  ('01JQDOC000008', 'hiking-trails',         'Hiking trails',                         'Things to do','# Hiking Trails\n\n_Add content here._', strftime('%s','now')),
  ('01JQDOC000009', 'putt-n-pets',           'Putt-n-Pets mini golf',                 'Things to do','# Putt-n-Pets Mini Golf\n\n_Add content here._', strftime('%s','now')),
  ('01JQDOC000010', 'wireless-network',      'Wireless network',                      'Cabin info',  '# Wireless Network\n\n_Add content here._', strftime('%s','now')),
  ('01JQDOC000011', 'rules-of-thumb',        'Rules of thumb',                        'Cabin info',  '# Rules of Thumb\n\n_Add content here._', strftime('%s','now'));
