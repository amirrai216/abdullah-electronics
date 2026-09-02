/*
# Add sort_order to categories & seed correct display order

1. Adds `sort_order int` column to the `categories` table.
2. Adds a UNIQUE constraint on `categories.name` so ON CONFLICT works.
3. Seeds all 24 categories with the exact display order requested
   (heavy appliances first, small appliances last).
4. "Spin Dryer / Spinner" is included at position 5.
5. Existing categories that match by name get their sort_order updated;
   new categories are inserted with the correct order.

## Category Display Order
1. Refrigerators
2. Deep Freezers
3. Washing Machines
4. Dryer Machine
5. Spin Dryer / Spinner
6. Air Conditioners
7. Water Geyser
8. Water Dispensers
9. LED TVs
10. Inverters
11. Stabilizers
12. Microwave Ovens
13. Ceiling Fans
14. Pedestal Fans
15. Electric Churn (Madhani)
16. Electric Heater
17. Juicer 3-in-1
18. Juicer 4-in-1
19. Blender 2-in-1
20. Electric Iron
21. Sandwich Maker
22. Tea Kettle
23. Kitchen Appliances
24. Other

## Security
No RLS policy changes — categories already have anon+authenticated CRUD.
*/

ALTER TABLE categories ADD COLUMN IF NOT EXISTS sort_order int NOT NULL DEFAULT 999;

-- Add unique constraint on name so ON CONFLICT (name) works
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'categories_name_unique' AND conrelid = 'categories'::regclass
  ) THEN
    ALTER TABLE categories ADD CONSTRAINT categories_name_unique UNIQUE (name);
  END IF;
END $$;

INSERT INTO categories (name, description, sort_order) VALUES
  ('Refrigerators', 'Refrigerators and fridge-freezers', 1),
  ('Deep Freezers', 'Chest and upright deep freezers', 2),
  ('Washing Machines', 'Semi-automatic and fully automatic washing machines', 3),
  ('Dryer Machine', 'Tumble and spin dryer machines', 4),
  ('Spin Dryer / Spinner', 'Spin dryers and spinners', 5),
  ('Air Conditioners', 'Split, inverter, and window ACs', 6),
  ('Water Geyser', 'Water geysers and instant heaters', 7),
  ('Water Dispensers', 'Water dispensers and coolers', 8),
  ('LED TVs', 'LED, Smart, and QLED televisions', 9),
  ('Inverters', 'Power inverters and solar inverters', 10),
  ('Stabilizers', 'Voltage stabilizers and regulators', 11),
  ('Microwave Ovens', 'Microwave and convection ovens', 12),
  ('Ceiling Fans', 'Ceiling fans and decorative fans', 13),
  ('Pedestal Fans', 'Pedestal, table, and stand fans', 14),
  ('Electric Churn (Madhani)', 'Electric churners / madhani', 15),
  ('Electric Heater', 'Room and blow heaters', 16),
  ('Juicer 3-in-1', '3-in-1 juicer machines', 17),
  ('Juicer 4-in-1', '4-in-1 juicer machines', 18),
  ('Blender 2-in-1', '2-in-1 blenders and grinders', 19),
  ('Electric Iron', 'Steam and dry electric irons', 20),
  ('Sandwich Maker', 'Sandwich makers and grills', 21),
  ('Tea Kettle', 'Electric tea kettles', 22),
  ('Kitchen Appliances', 'General kitchen appliances', 23),
  ('Other', 'Other items and miscellaneous', 24)
ON CONFLICT (name) DO UPDATE SET sort_order = EXCLUDED.sort_order, description = EXCLUDED.description;
