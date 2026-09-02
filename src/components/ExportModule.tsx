import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { exportToCSV } from '@/lib/print';
import { Card, Button, Select, Badge, EmptyState } from '@/components/ui';
import { formatCurrency, formatDate } from '@/lib/format';
import type { Customer, Product, Sale, Payment } from '@/lib/types';
import {
  Download,
  FileSpreadsheet,
  Users,
  Package,
  ShoppingCart,
  Wallet,
  Loader2,
  CheckCircle2,
} from 'lucide-react';

export function ExportModule() {
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [counts, setCounts] = useState({ customers: 0, products: 0, sales: 0, payments: 0 });

  const loadCounts = useCallback(async () => {
    setLoading(true);
    const [c, p, s, pay] = await Promise.all([
      supabase.from('customers').select('*', { count: 'exact', head: true }),
      supabase.from('products').select('*', { count: 'exact', head: true }),
      supabase.from('sales').select('*', { count: 'exact', head: true }),
      supabase.from('payments').select('*', { count: 'exact', head: true }),
    ]);
    setCounts({
      customers: c.count ?? 0,
      products: p.count ?? 0,
      sales: s.count ?? 0,
      payments: pay.count ?? 0,
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    loadCounts();
  }, [loadCounts]);

  const exportCustomers = async () => {
    setBusy('customers');
    const { data } = await supabase.from('customers').select('*').order('full_name');
    const rows = (data as Customer[]) ?? [];
    exportToCSV('customers.csv', rows.map((c) => ({
      Name: c.full_name,
      CNIC: c.cnic,
      Mobile: c.mobile,
      Address: c.address,
      Guarantor: c.guarantor_name,
      GuarantorCNIC: c.guarantor_cnic,
      GuarantorPhone: c.guarantor_phone,
      Relation: c.guarantor_relation,
      CreatedAt: formatDate(c.created_at),
    })));
    setBusy(null);
  };

  const exportProducts = async () => {
    setBusy('products');
    const { data } = await supabase.from('products').select('*, category:categories(name)').order('name');
    const rows = (data as any[]) ?? [];
    exportToCSV('inventory.csv', rows.map((p) => ({
      Name: p.name,
      BrandModel: p.brand_model,
      Category: p.category?.name ?? '',
      PurchasePrice: p.purchase_price,
      SellingPrice: p.selling_price,
      Quantity: p.quantity,
      MinStock: p.min_stock_level,
      TrackSerials: p.track_serials,
      Unit: p.unit,
    })));
    setBusy(null);
  };

  const exportSales = async () => {
    setBusy('sales');
    const { data } = await supabase.from('sales').select('*, customer:customers(full_name)').order('sale_date', { ascending: false });
    const rows = (data as any[]) ?? [];
    exportToCSV('sales.csv', rows.map((s) => ({
      Invoice: s.invoice_no,
      Date: formatDate(s.sale_date),
      Type: s.sale_type,
      Customer: s.customer?.full_name ?? 'Walk-in',
      Subtotal: s.subtotal,
      Discount: s.discount,
      Total: s.total,
      Advance: s.advance_paid,
      Balance: s.remaining_balance,
      Status: s.status,
      Terms: s.payment_terms,
    })));
    setBusy(null);
  };

  const exportPayments = async () => {
    setBusy('payments');
    const { data } = await supabase
      .from('payments')
      .select('*, sale:sales(invoice_no), customer:customers(full_name)')
      .order('payment_date', { ascending: false });
    const rows = (data as any[]) ?? [];
    exportToCSV('payments.csv', rows.map((p) => ({
      Date: formatDate(p.payment_date),
      Receipt: p.receipt_no ?? '',
      Invoice: p.sale?.invoice_no ?? '',
      Customer: p.customer?.full_name ?? '',
      Type: p.payment_type,
      Amount: p.amount,
      LateFee: p.late_fee,
      Method: p.method,
      Note: p.note,
    })));
    setBusy(null);
  };

  const exports = [
    {
      key: 'customers' as const,
      label: 'Customer Ledgers',
      desc: 'All customer profiles with guarantor details',
      icon: <Users size={24} />,
      count: counts.customers,
      action: exportCustomers,
      color: 'bg-blue-50 text-blue-600',
    },
    {
      key: 'products' as const,
      label: 'Inventory List',
      desc: 'All products with prices and stock levels',
      icon: <Package size={24} />,
      count: counts.products,
      action: exportProducts,
      color: 'bg-teal-50 text-teal-600',
    },
    {
      key: 'sales' as const,
      label: 'Sales Report',
      desc: 'All sales with invoice numbers and totals',
      icon: <ShoppingCart size={24} />,
      count: counts.sales,
      action: exportSales,
      color: 'bg-amber-50 text-amber-600',
    },
    {
      key: 'payments' as const,
      label: 'Payment Log',
      desc: 'All installment and cash payment records',
      icon: <Wallet size={24} />,
      count: counts.payments,
      action: exportPayments,
      color: 'bg-emerald-50 text-emerald-600',
    },
  ];

  return (
    <div className="space-y-5">
      <div className="bg-teal-50 border border-teal-200 rounded-2xl p-5 flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-teal-100 flex items-center justify-center shrink-0">
          <FileSpreadsheet className="text-teal-600" size={24} />
        </div>
        <div>
          <h2 className="font-bold text-teal-800">Data Backup & Export</h2>
          <p className="text-sm text-teal-700 mt-1">
            Export your business data to CSV files that open in Excel, Google Sheets, or any spreadsheet app.
            Use this for backups, accounting, or sharing with your accountant.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-teal-500" size={28} />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {exports.map((e) => (
            <Card key={e.key} className="p-5">
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${e.color}`}>
                  {e.icon}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-slate-800">{e.label}</h3>
                    <Badge variant="slate">{e.count} records</Badge>
                  </div>
                  <p className="text-sm text-slate-500 mb-3">{e.desc}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={e.action}
                    disabled={busy === e.key || e.count === 0}
                  >
                    {busy === e.key ? (
                      <Loader2 className="animate-spin" size={14} />
                    ) : e.count === 0 ? (
                      <CheckCircle2 size={14} />
                    ) : (
                      <Download size={14} />
                    )}
                    {e.count === 0 ? 'No Data' : 'Export CSV'}
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
