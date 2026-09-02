export type UserRole = 'admin' | 'staff';

export interface AppUser {
  id: string;
  full_name: string;
  role: UserRole;
  active: boolean;
  created_at: string;
}

export interface Settings {
  id: number;
  shop_name: string;
  shop_address: string;
  shop_phone: string;
  invoice_footer: string;
  currency: string;
  invoice_counter: number;
}

export interface Category {
  id: string;
  name: string;
  description: string;
  sort_order: number;
  created_at: string;
}

export interface Supplier {
  id: string;
  name: string;
  contact_person: string;
  phone: string;
  address: string;
  note: string;
  created_at: string;
}

export interface Product {
  id: string;
  category_id: string | null;
  name: string;
  brand_model: string;
  purchase_price: number;
  selling_price: number;
  min_stock_level: number;
  quantity: number;
  track_serials: boolean;
  unit: string;
  created_at: string;
  updated_at: string;
  category?: Category | null;
}

export interface ProductSerial {
  id: string;
  product_id: string;
  serial_number: string;
  status: 'in_stock' | 'sold' | 'reserved';
  created_at: string;
  product?: Product | null;
}

export interface Purchase {
  id: string;
  supplier_id: string | null;
  product_id: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  purchase_date: string;
  note: string;
  created_at: string;
  supplier?: Supplier | null;
  product?: Product | null;
}

export type CustomerType = 'cash' | 'installment';

export interface Customer {
  id: string;
  full_name: string;
  cnic: string;
  mobile: string;
  address: string;
  photo_url: string;
  cnic_scan_url: string;
  guarantor_name: string;
  guarantor_cnic: string;
  guarantor_phone: string;
  guarantor_relation: string;
  note: string;
  customer_type: CustomerType;
  created_at: string;
}

export type SaleType = 'cash' | 'installment';
export type SaleStatus = 'completed' | 'ongoing' | 'defaulted' | 'closed';

export interface Sale {
  id: string;
  invoice_no: string;
  sale_type: SaleType;
  customer_id: string | null;
  subtotal: number;
  discount: number;
  total: number;
  advance_paid: number;
  remaining_balance: number;
  status: SaleStatus;
  payment_terms: string;
  sale_date: string;
  created_by: string | null;
  created_at: string;
  customer?: Customer | null;
  created_by_user?: AppUser | null;
  sale_items?: SaleItem[];
  installment_plan?: InstallmentPlan | null;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string;
  serial_id: string | null;
  quantity: number;
  unit_price: number;
  unit_cost: number;
  subtotal: number;
  created_at: string;
  product?: Product | null;
  serial?: ProductSerial | null;
}

export interface InstallmentPlan {
  id: string;
  sale_id: string;
  frequency: 'weekly' | 'monthly';
  duration_months: number;
  installment_amount: number;
  down_payment: number;
  start_date: string;
  created_at: string;
}

export type ScheduleStatus = 'pending' | 'paid' | 'late' | 'overdue';

export interface InstallmentScheduleEntry {
  id: string;
  plan_id: string;
  sale_id: string;
  installment_no: number;
  due_date: string;
  amount: number;
  status: ScheduleStatus;
  paid_amount: number;
  late_fee: number;
  paid_date: string | null;
  created_at: string;
}

export type PaymentType = 'cash_sale' | 'installment' | 'advance';

export interface Payment {
  id: string;
  sale_id: string | null;
  schedule_id: string | null;
  customer_id: string | null;
  amount: number;
  late_fee: number;
  payment_type: PaymentType;
  method: string;
  receipt_no: string | null;
  note: string;
  received_by: string | null;
  payment_date: string;
  created_at: string;
  sale?: Sale | null;
  customer?: Customer | null;
  received_by_user?: AppUser | null;
}

export type ExpenseCategory = 'rent' | 'electricity' | 'salary' | 'tea' | 'transport' | 'other';

export interface Expense {
  id: string;
  category: ExpenseCategory;
  amount: number;
  note: string;
  expense_date: string;
  created_by: string | null;
  created_at: string;
  created_by_user?: AppUser | null;
}

export interface CashbookEntry {
  id: string;
  entry_date: string;
  type: 'cash_sale' | 'installment_collection' | 'expense' | 'advance';
  direction: 'in' | 'out';
  amount: number;
  reference: string;
  reference_id: string | null;
  note: string;
  created_at: string;
}
