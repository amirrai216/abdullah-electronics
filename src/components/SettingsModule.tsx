import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Settings } from '@/lib/types';
import { Modal, Button, Input, Textarea, Card, Badge } from '@/components/ui';
import { Settings as SettingsIcon, Save, Loader2, Store, AlertTriangle, Trash2, RotateCcw } from 'lucide-react';

export function SettingsModule() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetDone, setResetDone] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('settings').select('*').eq('id', 1).maybeSingle();
    setSettings(data as Settings | null);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    setError(null);
    const { error } = await supabase
      .from('settings')
      .update({
        shop_name: settings.shop_name,
        shop_address: settings.shop_address,
        shop_phone: settings.shop_phone,
        invoice_footer: settings.invoice_footer,
        currency: settings.currency,
      })
      .eq('id', 1);
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleReset = async (keepProducts: boolean) => {
    setResetting(true);
    setResetError(null);

    const order = [
      'installment_schedule',
      'installment_plans',
      'payments',
      'sale_items',
      'sales',
      'cashbook_entries',
      'expenses',
      'product_serials',
      'purchases',
    ];

    if (!keepProducts) order.push('products');

    for (const table of order) {
      const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) {
        setResetError(`Failed to clear ${table}: ${error.message}`);
        setResetting(false);
        return;
      }
    }

    if (keepProducts) {
      const { error } = await supabase.from('products').update({ quantity: 0 }).neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) {
        setResetError(`Failed to zero out product stock: ${error.message}`);
        setResetting(false);
        return;
      }
    }

    await supabase.from('customers').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    setResetting(false);
    setResetDone(true);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-teal-500" size={28} />
      </div>
    );
  }

  if (!settings) {
    return (
      <Card className="p-8">
        <p className="text-slate-500 text-center">Settings not found. Please contact support.</p>
      </Card>
    );
  }

  return (
    <div className="max-w-2xl space-y-5">
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center">
            <Store className="text-teal-600" size={20} />
          </div>
          <div>
            <h2 className="font-bold text-slate-800">Shop Information</h2>
            <p className="text-xs text-slate-400">Appears on invoices and receipts</p>
          </div>
        </div>

        <div className="space-y-4">
          <Input
            label="Shop Name"
            value={settings.shop_name}
            onChange={(e) => setSettings({ ...settings, shop_name: e.target.value })}
          />
          <Textarea
            label="Shop Address"
            rows={2}
            value={settings.shop_address}
            onChange={(e) => setSettings({ ...settings, shop_address: e.target.value })}
          />
          <Input
            label="Shop Phone"
            value={settings.shop_phone}
            onChange={(e) => setSettings({ ...settings, shop_phone: e.target.value })}
            placeholder="03XX-XXXXXXX"
          />
          <Input
            label="Currency Label"
            value={settings.currency}
            onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
            placeholder="PKR"
          />
          <Textarea
            label="Invoice Footer Note"
            rows={2}
            value={settings.invoice_footer}
            onChange={(e) => setSettings({ ...settings, invoice_footer: e.target.value })}
            hint="This text appears at the bottom of every printed invoice and receipt."
          />
        </div>

        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
            {error}
          </div>
        )}

        <div className="mt-5 flex items-center gap-3">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
            Save Settings
          </Button>
          {saved && (
            <Badge variant="green" className="animate-in fade-in">
              Saved successfully
            </Badge>
          )}
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
            <SettingsIcon className="text-blue-600" size={20} />
          </div>
          <h2 className="font-bold text-slate-800">System Info</h2>
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Next Invoice Number</span>
            <span className="font-mono font-semibold text-slate-700">
              INV-{String(settings.invoice_counter).padStart(5, '0')}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Database</span>
            <Badge variant="green">Connected</Badge>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Offline Mode</span>
            <Badge variant="teal">PWA Enabled</Badge>
          </div>
        </div>
      </Card>

      <Card className="p-6 border-red-200">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
            <AlertTriangle className="text-red-600" size={20} />
          </div>
          <div>
            <h2 className="font-bold text-slate-800">Danger Zone</h2>
            <p className="text-xs text-slate-400">Irreversible actions — proceed with caution</p>
          </div>
        </div>
        <p className="text-sm text-slate-500 mb-4">
          Resetting will permanently delete all sales, customers, payments, cashbook entries, and installment records.
          You can choose to keep your product list (with stock reset to zero) or wipe everything.
        </p>
        <Button variant="secondary" onClick={() => { setResetOpen(true); setResetError(null); setResetDone(false); }}>
          <Trash2 size={16} /> Reset / Clear All App Data
        </Button>
      </Card>

      <Modal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="Reset All App Data"
        size="md"
        footer={
          resetDone ? (
            <Button onClick={() => setResetOpen(false)}>Done</Button>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setResetOpen(false)} disabled={resetting}>
                Cancel
              </Button>
              <Button
                variant="outline"
                onClick={() => handleReset(true)}
                disabled={resetting}
              >
                {resetting ? <Loader2 className="animate-spin" size={16} /> : <RotateCcw size={16} />}
                Keep Products, Zero Stock
              </Button>
              <Button
                onClick={() => handleReset(false)}
                disabled={resetting}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {resetting ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16} />}
                Wipe Everything
              </Button>
            </>
          )
        }
      >
        {resetDone ? (
          <div className="text-center py-6">
            <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
              <RotateCcw className="text-emerald-600" size={28} />
            </div>
            <h3 className="text-lg font-bold text-slate-800">Reset Complete</h3>
            <p className="text-sm text-slate-500 mt-1">
              All app data has been cleared. You can now start fresh with real inventory, sales, and customers.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="text-red-600 shrink-0 mt-0.5" size={20} />
                <div className="space-y-1 text-sm text-red-700">
                  <p className="font-bold">This will permanently delete:</p>
                  <ul className="list-disc list-inside space-y-0.5 text-red-600">
                    <li>All sales, invoices, and transactions</li>
                    <li>All customer records and Khata balances</li>
                    <li>All cashbook entries and expenses</li>
                    <li>All installment plans and schedules</li>
                  </ul>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-700">Choose a reset option:</p>
              <div className="grid grid-cols-1 gap-2">
                <div className="border border-slate-200 rounded-xl p-3">
                  <p className="text-sm font-semibold text-slate-700">Keep Products, Zero Stock</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Keeps your product catalog intact but resets all stock to zero. Sales, customers, and cashbook are cleared.
                  </p>
                </div>
                <div className="border border-red-200 rounded-xl p-3">
                  <p className="text-sm font-semibold text-red-700">Wipe Everything</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Deletes everything including all products. Complete fresh start with empty database.
                  </p>
                </div>
              </div>
            </div>
            {resetError && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
                {resetError}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
