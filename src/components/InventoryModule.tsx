import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { Product, Category, Supplier, Purchase, ProductSerial } from '@/lib/types';
import { formatCurrency, formatDate, cn } from '@/lib/format';
import { Modal, Button, Input, Select, Textarea, Badge, Card, EmptyState, ConfirmDialog } from '@/components/ui';
import {
  Package,
  Plus,
  Pencil,
  Trash2,
  Search,
  AlertTriangle,
  Boxes,
  Truck,
  ShoppingCart,
  Smartphone,
  Loader2,
} from 'lucide-react';

type Tab = 'products' | 'serials' | 'suppliers' | 'purchases';

export function InventoryModule() {
  const [tab, setTab] = useState<Tab>('products');

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'products', label: 'Products', icon: <Package size={16} /> },
    { key: 'serials', label: 'Serial / IMEI', icon: <Smartphone size={16} /> },
    { key: 'suppliers', label: 'Suppliers', icon: <Truck size={16} /> },
    { key: 'purchases', label: 'Purchases', icon: <ShoppingCart size={16} /> },
  ];

  return (
    <div className="space-y-5">
      <div className="flex gap-1 p-1 bg-white rounded-xl border border-slate-200 w-fit overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap',
              tab === t.key ? 'bg-teal-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'products' && <ProductsTab />}
      {tab === 'serials' && <SerialsTab />}
      {tab === 'suppliers' && <SuppliersTab />}
      {tab === 'purchases' && <PurchasesTab />}
    </div>
  );
}

/* ============ PRODUCTS TAB ============ */

