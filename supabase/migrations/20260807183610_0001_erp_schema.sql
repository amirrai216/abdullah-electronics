/*
# Abdullah Electronics ERP - Core Schema

## Overview
Complete schema for a Business ERP & Installment Management system for Abdullah Electronics.
Starts with a BLANK database — no dummy data. All tables empty by design.

## New Tables
1. `app_users` — staff/admin accounts linked to auth.users with role (admin/staff), full_name, active flag.
2. `categories` — product categories (e.g. Refrigerators, ACs, TVs).
3. `suppliers` — vendor/supplier records.
4. `products` — products with category, brand/model, purchase price, selling price, min stock alert, quantity.
5. `product_serials` — unique serial/IMEI tracking for high-value items, linked to product, with status (in_stock/sold).
6. `purchases` — purchase log: supplier, product, qty, unit_cost, total, date.
7. `customers` — customer profiles: name, CNIC, mobile, address, photo URL, guarantor details.
8. `sales` — sales header: invoice_no, type (cash/installment), customer, totals, advance, balance, status, created_by.
9. `sale_items` — line items per sale: product, serial, qty, unit price, cost, subtotal.
10. `installment_plans` — plan for installment sales: frequency (weekly/monthly), duration, installment amount, down payment.
11. `installment_schedule` — auto-generated due dates: installment_no, due_date, amount, status (pending/paid/late), paid_date.
12. `payments` — payment log: sale, schedule entry (optional), amount, type (cash_sale/installment/advance), method, late_fee, received_by.
13. `expenses` — shop expenses: category (rent/electricity/salary/tea/transport/other), amount, note, date.
14. `cashbook_entries` — derived cash log: date, type (cash_sale/installment_collection/expense), reference, amount, direction (in/out).
15. `settings` — single-row shop settings: shop_name, address, phone, footer note, invoice counter.

## Security
- RLS enabled on ALL tables.
- Owner-scoped policies using auth.uid() against app_users.
- Staff role: can do POS, add payments, check stock (no cost price/profit access enforced in UI; DB allows read for simplicity but UI restricts).
- Admin role: full access.
- Policies scope by: user is an active app_user (EXISTS check against app_users where id = auth.uid()).
- For ownership of business data (single business, multi-user staff): all authenticated staff share the business data, so policies allow access to any authenticated user who is an active app_user. This is a single-tenant business app with staff logins.

## Notes
1. Invoice numbering via a sequence + settings counter fallback.
2. All monetary columns use numeric(12,2) for precision.
3. created_at/updated_at timestamps on all relevant tables.
4. Soft approach: business data is shared among all authenticated staff (single shop). Role enforcement for sensitive views (cost price, P&L) is done in the UI layer.
*/

-- ============ APP USERS ============
CREATE TABLE IF NOT EXISTS app_users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  role text NOT NULL DEFAULT 'staff' CHECK (role IN ('admin','staff')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_users_select" ON app_users;
CREATE POLICY "app_users_select" ON app_users FOR SELECT
  TO authenticated USING (EXISTS (SELECT 1 FROM app_users au WHERE au.id = auth.uid() AND au.active));

DROP POLICY IF EXISTS "app_users_insert_self" ON app_users;
CREATE POLICY "app_users_insert_self" ON app_users FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "app_users_update_self" ON app_users;
CREATE POLICY "app_users_update_self" ON app_users FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ============ SETTINGS (single-row) ============
CREATE TABLE IF NOT EXISTS settings (
  id int PRIMARY KEY DEFAULT 1,
  shop_name text NOT NULL DEFAULT 'Abdullah Electronics',
  shop_address text NOT NULL DEFAULT '',
  shop_phone text NOT NULL DEFAULT '',
  invoice_footer text NOT NULL DEFAULT 'Goods once sold cannot be returned without valid reason.',
  currency text NOT NULL DEFAULT 'PKR',
  invoice_counter int NOT NULL DEFAULT 1,
  CONSTRAINT settings_single_row CHECK (id = 1)
);
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "settings_select" ON settings;
CREATE POLICY "settings_select" ON settings FOR SELECT
  TO authenticated USING (EXISTS (SELECT 1 FROM app_users au WHERE au.id = auth.uid() AND au.active));

DROP POLICY IF EXISTS "settings_update" ON settings;
CREATE POLICY "settings_update" ON settings FOR UPDATE
  TO authenticated USING (EXISTS (SELECT 1 FROM app_users au WHERE au.id = auth.uid() AND au.active))
  WITH CHECK (EXISTS (SELECT 1 FROM app_users au WHERE au.id = auth.uid() AND au.active));

DROP POLICY IF EXISTS "settings_insert" ON settings;
CREATE POLICY "settings_insert" ON settings FOR INSERT
  TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM app_users au WHERE au.id = auth.uid() AND au.active));

