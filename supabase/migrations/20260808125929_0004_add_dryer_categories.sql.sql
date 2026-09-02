/*
# Add Dryer Machine & Spin Dryer / Spinner Categories

Adds two new laundry categories to match the updated inventory list:
- Dryer Machine
- Spin Dryer / Spinner

Uses ON CONFLICT DO NOTHING for idempotency.
*/

INSERT INTO categories (name, description) VALUES
  ('Dryer Machine', 'Tumble and spin dryer machines'),
  ('Spin Dryer / Spinner', 'Spin dryers and spinners')
ON CONFLICT DO NOTHING;
