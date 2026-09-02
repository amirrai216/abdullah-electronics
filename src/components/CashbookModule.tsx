import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { CashbookEntry, Expense, ExpenseCategory } from '@/lib/types';
import { formatCurrency, formatDate, cn, todayISO } from '@/lib/format';
import { Modal, Button, Input, Select, Textarea, Badge, Card, EmptyState, ConfirmDialog } from '@/components/ui';
import {
  Wallet,
  Plus,
  Trash2,
  Loader2,
  ArrowDownCircle,
  ArrowUpCircle,
  Receipt,
  TrendingUp,
  TrendingDown,
  Calendar,
} from 'lucide-react';

const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: 'rent', label: 'Rent' },
  { value: 'electricity', label: 'Electricity Bill' },
  { value: 'salary', label: 'Staff Salary' },
  { value: 'tea', label: 'Tea / Refreshments' },
  { value: 'transport', label: 'Transportation' },
  { value: 'other', label: 'Other' },
];

export function CashbookModule() {
  const { user, isAdmin } = useAuth();
  const [entries, setEntries] = useState<CashbookEntry[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState(todayISO());
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [deleteExpenseId, setDeleteExpenseId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [cashRes, expRes] = await Promise.all([
      supabase.from('cashbook_entries').select('*').order('entry_date', { ascending: false }),
      supabase
        .from('expenses')
        .select('*, created_by_user:app_users(*)')
        .order('expense_date', { ascending: false }),
    ]);
    setEntries((cashRes.data as CashbookEntry[]) ?? []);
    setExpenses((expRes.data as Expense[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const dayEntries = entries.filter((e) => e.entry_date === dateFilter);
  const dayExpenses = expenses.filter((e) => e.expense_date === dateFilter);

  const cashSalesIn = dayEntries
    .filter((e) => e.type === 'cash_sale' && e.direction === 'in')
    .reduce((s, e) => s + e.amount, 0);
  const installmentIn = dayEntries
    .filter((e) => e.type === 'installment_collection' && e.direction === 'in')
    .reduce((s, e) => s + e.amount, 0);
  const advanceIn = dayEntries
    .filter((e) => e.type === 'advance' && e.direction === 'in')
    .reduce((s, e) => s + e.amount, 0);
  const expensesOut = dayExpenses.reduce((s, e) => s + e.amount, 0);
  const totalIn = cashSalesIn + installmentIn + advanceIn;
  const netCash = totalIn - expensesOut;

  const typeLabel = (t: string) => {
    const map: Record<string, string> = {
      cash_sale: 'Cash Sale',
      installment_collection: 'Installment Collection',
      advance: 'Advance Payment',
      expense: 'Expense',
    };
    return map[t] ?? t;
  };

  return (
    <div className="space-y-5">
      {/* Date selector */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
        <div className="flex items-center gap-3">
          <Calendar size={18} className="text-slate-400" />
          <Input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="w-auto"
          />
        </div>
        {isAdmin && (
          <Button onClick={() => setExpenseModalOpen(true)}>
            <Plus size={16} /> Add Expense
          </Button>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-emerald-600 mb-1">
            <TrendingUp size={16} />
            <p className="text-xs font-semibold">Cash Sales</p>
          </div>
          <p className="text-xl font-bold text-slate-800">{formatCurrency(cashSalesIn)}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-teal-600 mb-1">
            <Wallet size={16} />
            <p className="text-xs font-semibold">Installments</p>
          </div>
          <p className="text-xl font-bold text-slate-800">{formatCurrency(installmentIn + advanceIn)}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-red-500 mb-1">
            <TrendingDown size={16} />
            <p className="text-xs font-semibold">Expenses</p>
          </div>
          <p className="text-xl font-bold text-slate-800">{formatCurrency(expensesOut)}</p>
        </Card>
        <Card className={cn('p-4', netCash >= 0 ? 'bg-emerald-50' : 'bg-red-50')}>
          <div className="flex items-center gap-2 text-slate-600 mb-1">
            <Receipt size={16} />
            <p className="text-xs font-semibold">Ending Cash Balance</p>
          </div>
          <p className={cn('text-xl font-bold', netCash >= 0 ? 'text-emerald-700' : 'text-red-700')}>
            {formatCurrency(netCash)}
          </p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Cash collections */}
        <Card className="overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200">
            <h2 className="font-bold text-slate-800 flex items-center gap-2">
              <ArrowDownCircle size={18} className="text-emerald-500" /> Cash Collections
            </h2>
          </div>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="animate-spin text-teal-500" size={24} />
            </div>
          ) : dayEntries.length === 0 ? (
            <EmptyState title="No collections today" description="Cash from sales and installments will appear here." />
          ) : (
            <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
              {dayEntries.map((e) => (
                <div key={e.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-700">{typeLabel(e.type)}</p>
                    <p className="text-xs text-slate-400">
                      {e.reference ? `Ref: ${e.reference}` : formatDate(e.entry_date)}
                    </p>
                  </div>
                  <span className="font-bold text-emerald-600">+{formatCurrency(e.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Expenses */}
        <Card className="overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200">
            <h2 className="font-bold text-slate-800 flex items-center gap-2">
              <ArrowUpCircle size={18} className="text-red-500" /> Shop Expenses
            </h2>
          </div>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="animate-spin text-teal-500" size={24} />
            </div>
          ) : dayExpenses.length === 0 ? (
            <EmptyState title="No expenses today" description="Add shop expenses like rent, bills, and salaries." />
          ) : (
            <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
              {dayExpenses.map((e) => (
                <div key={e.id} className="flex items-center justify-between px-5 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="red" className="capitalize">{e.category}</Badge>
                      {e.note && <span className="text-xs text-slate-400 truncate">{e.note}</span>}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {formatDate(e.expense_date)}
                      {e.created_by_user?.full_name ? ` · ${e.created_by_user.full_name}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-red-500">-{formatCurrency(e.amount)}</span>
                    {isAdmin && (
                      <button
                        onClick={() => setDeleteExpenseId(e.id)}
                        className="p-1 rounded-lg text-slate-300 hover:text-red-500"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <ExpenseModal
        open={expenseModalOpen}
        onClose={() => setExpenseModalOpen(false)}
        userId={user?.id ?? null}
        onSaved={load}
      />
      <ConfirmDialog
        open={!!deleteExpenseId}
        onClose={() => setDeleteExpenseId(null)}
        onConfirm={async () => {
          if (!deleteExpenseId) return;
          await supabase.from('expenses').delete().eq('id', deleteExpenseId);
          load();
        }}
        title="Delete Expense"
        message="Are you sure you want to delete this expense entry?"
        confirmLabel="Delete"
      />
    </div>
  );
}

function ExpenseModal({
  open,
  onClose,
  userId,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  userId: string | null;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    category: 'rent' as ExpenseCategory,
    amount: '',
    note: '',
    expense_date: todayISO(),
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm({ category: 'rent', amount: '', note: '', expense_date: todayISO() });
      setError(null);
    }
  }, [open]);

  const handleSubmit = async () => {
    const amt = parseFloat(form.amount) || 0;
    if (amt <= 0) {
      setError('Enter a valid amount.');
      return;
    }
    setBusy(true);
    setError(null);
    const { error } = await supabase.from('expenses').insert({
      category: form.category,
      amount: amt,
      note: form.note.trim(),
      expense_date: form.expense_date,
      created_by: userId,
    });
    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }
    // also create cashbook entry
    await supabase.from('cashbook_entries').insert({
      entry_date: form.expense_date,
      type: 'expense',
      direction: 'out',
      amount: amt,
      reference: form.category,
    });
    setBusy(false);
    onSaved();
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add Shop Expense"
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" size={16} /> : null}
            Save Expense
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Select label="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as ExpenseCategory })}>
          {EXPENSE_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </Select>
        <Input
          label="Amount"
          type="number"
          value={form.amount}
          onChange={(e) => setForm({ ...form, amount: e.target.value })}
        />
        <Input
          label="Date"
          type="date"
          value={form.expense_date}
          onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
        />
        <Textarea label="Note" rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
      </div>
      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
          {error}
        </div>
      )}
    </Modal>
  );
}
