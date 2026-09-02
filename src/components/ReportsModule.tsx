import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { Sale, SaleItem, Payment, Expense, Product } from '@/lib/types';
import { formatCurrency, formatDate, cn } from '@/lib/format';
import { Card, Select, Input, Badge, EmptyState, Button } from '@/components/ui';
import { exportToCSV } from '@/lib/print';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Wallet,
  Package,
  Loader2,
  Download,
  AlertTriangle,
  Receipt,
} from 'lucide-react';

type Period = 'daily' | 'weekly' | 'monthly' | 'yearly';

export function ReportsModule() {
  const { isAdmin } = useAuth();
  const [period, setPeriod] = useState<Period>('monthly');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sales, setSales] = useState<Sale[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    let from = dateFrom;
    let to = dateTo;
    if (!from || !to) {
      const now = new Date();
      if (period === 'daily') {
        from = now.toISOString().slice(0, 10);
        to = from;
      } else if (period === 'weekly') {
        const start = new Date(now);
        start.setDate(start.getDate() - 7);
        from = start.toISOString().slice(0, 10);
        to = now.toISOString().slice(0, 10);
      } else if (period === 'monthly') {
        from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
        to = now.toISOString().slice(0, 10);
      } else {
        from = `${now.getFullYear()}-01-01`;
        to = now.toISOString().slice(0, 10);
      }
      setDateFrom(from);
      setDateTo(to);
    }

    const [salesRes, payRes, expRes] = await Promise.all([
      supabase
        .from('sales')
        .select('*, sale_items:sale_items(*, product:products(*)), customer:customers(*)')
        .gte('sale_date', `${from}T00:00:00`)
        .lte('sale_date', `${to}T23:59:59`)
        .order('sale_date', { ascending: false }),
      supabase
        .from('payments')
        .select('*')
        .gte('payment_date', `${from}T00:00:00`)
        .lte('payment_date', `${to}T23:59:59`)
        .order('payment_date', { ascending: false }),
      supabase
        .from('expenses')
        .select('*')
        .gte('expense_date', from)
        .lte('expense_date', to)
        .order('expense_date', { ascending: false }),
    ]);
    setSales((salesRes.data as Sale[]) ?? []);
    setPayments((payRes.data as Payment[]) ?? []);
    setExpenses((expRes.data as Expense[]) ?? []);
    setLoading(false);
  }, [dateFrom, dateTo, period]);

  useEffect(() => {
    load();
  }, [load]);

  const metrics = useMemo(() => {
    const totalSalesRevenue = sales.reduce((s, sale) => s + sale.total, 0);
    const totalCost = sales.reduce((s, sale) => {
      const items = sale.sale_items ?? [];
      return s + items.reduce((cs, it) => cs + it.unit_cost * it.quantity, 0);
    }, 0);
    const grossProfit = totalSalesRevenue - totalCost;
    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
    const netProfit = grossProfit - totalExpenses;
    const totalCollections = payments.reduce((s, p) => s + p.amount + p.late_fee, 0);
    const totalAdvance = payments
      .filter((p) => p.payment_type === 'advance')
      .reduce((s, p) => s + p.amount, 0);
    const totalInstallmentCollected = payments
      .filter((p) => p.payment_type === 'installment')
      .reduce((s, p) => s + p.amount, 0);
    const totalCashSales = payments
      .filter((p) => p.payment_type === 'cash_sale')
      .reduce((s, p) => s + p.amount, 0);
    const totalReceivable = sales
      .filter((s) => s.sale_type === 'installment' && s.status !== 'closed')
      .reduce((s, sale) => s + sale.remaining_balance, 0);
    const cashSalesCount = sales.filter((s) => s.sale_type === 'cash').length;
    const installmentSalesCount = sales.filter((s) => s.sale_type === 'installment').length;

    return {
      totalSalesRevenue,
      totalCost,
      grossProfit,
      totalExpenses,
      netProfit,
      totalCollections,
      totalAdvance,
      totalInstallmentCollected,
      totalCashSales,
      totalReceivable,
      cashSalesCount,
      installmentSalesCount,
    };
  }, [sales, payments, expenses]);

  const handleExportSales = () => {
    exportToCSV(`sales_${dateFrom}_${dateTo}.csv`, sales.map((s) => ({
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
    })));
  };

  const handleExportPayments = () => {
    exportToCSV(`payments_${dateFrom}_${dateTo}.csv`, payments.map((p) => ({
      Date: formatDate(p.payment_date),
      Receipt: p.receipt_no ?? '',
      Type: p.payment_type,
      Amount: p.amount,
      LateFee: p.late_fee,
      Method: p.method,
    })));
  };

  const handleExportExpenses = () => {
    exportToCSV(`expenses_${dateFrom}_${dateTo}.csv`, expenses.map((e) => ({
      Date: formatDate(e.expense_date),
      Category: e.category,
      Amount: e.amount,
      Note: e.note,
    })));
  };

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
        <Select label="Period" value={period} onChange={(e) => setPeriod(e.target.value as Period)} className="w-auto">
          <option value="daily">Today</option>
          <option value="weekly">Last 7 Days</option>
          <option value="monthly">This Month</option>
          <option value="yearly">This Year</option>
        </Select>
        <Input label="From" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-auto" />
        <Input label="To" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-auto" />
        <Button variant="outline" onClick={load}><Download size={16} /> Refresh</Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-teal-500" size={28} />
        </div>
      ) : (
        <>
          {/* P&L Summary */}
          <div>
            <h2 className="text-sm font-bold text-slate-700 mb-3">Profit & Loss Statement</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <MetricCard icon={<TrendingUp size={18} />} label="Sales Revenue" value={metrics.totalSalesRevenue} color="teal" />
              <MetricCard icon={<Package size={18} />} label="Cost of Goods" value={metrics.totalCost} color="slate" />
              <MetricCard icon={<BarChart3 size={18} />} label="Gross Profit" value={metrics.grossProfit} color={metrics.grossProfit >= 0 ? 'green' : 'red'} />
              <MetricCard icon={<TrendingDown size={18} />} label="Shop Expenses" value={metrics.totalExpenses} color="red" />
              <MetricCard icon={<Wallet size={18} />} label="Net Profit" value={metrics.netProfit} color={metrics.netProfit >= 0 ? 'green' : 'red'} highlight />
              <MetricCard icon={<Receipt size={18} />} label="Total Collected" value={metrics.totalCollections} color="teal" />
              <MetricCard icon={<Wallet size={18} />} label="Receivables (Pending)" value={metrics.totalReceivable} color="amber" />
              <MetricCard icon={<BarChart3 size={18} />} label="Total Sales Count" value={sales.length} color="blue" raw />
            </div>
          </div>

          {/* Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <Card className="p-4">
              <p className="text-xs font-semibold text-slate-500 mb-2">Income Breakdown</p>
              <div className="space-y-2 text-sm">
                <Row label="Cash Sales" value={metrics.totalCashSales} />
                <Row label="Advance Payments" value={metrics.totalAdvance} />
                <Row label="Installment Collections" value={metrics.totalInstallmentCollected} />
                <div className="border-t pt-2">
                  <Row label="Total Income" value={metrics.totalCollections} bold />
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <p className="text-xs font-semibold text-slate-500 mb-2">Sales Breakdown</p>
              <div className="space-y-2 text-sm">
                <Row label="Cash Sales" value={metrics.cashSalesCount} raw />
                <Row label="Installment Sales" value={metrics.installmentSalesCount} raw />
                <div className="border-t pt-2">
                  <Row label="Total Sales" value={sales.length} raw bold />
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <p className="text-xs font-semibold text-slate-500 mb-2">Profit Summary</p>
              <div className="space-y-2 text-sm">
                <Row label="Revenue" value={metrics.totalSalesRevenue} />
                <Row label="Cost of Goods" value={-metrics.totalCost} />
                <Row label="Gross Profit" value={metrics.grossProfit} bold />
                <Row label="Expenses" value={-metrics.totalExpenses} />
                <div className="border-t pt-2">
                  <Row label="Net Profit" value={metrics.netProfit} bold color={metrics.netProfit >= 0 ? 'green' : 'red'} />
                </div>
              </div>
            </Card>
          </div>

          {/* Export buttons */}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleExportSales}><Download size={16} /> Export Sales</Button>
            <Button variant="outline" onClick={handleExportPayments}><Download size={16} /> Export Payments</Button>
            <Button variant="outline" onClick={handleExportExpenses}><Download size={16} /> Export Expenses</Button>
          </div>

          {/* Sales table */}
          <Card className="overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200">
              <h2 className="font-bold text-slate-800">Sales Records ({sales.length})</h2>
            </div>
            {sales.length === 0 ? (
              <EmptyState title="No sales in this period" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                    <tr>
                      <th className="text-left px-4 py-3 font-semibold">Invoice</th>
                      <th className="text-left px-4 py-3 font-semibold">Date</th>
                      <th className="text-left px-4 py-3 font-semibold">Customer</th>
                      <th className="text-center px-4 py-3 font-semibold">Type</th>
                      <th className="text-right px-4 py-3 font-semibold">Total</th>
                      <th className="text-right px-4 py-3 font-semibold">Balance</th>
                      <th className="text-center px-4 py-3 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sales.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50/70">
                        <td className="px-4 py-3 font-mono font-semibold text-slate-700">{s.invoice_no}</td>
                        <td className="px-4 py-3 text-slate-500">{formatDate(s.sale_date)}</td>
                        <td className="px-4 py-3 text-slate-600">{s.customer?.full_name ?? 'Walk-in'}</td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant={s.sale_type === 'cash' ? 'teal' : 'amber'}>{s.sale_type}</Badge>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold">{formatCurrency(s.total)}</td>
                        <td className="px-4 py-3 text-right text-amber-600">
                          {s.remaining_balance > 0 ? formatCurrency(s.remaining_balance) : '-'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant={s.status === 'completed' ? 'green' : s.status === 'ongoing' ? 'blue' : s.status === 'closed' ? 'slate' : 'red'}>
                            {s.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  color,
  highlight,
  raw,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: 'teal' | 'green' | 'red' | 'amber' | 'slate' | 'blue';
  highlight?: boolean;
  raw?: boolean;
}) {
  const colors = {
    teal: 'text-teal-600 bg-teal-50',
    green: 'text-emerald-600 bg-emerald-50',
    red: 'text-red-600 bg-red-50',
    amber: 'text-amber-600 bg-amber-50',
    slate: 'text-slate-600 bg-slate-50',
    blue: 'text-blue-600 bg-blue-50',
  };
  return (
    <Card className={cn('p-4', highlight && 'ring-2 ring-teal-500/20')}>
      <div className="flex items-center gap-2 mb-2">
        <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', colors[color])}>{icon}</div>
        <p className="text-xs font-semibold text-slate-500">{label}</p>
      </div>
      <p className={cn('text-xl font-bold', highlight && color === 'green' ? 'text-emerald-700' : color === 'red' ? 'text-red-700' : 'text-slate-800')}>
        {raw ? value : formatCurrency(value)}
      </p>
    </Card>
  );
}

function Row({
  label,
  value,
  bold,
  raw,
  color,
}: {
  label: string;
  value: number;
  bold?: boolean;
  raw?: boolean;
  color?: 'green' | 'red';
}) {
  return (
    <div className="flex justify-between">
      <span className={cn('text-slate-500', bold && 'font-bold text-slate-700')}>{label}</span>
      <span
        className={cn(
          bold && 'font-bold',
          color === 'green' && 'text-emerald-600',
          color === 'red' && 'text-red-600',
          !color && value < 0 && 'text-red-500',
          !color && value >= 0 && 'text-slate-700'
        )}
      >
        {raw ? value : formatCurrency(Math.abs(value))}
        {!raw && value < 0 ? '-' : ''}
      </span>
    </div>
  );
}
