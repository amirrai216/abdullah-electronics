import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type {
  Customer,
  Sale,
  InstallmentScheduleEntry,
  Payment,
  SaleItem,
  Settings,
} from '@/lib/types';
import { formatCurrency, formatDate, formatDateTime, cn, todayISO } from '@/lib/format';
import { computeScheduleStatus, nextReceiptNumber } from '@/lib/billing';
import { printPaymentReceipt, printInvoiceA4 } from '@/lib/print';
import { Modal, Button, Input, Select, Textarea, Badge, Card, EmptyState, ConfirmDialog } from '@/components/ui';
import {
  Users,
  Plus,
  Pencil,
  Trash2,
  Search,
  Phone,
  MapPin,
  UserCheck,
  Loader2,
  Wallet,
  Printer,
  Eye,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
} from 'lucide-react';

export function CustomersModule() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'overdue' | 'late' | 'ongoing' | 'paid'>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('customers')
      .select('*, sales:sales(*)')
      .order('created_at', { ascending: false });
    setCustomers((data as Customer[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // For each customer, we need schedule status to color-code
  const [scheduleMap, setScheduleMap] = useState<Record<string, InstallmentScheduleEntry[]>>({});

  useEffect(() => {
    (async () => {
      const map: Record<string, InstallmentScheduleEntry[]> = {};
      const { data } = await supabase
        .from('installment_schedule')
        .select('*, sale:sales(customer_id)')
        .in('status', ['pending', 'late', 'overdue']);
      if (data) {
        for (const entry of data as any[]) {
          const cid = entry.sale?.customer_id;
          if (cid) {
            (map[cid] ??= []).push(entry as InstallmentScheduleEntry);
          }
        }
      }
      setScheduleMap(map);
    })();
  }, [customers]);

  const getCustomerStatus = (c: Customer): 'paid' | 'ongoing' | 'late' | 'overdue' => {
    const entries = scheduleMap[c.id] ?? [];
    if (entries.length === 0) {
      const hasInstallment = (c as any).sales?.some((s: Sale) => s.sale_type === 'installment' && s.status === 'ongoing');
      return hasInstallment ? 'ongoing' : 'paid';
    }
    const hasOverdue = entries.some((e) => computeScheduleStatus(e) === 'overdue');
    if (hasOverdue) return 'overdue';
    const hasLate = entries.some((e) => computeScheduleStatus(e) === 'late');
    if (hasLate) return 'late';
    return 'ongoing';
  };

  const filtered = customers.filter((c) => {
    const q = search.toLowerCase();
    const matches =
      c.full_name.toLowerCase().includes(q) ||
      c.cnic?.toLowerCase().includes(q) ||
      c.mobile?.toLowerCase().includes(q);
    if (!matches) return false;
    if (statusFilter === 'all') return true;
    return getCustomerStatus(c) === statusFilter;
  });

  const statusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge variant="green"><CheckCircle2 size={11} className="mr-1" />Paid Up</Badge>;
      case 'ongoing':
        return <Badge variant="blue"><Clock size={11} className="mr-1" />On Track</Badge>;
      case 'late':
        return <Badge variant="amber"><AlertCircle size={11} className="mr-1" />Late</Badge>;
      case 'overdue':
        return <Badge variant="red"><XCircle size={11} className="mr-1" />Overdue</Badge>;
      default:
        return <Badge variant="slate">-</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <Input
            placeholder="Search by name, CNIC, or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} className="w-auto">
            <option value="all">All Customers</option>
            <option value="overdue">Overdue</option>
            <option value="late">Late</option>
            <option value="ongoing">On Track</option>
            <option value="paid">Paid Up</option>
          </Select>
          <Button
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
          >
            <Plus size={16} /> Add Customer
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="animate-spin text-teal-500" size={28} />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Users size={48} />}
            title="No customers yet"
            description="Add customers to track installment sales and payments."
            action={
              <Button onClick={() => setModalOpen(true)}>
                <Plus size={16} /> Add Customer
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">Name</th>
                  <th className="text-left px-4 py-3 font-semibold">CNIC</th>
                  <th className="text-left px-4 py-3 font-semibold">Mobile</th>
                  <th className="text-left px-4 py-3 font-semibold">Guarantor</th>
                  <th className="text-center px-4 py-3 font-semibold">Status</th>
                  <th className="text-right px-4 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((c) => {
                  const status = getCustomerStatus(c);
                  return (
                    <tr key={c.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3 font-semibold text-slate-800">{c.full_name}</td>
                      <td className="px-4 py-3 text-slate-600 font-mono text-xs">{c.cnic || '-'}</td>
                      <td className="px-4 py-3 text-slate-600">{c.mobile || '-'}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {c.guarantor_name ? (
                          <div>
                            <div>{c.guarantor_name}</div>
                            {c.guarantor_relation && (
                              <div className="text-xs text-slate-400">{c.guarantor_relation}</div>
                            )}
                          </div>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">{statusBadge(status)}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => setDetailId(c.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:bg-teal-50 hover:text-teal-600"
                            title="View Ledger"
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            onClick={() => {
                              setEditing(c);
                              setModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:bg-teal-50 hover:text-teal-600"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            onClick={() => setDeleteId(c.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <CustomerModal open={modalOpen} onClose={() => setModalOpen(false)} editing={editing} onSaved={load} />
      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={async () => {
          if (!deleteId) return;
          await supabase.from('customers').delete().eq('id', deleteId);
          load();
        }}
        title="Delete Customer"
        message="Are you sure? This will remove the customer profile. Sales records will be preserved."
        confirmLabel="Delete"
      />
      {detailId && <CustomerLedger customerId={detailId} onClose={() => setDetailId(null)} />}
    </div>
  );
}

function CustomerModal({
  open,
  onClose,
  editing,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  editing: Customer | null;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    full_name: '',
    cnic: '',
    mobile: '',
    address: '',
    photo_url: '',
    cnic_scan_url: '',
    guarantor_name: '',
    guarantor_cnic: '',
    guarantor_phone: '',
    guarantor_relation: '',
    note: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editing) {
      setForm({
        full_name: editing.full_name,
        cnic: editing.cnic ?? '',
        mobile: editing.mobile ?? '',
        address: editing.address ?? '',
        photo_url: editing.photo_url ?? '',
        cnic_scan_url: editing.cnic_scan_url ?? '',
        guarantor_name: editing.guarantor_name ?? '',
        guarantor_cnic: editing.guarantor_cnic ?? '',
        guarantor_phone: editing.guarantor_phone ?? '',
        guarantor_relation: editing.guarantor_relation ?? '',
        note: editing.note ?? '',
      });
    } else {
      setForm({
        full_name: '',
        cnic: '',
        mobile: '',
        address: '',
        photo_url: '',
        cnic_scan_url: '',
        guarantor_name: '',
        guarantor_cnic: '',
        guarantor_phone: '',
        guarantor_relation: '',
        note: '',
      });
    }
    setError(null);
  }, [editing, open]);

  const handleSubmit = async () => {
    if (!form.full_name.trim()) {
      setError('Full name is required.');
      return;
    }
    setBusy(true);
    setError(null);
    const payload = {
      full_name: form.full_name.trim(),
      cnic: form.cnic.trim(),
      mobile: form.mobile.trim(),
      address: form.address.trim(),
      photo_url: form.photo_url.trim(),
      cnic_scan_url: form.cnic_scan_url.trim(),
      guarantor_name: form.guarantor_name.trim(),
      guarantor_cnic: form.guarantor_cnic.trim(),
      guarantor_phone: form.guarantor_phone.trim(),
      guarantor_relation: form.guarantor_relation.trim(),
      note: form.note.trim(),
    };
    let error;
    if (editing) {
      ({ error } = await supabase.from('customers').update(payload).eq('id', editing.id));
    } else {
      ({ error } = await supabase.from('customers').insert(payload));
    }
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    onSaved();
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit Customer' : 'Add Customer'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" size={16} /> : null}
            {editing ? 'Save Changes' : 'Add Customer'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <p className="text-sm font-semibold text-slate-700 mb-3">Customer Details</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Full Name"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            />
            <Input
              label="CNIC Number"
              value={form.cnic}
              onChange={(e) => setForm({ ...form, cnic: e.target.value })}
              placeholder="XXXXX-XXXXXXX-X"
            />
            <Input
              label="Mobile Number"
              value={form.mobile}
              onChange={(e) => setForm({ ...form, mobile: e.target.value })}
              placeholder="03XX-XXXXXXX"
            />
            <Textarea
              label="Address"
              rows={1}
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
            <Input
              label="Customer Photo URL"
              value={form.photo_url}
              onChange={(e) => setForm({ ...form, photo_url: e.target.value })}
              placeholder="https://..."
              hint="Paste a link to the customer's photo"
            />
            <Input
              label="CNIC Scan URL"
              value={form.cnic_scan_url}
              onChange={(e) => setForm({ ...form, cnic_scan_url: e.target.value })}
              placeholder="https://..."
              hint="Paste a link to the CNIC scan"
            />
          </div>
        </div>

        <div className="border-t border-slate-200 pt-4">
          <p className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <UserCheck size={16} /> Guarantor / Witness Details
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Guarantor Name"
              value={form.guarantor_name}
              onChange={(e) => setForm({ ...form, guarantor_name: e.target.value })}
            />
            <Input
              label="Guarantor CNIC"
              value={form.guarantor_cnic}
              onChange={(e) => setForm({ ...form, guarantor_cnic: e.target.value })}
            />
            <Input
              label="Guarantor Phone"
              value={form.guarantor_phone}
              onChange={(e) => setForm({ ...form, guarantor_phone: e.target.value })}
            />
            <Input
              label="Relation to Customer"
              value={form.guarantor_relation}
              onChange={(e) => setForm({ ...form, guarantor_relation: e.target.value })}
              placeholder="e.g. Brother, Father"
            />
          </div>
        </div>

        <Textarea
          label="Notes"
          rows={2}
          value={form.note}
          onChange={(e) => setForm({ ...form, note: e.target.value })}
        />
      </div>
      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
          {error}
        </div>
      )}
    </Modal>
  );
}

/* ============ CUSTOMER LEDGER DETAIL ============ */

function CustomerLedger({ customerId, onClose }: { customerId: string; onClose: () => void }) {
  const { user } = useAuth();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [schedule, setSchedule] = useState<InstallmentScheduleEntry[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [payTarget, setPayTarget] = useState<InstallmentScheduleEntry | null>(null);
  const [viewSale, setViewSale] = useState<Sale | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: cust }, { data: salesData }, { data: sett }] = await Promise.all([
      supabase.from('customers').select('*').eq('id', customerId).maybeSingle(),
      supabase
        .from('sales')
        .select('*, sale_items:sale_items(*, product:products(*), serial:product_serials(*))')
        .eq('customer_id', customerId)
        .order('sale_date', { ascending: false }),
      supabase.from('settings').select('*').eq('id', 1).maybeSingle(),
    ]);
    setCustomer(cust as Customer | null);
    setSales((salesData as Sale[]) ?? []);
    setSettings(sett as Settings | null);

    const saleIds = (salesData ?? []).map((s) => s.id);
    if (saleIds.length) {
      const [{ data: sched }, { data: pays }] = await Promise.all([
        supabase
          .from('installment_schedule')
          .select('*')
          .in('sale_id', saleIds)
          .order('due_date', { ascending: true }),
        supabase
          .from('payments')
          .select('*')
          .in('sale_id', saleIds)
          .order('payment_date', { ascending: false }),
      ]);
      setSchedule((sched as InstallmentScheduleEntry[]) ?? []);
      setPayments((pays as Payment[]) ?? []);
    } else {
      setSchedule([]);
      setPayments([]);
    }
    setLoading(false);
  }, [customerId]);

  useEffect(() => {
    load();
  }, [load]);

  const totalReceivable = schedule
    .filter((s) => s.status !== 'paid')
    .reduce((sum, s) => sum + (s.amount - s.paid_amount + s.late_fee), 0);

  const totalPaid = payments.reduce((sum, p) => sum + p.amount + p.late_fee, 0);

  return (
    <Modal open={true} onClose={onClose} title="Customer Ledger" size="xl">
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-teal-500" size={28} />
        </div>
      ) : customer ? (
        <div className="space-y-5">
          {/* Customer header */}
          <div className="flex flex-col sm:flex-row gap-4 bg-slate-50 rounded-xl p-4">
            <div className="w-16 h-16 rounded-full bg-teal-100 flex items-center justify-center text-2xl font-bold text-teal-700 shrink-0">
              {customer.full_name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              <div>
                <p className="font-bold text-slate-800 text-base">{customer.full_name}</p>
                {customer.cnic && <p className="text-slate-500 font-mono text-xs">CNIC: {customer.cnic}</p>}
                {customer.mobile && (
                  <p className="text-slate-500 flex items-center gap-1">
                    <Phone size={12} /> {customer.mobile}
                  </p>
                )}
                {customer.address && (
                  <p className="text-slate-500 flex items-center gap-1">
                    <MapPin size={12} /> {customer.address}
                  </p>
                )}
              </div>
              <div>
                {customer.guarantor_name && (
                  <>
                    <p className="font-semibold text-slate-700 flex items-center gap-1">
                      <UserCheck size={12} /> {customer.guarantor_name}
                    </p>
                    {customer.guarantor_cnic && <p className="text-slate-500 text-xs">CNIC: {customer.guarantor_cnic}</p>}
                    {customer.guarantor_phone && <p className="text-slate-500 text-xs">Phone: {customer.guarantor_phone}</p>}
                    {customer.guarantor_relation && (
                      <p className="text-slate-400 text-xs">Relation: {customer.guarantor_relation}</p>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="bg-red-50 border border-red-200 rounded-xl p-3">
              <p className="text-xs text-red-600 font-semibold">Total Receivable</p>
              <p className="text-lg font-bold text-red-700">{formatCurrency(totalReceivable)}</p>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
              <p className="text-xs text-emerald-600 font-semibold">Total Collected</p>
              <p className="text-lg font-bold text-emerald-700">{formatCurrency(totalPaid)}</p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <p className="text-xs text-slate-500 font-semibold">Total Sales</p>
              <p className="text-lg font-bold text-slate-700">{sales.length}</p>
            </div>
          </div>

          {/* Sales */}
          <div>
            <h3 className="text-sm font-bold text-slate-700 mb-2">Sales History</h3>
            {sales.length === 0 ? (
              <p className="text-sm text-slate-400 py-4 text-center bg-slate-50 rounded-xl">No sales recorded.</p>
            ) : (
              <div className="space-y-2">
                {sales.map((s) => (
                  <div key={s.id} className="flex items-center justify-between bg-white border border-slate-200 rounded-xl p-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold text-slate-800 text-sm">{s.invoice_no}</span>
                        <Badge variant={s.sale_type === 'cash' ? 'teal' : 'amber'}>
                          {s.sale_type === 'cash' ? 'Cash' : 'Installment'}
                        </Badge>
                        {s.status === 'ongoing' && <Badge variant="blue">Ongoing</Badge>}
                        {s.status === 'completed' && <Badge variant="green">Completed</Badge>}
                        {s.status === 'defaulted' && <Badge variant="red">Defaulted</Badge>}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {formatDate(s.sale_date)} · Total: {formatCurrency(s.total)}
                        {s.sale_type === 'installment' && ` · Balance: ${formatCurrency(s.remaining_balance)}`}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setViewSale(s)}
                        className="p-1.5 rounded-lg text-slate-400 hover:bg-teal-50 hover:text-teal-600"
                      >
                        <Eye size={16} />
                      </button>
                      {settings && (
                        <button
                          onClick={() => printInvoiceA4(s, settings)}
                          className="p-1.5 rounded-lg text-slate-400 hover:bg-teal-50 hover:text-teal-600"
                        >
                          <Printer size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Installment Schedule */}
          {schedule.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-slate-700 mb-2">Installment Schedule</h3>
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold">#</th>
                      <th className="text-left px-3 py-2 font-semibold">Due Date</th>
                      <th className="text-right px-3 py-2 font-semibold">Amount</th>
                      <th className="text-right px-3 py-2 font-semibold">Paid</th>
                      <th className="text-right px-3 py-2 font-semibold">Late Fee</th>
                      <th className="text-center px-3 py-2 font-semibold">Status</th>
                      <th className="text-right px-3 py-2 font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {schedule.map((e) => {
                      const liveStatus = computeScheduleStatus(e);
                      return (
                        <tr key={e.id} className="hover:bg-slate-50/70">
                          <td className="px-3 py-2 text-slate-600">{e.installment_no}</td>
                          <td className="px-3 py-2 text-slate-600">{formatDate(e.due_date)}</td>
                          <td className="px-3 py-2 text-right font-semibold text-slate-700">
                            {formatCurrency(e.amount)}
                          </td>
                          <td className="px-3 py-2 text-right text-emerald-600">{formatCurrency(e.paid_amount)}</td>
                          <td className="px-3 py-2 text-right text-red-500">
                            {e.late_fee > 0 ? formatCurrency(e.late_fee) : '-'}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {liveStatus === 'paid' && <Badge variant="green">Paid</Badge>}
                            {liveStatus === 'pending' && <Badge variant="slate">Upcoming</Badge>}
                            {liveStatus === 'late' && <Badge variant="amber">Late</Badge>}
                            {liveStatus === 'overdue' && <Badge variant="red">Overdue</Badge>}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {liveStatus !== 'paid' && (
                              <Button
                                size="sm"
                                variant="success"
                                onClick={() => {
                                  setPayTarget(e);
                                  setPayModalOpen(true);
                                }}
                              >
                                <Wallet size={12} /> Collect
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Payment History */}
          {payments.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-slate-700 mb-2">Payment History</h3>
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold">Date</th>
                      <th className="text-left px-3 py-2 font-semibold">Receipt</th>
                      <th className="text-left px-3 py-2 font-semibold">Type</th>
                      <th className="text-right px-3 py-2 font-semibold">Amount</th>
                      <th className="text-right px-3 py-2 font-semibold">Late Fee</th>
                      <th className="text-right px-3 py-2 font-semibold">Print</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {payments.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/70">
                        <td className="px-3 py-2 text-slate-600">{formatDateTime(p.payment_date)}</td>
                        <td className="px-3 py-2 font-mono text-xs text-slate-500">{p.receipt_no ?? '-'}</td>
                        <td className="px-3 py-2">
                          <Badge variant={p.payment_type === 'advance' ? 'amber' : p.payment_type === 'cash_sale' ? 'teal' : 'blue'}>
                            {p.payment_type.replace('_', ' ')}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-emerald-600">
                          {formatCurrency(p.amount)}
                        </td>
                        <td className="px-3 py-2 text-right text-red-500">
                          {p.late_fee > 0 ? formatCurrency(p.late_fee) : '-'}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {settings && (
                            <button
                              onClick={() => {
                                const sale = sales.find((s) => s.id === p.sale_id) ?? null;
                                printPaymentReceipt(p, sale, settings);
                              }}
                              className="p-1.5 rounded-lg text-slate-400 hover:bg-teal-50 hover:text-teal-600"
                            >
                              <Printer size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
        <EmptyState title="Customer not found" />
      )}

      {payTarget && payModalOpen && (
        <PaymentModal
          entry={payTarget}
          customer={customer}
          onClose={() => {
            setPayModalOpen(false);
            setPayTarget(null);
          }}
          onSaved={() => {
            setPayModalOpen(false);
            setPayTarget(null);
            load();
          }}
          userId={user?.id ?? null}
        />
      )}

      {viewSale && settings && (
        <Modal open={!!viewSale} onClose={() => setViewSale(null)} title={`Invoice ${viewSale.invoice_no}`} size="lg"
          footer={
            <>
              <Button variant="secondary" onClick={() => setViewSale(null)}>Close</Button>
              <Button onClick={() => printInvoiceA4(viewSale, settings)}><Printer size={16} /> Print A4</Button>
            </>
          }
        >
          <SaleDetail sale={viewSale} settings={settings} />
        </Modal>
      )}
    </Modal>
  );
}

function SaleDetail({ sale, settings }: { sale: Sale; settings: Settings }) {
  const items = sale.sale_items ?? [];
  return (
    <div className="space-y-3 text-sm">
      <div className="flex justify-between">
        <span className="text-slate-500">Type</span>
        <span className="font-semibold capitalize">{sale.sale_type}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-slate-500">Date</span>
        <span className="font-semibold">{formatDateTime(sale.sale_date)}</span>
      </div>
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="text-left px-3 py-2">Item</th>
              <th className="text-center px-3 py-2">Qty</th>
              <th className="text-right px-3 py-2">Price</th>
              <th className="text-right px-3 py-2">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((it: SaleItem) => (
              <tr key={it.id}>
                <td className="px-3 py-2">
                  <div className="font-semibold text-slate-700">{it.product?.name}</div>
                  {it.serial?.serial_number && <div className="text-xs text-blue-600">SN: {it.serial.serial_number}</div>}
                </td>
                <td className="px-3 py-2 text-center">{it.quantity}</td>
                <td className="px-3 py-2 text-right">{formatCurrency(it.unit_price, settings.currency)}</td>
                <td className="px-3 py-2 text-right font-semibold">{formatCurrency(it.subtotal, settings.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex justify-between"><span className="text-slate-500">Subtotal</span><span>{formatCurrency(sale.subtotal, settings.currency)}</span></div>
      {sale.discount > 0 && <div className="flex justify-between"><span className="text-slate-500">Discount</span><span>-{formatCurrency(sale.discount, settings.currency)}</span></div>}
      <div className="flex justify-between font-bold text-base border-t pt-2"><span>Total</span><span className="text-teal-700">{formatCurrency(sale.total, settings.currency)}</span></div>
      {sale.sale_type === 'installment' && (
        <>
          <div className="flex justify-between"><span className="text-slate-500">Advance</span><span>{formatCurrency(sale.advance_paid, settings.currency)}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Balance</span><span className="font-semibold text-amber-600">{formatCurrency(sale.remaining_balance, settings.currency)}</span></div>
          {sale.payment_terms && <div className="flex justify-between"><span className="text-slate-500">Terms</span><span>{sale.payment_terms}</span></div>}
        </>
      )}
    </div>
  );
}

function PaymentModal({
  entry,
  customer,
  onClose,
  onSaved,
  userId,
}: {
  entry: InstallmentScheduleEntry;
  customer: Customer | null;
  onClose: () => void;
  onSaved: () => void;
  userId: string | null;
}) {
  const [amount, setAmount] = useState(String(entry.amount - entry.paid_amount));
  const [lateFee, setLateFee] = useState('0');
  const [method, setMethod] = useState('cash');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    const amt = parseFloat(amount) || 0;
    if (amt <= 0) {
      setError('Enter a valid amount.');
      return;
    }
    setBusy(true);
    setError(null);
    const receiptNo = await nextReceiptNumber();
    const lf = parseFloat(lateFee) || 0;

    const { data: payData, error: payErr } = await supabase
      .from('payments')
      .insert({
        sale_id: entry.sale_id,
        schedule_id: entry.id,
        customer_id: customer?.id ?? null,
        amount: amt,
        late_fee: lf,
        payment_type: 'installment',
        method,
        receipt_no: receiptNo,
        note: note.trim(),
        received_by: userId,
        payment_date: new Date().toISOString(),
      })
      .select('*')
      .single();

    if (payErr) {
      setError(payErr.message);
      setBusy(false);
      return;
    }

    // update schedule entry
    const newPaid = entry.paid_amount + amt;
    const isFullyPaid = newPaid >= entry.amount;
    await supabase
      .from('installment_schedule')
      .update({
        paid_amount: newPaid,
        late_fee: entry.late_fee + lf,
        status: isFullyPaid ? 'paid' : entry.status,
        paid_date: isFullyPaid ? todayISO() : entry.paid_date,
      })
      .eq('id', entry.id);

    // update sale remaining balance
    const { data: saleData } = await supabase
      .from('sales')
      .select('*')
      .eq('id', entry.sale_id)
      .maybeSingle();
    if (saleData) {
      const sale = saleData as Sale;
      const newBalance = Math.max(0, sale.remaining_balance - amt);
      const allSched = await supabase
        .from('installment_schedule')
        .select('*')
        .eq('sale_id', sale.id);
      const allPaid = (allSched.data ?? []).every((s) => s.status === 'paid' || (s.id === entry.id && isFullyPaid));
      await supabase
        .from('sales')
        .update({
          remaining_balance: newBalance,
          status: newBalance <= 0 ? 'closed' : sale.status,
        })
        .eq('id', sale.id);
      void allPaid;
    }

    // cashbook entry
    await supabase.from('cashbook_entries').insert({
      entry_date: todayISO(),
      type: 'installment_collection',
      direction: 'in',
      amount: amt + lf,
      reference: receiptNo,
      reference_id: entry.sale_id,
    });

    setBusy(false);
    void payData;
    onSaved();
  };

  return (
    <Modal
      open={true}
      onClose={onClose}
      title="Collect Installment Payment"
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="success" onClick={handleSubmit} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" size={16} /> : <Wallet size={16} />}
            Record Payment
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="bg-slate-50 rounded-xl p-3 text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-slate-500">Customer</span>
            <span className="font-semibold">{customer?.full_name ?? '-'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Installment #</span>
            <span className="font-semibold">{entry.installment_no}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Due Date</span>
            <span className="font-semibold">{formatDate(entry.due_date)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Installment Amount</span>
            <span className="font-semibold">{formatCurrency(entry.amount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Already Paid</span>
            <span className="font-semibold text-emerald-600">{formatCurrency(entry.paid_amount)}</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Payment Amount"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <Input
            label="Late Payment Fee (optional)"
            type="number"
            value={lateFee}
            onChange={(e) => setLateFee(e.target.value)}
          />
        </div>
        <Select label="Payment Method" value={method} onChange={(e) => setMethod(e.target.value)}>
          <option value="cash">Cash</option>
          <option value="card">Card</option>
          <option value="bank">Bank Transfer</option>
          <option value="other">Other</option>
        </Select>
        <Textarea label="Note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
          {error}
        </div>
      )}
    </Modal>
  );
}
