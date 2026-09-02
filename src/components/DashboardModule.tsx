import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Sale, Product, Payment, InstallmentScheduleEntry, SaleItem } from '@/lib/types';
import { formatCurrency, cn, todayISO, formatDate } from '@/lib/format';
import { computeScheduleStatus, nextReceiptNumber } from '@/lib/billing';
import { Card, Badge, Button, EmptyState } from '@/components/ui';
import { UnifiedSaleModal } from '@/components/UnifiedSaleModal';
import {
  TrendingUp,
  Wallet,
  Package,
  Users,
  AlertTriangle,
  ShoppingCart,
  ArrowRight,
  Clock,
  XCircle,
  Plus,
  Receipt,
  Activity,
  CheckCircle2,
} from 'lucide-react';
import type { NavKey } from '@/components/Layout';

interface DashboardProps {
  onNavigate: (k: NavKey) => void;
}

export function DashboardModule({ onNavigate }: DashboardProps) {
  const [loading, setLoading] = useState(true);
  const [todaySales, setTodaySales] = useState<Sale[]>([]);
  const [todayPayments, setTodayPayments] = useState<Payment[]>([]);
  const [lowStock, setLowStock] = useState<Product[]>([]);
  const [totalProducts, setTotalProducts] = useState(0);
  const [totalCustomers, setTotalCustomers] = useState(0);
  const [dueSched, setDueSched] = useState<InstallmentScheduleEntry[]>([]);
  const [recentSales, setRecentSales] = useState<Sale[]>([]);
  const [saleModalOpen, setSaleModalOpen] = useState(false);
  const [payTarget, setPayTarget] = useState<InstallmentScheduleEntry | null>(null);
  const [payBusy, setPayBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const today = todayISO();
    const [salesRes, payRes, prodRes, custRes, schedRes, recentRes] = await Promise.all([
      supabase
        .from('sales')
        .select('*, customer:customers(*), sale_items:sale_items(*, product:products(*))')
        .gte('sale_date', `${today}T00:00:00`)
        .lte('sale_date', `${today}T23:59:59`),
      supabase.from('payments').select('*').gte('payment_date', `${today}T00:00:00`).lte('payment_date', `${today}T23:59:59`),
      supabase.from('products').select('*'),
      supabase.from('customers').select('*', { count: 'exact', head: true }),
      supabase
        .from('installment_schedule')
        .select('*, sale:sales(*, customer:customers(*), installment_plans:installment_plans(*))')
        .in('status', ['pending', 'late', 'overdue']),
      supabase.from('sales').select('*, customer:customers(*)').order('sale_date', { ascending: false }).limit(5),
    ]);
    setTodaySales((salesRes.data as Sale[]) ?? []);
    setTodayPayments((payRes.data as Payment[]) ?? []);
    setTotalProducts(prodRes.data?.length ?? 0);
    setTotalCustomers(custRes.count ?? 0);
    setDueSched((schedRes.data as InstallmentScheduleEntry[]) ?? []);
    setRecentSales((recentRes.data as Sale[]) ?? []);
    const prods = (prodRes.data as Product[]) ?? [];
    setLowStock(prods.filter((p) => p.quantity <= p.min_stock_level));
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Dynamic profit calculation: SUM of (selling_price - purchase_cost) * qty for all items sold today
  const todayProfit = todaySales.reduce((sum, sale) => {
    const items = sale.sale_items ?? [];
    return sum + items.reduce((s, it: SaleItem) => s + (it.unit_price - it.unit_cost) * it.quantity, 0);
  }, 0);

  const todayRevenue = todaySales.reduce((s, sale) => s + sale.total, 0);
  const todayTxnCount = todaySales.length;

  // Due today or overdue
  const dueToday = dueSched.filter((e) => {
    const status = computeScheduleStatus(e);
    return status === 'late' || status === 'overdue' || e.due_date === todayISO();
  });

  const handleQuickPayment = async (entry: InstallmentScheduleEntry) => {
    setPayBusy(true);
    const receiptNo = await nextReceiptNumber();
    const amt = Number(entry.amount) - Number(entry.paid_amount);

    const { data: payData } = await supabase
      .from('payments')
      .insert({
        sale_id: entry.sale_id,
        schedule_id: entry.id,
        customer_id: (entry as any).sale?.customer_id ?? null,
        amount: amt,
        late_fee: 0,
        payment_type: 'installment',
        method: 'cash',
        receipt_no: receiptNo,
        received_by: null,
        payment_date: new Date().toISOString(),
      })
      .select('*')
      .single();

    // update schedule
    const newPaid = Number(entry.paid_amount) + amt;
    const isFullyPaid = newPaid >= Number(entry.amount);
    await supabase
      .from('installment_schedule')
      .update({
        paid_amount: newPaid,
        status: isFullyPaid ? 'paid' : entry.status,
        paid_date: isFullyPaid ? todayISO() : entry.paid_date,
      })
      .eq('id', entry.id);

    // update sale remaining balance
    const { data: saleData } = await supabase.from('sales').select('*').eq('id', entry.sale_id).maybeSingle();
    if (saleData) {
      const sale = saleData as Sale;
      const newBalance = Math.max(0, Number(sale.remaining_balance) - amt);
      await supabase
        .from('sales')
        .update({ remaining_balance: newBalance, status: newBalance <= 0 ? 'closed' : sale.status })
        .eq('id', sale.id);
    }

    // cashbook
    await supabase.from('cashbook_entries').insert({
      entry_date: todayISO(),
      type: 'installment_collection',
      direction: 'in',
      amount: amt,
      reference: receiptNo,
      reference_id: entry.sale_id,
    });

    void payData;
    setPayBusy(false);
    setPayTarget(null);
    load();
  };

  return (
    <div className="space-y-5">
      {/* Primary Quick Action */}
      <Button
        size="lg"
        fullWidth
        onClick={() => setSaleModalOpen(true)}
        className="text-base"
      >
        <Plus size={20} /> Add New Customer & Sale
      </Button>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-teal-500 border-t-transparent" />
        </div>
      ) : (
        <>
          {/* Stats Overview */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <MetricCard
              icon={<TrendingUp size={20} />}
              label="Today's Sales"
              value={formatCurrency(todayRevenue)}
              color="teal"
              onClick={() => onNavigate('pos')}
            />
            <MetricCard
              icon={<Wallet size={20} />}
              label="Today's Profit"
              value={formatCurrency(todayProfit)}
              color="green"
              onClick={() => onNavigate('reports')}
            />
            <MetricCard
              icon={<Activity size={20} />}
              label="Today's Transactions"
              value={String(todayTxnCount)}
              color="blue"
              onClick={() => onNavigate('pos')}
            />
            <MetricCard
              icon={<Users size={20} />}
              label="Total Customers"
              value={String(totalCustomers)}
              color="amber"
              onClick={() => onNavigate('customers')}
            />
            <MetricCard
              icon={<Package size={20} />}
              label="Total Stock Items"
              value={String(totalProducts)}
              color="slate"
              onClick={() => onNavigate('inventory')}
            />
          </div>

          {/* Installment Due / Overdue Alerts */}
          <Card className="overflow-hidden border-red-200">
            <div className="px-5 py-4 border-b border-red-100 bg-red-50/50 flex items-center justify-between">
              <h2 className="font-bold text-red-800 flex items-center gap-2">
                <XCircle size={18} /> Installment Due / Overdue Alerts
              </h2>
              <Button variant="ghost" size="sm" onClick={() => onNavigate('customers')}>
                View All <ArrowRight size={14} />
              </Button>
            </div>
            {dueToday.length === 0 ? (
              <EmptyState icon={<CheckCircle2 size={40} />} title="All Clear" description="No installments due today or overdue." />
            ) : (
              <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                {dueToday.slice(0, 15).map((e) => {
                  const status = computeScheduleStatus(e);
                  const custName = (e as any).sale?.customer?.full_name ?? 'Customer';
                  const custMobile = (e as any).sale?.customer?.mobile ?? '';
                  return (
                    <div key={e.id} className="flex items-center justify-between px-5 py-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-700">{custName}</p>
                        <p className="text-xs text-slate-400">
                          {custMobile && `${custMobile} · `}
                          Qist #{e.installment_no} · Due {formatDate(e.due_date)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800 text-sm">
                          {formatCurrency(Number(e.amount) - Number(e.paid_amount))}
                        </span>
                        {status === 'overdue' ? (
                          <Badge variant="red">Overdue</Badge>
                        ) : status === 'late' ? (
                          <Badge variant="amber">Late</Badge>
                        ) : (
                          <Badge variant="blue">Due Today</Badge>
                        )}
                        <Button
                          size="sm"
                          variant="success"
                          disabled={payBusy && payTarget?.id === e.id}
                          onClick={() => {
                            setPayTarget(e);
                            handleQuickPayment(e);
                          }}
                        >
                          {payBusy && payTarget?.id === e.id ? (
                            <span className="animate-spin h-3 w-3 border-2 border-white border-t-transparent rounded-full" />
                          ) : (
                            <Wallet size={12} />
                          )}
                          Receive Payment
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Recent sales */}
            <Card className="overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                <h2 className="font-bold text-slate-800 flex items-center gap-2">
                  <ShoppingCart size={18} /> Recent Sales
                </h2>
                <Button variant="ghost" size="sm" onClick={() => onNavigate('pos')}>
                  New Sale <ArrowRight size={14} />
                </Button>
              </div>
              {recentSales.length === 0 ? (
                <EmptyState title="No sales yet" description="Process your first sale from the POS." />
              ) : (
                <div className="divide-y divide-slate-100">
                  {recentSales.map((s) => (
                    <div key={s.id} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50/70">
                      <div>
                        <p className="font-mono font-semibold text-sm text-slate-700">{s.invoice_no}</p>
                        <p className="text-xs text-slate-400">
                          {formatDate(s.sale_date)} · {s.customer?.full_name ?? 'Walk-in'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={s.sale_type === 'cash' ? 'teal' : 'amber'}>{s.sale_type}</Badge>
                        <span className="font-bold text-slate-800 text-sm">{formatCurrency(s.total)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Low Stock Alerts */}
            <Card className="overflow-hidden border-amber-200">
              <div className="px-5 py-4 border-b border-amber-100 bg-amber-50/50 flex items-center gap-2">
                <AlertTriangle size={18} className="text-amber-600" />
                <h2 className="font-bold text-amber-800">Low Stock Alerts ({lowStock.length})</h2>
              </div>
              {lowStock.length === 0 ? (
                <EmptyState icon={<CheckCircle2 size={40} />} title="Stock OK" description="All products are above minimum stock level." />
              ) : (
                <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                  {lowStock.slice(0, 10).map((p) => (
                    <div key={p.id} className="flex items-center justify-between px-5 py-3">
                      <div>
                        <p className="font-semibold text-slate-700 text-sm">{p.name}</p>
                        {p.brand_model && <p className="text-xs text-slate-400">{p.brand_model}</p>}
                      </div>
                      <Badge variant="red">{p.quantity} left (min {p.min_stock_level})</Badge>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </>
      )}

      <UnifiedSaleModal
        open={saleModalOpen}
        onClose={() => setSaleModalOpen(false)}
        onSaved={load}
      />
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  color,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: 'teal' | 'green' | 'red' | 'blue' | 'amber' | 'slate';
  onClick?: () => void;
}) {
  const colors: Record<string, string> = {
    teal: 'bg-teal-50 text-teal-600',
    green: 'bg-emerald-50 text-emerald-600',
    red: 'bg-red-50 text-red-600',
    blue: 'bg-blue-50 text-blue-600',
    amber: 'bg-amber-50 text-amber-600',
    slate: 'bg-slate-100 text-slate-600',
  };
  const textColors: Record<string, string> = {
    teal: 'text-teal-700',
    green: 'text-emerald-700',
    red: 'text-red-700',
    blue: 'text-blue-700',
    amber: 'text-amber-700',
    slate: 'text-slate-700',
  };
  return (
    <Card className={cn('p-4 cursor-pointer hover:shadow-md transition-all')}>
      <button onClick={onClick} className="w-full text-left">
        <div className="flex items-center gap-2 mb-2">
          <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', colors[color])}>{icon}</div>
          <p className="text-xs font-semibold text-slate-500">{label}</p>
        </div>
        <p className={cn('text-xl font-bold', textColors[color])}>{value}</p>
      </button>
    </Card>
  );
}