-- ============ CATEGORIES ============
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "categories_select" ON categories;
CREATE POLICY "categories_select" ON categories FOR SELECT
  TO authenticated USING (EXISTS (SELECT 1 FROM app_users au WHERE au.id = auth.uid() AND au.active));
DROP POLICY IF EXISTS "categories_insert" ON categories;
CREATE POLICY "categories_insert" ON categories FOR INSERT
  TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM app_users au WHERE au.id = auth.uid() AND au.active));
DROP POLICY IF EXISTS "categories_update" ON categories;
CREATE POLICY "categories_update" ON categories FOR UPDATE
  TO authenticated USING (EXISTS (SELECT 1 FROM app_users au WHERE au.id = auth.uid() AND au.active))
  WITH CHECK (EXISTS (SELECT 1 FROM app_users au WHERE au.id = auth.uid() AND au.active));
DROP POLICY IF EXISTS "categories_delete" ON categories;
CREATE POLICY "categories_delete" ON categories FOR DELETE
  TO authenticated USING (EXISTS (SELECT 1 FROM app_users au WHERE au.id = auth.uid() AND au.active));

-- ============ SUPPLIERS ============
CREATE TABLE IF NOT EXISTS suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact_person text DEFAULT '',
  phone text DEFAULT '',
  address text DEFAULT '',
  note text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "suppliers_select" ON suppliers;
CREATE POLICY "suppliers_select" ON suppliers FOR SELECT
  TO authenticated USING (EXISTS (SELECT 1 FROM app_users au WHERE au.id = auth.uid() AND au.active));
DROP POLICY IF EXISTS "suppliers_insert" ON suppliers;
CREATE POLICY "suppliers_insert" ON suppliers FOR INSERT
  TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM app_users au WHERE au.id = auth.uid() AND au.active));
DROP POLICY IF EXISTS "suppliers_update" ON suppliers;
CREATE POLICY "suppliers_update" ON suppliers FOR UPDATE
  TO authenticated USING (EXISTS (SELECT 1 FROM app_users au WHERE au.id = auth.uid() AND au.active))
  WITH CHECK (EXISTS (SELECT 1 FROM app_users au WHERE au.id = auth.uid() AND au.active));
DROP POLICY IF EXISTS "suppliers_delete" ON suppliers;
CREATE POLICY "suppliers_delete" ON suppliers FOR DELETE
  TO authenticated USING (EXISTS (SELECT 1 FROM app_users au WHERE au.id = auth.uid() AND au.active));

-- ============ PRODUCTS ============
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  brand_model text DEFAULT '',
  purchase_price numeric(12,2) NOT NULL DEFAULT 0,
  selling_price numeric(12,2) NOT NULL DEFAULT 0,
  min_stock_level int NOT NULL DEFAULT 0,
  quantity int NOT NULL DEFAULT 0,
  track_serials boolean NOT NULL DEFAULT false,
  unit text NOT NULL DEFAULT 'piece',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "products_select" ON products;
CREATE POLICY "products_select" ON products FOR SELECT
  TO authenticated USING (EXISTS (SELECT 1 FROM app_users au WHERE au.id = auth.uid() AND au.active));
DROP POLICY IF EXISTS "products_insert" ON products;
CREATE POLICY "products_insert" ON products FOR INSERT
  TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM app_users au WHERE au.id = auth.uid() AND au.active));
DROP POLICY IF EXISTS "products_update" ON products;
CREATE POLICY "products_update" ON products FOR UPDATE
  TO authenticated USING (EXISTS (SELECT 1 FROM app_users au WHERE au.id = auth.uid() AND au.active))
  WITH CHECK (EXISTS (SELECT 1 FROM app_users au WHERE au.id = auth.uid() AND au.active));
