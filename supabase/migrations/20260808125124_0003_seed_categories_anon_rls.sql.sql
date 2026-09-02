/*
# Seed Inventory Categories & Enable Anon Access (Auth Disabled)

## Overview
This migration does two things:
1. Seeds the 22 inventory categories required by Abdullah Electronics.
2. Replaces all RLS policies to allow `anon` role access, since authentication
   has been disabled in favor of direct demo-admin access. The frontend uses
   the anon key, so without `anon`-scoped policies every table appears empty.

## Categories Seeded
Refrigerators, Deep Freezers, Washing Machines, Ceiling Fans, Pedestal Fans,
LED TVs, Air Conditioners, Microwave Ovens, Water Dispensers, Inverters,
Stabilizers, Electric Iron, Juicer 3-in-1, Juicer 4-in-1, Blender 2-in-1,
Sandwich Maker, Tea Kettle, Electric Churn (Madhani), Electric Heater,
Water Geyser, Kitchen Appliances, Other.

## Security Changes
- All existing `authenticated`-only policies are dropped and replaced with
  `TO anon, authenticated` policies using `USING (true)` / `WITH CHECK (true)`.
  This is correct because the app is now a single-tenant no-auth app — there is
  no sign-in screen, and all data is intentionally shared/public within the
  single shop context.
- RLS remains enabled on every table.
- `app_users` table policies are also updated to allow anon access since the
  demo admin is a static frontend object and the table is not used for auth
  gating anymore.

## Notes
1. Categories use `ON CONFLICT DO NOTHING` so re-running is safe.
2. No data is lost — only policies are replaced.
*/

-- ============ SEED CATEGORIES ============
INSERT INTO categories (name, description) VALUES
  ('Refrigerators', 'Refrigerators and fridge-freezers'),
  ('Deep Freezers', 'Chest and upright deep freezers'),
  ('Washing Machines', 'Semi-automatic and fully automatic washing machines'),
  ('Ceiling Fans', 'Ceiling fans and decorative fans'),
  ('Pedestal Fans', 'Pedestal, table, and stand fans'),
  ('LED TVs', 'LED, Smart, and QLED televisions'),
  ('Air Conditioners', 'Split, inverter, and window ACs'),
  ('Microwave Ovens', 'Microwave and convection ovens'),
  ('Water Dispensers', 'Water dispensers and coolers'),
  ('Inverters', 'Power inverters and solar inverters'),
  ('Stabilizers', 'Voltage stabilizers and regulators'),
  ('Electric Iron', 'Steam and dry electric irons'),
  ('Juicer 3-in-1', '3-in-1 juicer machines'),
  ('Juicer 4-in-1', '4-in-1 juicer machines'),
  ('Blender 2-in-1', '2-in-1 blenders and grinders'),
  ('Sandwich Maker', 'Sandwich makers and grills'),
  ('Tea Kettle', 'Electric tea kettles'),
  ('Electric Churn (Madhani)', 'Electric churners / madhani'),
  ('Electric Heater', 'Room and blow heaters'),
  ('Water Geyser', 'Water geysers and instant heaters'),
  ('Kitchen Appliances', 'General kitchen appliances'),
  ('Other', 'Other items and miscellaneous')
ON CONFLICT DO NOTHING;

-- ============ HELPER: replace policy macro ============
-- We do this manually for each table since Supabase doesn't support macros.

-- ============ APP_USERS ============
DROP POLICY IF EXISTS "app_users_select" ON app_users;
CREATE POLICY "app_users_select" ON app_users FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "app_users_insert_self" ON app_users;
CREATE POLICY "app_users_insert_self" ON app_users FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "app_users_update_self" ON app_users;
CREATE POLICY "app_users_update_self" ON app_users FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "app_users_delete" ON app_users;
CREATE POLICY "app_users_delete" ON app_users FOR DELETE
  TO anon, authenticated USING (true);

-- ============ SETTINGS ============
DROP POLICY IF EXISTS "settings_select" ON settings;
CREATE POLICY "settings_select" ON settings FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "settings_update" ON settings;
CREATE POLICY "settings_update" ON settings FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "settings_insert" ON settings;
CREATE POLICY "settings_insert" ON settings FOR INSERT
  TO anon, authenticated WITH CHECK (true);

-- ============ CATEGORIES ============
DROP POLICY IF EXISTS "categories_select" ON categories;
CREATE POLICY "categories_select" ON categories FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "categories_insert" ON categories;
CREATE POLICY "categories_insert" ON categories FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "categories_update" ON categories;
CREATE POLICY "categories_update" ON categories FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "categories_delete" ON categories;
CREATE POLICY "categories_delete" ON categories FOR DELETE
  TO anon, authenticated USING (true);

-- ============ SUPPLIERS ============
DROP POLICY IF EXISTS "suppliers_select" ON suppliers;
CREATE POLICY "suppliers_select" ON suppliers FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "suppliers_insert" ON suppliers;
CREATE POLICY "suppliers_insert" ON suppliers FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "suppliers_update" ON suppliers;
CREATE POLICY "suppliers_update" ON suppliers FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "suppliers_delete" ON suppliers;
CREATE POLICY "suppliers_delete" ON suppliers FOR DELETE
  TO anon, authenticated USING (true);

-- ============ PRODUCTS ============
DROP POLICY IF EXISTS "products_select" ON products;
CREATE POLICY "products_select" ON products FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "products_insert" ON products;
CREATE POLICY "products_insert" ON products FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "products_update" ON products;
CREATE POLICY "products_update" ON products FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "products_delete" ON products;
CREATE POLICY "products_delete" ON products FOR DELETE
  TO anon, authenticated USING (true);

