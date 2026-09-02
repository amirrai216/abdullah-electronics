import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { AppUser, UserRole } from '@/lib/types';
import { formatDate, cn } from '@/lib/format';
import { Modal, Button, Input, Select, Badge, Card, EmptyState, ConfirmDialog } from '@/components/ui';
import {
  UserCog,
  Plus,
  Trash2,
  Shield,
  Loader2,
  Mail,
  User as UserIcon,
} from 'lucide-react';

export function UsersModule() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [toggleId, setToggleId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('app_users').select('*').order('created_at', { ascending: false });
    setUsers((data as AppUser[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleToggleActive = async (id: string) => {
    const u = users.find((x) => x.id === id);
    if (!u) return;
    await supabase.from('app_users').update({ active: !u.active }).eq('id', id);
    load();
    if (id === currentUser?.id) return;
  };

  const handleChangeRole = async (id: string, role: UserRole) => {
    await supabase.from('app_users').update({ role }).eq('id', id);
    load();
    if (id === currentUser?.id) return;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Manage staff accounts and their access levels.</p>
        <Button onClick={() => setModalOpen(true)}>
          <Plus size={16} /> Add Staff
        </Button>
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="animate-spin text-teal-500" size={28} />
          </div>
        ) : users.length === 0 ? (
          <EmptyState icon={<UserCog size={48} />} title="No users found" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">Name</th>
                  <th className="text-left px-4 py-3 font-semibold">Role</th>
                  <th className="text-center px-4 py-3 font-semibold">Status</th>
                  <th className="text-left px-4 py-3 font-semibold">Joined</th>
                  <th className="text-right px-4 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-600">
                          {u.full_name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800">
                            {u.full_name}
                            {u.id === currentUser?.id && <span className="text-xs text-teal-600 ml-1">(You)</span>}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {u.id === currentUser?.id ? (
                        <Badge variant={u.role === 'admin' ? 'teal' : 'slate'} className="capitalize">
                          <Shield size={11} className="mr-1" />
                          {u.role}
                        </Badge>
                      ) : (
                        <Select
                          value={u.role}
                          onChange={(e) => handleChangeRole(u.id, e.target.value as UserRole)}
                          className="py-1.5 text-sm w-32"
                        >
                          <option value="admin">Admin</option>
                          <option value="staff">Staff</option>
                        </Select>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => u.id !== currentUser?.id && setToggleId(u.id)}
                        disabled={u.id === currentUser?.id}
                        className={cn(
                          'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold cursor-pointer',
                          u.active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700',
                          u.id === currentUser?.id && 'opacity-60 cursor-not-allowed'
                        )}
                      >
                        {u.active ? 'Active' : 'Disabled'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(u.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        {u.id !== currentUser?.id && (
                          <button
                            onClick={() => setDeleteId(u.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
        <h3 className="text-sm font-bold text-slate-700 mb-2">Role Permissions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div className="flex items-start gap-2">
            <Badge variant="teal" className="mt-0.5">Admin</Badge>
            <p className="text-slate-600">Full access: POS, inventory, customers, cashbook, reports, P&L, cost prices, settings, and user management.</p>
          </div>
          <div className="flex items-start gap-2">
            <Badge variant="slate" className="mt-0.5">Staff</Badge>
            <p className="text-slate-600">Restricted access: POS billing, adding payments, checking stock, and viewing customers. No access to cost prices, profit reports, or settings.</p>
          </div>
        </div>
      </div>

      <AddUserModal open={modalOpen} onClose={() => setModalOpen(false)} onSaved={load} />
      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={async () => {
          if (!deleteId) return;
          await supabase.from('app_users').delete().eq('id', deleteId);
          load();
        }}
        title="Remove User"
        message="This will remove the staff account. They will no longer be able to sign in."
        confirmLabel="Remove"
      />
      <ConfirmDialog
        open={!!toggleId}
        onClose={() => setToggleId(null)}
        onConfirm={() => toggleId && handleToggleActive(toggleId)}
        title="Toggle Status"
        message="Are you sure you want to change this user's active status?"
        confirmLabel="Yes, change"
        danger={false}
      />
    </div>
  );
}

function AddUserModal({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { signUp } = useAuth();
  const [form, setForm] = useState({ full_name: '', email: '', password: '', role: 'staff' as UserRole });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm({ full_name: '', email: '', password: '', role: 'staff' });
      setError(null);
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!form.full_name.trim() || !form.email.trim() || !form.password) {
      setError('All fields are required.');
      return;
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setBusy(true);
    setError(null);
    const { error } = await signUp(form.email.trim(), form.password, form.full_name.trim(), form.role);
    setBusy(false);
    if (error) {
      setError(error);
      return;
    }
    onSaved();
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add Staff Member"
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" size={16} /> : null}
            Create Account
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="relative">
          <UserIcon className="absolute left-3 top-[42px] -translate-y-1/2 text-slate-400" size={18} />
          <Input
            label="Full Name"
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            className="pl-10"
            placeholder="Staff member name"
          />
        </div>
        <div className="relative">
          <Mail className="absolute left-3 top-[42px] -translate-y-1/2 text-slate-400" size={18} />
          <Input
            label="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="pl-10"
            placeholder="staff@example.com"
          />
        </div>
        <Input
          label="Password"
          type="password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          placeholder="At least 6 characters"
        />
        <Select
          label="Role"
          value={form.role}
          onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
        >
          <option value="staff">Staff (restricted access)</option>
          <option value="admin">Admin (full access)</option>
        </Select>
      </div>
      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
          {error}
        </div>
      )}
    </Modal>
  );
}