DROP POLICY IF EXISTS "products_delete" ON products;
CREATE POLICY "products_delete" ON products FOR DELETE
  TO authenticated USING (EXISTS (SELECT 1 FROM app_users au WHERE au.id = auth.uid() AND au.active));

-- ============ PRODUCT SERIALS ============
CREATE TABLE IF NOT EXISTS product_serials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  serial_number text NOT NULL,
  status text NOT NULL DEFAULT 'in_stock' CHECK (status IN ('in_stock','sold','reserved')),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE product_serials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "product_serials_select" ON product_serials;
CREATE POLICY "product_serials_select" ON product_serials FOR SELECT
  TO authenticated USING (EXISTS (SELECT 1 FROM app_users au WHERE au.id = auth.uid() AND au.active));
DROP POLICY IF EXISTS "product_serials_insert" ON product_serials;
CREATE POLICY "product_serials_insert" ON product_serials FOR INSERT
  TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM app_users au WHERE au.id = auth.uid() AND au.active));
DROP POLICY IF EXISTS "product_serials_update" ON product_serials;
CREATE POLICY "product_serials_update" ON product_serials FOR UPDATE
  TO authenticated USING (EXISTS (SELECT 1 FROM app_users au WHERE au.id = auth.uid() AND au.active))
  WITH CHECK (EXISTS (SELECT 1 FROM app_users au WHERE au.id = auth.uid() AND au.active));
DROP POLICY IF EXISTS "product_serials_delete" ON product_serials;
CREATE POLICY "product_serials_delete" ON product_serials FOR DELETE
  TO authenticated USING (EXISTS (SELECT 1 FROM app_users au WHERE au.id = auth.uid() AND au.active));

-- ============ PURCHASES ============
CREATE TABLE IF NOT EXISTS purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity int NOT NULL DEFAULT 1,
  unit_cost numeric(12,2) NOT NULL DEFAULT 0,
  total_cost numeric(12,2) NOT NULL DEFAULT 0,
  purchase_date date NOT NULL DEFAULT CURRENT_DATE,
  note text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "purchases_select" ON purchases;
CREATE POLICY "purchases_select" ON purchases FOR SELECT
  TO authenticated USING (EXISTS (SELECT 1 FROM app_users au WHERE au.id = auth.uid() AND au.active));
DROP POLICY IF EXISTS "purchases_insert" ON purchases;
CREATE POLICY "purchases_insert" ON purchases FOR INSERT
  TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM app_users au WHERE au.id = auth.uid() AND au.active));
DROP POLICY IF EXISTS "purchases_update" ON purchases;
CREATE POLICY "purchases_update" ON purchases FOR UPDATE
  TO authenticated USING (EXISTS (SELECT 1 FROM app_users au WHERE au.id = auth.uid() AND au.active))
  WITH CHECK (EXISTS (SELECT 1 FROM app_users au WHERE au.id = auth.uid() AND au.active));
DROP POLICY IF EXISTS "purchases_delete" ON purchases;
CREATE POLICY "purchases_delete" ON purchases FOR DELETE
  TO authenticated USING (EXISTS (SELECT 1 FROM app_users au WHERE au.id = auth.uid() AND au.active));

-- ============ CUSTOMERS ============
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  cnic text DEFAULT '',
  mobile text DEFAULT '',
  address text DEFAULT '',
  photo_url text DEFAULT '',
  cnic_scan_url text DEFAULT '',
  -- Guarantor / witness
  guarantor_name text DEFAULT '',
  guarantor_cnic text DEFAULT '',
  guarantor_phone text DEFAULT '',
  guarantor_relation text DEFAULT '',
  note text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customers_select" ON customers;
CREATE POLICY "customers_select" ON customers FOR SELECT
  TO authenticated USING (EXISTS (SELECT 1 FROM app_users au WHERE au.id = auth.uid() AND au.active));
DROP POLICY IF EXISTS "customers_insert" ON customers;
CREATE POLICY "customers_insert" ON customers FOR INSERT
  TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM app_users au WHERE au.id = auth.uid() AND au.active));
DROP POLICY IF EXISTS "customers_update" ON customers;
CREATE POLICY "customers_update" ON customers FOR UPDATE
  TO authenticated USING (EXISTS (SELECT 1 FROM app_users au WHERE au.id = auth.uid() AND au.active))
  WITH CHECK (EXISTS (SELECT 1 FROM app_users au WHERE au.id = auth.uid() AND au.active));
