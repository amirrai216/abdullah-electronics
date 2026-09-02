ALTER TABLE customers ADD COLUMN IF NOT EXISTS customer_type text DEFAULT 'cash' CHECK (customer_type = ANY (ARRAY['cash'::text, 'installment'::text]));
