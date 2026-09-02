import { useState } from 'react';
import { AuthProvider, useAuth } from '@/lib/auth';
import { AuthScreen } from '@/components/AuthScreen';
import { Layout, NavKey } from '@/components/Layout';
import { DashboardModule } from '@/components/DashboardModule';
import { InventoryModule } from '@/components/InventoryModule';
import { POSModule } from '@/components/POSModule';
import { CustomersModule } from '@/components/CustomersModule';
import { CashbookModule } from '@/components/CashbookModule';
import { ReportsModule } from '@/components/ReportsModule';
import { ExportModule } from '@/components/ExportModule';
import { UsersModule } from '@/components/UsersModule';
import { SettingsModule } from '@/components/SettingsModule';
import { Loader2 } from 'lucide-react';

function AppContent() {
  const { user, profile, loading } = useAuth();
  const [current, setCurrent] = useState<NavKey>('dashboard');

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="animate-spin text-teal-400" size={32} />
      </div>
    );
  }

  if (!user) return <AuthScreen />;

  const renderModule = () => {
    switch (current) {
      case 'dashboard':
        return <DashboardModule onNavigate={setCurrent} />;
      case 'inventory':
        return <InventoryModule />;
      case 'pos':
        return <POSModule />;
      case 'customers':
        return <CustomersModule />;
      case 'cashbook':
        return <CashbookModule />;
      case 'reports':
        return profile.role === 'admin' ? <ReportsModule /> : <DashboardModule onNavigate={setCurrent} />;
      case 'export':
        return <ExportModule />;
      case 'users':
        return profile.role === 'admin' ? <UsersModule /> : <DashboardModule onNavigate={setCurrent} />;
      case 'settings':
        return profile.role === 'admin' ? <SettingsModule /> : <DashboardModule onNavigate={setCurrent} />;
      default:
        return <DashboardModule onNavigate={setCurrent} />;
    }
  };

  return <Layout current={current} onNavigate={setCurrent}>{renderModule()}</Layout>;
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