DROP POLICY IF EXISTS "customers_delete" ON customers;
CREATE POLICY "customers_delete" ON customers FOR DELETE
  TO authenticated USING (EXISTS (SELECT 1 FROM app_users au WHERE au.id = auth.uid() AND au.active));

-- ============ SALES ============
CREATE TABLE IF NOT EXISTS sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_no text NOT NULL UNIQUE,
  sale_type text NOT NULL CHECK (sale_type IN ('cash','installment')),
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  discount numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,
  advance_paid numeric(12,2) NOT NULL DEFAULT 0,
  remaining_balance numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('completed','ongoing','defaulted','closed')),
  payment_terms text DEFAULT '',
  sale_date timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES app_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sales_select" ON sales;
CREATE POLICY "sales_select" ON sales FOR SELECT
  TO authenticated USING (EXISTS (SELECT 1 FROM app_users au WHERE au.id = auth.uid() AND au.active));
DROP POLICY IF EXISTS "sales_insert" ON sales;
CREATE POLICY "sales_insert" ON sales FOR INSERT
  TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM app_users au WHERE au.id = auth.uid() AND au.active));
DROP POLICY IF EXISTS "sales_update" ON sales;
CREATE POLICY "sales_update" ON sales FOR UPDATE
  TO authenticated USING (EXISTS (SELECT 1 FROM app_users au WHERE au.id = auth.uid() AND au.active))
  WITH CHECK (EXISTS (SELECT 1 FROM app_users au WHERE au.id = auth.uid() AND au.active));
DROP POLICY IF EXISTS "sales_delete" ON sales;
CREATE POLICY "sales_delete" ON sales FOR DELETE
  TO authenticated USING (EXISTS (SELECT 1 FROM app_users au WHERE au.id = auth.uid() AND au.active));

-- ============ SALE ITEMS ============
CREATE TABLE IF NOT EXISTS sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  serial_id uuid REFERENCES product_serials(id) ON DELETE SET NULL,
  quantity int NOT NULL DEFAULT 1,
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  unit_cost numeric(12,2) NOT NULL DEFAULT 0,
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sale_items_select" ON sale_items;
CREATE POLICY "sale_items_select" ON sale_items FOR SELECT
  TO authenticated USING (EXISTS (SELECT 1 FROM app_users au WHERE au.id = auth.uid() AND au.active));
DROP POLICY IF EXISTS "sale_items_insert" ON sale_items;
CREATE POLICY "sale_items_insert" ON sale_items FOR INSERT
  TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM app_users au WHERE au.id = auth.uid() AND au.active));
DROP POLICY IF EXISTS "sale_items_update" ON sale_items;
CREATE POLICY "sale_items_update" ON sale_items FOR UPDATE
  TO authenticated USING (EXISTS (SELECT 1 FROM app_users au WHERE au.id = auth.uid() AND au.active))
  WITH CHECK (EXISTS (SELECT 1 FROM app_users au WHERE au.id = auth.uid() AND au.active));
DROP POLICY IF EXISTS "sale_items_delete" ON sale_items;
CREATE POLICY "sale_items_delete" ON sale_items FOR DELETE
  TO authenticated USING (EXISTS (SELECT 1 FROM app_users au WHERE au.id = auth.uid() AND au.active));

-- ============ INSTALLMENT PLANS ============
CREATE TABLE IF NOT EXISTS installment_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  frequency text NOT NULL CHECK (frequency IN ('weekly','monthly')),
  duration_months int NOT NULL DEFAULT 1,
  installment_amount numeric(12,2) NOT NULL DEFAULT 0,
  down_payment numeric(12,2) NOT NULL DEFAULT 0,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE installment_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "installment_plans_select" ON installment_plans;
CREATE POLICY "installment_plans_select" ON installment_plans FOR SELECT
  TO authenticated USING (EXISTS (SELECT 1 FROM app_users au WHERE au.id = auth.uid() AND au.active));
DROP POLICY IF EXISTS "installment_plans_insert" ON installment_plans;
CREATE POLICY "installment_plans_insert" ON installment_plans FOR INSERT
  TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM app_users au WHERE au.id = auth.uid() AND au.active));
