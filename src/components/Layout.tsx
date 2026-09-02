import { useState, ReactNode } from 'react';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/format';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  Wallet,
  BarChart3,
  Download,
  UserCog,
  Settings as SettingsIcon,
  Store,
  LogOut,
  Menu,
  X,
  Shield,
} from 'lucide-react';

export type NavKey =
  | 'dashboard'
  | 'inventory'
  | 'pos'
  | 'customers'
  | 'cashbook'
  | 'reports'
  | 'export'
  | 'users'
  | 'settings';

interface NavItem {
  key: NavKey;
  label: string;
  icon: ReactNode;
  adminOnly?: boolean;
}

const NAV: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
  { key: 'pos', label: 'POS Billing', icon: <ShoppingCart size={20} /> },
  { key: 'inventory', label: 'Inventory', icon: <Package size={20} /> },
  { key: 'customers', label: 'Customers', icon: <Users size={20} /> },
  { key: 'cashbook', label: 'Cashbook', icon: <Wallet size={20} /> },
  { key: 'reports', label: 'Reports & P&L', icon: <BarChart3 size={20} />, adminOnly: true },
  { key: 'export', label: 'Export Data', icon: <Download size={20} /> },
  { key: 'users', label: 'Users & Roles', icon: <UserCog size={20} />, adminOnly: true },
  { key: 'settings', label: 'Settings', icon: <SettingsIcon size={20} />, adminOnly: true },
];

interface LayoutProps {
  current: NavKey;
  onNavigate: (key: NavKey) => void;
  children: ReactNode;
}

export function Layout({ current, onNavigate, children }: LayoutProps) {
  const { profile, signOut, isAdmin } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const items = NAV.filter((n) => !n.adminOnly || isAdmin);

  const handleNav = (key: NavKey) => {
    onNavigate(key);
    setMobileOpen(false);
  };

  const SidebarContent = (
    <>
      <div className="flex items-center gap-3 px-6 py-6 border-b border-slate-800/60">
        <div className="w-10 h-10 rounded-xl bg-teal-500 flex items-center justify-center shadow-lg shadow-teal-500/20">
          <Store className="text-white" size={22} />
        </div>
        <div className="min-w-0">
          <p className="text-white font-bold text-sm truncate">Abdullah Electronics</p>
          <p className="text-slate-400 text-xs">ERP System</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {items.map((item) => (
          <button
            key={item.key}
            onClick={() => handleNav(item.key)}
            className={cn(
              'w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
              current === item.key
                ? 'bg-teal-500 text-white shadow-lg shadow-teal-500/20'
                : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
            )}
          >
            {item.icon}
            <span>{item.label}</span>
            {item.adminOnly && (
              <Shield size={12} className="ml-auto text-amber-400/80" />
            )}
          </button>
        ))}
      </nav>

      <div className="px-3 py-4 border-t border-slate-800/60">
        <div className="flex items-center gap-3 px-3 py-2 mb-2">
          <div className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center text-sm font-bold text-white">
            {profile?.full_name?.charAt(0)?.toUpperCase() ?? '?'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white truncate">{profile?.full_name}</p>
            <p className="text-xs text-slate-400 capitalize">{profile?.role}</p>
          </div>
        </div>
        <button
          onClick={signOut}
          className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-all"
        >
          <LogOut size={20} />
          <span>Sign Out</span>
        </button>
      </div>
    </>
  );

  const currentItem = NAV.find((n) => n.key === current);

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 bg-slate-900 flex-col fixed inset-y-0 left-0 z-30">
        {SidebarContent}
      </aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative w-64 bg-slate-900 flex flex-col animate-in slide-in-from-left">
            {SidebarContent}
          </aside>
        </div>
      )}

      <div className="flex-1 lg:ml-64 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-slate-200">
          <div className="flex items-center justify-between px-4 sm:px-6 py-3.5">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileOpen(true)}
                className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
              >
                <Menu size={22} />
              </button>
              <h1 className="text-lg font-bold text-slate-800">{currentItem?.label}</h1>
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-teal-50 text-teal-700 text-xs font-semibold">
                <Shield size={12} />
                {isAdmin ? 'Admin' : 'Staff'}
              </span>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 max-w-[1400px] w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