function ProductsTab() {
  const { isAdmin } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: prods }, { data: cats }] = await Promise.all([
      supabase.from('products').select('*, category:categories(*)').order('created_at', { ascending: false }),
      supabase.from('categories').select('*').order('sort_order'),
    ]);
    setProducts((prods as Product[]) ?? []);
    setCategories((cats as Category[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = products.filter((p) => {
    const q = search.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.brand_model?.toLowerCase().includes(q) ||
      (p.category?.name ?? '').toLowerCase().includes(q)
    );
  });

  const lowStock = products.filter((p) => p.quantity <= p.min_stock_level);

  return (
    <div className="space-y-4">
      {lowStock.length > 0 && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={18} />
          <div className="text-sm text-amber-800">
            <strong>{lowStock.length}</strong> product(s) are at or below minimum stock level and need restocking.
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <Input
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setCatModalOpen(true)}>
            <Boxes size={16} /> Categories
          </Button>
          {isAdmin && (
            <Button
              onClick={() => {
                setEditing(null);
                setModalOpen(true);
              }}
            >
              <Plus size={16} /> Add Product
            </Button>
          )}
        </div>
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="animate-spin text-teal-500" size={28} />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Package size={48} />}
            title="No products yet"
            description="Add your first product to start tracking inventory."
            action={
              isAdmin && (
                <Button onClick={() => setModalOpen(true)}>
                  <Plus size={16} /> Add Product
                </Button>
              )
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">Product</th>
                  <th className="text-left px-4 py-3 font-semibold">Category</th>
                  <th className="text-right px-4 py-3 font-semibold">Selling Price</th>
                  {isAdmin && <th className="text-right px-4 py-3 font-semibold">Cost Price</th>}
                  <th className="text-center px-4 py-3 font-semibold">Stock</th>
                  <th className="text-center px-4 py-3 font-semibold">Serial Track</th>
                  {isAdmin && <th className="text-right px-4 py-3 font-semibold">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((p) => {
                  const low = p.quantity <= p.min_stock_level;
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-800">{p.name}</div>
                        {p.brand_model && <div className="text-xs text-slate-400">{p.brand_model}</div>}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{p.category?.name ?? '-'}</td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-800">
                        {formatCurrency(p.selling_price)}
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-3 text-right text-slate-500">{formatCurrency(p.purchase_price)}</td>
                      )}
                      <td className="px-4 py-3 text-center">
                        <span
                          className={cn(
                            'inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold',
                            low ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                          )}
                        >
                          {p.quantity} {p.unit}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {p.track_serials ? <Badge variant="blue">Yes</Badge> : <Badge variant="slate">No</Badge>}
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1">
                            <button
                              onClick={() => {
                                setEditing(p);
                                setModalOpen(true);
                              }}
                              className="p-1.5 rounded-lg text-slate-400 hover:bg-teal-50 hover:text-teal-600 transition-colors"
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              onClick={() => setDeleteId(p.id)}
                              className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ProductModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        editing={editing}
        categories={categories}
        onSaved={load}
      />
      <CategoryModal open={catModalOpen} onClose={() => setCatModalOpen(false)} onSaved={load} />
      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={async () => {
          if (!deleteId) return;
          await supabase.from('products').delete().eq('id', deleteId);
          load();
        }}
        title="Delete Product"
        message="Are you sure? This will remove the product. Existing sales records will be preserved."
        confirmLabel="Delete"
      />
    </div>
  );
}

function ProductModal({
  open,
  onClose,
  editing,
  categories,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  editing: Product | null;
  categories: Category[];
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: '',
    brand_model: '',
    category_id: '',
    purchase_price: '',
    selling_price: '',
    min_stock_level: '0',
    quantity: '0',
    track_serials: false,
    unit: 'piece',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editing) {
      setForm({
        name: editing.name,
        brand_model: editing.brand_model ?? '',
        category_id: editing.category_id ?? '',
        purchase_price: String(editing.purchase_price ?? ''),
        selling_price: String(editing.selling_price ?? ''),
        min_stock_level: String(editing.min_stock_level ?? '0'),
        quantity: String(editing.quantity ?? '0'),
        track_serials: editing.track_serials,
        unit: editing.unit ?? 'piece',
      });
    } else {
      setForm({
        name: '',
        brand_model: '',
        category_id: '',
        purchase_price: '',
        selling_price: '',
        min_stock_level: '0',
        quantity: '0',
        track_serials: false,
        unit: 'piece',
      });
    }
    setError(null);
  }, [editing, open]);

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      setError('Product name is required.');
      return;
    }
    setBusy(true);
    setError(null);
    const payload = {
      name: form.name.trim(),
      brand_model: form.brand_model.trim(),
      category_id: form.category_id || null,
      purchase_price: parseFloat(form.purchase_price) || 0,
      selling_price: parseFloat(form.selling_price) || 0,
      min_stock_level: parseInt(form.min_stock_level) || 0,
      quantity: parseInt(form.quantity) || 0,
      track_serials: form.track_serials,
      unit: form.unit,
    };
    let error;
    if (editing) {
      ({ error } = await supabase.from('products').update(payload).eq('id', editing.id));
    } else {
      ({ error } = await supabase.from('products').insert(payload));
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
      title={editing ? 'Edit Product' : 'Add Product'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" size={16} /> : null}
            {editing ? 'Save Changes' : 'Add Product'}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Product Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="e.g. Haier Refrigerator"
        />
        <Input
          label="Brand / Model"
          value={form.brand_model}
          onChange={(e) => setForm({ ...form, brand_model: e.target.value })}
          placeholder="e.g. HRF-216"
        />
        <Select
          label="Category"
          value={form.category_id}
          onChange={(e) => setForm({ ...form, category_id: e.target.value })}
        >
          <option value="">No category</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Input
          label="Unit"
          value={form.unit}
          onChange={(e) => setForm({ ...form, unit: e.target.value })}
          placeholder="piece"
        />
        <Input
          label="Purchase Price"
          type="number"
          value={form.purchase_price}
          onChange={(e) => setForm({ ...form, purchase_price: e.target.value })}
        />
        <Input
          label="Default Sale Price"
          type="number"
          value={form.selling_price}
          onChange={(e) => setForm({ ...form, selling_price: e.target.value })}
          placeholder="Optional"
        />
        <Input
          label="Available Quantity"
          type="number"
          value={form.quantity}
          onChange={(e) => setForm({ ...form, quantity: e.target.value })}
        />
        <Input
          label="Minimum Stock Alert Level"
          type="number"
          value={form.min_stock_level}
          onChange={(e) => setForm({ ...form, min_stock_level: e.target.value })}
        />
        <label className="flex items-center gap-3 sm:col-span-2 mt-1 cursor-pointer">
          <input
            type="checkbox"
            checked={form.track_serials}
            onChange={(e) => setForm({ ...form, track_serials: e.target.checked })}
            className="w-4 h-4 rounded accent-teal-600"
          />
          <span className="text-sm font-medium text-slate-700">
            Track unique serial numbers / IMEI (for high-value electronics)
          </span>
        </label>
      </div>
      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
          {error}
        </div>
      )}
    </Modal>
  );
}