DROP POLICY IF EXISTS "installment_plans_update" ON installment_plans;
CREATE POLICY "installment_plans_update" ON installment_plans FOR UPDATE
  TO authenticated USING (EXISTS (SELECT 1 FROM app_users au WHERE au.id = auth.uid() AND au.active))
  WITH CHECK (EXISTS (SELECT 1 FROM app_users au WHERE au.id = auth.uid() AND au.active));
DROP POLICY IF EXISTS "installment_plans_delete" ON installment_plans;
CREATE POLICY "installment_plans_delete" ON installment_plans FOR DELETE
  TO authenticated USING (EXISTS (SELECT 1 FROM app_users au WHERE au.id = auth.uid() AND au.active));

-- ============ INSTALLMENT SCHEDULE ============
CREATE TABLE IF NOT EXISTS installment_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES installment_plans(id) ON DELETE CASCADE,
  sale_id uuid NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  installment_no int NOT NULL DEFAULT 1,
  due_date date NOT NULL,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','late','overdue')),
  paid_amount numeric(12,2) NOT NULL DEFAULT 0,
  late_fee numeric(12,2) NOT NULL DEFAULT 0,
  paid_date date,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE installment_schedule ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "installment_schedule_select" ON installment_schedule;
CREATE POLICY "installment_schedule_select" ON installment_schedule FOR SELECT
  TO authenticated USING (EXISTS (SELECT 1 FROM app_users au WHERE au.id = auth.uid() AND au.active));
DROP POLICY IF EXISTS "installment_schedule_insert" ON installment_schedule;
CREATE POLICY "installment_schedule_insert" ON installment_schedule FOR INSERT
  TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM app_users au WHERE au.id = auth.uid() AND au.active));
DROP POLICY IF EXISTS "installment_schedule_update" ON installment_schedule;
CREATE POLICY "installment_schedule_update" ON installment_schedule FOR UPDATE
  TO authenticated USING (EXISTS (SELECT 1 FROM app_users au WHERE au.id = auth.uid() AND au.active))
  WITH CHECK (EXISTS (SELECT 1 FROM app_users au WHERE au.id = auth.uid() AND au.active));
DROP POLICY IF EXISTS "installment_schedule_delete" ON installment_schedule;
CREATE POLICY "installment_schedule_delete" ON installment_schedule FOR DELETE
  TO authenticated USING (EXISTS (SELECT 1 FROM app_users au WHERE au.id = auth.uid() AND au.active));

-- ============ PAYMENTS ============
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid REFERENCES sales(id) ON DELETE SET NULL,
  schedule_id uuid REFERENCES installment_schedule(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  late_fee numeric(12,2) NOT NULL DEFAULT 0,
  payment_type text NOT NULL CHECK (payment_type IN ('cash_sale','installment','advance')),
  method text NOT NULL DEFAULT 'cash' CHECK (method IN ('cash','card','bank','other')),
  receipt_no text,
  note text DEFAULT '',
  received_by uuid REFERENCES app_users(id) ON DELETE SET NULL,
  payment_date timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payments_select" ON payments;
CREATE POLICY "payments_select" ON payments FOR SELECT
  TO authenticated USING (EXISTS (SELECT 1 FROM app_users au WHERE au.id = auth.uid() AND au.active));
DROP POLICY IF EXISTS "payments_insert" ON payments;
CREATE POLICY "payments_insert" ON payments FOR INSERT
  TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM app_users au WHERE au.id = auth.uid() AND au.active));
DROP POLICY IF EXISTS "payments_update" ON payments;
CREATE POLICY "payments_update" ON payments FOR UPDATE
  TO authenticated USING (EXISTS (SELECT 1 FROM app_users au WHERE au.id = auth.uid() AND au.active))
  WITH CHECK (EXISTS (SELECT 1 FROM app_users au WHERE au.id = auth.uid() AND au.active));
DROP POLICY IF EXISTS "payments_delete" ON payments;
CREATE POLICY "payments_delete" ON payments FOR DELETE
  TO authenticated USING (EXISTS (SELECT 1 FROM app_users au WHERE au.id = auth.uid() AND au.active));