-- ============ PRODUCT_SERIALS ============
DROP POLICY IF EXISTS "product_serials_select" ON product_serials;
CREATE POLICY "product_serials_select" ON product_serials FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "product_serials_insert" ON product_serials;
CREATE POLICY "product_serials_insert" ON product_serials FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "product_serials_update" ON product_serials;
CREATE POLICY "product_serials_update" ON product_serials FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "product_serials_delete" ON product_serials;
CREATE POLICY "product_serials_delete" ON product_serials FOR DELETE
  TO anon, authenticated USING (true);

-- ============ PURCHASES ============
DROP POLICY IF EXISTS "purchases_select" ON purchases;
CREATE POLICY "purchases_select" ON purchases FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "purchases_insert" ON purchases;
CREATE POLICY "purchases_insert" ON purchases FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "purchases_update" ON purchases;
CREATE POLICY "purchases_update" ON purchases FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "purchases_delete" ON purchases;
CREATE POLICY "purchases_delete" ON purchases FOR DELETE
  TO anon, authenticated USING (true);

-- ============ CUSTOMERS ============
DROP POLICY IF EXISTS "customers_select" ON customers;
CREATE POLICY "customers_select" ON customers FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "customers_insert" ON customers;
CREATE POLICY "customers_insert" ON customers FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "customers_update" ON customers;
CREATE POLICY "customers_update" ON customers FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "customers_delete" ON customers;
CREATE POLICY "customers_delete" ON customers FOR DELETE
  TO anon, authenticated USING (true);

-- ============ SALES ============
DROP POLICY IF EXISTS "sales_select" ON sales;
CREATE POLICY "sales_select" ON sales FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "sales_insert" ON sales;
CREATE POLICY "sales_insert" ON sales FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "sales_update" ON sales;
CREATE POLICY "sales_update" ON sales FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "sales_delete" ON sales;
CREATE POLICY "sales_delete" ON sales FOR DELETE
  TO anon, authenticated USING (true);

-- ============ SALE_ITEMS ============
DROP POLICY IF EXISTS "sale_items_select" ON sale_items;
CREATE POLICY "sale_items_select" ON sale_items FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "sale_items_insert" ON sale_items;
CREATE POLICY "sale_items_insert" ON sale_items FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "sale_items_update" ON sale_items;
CREATE POLICY "sale_items_update" ON sale_items FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "sale_items_delete" ON sale_items;
CREATE POLICY "sale_items_delete" ON sale_items FOR DELETE
  TO anon, authenticated USING (true);

-- ============ INSTALLMENT_PLANS ============
DROP POLICY IF EXISTS "installment_plans_select" ON installment_plans;
CREATE POLICY "installment_plans_select" ON installment_plans FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "installment_plans_insert" ON installment_plans;
CREATE POLICY "installment_plans_insert" ON installment_plans FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "installment_plans_update" ON installment_plans;
CREATE POLICY "installment_plans_update" ON installment_plans FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "installment_plans_delete" ON installment_plans;
CREATE POLICY "installment_plans_delete" ON installment_plans FOR DELETE
  TO anon, authenticated USING (true);

-- ============ INSTALLMENT_SCHEDULE ============
DROP POLICY IF EXISTS "installment_schedule_select" ON installment_schedule;
CREATE POLICY "installment_schedule_select" ON installment_schedule FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "installment_schedule_insert" ON installment_schedule;
CREATE POLICY "installment_schedule_insert" ON installment_schedule FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "installment_schedule_update" ON installment_schedule;
CREATE POLICY "installment_schedule_update" ON installment_schedule FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "installment_schedule_delete" ON installment_schedule;
CREATE POLICY "installment_schedule_delete" ON installment_schedule FOR DELETE
  TO anon, authenticated USING (true);

-- ============ PAYMENTS ============
DROP POLICY IF EXISTS "payments_select" ON payments;
CREATE POLICY "payments_select" ON payments FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "payments_insert" ON payments;
CREATE POLICY "payments_insert" ON payments FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "payments_update" ON payments;
CREATE POLICY "payments_update" ON payments FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "payments_delete" ON payments;
CREATE POLICY "payments_delete" ON payments FOR DELETE
  TO anon, authenticated USING (true);

-- ============ EXPENSES ============
DROP POLICY IF EXISTS "expenses_select" ON expenses;
CREATE POLICY "expenses_select" ON expenses FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "expenses_insert" ON expenses;
CREATE POLICY "expenses_insert" ON expenses FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "expenses_update" ON expenses;
CREATE POLICY "expenses_update" ON expenses FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "expenses_delete" ON expenses;
CREATE POLICY "expenses_delete" ON expenses FOR DELETE
  TO anon, authenticated USING (true);

-- ============ CASHBOOK_ENTRIES ============
DROP POLICY IF EXISTS "cashbook_select" ON cashbook_entries;
CREATE POLICY "cashbook_select" ON cashbook_entries FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "cashbook_insert" ON cashbook_entries;
CREATE POLICY "cashbook_insert" ON cashbook_entries FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "cashbook_update" ON cashbook_entries;
CREATE POLICY "cashbook_update" ON cashbook_entries FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "cashbook_delete" ON cashbook_entries;
CREATE POLICY "cashbook_delete" ON cashbook_entries FOR DELETE
  TO anon, authenticated USING (true);