function CategoryModal({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from('categories').select('*').order('sort_order');
    setCategories((data as Category[]) ?? []);
  }, []);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const handleAdd = async () => {
    if (!name.trim()) return;
    setBusy(true);
    await supabase.from('categories').insert({ name: name.trim(), description: desc.trim() });
    setName('');
    setDesc('');
    setBusy(false);
    load();
    onSaved();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('categories').delete().eq('id', id);
    load();
    onSaved();
  };

  return (
    <Modal open={open} onClose={onClose} title="Manage Categories" size="md">
      <div className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="Category name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1"
          />
          <Button onClick={handleAdd} disabled={busy}>
            <Plus size={16} /> Add
          </Button>
        </div>
        <Input
          placeholder="Description (optional)"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
        />
        <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl">
          {categories.length === 0 && (
            <p className="px-4 py-6 text-sm text-slate-400 text-center">No categories yet.</p>
          )}
          {categories.map((c) => (
            <div key={c.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-slate-700">{c.name}</p>
                {c.description && <p className="text-xs text-slate-400">{c.description}</p>}
              </div>
              <button
                onClick={() => handleDelete(c.id)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}

/* ============ SERIALS TAB ============ */

function SerialsTab() {
  const { isAdmin } = useAuth();
  const [serials, setSerials] = useState<ProductSerial[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: s }, { data: p }] = await Promise.all([
      supabase
        .from('product_serials')
        .select('*, product:products(*)')
        .order('created_at', { ascending: false }),
      supabase.from('products').select('*').eq('track_serials', true).order('name'),
    ]);
    setSerials((s as ProductSerial[]) ?? []);
    setProducts((p as Product[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = serials.filter((s) => {
    const q = search.toLowerCase();
    return (
      s.serial_number.toLowerCase().includes(q) ||
      (s.product?.name ?? '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <Input
            placeholder="Search serial / IMEI..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        {isAdmin && (
          <Button onClick={() => setModalOpen(true)}>
            <Plus size={16} /> Add Serial
          </Button>
        )}
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="animate-spin text-teal-500" size={28} />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Smartphone size={48} />}
            title="No serial numbers tracked"
            description="Add serial/IMEI numbers for high-value products like ACs, TVs, and refrigerators."
            action={
              isAdmin && (
                <Button onClick={() => setModalOpen(true)}>
                  <Plus size={16} /> Add Serial
                </Button>
              )
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">Serial / IMEI</th>
                  <th className="text-left px-4 py-3 font-semibold">Product</th>
                  <th className="text-center px-4 py-3 font-semibold">Status</th>
                  <th className="text-left px-4 py-3 font-semibold">Added</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-mono font-semibold text-slate-800">{s.serial_number}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {s.product?.name ?? '-'}
                      {s.product?.brand_model && (
                        <span className="text-xs text-slate-400 ml-1">{s.product.brand_model}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {s.status === 'in_stock' && <Badge variant="green">In Stock</Badge>}
                      {s.status === 'sold' && <Badge variant="slate">Sold</Badge>}
                      {s.status === 'reserved' && <Badge variant="amber">Reserved</Badge>}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(s.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <SerialModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        products={products}
        onSaved={load}
      />
    </div>
  );
}

function SerialModal({
  open,
  onClose,
  products,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  products: Product[];
  onSaved: () => void;
}) {
  const [productId, setProductId] = useState('');
  const [serials, setSerials] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setProductId('');
      setSerials('');
      setError(null);
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!productId) {
      setError('Select a product.');
      return;
    }
    const lines = serials
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) {
      setError('Enter at least one serial number.');
      return;
    }
    setBusy(true);
    setError(null);
    const rows = lines.map((sn) => ({ product_id: productId, serial_number: sn }));
    const { error } = await supabase.from('product_serials').insert(rows);
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
      title="Add Serial Numbers"
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" size={16} /> : null}
            Save Serials
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Select label="Product" value={productId} onChange={(e) => setProductId(e.target.value)}>
          <option value="">Select product...</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} {p.brand_model ? `(${p.brand_model})` : ''}
            </option>
          ))}
        </Select>
        <Textarea
          label="Serial Numbers / IMEI"
          placeholder="Enter one per line..."
          rows={6}
          value={serials}
          onChange={(e) => setSerials(e.target.value)}
          hint="You can paste multiple serial numbers, one per line."
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

/* ============ SUPPLIERS TAB ============ */

function SuppliersTab() {
  const { isAdmin } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('suppliers').select('*').order('created_at', { ascending: false });
    setSuppliers((data as Supplier[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = suppliers.filter((s) => {
    const q = search.toLowerCase();
    return s.name.toLowerCase().includes(q) || s.phone?.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <Input
            placeholder="Search suppliers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        {isAdmin && (
          <Button
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
          >
            <Plus size={16} /> Add Supplier
          </Button>
        )}
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="animate-spin text-teal-500" size={28} />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Truck size={48} />}
            title="No suppliers yet"
            description="Add vendor records to track your purchase sources."
            action={
              isAdmin && (
                <Button onClick={() => setModalOpen(true)}>
                  <Plus size={16} /> Add Supplier
                </Button>
              )
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">Name</th>
                  <th className="text-left px-4 py-3 font-semibold">Contact Person</th>
                  <th className="text-left px-4 py-3 font-semibold">Phone</th>
                  <th className="text-left px-4 py-3 font-semibold">Address</th>
                  {isAdmin && <th className="text-right px-4 py-3 font-semibold">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-semibold text-slate-800">{s.name}</td>
                    <td className="px-4 py-3 text-slate-600">{s.contact_person || '-'}</td>
                    <td className="px-4 py-3 text-slate-600">{s.phone || '-'}</td>
                    <td className="px-4 py-3 text-slate-500">{s.address || '-'}</td>
                    {isAdmin && (
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => {
                              setEditing(s);
                              setModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:bg-teal-50 hover:text-teal-600"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            onClick={() => setDeleteId(s.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <SupplierModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        editing={editing}
        onSaved={load}
      />
      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={async () => {
          if (!deleteId) return;
          await supabase.from('suppliers').delete().eq('id', deleteId);
          load();
        }}
        title="Delete Supplier"
        message="Are you sure you want to delete this supplier?"
        confirmLabel="Delete"
      />
    </div>
  );
}

function SupplierModal({
  open,
  onClose,
  editing,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  editing: Supplier | null;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: '',
    contact_person: '',
    phone: '',
    address: '',
    note: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editing) {
      setForm({
        name: editing.name,
        contact_person: editing.contact_person ?? '',
        phone: editing.phone ?? '',
        address: editing.address ?? '',
        note: editing.note ?? '',
      });
    } else {
      setForm({ name: '', contact_person: '', phone: '', address: '', note: '' });
    }
    setError(null);
  }, [editing, open]);

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      setError('Supplier name is required.');
      return;
    }
    setBusy(true);
    setError(null);
    const payload = {
      name: form.name.trim(),
      contact_person: form.contact_person.trim(),
      phone: form.phone.trim(),
      address: form.address.trim(),
      note: form.note.trim(),
    };
    let error;
    if (editing) {
      ({ error } = await supabase.from('suppliers').update(payload).eq('id', editing.id));
    } else {
      ({ error } = await supabase.from('suppliers').insert(payload));
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
      title={editing ? 'Edit Supplier' : 'Add Supplier'}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" size={16} /> : null}
            {editing ? 'Save' : 'Add Supplier'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label="Supplier Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <Input
          label="Contact Person"
          value={form.contact_person}
          onChange={(e) => setForm({ ...form, contact_person: e.target.value })}
        />
        <Input
          label="Phone"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
        />
        <Textarea
          label="Address"
          rows={2}
          value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
        />
        <Textarea
          label="Note"
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

/* ============ PURCHASES TAB ============ */

function PurchasesTab() {
  const { isAdmin } = useAuth();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: pur }, { data: prods }, { data: sups }] = await Promise.all([
      supabase
        .from('purchases')
        .select('*, supplier:suppliers(*), product:products(*)')
        .order('created_at', { ascending: false }),
      supabase.from('products').select('*').order('name'),
      supabase.from('suppliers').select('*').order('name'),
    ]);
    setPurchases((pur as Purchase[]) ?? []);
    setProducts((prods as Product[]) ?? []);
    setSuppliers((sups as Supplier[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-500">Log stock purchases from suppliers. Stock updates automatically.</p>
        {isAdmin && (
          <Button onClick={() => setModalOpen(true)}>
            <Plus size={16} /> Add Purchase
          </Button>
        )}
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="animate-spin text-teal-500" size={28} />
          </div>
        ) : purchases.length === 0 ? (
          <EmptyState
            icon={<ShoppingCart size={48} />}
            title="No purchases logged"
            description="Record stock purchases to track cost of goods and supplier history."
            action={
              isAdmin && (
                <Button onClick={() => setModalOpen(true)}>
                  <Plus size={16} /> Add Purchase
                </Button>
              )
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">Date</th>
                  <th className="text-left px-4 py-3 font-semibold">Product</th>
                  <th className="text-left px-4 py-3 font-semibold">Supplier</th>
                  <th className="text-center px-4 py-3 font-semibold">Qty</th>
                  <th className="text-right px-4 py-3 font-semibold">Unit Cost</th>
                  <th className="text-right px-4 py-3 font-semibold">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {purchases.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 text-slate-500">{formatDate(p.purchase_date)}</td>
                    <td className="px-4 py-3 font-semibold text-slate-800">
                      {p.product?.name ?? '-'}
                      {p.product?.brand_model && (
                        <span className="text-xs text-slate-400 ml-1">{p.product.brand_model}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{p.supplier?.name ?? '-'}</td>
                    <td className="px-4 py-3 text-center text-slate-600">{p.quantity}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(p.unit_cost)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-800">
                      {formatCurrency(p.total_cost)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <PurchaseModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        products={products}
        suppliers={suppliers}
        onSaved={load}
      />
    </div>
  );
}

function PurchaseModal({
  open,
  onClose,
  products,
  suppliers,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  products: Product[];
  suppliers: Supplier[];
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    product_id: '',
    supplier_id: '',
    quantity: '1',
    unit_cost: '',
    purchase_date: new Date().toISOString().slice(0, 10),
    note: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    if (open) {
      setForm({
        product_id: '',
        supplier_id: '',
        quantity: '1',
        unit_cost: '',
        purchase_date: new Date().toISOString().slice(0, 10),
        note: '',
      });
      setError(null);
      supabase
        .from('categories')
        .select('*')
        .order('sort_order')
        .then(({ data }) => setCategories((data as Category[]) ?? []));
    }
  }, [open]);

  const handleCreatedProduct = async (newId: string) => {
    await onSaved();
    setForm((f) => ({ ...f, product_id: newId }));
  };

  const handleCreatedSupplier = async (newId: string) => {
    await onSaved();
    setForm((f) => ({ ...f, supplier_id: newId }));
  };

  const handleSubmit = async () => {
    if (!form.product_id) {
      setError('Select a product.');
      return;
    }
    const qty = parseInt(form.quantity) || 0;
    const unitCost = parseFloat(form.unit_cost) || 0;
    if (qty <= 0) {
      setError('Quantity must be greater than 0.');
      return;
    }
    setBusy(true);
    setError(null);

    let supplierId = form.supplier_id || null;
    if (!supplierId) {
      const { data: existing } = await supabase
        .from('suppliers')
        .select('id')
        .eq('name', 'Direct / Local Purchase')
        .maybeSingle();
      if (existing) {
        supplierId = (existing as Supplier).id;
      } else {
        const { data: created } = await supabase
          .from('suppliers')
          .insert({ name: 'Direct / Local Purchase', contact_person: '', phone: '', address: '', note: 'Auto-assigned for purchases without a supplier' })
          .select('id')
          .single();
        if (created) supplierId = (created as Supplier).id;
      }
    }

    const payload = {
      product_id: form.product_id,
      supplier_id: supplierId,
      quantity: qty,
      unit_cost: unitCost,
      total_cost: qty * unitCost,
      purchase_date: form.purchase_date,
      note: form.note.trim(),
    };
    const { error } = await supabase.from('purchases').insert(payload);
    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }
    const prod = products.find((p) => p.id === form.product_id);
    if (prod) {
      await supabase
        .from('products')
        .update({ quantity: prod.quantity + qty })
        .eq('id', form.product_id);
    }
    setBusy(false);
    onSaved();
    onClose();
  };

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title="Log Purchase"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={busy}>
              {busy ? <Loader2 className="animate-spin" size={16} /> : null}
              Save Purchase
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Select
                  label="Product"
                  value={form.product_id}
                  onChange={(e) => setForm({ ...form, product_id: e.target.value })}
                >
                  <option value="">Select product...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.brand_model ? `(${p.brand_model})` : ''} — Stock: {p.quantity}
                    </option>
                  ))}
                </Select>
              </div>
              <Button variant="outline" onClick={() => setShowAddProduct(true)} className="mb-0.5 shrink-0">
                <Plus size={16} /> Add New Product
              </Button>
            </div>
          </div>
          <div className="sm:col-span-2">
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Select
                  label="Supplier (optional)"
                  value={form.supplier_id}
                  onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}
                >
                  <option value="">Direct / Local Purchase</option>
                  {suppliers
                    .filter((s) => s.name !== 'Direct / Local Purchase')
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                </Select>
              </div>
              <Button variant="outline" onClick={() => setShowAddSupplier(true)} className="mb-0.5 shrink-0">
                <Plus size={16} /> Add New Supplier
              </Button>
            </div>
            <p className="mt-1 text-xs text-slate-400">Leave blank for direct/local purchases.</p>
          </div>
          <Input
            label="Purchase Date"
            type="date"
            value={form.purchase_date}
            onChange={(e) => setForm({ ...form, purchase_date: e.target.value })}
          />
          <Input
            label="Quantity"
            type="number"
            value={form.quantity}
            onChange={(e) => setForm({ ...form, quantity: e.target.value })}
          />
          <Input
            label="Unit Cost"
            type="number"
            value={form.unit_cost}
            onChange={(e) => setForm({ ...form, unit_cost: e.target.value })}
          />
          <Textarea
            label="Note"
            rows={2}
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
            className="sm:col-span-2"
          />
        </div>
        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
            {error}
          </div>
        )}
      </Modal>

      <InlineProductModal
        open={showAddProduct}
        onClose={() => setShowAddProduct(false)}
        categories={categories}
        onCreated={handleCreatedProduct}
      />
      <InlineSupplierModal
        open={showAddSupplier}
        onClose={() => setShowAddSupplier(false)}
        onCreated={handleCreatedSupplier}
      />
    </>
  );
}

function InlineProductModal({
  open,
  onClose,
  categories,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  categories: Category[];
  onCreated: (id: string) => void;
}) {
  const [form, setForm] = useState({
    name: '',
    brand_model: '',
    category_id: '',
    purchase_price: '',
    selling_price: '',
    quantity: '0',
    unit: 'piece',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm({ name: '', brand_model: '', category_id: '', purchase_price: '', selling_price: '', quantity: '0', unit: 'piece' });
      setError(null);
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      setError('Product name is required.');
      return;
    }
    setBusy(true);
    setError(null);
    const { data, error } = await supabase
      .from('products')
      .insert({
        name: form.name.trim(),
        brand_model: form.brand_model.trim(),
        category_id: form.category_id || null,
        purchase_price: parseFloat(form.purchase_price) || 0,
        selling_price: parseFloat(form.selling_price) || 0,
        min_stock_level: 0,
        quantity: parseInt(form.quantity) || 0,
        track_serials: false,
        unit: form.unit,
      })
      .select('id')
      .single();
    setBusy(false);
    if (error || !data) {
      setError(error?.message ?? 'Failed to create product.');
      return;
    }
    onCreated((data as Product).id);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Quick Add New Product"
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" size={16} /> : null}
            Add Product
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Product Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="e.g. Haier Refrigerator"
        />
        <Input
          label="Brand / Model"
          value={form.brand_model}
          onChange={(e) => setForm({ ...form, brand_model: e.target.value })}
          placeholder="e.g. HRF-216"
        />
        <Select
          label="Category"
          value={form.category_id}
          onChange={(e) => setForm({ ...form, category_id: e.target.value })}
        >
          <option value="">No category</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Input
          label="Unit"
          value={form.unit}
          onChange={(e) => setForm({ ...form, unit: e.target.value })}
          placeholder="piece"
        />
        <Input
          label="Purchase Price"
          type="number"
          value={form.purchase_price}
          onChange={(e) => setForm({ ...form, purchase_price: e.target.value })}
        />
        <Input
          label="Default Sale Price"
          type="number"
          value={form.selling_price}
          onChange={(e) => setForm({ ...form, selling_price: e.target.value })}
          placeholder="Optional"
        />
        <Input
          label="Quantity"
          type="number"
          value={form.quantity}
          onChange={(e) => setForm({ ...form, quantity: e.target.value })}
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

function InlineSupplierModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [form, setForm] = useState({ name: '', contact_person: '', phone: '', address: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm({ name: '', contact_person: '', phone: '', address: '' });
      setError(null);
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      setError('Supplier name is required.');
      return;
    }
    setBusy(true);
    setError(null);
    const { data, error } = await supabase
      .from('suppliers')
      .insert({
        name: form.name.trim(),
        contact_person: form.contact_person.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
        note: '',
      })
      .select('id')
      .single();
    setBusy(false);
    if (error || !data) {
      setError(error?.message ?? 'Failed to create supplier.');
      return;
    }
    onCreated((data as Supplier).id);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Quick Add New Supplier"
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" size={16} /> : null}
            Add Supplier
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label="Supplier Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <Input
          label="Contact Person"
          value={form.contact_person}
          onChange={(e) => setForm({ ...form, contact_person: e.target.value })}
        />
        <Input
          label="Phone"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
        />
        <Textarea
          label="Address"
          rows={2}
          value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
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
