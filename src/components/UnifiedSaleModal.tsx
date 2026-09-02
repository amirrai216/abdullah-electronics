import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import type { Product, Customer, Sale, Settings, InstallmentPlan } from '@/lib/types';
import { formatCurrency, cn, todayISO } from '@/lib/format';
import { nextInvoiceNumber, generateSchedule } from '@/lib/billing';
import { printInvoiceA4 } from '@/lib/print';
import { Modal, Button, Input, Select, Textarea, Badge } from '@/components/ui';
import {
  Search,
  Plus,
  Minus,
  Trash2,
  X,
  Loader2,
  Package,
  CheckCircle2,
  Printer,
  User,
  Calendar,
  Camera,
} from 'lucide-react';

interface CartLine {
  product: Product;
  qty: number;
  unitPrice: number;
}

interface UnifiedSaleModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function UnifiedSaleModal({ open, onClose, onSaved }: UnifiedSaleModalProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [productSearch, setProductSearch] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);

  // Customer form
  const [cust, setCust] = useState({
    full_name: '',
    mobile: '',
    cnic: '',
    address: '',
    photo_url: '',
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  // Sale settings
  const [saleType, setSaleType] = useState<'cash' | 'installment'>('cash');
  const [saleDate, setSaleDate] = useState(() => new Date().toISOString().slice(0, 16));

  // Installment details
  const [install, setInstall] = useState({
    advance: '0',
    monthlyAmount: '0',
    months: '3',
    firstDueDate: todayISO(),
  });

  const load = useCallback(async () => {
    const [{ data: prods }, { data: sett }] = await Promise.all([
      supabase.from('products').select('*, category:categories(*)').gt('quantity', 0).order('name'),
      supabase.from('settings').select('*').eq('id', 1).maybeSingle(),
    ]);
    setProducts((prods as Product[]) ?? []);
    setSettings(sett as Settings | null);
  }, []);

  useEffect(() => {
    if (open) {
      load();
      setCust({ full_name: '', mobile: '', cnic: '', address: '', photo_url: '' });
      setPhotoFile(null);
      setCart([]);
      setSaleType('cash');
      setSaleDate(new Date().toISOString().slice(0, 16));
      setInstall({ advance: '0', months: '3', firstDueDate: todayISO() });
      setError(null);
      setCompletedSale(null);
    }
  }, [open, load]);

  const filteredProducts = useMemo(() => {
    const q = productSearch.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.brand_model?.toLowerCase().includes(q) ||
        (p.category?.name ?? '').toLowerCase().includes(q)
    );
  }, [products, productSearch]);

  const subtotal = cart.reduce((s, l) => s + l.unitPrice * l.qty, 0);
  const advanceVal = saleType === 'installment' ? parseFloat(install.advance) || 0 : subtotal;
  const remaining = saleType === 'installment' ? Math.max(0, subtotal - advanceVal) : 0;
  const months = saleType === 'installment' ? parseInt(install.months) || 0 : 0;
  const monthlyAmount = saleType === 'installment' && months > 0 ? remaining / months : 0;

  const addToCart = (p: Product) => {
    setCart((prev) => {
      const existing = prev.find((l) => l.product.id === p.id);
      if (existing) {
        if (existing.qty >= p.quantity) return prev;
        return prev.map((l) => (l.product.id === p.id ? { ...l, qty: l.qty + 1 } : l));
      }
      return [...prev, { product: p, qty: 1, unitPrice: p.selling_price }];
    });
  };

  const updateQty = (idx: number, delta: number) => {
    setCart((prev) =>
      prev.map((l, i) => {
        if (i !== idx) return l;
        const next = Math.min(Math.max(1, l.qty + delta), l.product.quantity);
        return { ...l, qty: next };
      })
    );
  };

  const setQty = (idx: number, val: number) => {
    setCart((prev) =>
      prev.map((l, i) => {
        if (i !== idx) return l;
        const next = Math.min(Math.max(1, val), l.product.quantity);
        return { ...l, qty: next };
      })
    );
  };

  const updatePrice = (idx: number, val: number) => {
    setCart((prev) => prev.map((l, i) => (i === idx ? { ...l, unitPrice: Math.max(0, val) } : l)));
  };

  const removeLine = (idx: number) => {
    setCart((prev) => prev.filter((_, i) => i !== idx));
  };

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      setCust((c) => ({ ...c, photo_url: file.name }));
    }
  };

  const completeSale = async () => {
    if (!cust.full_name.trim()) {
      setError('Customer name is required.');
      return;
    }
    if (cart.length === 0) {
      setError('Add at least one product to the sale.');
      return;
    }
    if (saleType === 'installment') {
      if (advanceVal < 0) {
        setError('Advance payment cannot be negative.');
        return;
      }
      if (months <= 0) {
        setError('Number of months must be greater than 0.');
        return;
      }
    }

    setBusy(true);
    setError(null);

    try {
      // 1. Create customer
      const { data: custData, error: custErr } = await supabase
        .from('customers')
        .insert({
          full_name: cust.full_name.trim(),
          mobile: cust.mobile.trim(),
          cnic: cust.cnic.trim(),
          address: cust.address.trim(),
          photo_url: cust.photo_url.trim(),
        })
        .select('*')
        .single();

      if (custErr || !custData) {
        setError(custErr?.message ?? 'Failed to create customer.');
        setBusy(false);
        return;
      }
      const customer = custData as Customer;

      // 2. Create sale
      const invoiceNo = await nextInvoiceNumber();
      const saleDateTime = new Date(saleDate).toISOString();

      const salePayload = {
        invoice_no: invoiceNo,
        sale_type: saleType,
        customer_id: customer.id,
        subtotal,
        discount: 0,
        total: subtotal,
        advance_paid: advanceVal,
        remaining_balance: remaining,
        status: saleType === 'installment' ? 'ongoing' : 'completed',
        payment_terms:
          saleType === 'installment'
            ? `Monthly for ${months} months`
            : 'Cash',
        sale_date: saleDateTime,
        created_by: null,
      };

      const { data: saleData, error: saleErr } = await supabase
        .from('sales')
        .insert(salePayload)
        .select('*, customer:customers(*), sale_items:sale_items(*, product:products(*), serial:product_serials(*))')
        .single();

      if (saleErr || !saleData) {
        setError(saleErr?.message ?? 'Failed to create sale.');
        setBusy(false);
        return;
      }
      const sale = saleData as Sale;

      // 3. Insert sale items
      const itemRows = cart.map((l) => ({
        sale_id: sale.id,
        product_id: l.product.id,
        serial_id: null,
        quantity: l.qty,
        unit_price: l.unitPrice,
        unit_cost: l.product.purchase_price,
        subtotal: l.unitPrice * l.qty,
      }));
      await supabase.from('sale_items').insert(itemRows);

      // 4. Deduct stock
      for (const l of cart) {
        await supabase
          .from('products')
          .update({ quantity: l.product.quantity - l.qty })
          .eq('id', l.product.id);
      }

      // 5. Record payment + cashbook
      if (advanceVal > 0) {
        await supabase.from('payments').insert({
          sale_id: sale.id,
          customer_id: customer.id,
          amount: advanceVal,
          late_fee: 0,
          payment_type: saleType === 'installment' ? 'advance' : 'cash_sale',
          method: 'cash',
          receipt_no: `RCP-${invoiceNo}`,
          received_by: null,
          payment_date: saleDateTime,
        });

        await supabase.from('cashbook_entries').insert({
          entry_date: todayISO(),
          type: saleType === 'installment' ? 'advance' : 'cash_sale',
          direction: 'in',
          amount: advanceVal,
          reference: invoiceNo,
          reference_id: sale.id,
        });
      }

      // 6. Installment plan + schedule
      if (saleType === 'installment' && months > 0 && monthlyAmount > 0) {
        const { data: planData } = await supabase
          .from('installment_plans')
          .insert({
            sale_id: sale.id,
            frequency: 'monthly',
            duration_months: months,
            installment_amount: monthlyAmount,
            down_payment: advanceVal,
            start_date: install.firstDueDate,
          })
          .select('*')
          .single();

        if (planData) {
          const plan = planData as InstallmentPlan;
          const schedule = generateSchedule({
            frequency: 'monthly',
            duration: months,
            installmentAmount: monthlyAmount,
            startDate: install.firstDueDate,
          });
          const schedRows = schedule.map((s) => ({
            plan_id: plan.id,
            sale_id: sale.id,
            installment_no: s.installment_no,
            due_date: s.due_date,
            amount: s.amount,
            status: 'pending',
          }));
          await supabase.from('installment_schedule').insert(schedRows);
        }
      }

      // 7. Reload sale with relations for printing
      const { data: fullSale } = await supabase
        .from('sales')
        .select('*, customer:customers(*), sale_items:sale_items(*, product:products(*), serial:product_serials(*))')
        .eq('id', sale.id)
        .single();

      setCompletedSale(fullSale as Sale);
      setBusy(false);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
      setBusy(false);
    }
  };

  // ===== Receipt View =====
  if (completedSale) {
    return (
      <Modal
        open={open}
        onClose={onClose}
        title="Sale Completed"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
            <Button onClick={() => settings && printInvoiceA4(completedSale, settings)}>
              <Printer size={16} /> Print Bill (PDF)
            </Button>
          </>
        }
      >
        <div className="text-center py-4">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="text-emerald-600" size={36} />
          </div>
          <h3 className="text-lg font-bold text-slate-800">Sale Successful</h3>
          <p className="text-sm text-slate-500 mt-1">
            Invoice <span className="font-mono font-semibold">{completedSale.invoice_no}</span>
          </p>
          <p className="text-2xl font-bold text-teal-700 mt-3">{formatCurrency(completedSale.total)}</p>
          {completedSale.sale_type === 'installment' && (
            <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-amber-700">Advance Paid</span>
                <span className="font-semibold text-amber-800">{formatCurrency(completedSale.advance_paid)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-amber-700">Remaining Balance</span>
                <span className="font-semibold text-amber-800">{formatCurrency(completedSale.remaining_balance)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-amber-700">Monthly Qist</span>
                <span className="font-semibold text-amber-800">{formatCurrency(monthlyAmount)}</span>
              </div>
            </div>
          )}
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add New Customer & Sale"
      size="xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={completeSale} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
            Save Customer & Complete Sale
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        {/* Customer Information */}
        <div>
          <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
            <User size={16} /> Customer Information
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Customer Name *"
              value={cust.full_name}
              onChange={(e) => setCust({ ...cust, full_name: e.target.value })}
              placeholder="Enter customer name"
            />
            <Input
              label="Mobile Number"
              value={cust.mobile}
              onChange={(e) => setCust({ ...cust, mobile: e.target.value })}
              placeholder="03XX-XXXXXXX"
            />
            <Input
              label="CNIC"
              value={cust.cnic}
              onChange={(e) => setCust({ ...cust, cnic: e.target.value })}
              placeholder="XXXXX-XXXXXXX-X"
            />
            <Input
              label="Address"
              value={cust.address}
              onChange={(e) => setCust({ ...cust, address: e.target.value })}
              placeholder="Enter address"
            />
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Photo Upload</label>
              <label className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white cursor-pointer hover:bg-slate-50 transition-all">
                <Camera size={18} className="text-slate-400" />
                <span className="text-sm text-slate-500 truncate">
                  {photoFile ? photoFile.name : 'Choose photo...'}
                </span>
                <input type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
              </label>
            </div>
            <Input
              label="Sale Date & Time"
              type="datetime-local"
              value={saleDate}
              onChange={(e) => setSaleDate(e.target.value)}
            />
          </div>
        </div>

        {/* Payment Mode */}
        <div>
          <h3 className="text-sm font-bold text-slate-700 mb-3">Payment Mode</h3>
          <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
            <button
              onClick={() => setSaleType('cash')}
              className={cn(
                'flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all',
                saleType === 'cash' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500'
              )}
            >
              Cash (Full)
            </button>
            <button
              onClick={() => setSaleType('installment')}
              className={cn(
                'flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all',
                saleType === 'installment' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500'
              )}
            >
              Installment
            </button>
          </div>
        </div>

        {/* Installment Details */}
        {saleType === 'installment' && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-bold text-amber-800">Installment Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Advance Payment (Rs)"
                type="number"
                value={install.advance}
                onChange={(e) => setInstall({ ...install, advance: e.target.value })}
              />
              <Input
                label="Number of Months"
                type="number"
                value={install.months}
                onChange={(e) => setInstall({ ...install, months: e.target.value })}
              />
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Monthly Qist (Auto-calculated)</label>
                <div className="px-3.5 py-2.5 rounded-xl border border-amber-300 bg-amber-100/50 text-sm font-bold text-amber-800">
                  {formatCurrency(monthlyAmount)} / mo
                </div>
                <p className="mt-1 text-xs text-amber-600">Calculated as (Total - Advance) / Months</p>
              </div>
              <Input
                label="First Due Date"
                type="date"
                value={install.firstDueDate}
                onChange={(e) => setInstall({ ...install, firstDueDate: e.target.value })}
              />
            </div>
          </div>
        )}

        {/* Product Selection */}
        <div>
          <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
            <Package size={16} /> Product Selection
          </h3>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <Input
              placeholder="Search inventory items..."
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Product results */}
          {productSearch && (
            <div className="border border-slate-200 rounded-xl max-h-48 overflow-y-auto mb-3">
              {filteredProducts.length === 0 ? (
                <p className="px-4 py-6 text-sm text-slate-400 text-center">No products found.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {filteredProducts.slice(0, 8).map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        addToCart(p);
                        setProductSearch('');
                      }}
                      className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-teal-50 transition-colors text-left"
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-700">{p.name}</p>
                        <p className="text-xs text-slate-400">
                          {p.brand_model && `${p.brand_model} · `}
                          {formatCurrency(p.selling_price)} · {p.quantity} in stock
                        </p>
                      </div>
                      <div className="w-7 h-7 rounded-lg bg-teal-100 text-teal-600 flex items-center justify-center">
                        <Plus size={16} />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Cart lines */}
          {cart.length > 0 && (
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                  <tr>
                    <th className="text-left px-3 py-2 font-semibold">Item</th>
                    <th className="text-center px-3 py-2 font-semibold">Qty</th>
                    <th className="text-right px-3 py-2 font-semibold">Unit Price (Rs)</th>
                    <th className="text-right px-3 py-2 font-semibold">Subtotal</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cart.map((l, i) => (
                    <tr key={l.product.id}>
                      <td className="px-3 py-2.5">
                        <p className="font-semibold text-slate-700">{l.product.name}</p>
                        {l.product.brand_model && (
                          <p className="text-xs text-slate-400">{l.product.brand_model}</p>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-center gap-1 bg-white rounded-lg border border-slate-200 w-fit mx-auto">
                          <button onClick={() => updateQty(i, -1)} className="p-1 text-slate-500 hover:text-teal-600">
                            <Minus size={14} />
                          </button>
                          <input
                            type="number"
                            value={l.qty}
                            onChange={(e) => setQty(i, parseInt(e.target.value) || 1)}
                            className="w-10 text-center text-sm font-semibold border-0 p-0 focus:outline-none"
                          />
                          <button onClick={() => updateQty(i, 1)} className="p-1 text-slate-500 hover:text-teal-600">
                            <Plus size={14} />
                          </button>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <input
                          type="number"
                          value={l.unitPrice}
                          onChange={(e) => updatePrice(i, parseFloat(e.target.value) || 0)}
                          className="w-24 text-right px-2 py-1 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-teal-500"
                        />
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold text-slate-800">
                        {formatCurrency(l.unitPrice * l.qty)}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <button
                          onClick={() => removeLine(i)}
                          className="p-1 text-slate-400 hover:text-red-500"
                        >
                          <X size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Live Totals */}
          {cart.length > 0 && (
            <div className="mt-4 bg-slate-50 rounded-xl p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Total Price</span>
                <span className="font-bold text-slate-800 text-base">{formatCurrency(subtotal)}</span>
              </div>
              {saleType === 'installment' && (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Total Advance</span>
                    <span className="font-semibold text-emerald-600">{formatCurrency(advanceVal)}</span>
                  </div>
                  <div className="flex justify-between text-sm border-t border-slate-200 pt-2">
                    <span className="font-semibold text-slate-700">Remaining Balance Due</span>
                    <span className="font-bold text-amber-700 text-base">{formatCurrency(remaining)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Monthly Qist ({months} months)</span>
                    <span className="font-semibold text-slate-700">{formatCurrency(monthlyAmount)}/mo</span>
                  </div>
                </>
              )}
              {saleType === 'cash' && (
                <div className="flex justify-between text-sm border-t border-slate-200 pt-2">
                  <span className="font-semibold text-emerald-700">Paid Full</span>
                  <Badge variant="green">PAID FULL</Badge>
                </div>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
            {error}
          </div>
        )}
      </div>
    </Modal>
  );
}
