import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { Product, Customer, Sale, SaleItem, ProductSerial, Settings } from '@/lib/types';
import { formatCurrency, cn, todayISO } from '@/lib/format';
import { nextInvoiceNumber, generateSchedule } from '@/lib/billing';
import { printInvoiceA4, printReceipt80mm } from '@/lib/print';
import { Modal, Button, Input, Select, Textarea, Badge, Card, EmptyState } from '@/components/ui';
import {
  Search,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  Printer,
  Loader2,
  Package,
  UserPlus,
  CheckCircle2,
  X,
  User,
} from 'lucide-react';

interface CartLine {
  product: Product;
  qty: number;
  serialId: string | null;
  unitPrice: number;
}

export function POSModule() {
  const { user, isAdmin } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [saleType, setSaleType] = useState<'cash' | 'installment'>('cash');
  const [customerId, setCustomerId] = useState('');
  const [discount, setDiscount] = useState('0');
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutCustSearch, setCheckoutCustSearch] = useState('');
  const [custModalOpen, setCustModalOpen] = useState(false);
  const [cashCustName, setCashCustName] = useState('');
  const [cashCustPhone, setCashCustPhone] = useState('');
  const [lastSale, setLastSale] = useState<Sale | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // installment form
  const [install, setInstall] = useState({
    advance: '0',
    frequency: 'monthly' as 'monthly' | 'weekly',
    duration: '3',
    startDate: todayISO(),
  });

  const load = useCallback(async () => {
    const [{ data: prods }, { data: custs }, { data: sett }] = await Promise.all([
      supabase.from('products').select('*, category:categories(*)').gt('quantity', 0).order('name'),
      supabase.from('customers').select('*').order('full_name'),
      supabase.from('settings').select('*').eq('id', 1).maybeSingle(),
    ]);
    setProducts((prods as Product[]) ?? []);
    setCustomers((custs as Customer[]) ?? []);
    setSettings(sett as Settings | null);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.brand_model?.toLowerCase().includes(q) ||
        (p.category?.name ?? '').toLowerCase().includes(q)
    );
  }, [products, search]);

  const checkoutFiltered = useMemo(() => {
    const q = checkoutCustSearch.toLowerCase();
    return customers.filter(
      (c) =>
        c.full_name.toLowerCase().includes(q) ||
        c.mobile?.toLowerCase().includes(q) ||
        c.cnic?.toLowerCase().includes(q)
    );
  }, [customers, checkoutCustSearch]);

  const subtotal = cart.reduce((s, l) => s + l.unitPrice * l.qty, 0);
  const discountVal = parseFloat(discount) || 0;
  const total = Math.max(0, subtotal - discountVal);

  const addToCart = (p: Product) => {
    setCart((prev) => {
      const existing = prev.find((l) => l.product.id === p.id && !l.serialId);
      if (existing) {
        if (existing.qty >= p.quantity) return prev;
        return prev.map((l) =>
          l.product.id === p.id && !l.serialId ? { ...l, qty: l.qty + 1 } : l
        );
      }
      return [...prev, { product: p, qty: 1, serialId: null, unitPrice: p.selling_price }];
    });
  };

  const addSerialToCart = async (p: Product) => {
    const { data } = await supabase
      .from('product_serials')
      .select('*')
      .eq('product_id', p.id)
      .eq('status', 'in_stock')
      .limit(1)
      .maybeSingle();
    if (!data) {
      alert('No in-stock serial numbers for this product.');
      return;
    }
    const serial = data as ProductSerial;
    setCart((prev) => [
      ...prev,
      { product: p, qty: 1, serialId: serial.id, unitPrice: p.selling_price },
    ]);
  };

  const handleAdd = (p: Product) => {
    if (p.track_serials) {
      addSerialToCart(p);
    } else {
      addToCart(p);
    }
  };

  const updateQty = (idx: number, delta: number) => {
    setCart((prev) =>
      prev.map((l, i) => {
        if (i !== idx) return l;
        if (l.serialId) return l; // serial items are qty 1
        const next = Math.min(Math.max(1, l.qty + delta), l.product.quantity);
        return { ...l, qty: next };
      })
    );
  };

  const updateUnitPrice = (idx: number, value: string) => {
    const price = parseFloat(value) || 0;
    setCart((prev) => prev.map((l, i) => (i === idx ? { ...l, unitPrice: price } : l)));
  };

  const removeLine = (idx: number) => {
    setCart((prev) => prev.filter((_, i) => i !== idx));
  };

  const openCheckout = () => {
    if (cart.length === 0) return;
    setError(null);
    setCheckoutCustSearch('');
    setCashCustName('');
    setCashCustPhone('');
    setCheckoutOpen(true);
  };

  const completeSale = async () => {
    if (!user) return;
    setBusy(true);
    setError(null);

    const advance = saleType === 'installment' ? parseFloat(install.advance) || 0 : total;
    const remaining = saleType === 'installment' ? Math.max(0, total - advance) : 0;
    const duration = saleType === 'installment' ? parseInt(install.duration) || 1 : 0;
    const installmentAmount = saleType === 'installment' && duration > 0 ? remaining / duration : 0;

    const invoiceNo = await nextInvoiceNumber();

    let saleCustomerId = customerId || null;

    if (saleType === 'cash' && !saleCustomerId && cashCustName.trim()) {
      const { data: cashCust } = await supabase
        .from('customers')
        .insert({
          full_name: cashCustName.trim(),
          mobile: cashCustPhone.trim(),
        })
        .select('*')
        .single();
      if (cashCust) saleCustomerId = (cashCust as Customer).id;
    }

    const salePayload = {
      invoice_no: invoiceNo,
      sale_type: saleType,
      customer_id: saleCustomerId,
      subtotal,
      discount: discountVal,
      total,
      advance_paid: advance,
      remaining_balance: remaining,
      status: saleType === 'installment' ? 'ongoing' : 'completed',
      payment_terms:
        saleType === 'installment'
          ? `${install.frequency} for ${duration} ${install.frequency === 'monthly' ? 'months' : 'weeks'}`
          : 'Cash',
      sale_date: new Date().toISOString(),
      created_by: user.id,
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

    // insert sale items
    const itemRows = cart.map((l) => ({
      sale_id: sale.id,
      product_id: l.product.id,
      serial_id: l.serialId,
      quantity: l.qty,
      unit_price: l.unitPrice,
      unit_cost: l.product.purchase_price,
      subtotal: l.unitPrice * l.qty,
    }));
    const { error: itemErr } = await supabase.from('sale_items').insert(itemRows);
    if (itemErr) {
      setError(itemErr.message);
      setBusy(false);
      return;
    }

    // deduct stock
    for (const l of cart) {
      await supabase
        .from('products')
        .update({ quantity: l.product.quantity - l.qty })
        .eq('id', l.product.id);
      if (l.serialId) {
        await supabase.from('product_serials').update({ status: 'sold' }).eq('id', l.serialId);
      }
    }

    // record payment + cashbook for advance/cash
    if (advance > 0) {
      const { data: payData } = await supabase
        .from('payments')
        .insert({
          sale_id: sale.id,
          customer_id: saleCustomerId,
          amount: advance,
          late_fee: 0,
          payment_type: saleType === 'installment' ? 'advance' : 'cash_sale',
          method: 'cash',
          receipt_no: `RCP-${invoiceNo}`,
          received_by: user.id,
          payment_date: new Date().toISOString(),
        })
        .select('*')
        .single();

      await supabase.from('cashbook_entries').insert({
        entry_date: todayISO(),
        type: saleType === 'installment' ? 'advance' : 'cash_sale',
        direction: 'in',
        amount: advance,
        reference: invoiceNo,
        reference_id: sale.id,
      });

      void payData;
    }

    // installment plan + schedule
    if (saleType === 'installment' && duration > 0 && installmentAmount > 0) {
      const { data: planData } = await supabase
        .from('installment_plans')
        .insert({
          sale_id: sale.id,
          frequency: install.frequency,
          duration_months: duration,
          installment_amount: Math.round(installmentAmount * 100) / 100,
          down_payment: advance,
          start_date: install.startDate,
        })
        .select('*')
        .single();

      if (planData) {
        const schedule = generateSchedule({
          frequency: install.frequency,
          duration,
          installmentAmount: Math.round(installmentAmount * 100) / 100,
          startDate: install.startDate,
        });
        const schedRows = schedule.map((s) => ({
          plan_id: (planData as any).id,
          sale_id: sale.id,
          installment_no: s.installment_no,
          due_date: s.due_date,
          amount: s.amount,
          status: 'pending',
        }));
        await supabase.from('installment_schedule').insert(schedRows);
      }
    }

    // reload sale with relations for printing
    const { data: fullSale } = await supabase
      .from('sales')
      .select('*, customer:customers(*), sale_items:sale_items(*, product:products(*), serial:product_serials(*))')
      .eq('id', sale.id)
      .single();
    const finalSale = fullSale as Sale;

    setLastSale(finalSale);
    setCart([]);
    setDiscount('0');
    setCustomerId('');
    setCashCustName('');
    setCashCustPhone('');
    setInstall({ advance: '0', frequency: 'monthly', duration: '3', startDate: todayISO() });
    setCheckoutOpen(false);
    setReceiptOpen(true);
    setBusy(false);
    load();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      {/* Product grid */}
      <div className="lg:col-span-2 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <Input
            placeholder="Search products by name, brand, or category..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {filtered.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Package size={48} />}
              title="No products in stock"
              description="Add products in the Inventory module to start billing."
            />
          </Card>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
            {filtered.map((p) => (
              <button
                key={p.id}
                onClick={() => handleAdd(p)}
                className="text-left bg-white rounded-xl border border-slate-200 p-3.5 hover:border-teal-400 hover:shadow-md transition-all group"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="w-9 h-9 rounded-lg bg-teal-50 flex items-center justify-center text-teal-600 group-hover:bg-teal-100">
                    <Package size={18} />
                  </div>
                  {p.track_serials && <Badge variant="blue">SN</Badge>}
                </div>
                <p className="font-semibold text-slate-800 text-sm leading-tight line-clamp-2">{p.name}</p>
                {p.brand_model && <p className="text-xs text-slate-400 mt-0.5">{p.brand_model}</p>}
                <div className="flex items-center justify-between mt-2">
                  <span className="font-bold text-teal-700 text-sm">{formatCurrency(p.selling_price)}</span>
                  <span className="text-xs text-slate-400">{p.quantity} left</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Cart */}
      <div className="lg:sticky lg:top-20 h-fit">
        <Card className="flex flex-col max-h-[calc(100vh-7rem)]">
          <div className="px-5 py-4 border-b border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-slate-800 flex items-center gap-2">
                <ShoppingCart size={18} /> Current Sale
              </h2>
              {cart.length > 0 && (
                <button
                  onClick={() => setCart([])}
                  className="text-xs text-red-500 hover:text-red-700 font-semibold"
                >
                  Clear all
                </button>
              )}
            </div>
            <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
              <button
                onClick={() => setSaleType('cash')}
                className={cn(
                  'flex-1 py-2 rounded-lg text-sm font-semibold transition-all',
                  saleType === 'cash' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500'
                )}
              >
                Cash Sale
              </button>
              <button
                onClick={() => setSaleType('installment')}
                className={cn(
                  'flex-1 py-2 rounded-lg text-sm font-semibold transition-all',
                  saleType === 'installment' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500'
                )}
              >
                Installment
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-3 min-h-[200px]">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-300 py-10">
                <ShoppingCart size={40} />
                <p className="text-sm text-slate-400 mt-2">Click products to add them</p>
              </div>
            ) : (
              <div className="space-y-2">
                {cart.map((l, i) => (
                  <div key={i} className="flex items-center gap-2 bg-slate-50 rounded-xl p-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-700 truncate">{l.product.name}</p>
                      {l.serialId && <p className="text-xs text-blue-600">Serial tracked</p>}
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-xs text-slate-400">Rs.</span>
                        <input
                          type="number"
                          value={l.unitPrice}
                          onChange={(e) => updateUnitPrice(i, e.target.value)}
                          className="w-20 px-1.5 py-0.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
                        />
                        <span className="text-xs text-slate-400">each</span>
                      </div>
                    </div>
                    {l.serialId ? (
                      <Badge variant="blue">1</Badge>
                    ) : (
                      <div className="flex items-center gap-1 bg-white rounded-lg border border-slate-200">
                        <button
                          onClick={() => updateQty(i, -1)}
                          className="p-1 text-slate-500 hover:text-teal-600"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="w-6 text-center text-sm font-semibold">{l.qty}</span>
                        <button
                          onClick={() => updateQty(i, 1)}
                          className="p-1 text-slate-500 hover:text-teal-600"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    )}
                    <span className="text-sm font-bold text-slate-800 w-20 text-right">
                      {formatCurrency(l.unitPrice * l.qty)}
                    </span>
                    <button
                      onClick={() => removeLine(i)}
                      className="p-1 text-slate-400 hover:text-red-500"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="px-5 py-4 border-t border-slate-200 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Subtotal</span>
              <span className="font-semibold text-slate-700">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500">Discount</span>
              <Input
                type="number"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                className="flex-1 py-1.5 text-sm"
                placeholder="0"
              />
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 pt-2">
              <span className="font-bold text-slate-800">Total</span>
              <span className="text-xl font-bold text-teal-700">{formatCurrency(total)}</span>
            </div>

            {saleType === 'installment' && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
                <p className="text-xs font-semibold text-amber-800">Installment Sale — Customer Required</p>
                {customerId ? (
                  <div className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-amber-200">
                    <span className="text-sm font-semibold text-slate-700">
                      {customers.find((c) => c.id === customerId)?.full_name ?? 'Selected customer'}
                    </span>
                    <button onClick={() => setCustomerId('')} className="text-xs text-red-500 font-semibold">
                      Change
                    </button>
                  </div>
                ) : (
                  <Button variant="outline" size="sm" fullWidth onClick={() => setCustModalOpen(true)}>
                    <UserPlus size={14} /> Select or Add Customer
                  </Button>
                )}
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-3 py-2">
                {error}
              </div>
            )}

            <Button fullWidth size="lg" onClick={openCheckout} disabled={cart.length === 0}>
              Proceed to Checkout
            </Button>
          </div>
        </Card>
      </div>

      {/* Checkout Modal */}
      <Modal
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        title="Confirm Sale"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCheckoutOpen(false)}>
              Cancel
            </Button>
            <Button onClick={completeSale} disabled={busy}>
              {busy ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
              Complete Sale
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          {/* Customer Section */}
          <div className="border border-slate-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <User size={16} className="text-slate-600" />
              <p className="text-sm font-bold text-slate-700">
                Customer Details {saleType === 'cash' && <span className="font-normal text-slate-400">(optional)</span>}
              </p>
            </div>

            {customerId ? (
              <div className="flex items-center justify-between bg-teal-50 rounded-lg px-4 py-3 border border-teal-200">
                <div>
                  <p className="text-sm font-bold text-slate-800">
                    {customers.find((c) => c.id === customerId)?.full_name ?? 'Selected customer'}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {customers.find((c) => c.id === customerId)?.mobile ?? ''}
                  </p>
                </div>
                <button onClick={() => setCustomerId('')} className="text-xs text-red-500 font-semibold whitespace-nowrap">
                  Change
                </button>
              </div>
            ) : saleType === 'installment' ? (
              <div className="space-y-3">
                <Input
                  placeholder="Search existing customers by name or phone..."
                  value={checkoutCustSearch}
                  onChange={(e) => setCheckoutCustSearch(e.target.value)}
                  className="text-sm"
                />
                {checkoutCustSearch && (
                  <div className="border border-slate-200 rounded-xl max-h-40 overflow-y-auto">
                    {checkoutFiltered.length === 0 ? (
                      <p className="px-4 py-3 text-sm text-slate-400 text-center">No matches found.</p>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {checkoutFiltered.slice(0, 6).map((c) => (
                          <button
                            key={c.id}
                            onClick={() => {
                              setCustomerId(c.id);
                              setCheckoutCustSearch('');
                            }}
                            className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-teal-50 transition-colors text-left"
                          >
                            <div>
                              <p className="text-sm font-semibold text-slate-700">{c.full_name}</p>
                              <p className="text-xs text-slate-400">
                                {c.mobile && `${c.mobile}`}
                                {c.cnic && ` \u00b7 ${c.cnic}`}
                              </p>
                            </div>
                            <CheckCircle2 size={16} className="text-teal-500 shrink-0" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <div className="flex-1 border-t border-slate-200" />
                  <span className="text-xs text-slate-400 font-semibold">OR</span>
                  <div className="flex-1 border-t border-slate-200" />
                </div>
                <Button variant="outline" size="sm" fullWidth onClick={() => setCustModalOpen(true)}>
                  <UserPlus size={14} /> Add New Customer
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label="Customer Name"
                    value={cashCustName}
                    onChange={(e) => setCashCustName(e.target.value)}
                    placeholder="Walk-in Customer"
                  />
                  <Input
                    label="Phone Number"
                    value={cashCustPhone}
                    onChange={(e) => setCashCustPhone(e.target.value)}
                    placeholder="03XX-XXXXXXX"
                  />
                </div>
                <p className="text-xs text-slate-400">Leave blank to record as a walk-in cash sale.</p>
              </div>
            )}
          </div>

          {/* Sale Summary */}
          <div className="bg-slate-50 rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Type</span>
              <span className="font-semibold capitalize">{saleType}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Items</span>
              <span className="font-semibold">{cart.length}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Subtotal</span>
              <span className="font-semibold">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Discount</span>
              <span className="font-semibold">{formatCurrency(discountVal)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-2">
              <span className="font-bold">Total</span>
              <span className="font-bold text-teal-700 text-lg">{formatCurrency(total)}</span>
            </div>
          </div>

          {/* Installment Plan */}
          {saleType === 'installment' && (
            <div className="border border-amber-200 bg-amber-50/50 rounded-xl p-4 space-y-4">
              <p className="text-sm font-semibold text-amber-800">Installment Plan</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Advance / Down Payment (Rs)"
                  type="number"
                  value={install.advance}
                  onChange={(e) => setInstall({ ...install, advance: e.target.value })}
                />
                <Select
                  label="Frequency"
                  value={install.frequency}
                  onChange={(e) => setInstall({ ...install, frequency: e.target.value as 'monthly' | 'weekly' })}
                >
                  <option value="monthly">Monthly</option>
                  <option value="weekly">Weekly</option>
                </Select>
                <Input
                  label="Duration (months/weeks)"
                  type="number"
                  value={install.duration}
                  onChange={(e) => setInstall({ ...install, duration: e.target.value })}
                />
                <Input
                  label="Start Date"
                  type="date"
                  value={install.startDate}
                  onChange={(e) => setInstall({ ...install, startDate: e.target.value })}
                />
              </div>
              <div className="bg-white rounded-lg border border-amber-200 px-4 py-3 space-y-2">
                {(() => {
                  const adv = parseFloat(install.advance) || 0;
                  const rem = Math.max(0, total - adv);
                  const dur = parseInt(install.duration) || 1;
                  const per = rem / dur;
                  return (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">Remaining Balance</span>
                        <span className="font-semibold text-slate-800">{formatCurrency(rem)}</span>
                      </div>
                      <div className="flex justify-between text-sm border-t border-slate-100 pt-2">
                        <span className="font-semibold text-amber-700">Monthly Qist</span>
                        <span className="font-bold text-amber-800">
                          {formatCurrency(per)} / {install.frequency === 'monthly' ? 'mo' : 'wk'}
                        </span>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
              {error}
            </div>
          )}
        </div>
      </Modal>

      {/* Receipt Modal */}
      <Modal
        open={receiptOpen}
        onClose={() => setReceiptOpen(false)}
        title="Sale Completed"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setReceiptOpen(false)}>
              Close
            </Button>
            <Button
              onClick={() => lastSale && settings && printReceipt80mm(lastSale, settings)}
            >
              <Printer size={16} /> 80mm Receipt
            </Button>
            <Button
              variant="outline"
              onClick={() => lastSale && settings && printInvoiceA4(lastSale, settings)}
            >
              <Printer size={16} /> A4 Invoice
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
            Invoice <span className="font-mono font-semibold">{lastSale?.invoice_no}</span>
          </p>
          <p className="text-2xl font-bold text-teal-700 mt-3">{formatCurrency(lastSale?.total ?? 0)}</p>
          {lastSale?.sale_type === 'installment' && (
            <p className="text-sm text-amber-600 mt-1">
              Remaining: {formatCurrency(lastSale.remaining_balance)}
            </p>
          )}
        </div>
      </Modal>

      <QuickCustomerModal
        open={custModalOpen}
        onClose={() => setCustModalOpen(false)}
        onSaved={(c) => {
          setCustomerId(c.id);
          load();
        }}
      />
    </div>
  );
}

function QuickCustomerModal({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (c: Customer) => void;
}) {
  const [form, setForm] = useState({
    full_name: '',
    cnic: '',
    mobile: '',
    address: '',
    guarantor_name: '',
    guarantor_cnic: '',
    guarantor_phone: '',
    guarantor_relation: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm({
        full_name: '',
        cnic: '',
        mobile: '',
        address: '',
        guarantor_name: '',
        guarantor_cnic: '',
        guarantor_phone: '',
        guarantor_relation: '',
      });
      setError(null);
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!form.full_name.trim()) {
      setError('Full name is required.');
      return;
    }
    setBusy(true);
    setError(null);
    const { data, error } = await supabase
      .from('customers')
      .insert({
        full_name: form.full_name.trim(),
        cnic: form.cnic.trim(),
        mobile: form.mobile.trim(),
        address: form.address.trim(),
        guarantor_name: form.guarantor_name.trim(),
        guarantor_cnic: form.guarantor_cnic.trim(),
        guarantor_phone: form.guarantor_phone.trim(),
        guarantor_relation: form.guarantor_relation.trim(),
      })
      .select('*')
      .single();
    setBusy(false);
    if (error || !data) {
      setError(error?.message ?? 'Failed to add customer.');
      return;
    }
    onSaved(data as Customer);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add Customer"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" size={16} /> : null}
            Save Customer
          </Button>
        </>
      }
    >
      <div className="space-y-4">
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
          <Input
            label="Address"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
        </div>
        <div className="border-t border-slate-200 pt-4">
          <p className="text-sm font-semibold text-slate-700 mb-3">Guarantor / Witness Details</p>
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
            />
          </div>
        </div>
      </div>
      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
          {error}
        </div>
      )}
    </Modal>
  );
}