-- ============ EXPENSES ============
CREATE TABLE IF NOT EXISTS expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL CHECK (category IN ('rent','electricity','salary','tea','transport','other')),
  amount numeric(12,2) NOT NULL DEFAULT 0,
  note text DEFAULT '',
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  created_by uuid REFERENCES app_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "expenses_select" ON expenses;
CREATE POLICY "expenses_select" ON expenses FOR SELECT
  TO authenticated USING (EXISTS (SELECT 1 FROM app_users au WHERE au.id = auth.uid() AND au.active));
DROP POLICY IF EXISTS "expenses_insert" ON expenses;
CREATE POLICY "expenses_insert" ON expenses FOR INSERT
  TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM app_users au WHERE au.id = auth.uid() AND au.active));
DROP POLICY IF EXISTS "expenses_update" ON expenses;
CREATE POLICY "expenses_update" ON expenses FOR UPDATE
  TO authenticated USING (EXISTS (SELECT 1 FROM app_users au WHERE au.id = auth.uid() AND au.active))
  WITH CHECK (EXISTS (SELECT 1 FROM app_users au WHERE au.id = auth.uid() AND au.active));
DROP POLICY IF EXISTS "expenses_delete" ON expenses;
CREATE POLICY "expenses_delete" ON expenses FOR DELETE
  TO authenticated USING (EXISTS (SELECT 1 FROM app_users au WHERE au.id = auth.uid() AND au.active));

-- ============ CASHBOOK ENTRIES ============
CREATE TABLE IF NOT EXISTS cashbook_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  type text NOT NULL CHECK (type IN ('cash_sale','installment_collection','expense','advance')),
  direction text NOT NULL CHECK (direction IN ('in','out')),
  amount numeric(12,2) NOT NULL DEFAULT 0,
  reference text DEFAULT '',
  reference_id uuid,
  note text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE cashbook_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cashbook_select" ON cashbook_entries;
CREATE POLICY "cashbook_select" ON cashbook_entries FOR SELECT
  TO authenticated USING (EXISTS (SELECT 1 FROM app_users au WHERE au.id = auth.uid() AND au.active));
DROP POLICY IF EXISTS "cashbook_insert" ON cashbook_entries;
CREATE POLICY "cashbook_insert" ON cashbook_entries FOR INSERT
  TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM app_users au WHERE au.id = auth.uid() AND au.active));
DROP POLICY IF EXISTS "cashbook_update" ON cashbook_entries;
CREATE POLICY "cashbook_update" ON cashbook_entries FOR UPDATE
  TO authenticated USING (EXISTS (SELECT 1 FROM app_users au WHERE au.id = auth.uid() AND au.active))
  WITH CHECK (EXISTS (SELECT 1 FROM app_users au WHERE au.id = auth.uid() AND au.active));
DROP POLICY IF EXISTS "cashbook_delete" ON cashbook_entries;
CREATE POLICY "cashbook_delete" ON cashbook_entries FOR DELETE
  TO authenticated USING (EXISTS (SELECT 1 FROM app_users au WHERE au.id = auth.uid() AND au.active));

-- ============ INDEXES ============
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_product_serials_product ON product_serials(product_id);
CREATE INDEX IF NOT EXISTS idx_product_serials_status ON product_serials(status);
CREATE INDEX IF NOT EXISTS idx_purchases_product ON purchases(product_id);
CREATE INDEX IF NOT EXISTS idx_purchases_supplier ON purchases(supplier_id);
CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_type ON sales(sale_type);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_installment_schedule_sale ON installment_schedule(sale_id);
CREATE INDEX IF NOT EXISTS idx_installment_schedule_status ON installment_schedule(status);
CREATE INDEX IF NOT EXISTS idx_installment_schedule_due ON installment_schedule(due_date);
CREATE INDEX IF NOT EXISTS idx_payments_sale ON payments(sale_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_cashbook_date ON cashbook_entries(entry_date);

-- ============ UPDATED_AT TRIGGER ============
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS products_updated_at ON products;
CREATE TRIGGER products_updated_at BEFORE UPDATE ON products
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============ INVOICE NUMBER SEQUENCE ============
CREATE SEQUENCE IF NOT EXISTS invoice_seq START 1;

-- ============ BOOTSTRAP SETTINGS ROW ============
INSERT INTO settings (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;
