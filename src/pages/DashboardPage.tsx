import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart3, Users, TrendingUp, LogOut, Settings, UserCog, Database,
  Search, Plus, CalendarDays, Receipt, MessageSquare, BarChart2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { signOut } from '../lib/auth';

interface DashboardStats {
  totalClients: number;
  dailySales: number;
  monthlySales: number;
  popularTreatments: Array<{ name: string; count: number }>;
  todayAppointments: number;
  pendingInvoices: number;
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalClients: 0,
    dailySales: 0,
    monthlySales: 0,
    popularTreatments: [],
    todayAppointments: 0,
    pendingInvoices: 0,
  });

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    fetchStats();
  }, [user, navigate]);

  async function fetchStats() {
    try {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const { data: monthTransactions } = await supabase
        .from('transactions')
        .select('treatment_name')
        .gte('date', monthStart.toISOString());

      const treatmentCounts = (monthTransactions || []).reduce((acc, t) => {
        const existing = acc.find(item => item.name === t.treatment_name);
        if (existing) existing.count++;
        else acc.push({ name: t.treatment_name, count: 1 });
        return acc;
      }, [] as Array<{ name: string; count: number }>).sort((a, b) => b.count - a.count).slice(0, 5);

      // Today's appointments count (available to all)
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);
      const { count: apptCount } = await supabase
        .from('appointments')
        .select('*', { count: 'exact' })
        .gte('scheduled_at', todayStart.toISOString())
        .lte('scheduled_at', todayEnd.toISOString())
        .in('status', ['scheduled', 'confirmed', 'in_progress']);

      if (isAdmin) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const [
          { count: clientCount },
          { data: todayTx },
          { data: monthSales },
          { count: pendingCount },
        ] = await Promise.all([
          supabase.from('clients').select('*', { count: 'exact' }),
          supabase.from('transactions').select('price').gte('date', today.toISOString()),
          supabase.from('transactions').select('price').gte('date', monthStart.toISOString()),
          supabase.from('invoices').select('*', { count: 'exact' }).eq('payment_status', 'pending'),
        ]);

        const dailySales = todayTx?.reduce((s, t) => s + (t.price || 0), 0) || 0;
        const monthlySales = monthSales?.reduce((s, t) => s + (t.price || 0), 0) || 0;

        setStats({
          totalClients: clientCount || 0,
          dailySales,
          monthlySales,
          popularTreatments: treatmentCounts,
          todayAppointments: apptCount || 0,
          pendingInvoices: pendingCount || 0,
        });
      } else {
        setStats(prev => ({
          ...prev,
          popularTreatments: treatmentCounts,
          todayAppointments: apptCount || 0,
        }));
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  }

  async function handleLogout() {
    await signOut();
    navigate('/login');
  }

  // Quick-action modules — shown to all roles
  const operatorModules = [
    { label: 'Search Client', desc: 'Find by phone or name', path: '/clients/search', icon: <Search className="w-6 h-6" />, color: 'from-teal-50 to-teal-100 border-teal-200', btnColor: 'bg-teal-600' },
    { label: 'Add New Client', desc: 'Create a new profile', path: '/clients/new', icon: <Plus className="w-6 h-6" />, color: 'from-blue-50 to-blue-100 border-blue-200', btnColor: 'bg-blue-600' },
    { label: 'Appointments', desc: `${stats.todayAppointments} today`, path: '/appointments', icon: <CalendarDays className="w-6 h-6" />, color: 'from-violet-50 to-violet-100 border-violet-200', btnColor: 'bg-violet-600' },
    { label: 'Billing', desc: 'Invoices & payments', path: '/billing', icon: <Receipt className="w-6 h-6" />, color: 'from-amber-50 to-amber-100 border-amber-200', btnColor: 'bg-amber-600' },
    { label: 'Inquiries', desc: 'Leads & follow-ups', path: '/inquiries', icon: <MessageSquare className="w-6 h-6" />, color: 'from-green-50 to-green-100 border-green-200', btnColor: 'bg-green-600' },
  ];

  const adminOnlyModules = [
    { label: 'Reports', desc: 'Analytics & export', path: '/reports', icon: <BarChart2 className="w-6 h-6" />, color: 'from-rose-50 to-rose-100 border-rose-200', btnColor: 'bg-rose-600' },
  ];

  const modules = isAdmin ? [...operatorModules, ...adminOnlyModules] : operatorModules;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/Image_logo.png" alt="Image Skinn & Hair" className="h-12 w-auto object-contain" />
            <p className="text-xs text-gray-400 font-medium hidden sm:block">Salon Management Platform</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="text-sm font-medium text-gray-700 hidden sm:inline">{user?.name}</span>
            <span className="px-3 py-1 bg-teal-100 text-teal-800 text-xs font-semibold rounded-full capitalize">{user?.role}</span>
            {isAdmin && (
              <>
                <button onClick={() => navigate('/admin/master-data')} className="p-2 hover:bg-gray-100 rounded-lg transition" title="Master Data"><Database className="w-5 h-5 text-gray-600" /></button>
                <button onClick={() => navigate('/admin/users')} className="p-2 hover:bg-gray-100 rounded-lg transition" title="Users"><UserCog className="w-5 h-5 text-gray-600" /></button>
                <button onClick={() => navigate('/settings')} className="p-2 hover:bg-gray-100 rounded-lg transition" title="Settings"><Settings className="w-5 h-5 text-gray-600" /></button>
              </>
            )}
            <button onClick={handleLogout} className="p-2 hover:bg-red-50 rounded-lg transition" title="Logout"><LogOut className="w-5 h-5 text-red-600" /></button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        {/* ── Stats bar (admin) ── */}
        {isAdmin && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <button onClick={() => navigate('/admin/clients')}
              className="bg-white rounded-xl shadow-sm border border-gray-100 hover:border-teal-300 hover:shadow-md p-5 transition text-left group col-span-1">
              <p className="text-gray-500 text-xs font-medium group-hover:text-teal-600 transition">Total Clients</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats.totalClients}</p>
              <div className="flex items-center justify-between mt-2">
                <Users className="w-8 h-8 text-teal-100 group-hover:text-teal-200 transition" />
                <span className="text-xs text-teal-600 opacity-0 group-hover:opacity-100 transition font-medium">View →</span>
              </div>
            </button>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <p className="text-gray-500 text-xs font-medium">Today's Sales</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">₹{stats.dailySales.toLocaleString('en-IN')}</p>
              <BarChart3 className="w-8 h-8 text-blue-100 mt-2" />
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <p className="text-gray-500 text-xs font-medium">Monthly Sales</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">₹{stats.monthlySales.toLocaleString('en-IN')}</p>
              <TrendingUp className="w-8 h-8 text-green-100 mt-2" />
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <p className="text-gray-500 text-xs font-medium">Today's Appts</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats.todayAppointments}</p>
              <CalendarDays className="w-8 h-8 text-violet-100 mt-2" />
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <p className="text-gray-500 text-xs font-medium">Pending Bills</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats.pendingInvoices}</p>
              <Receipt className="w-8 h-8 text-amber-100 mt-2" />
            </div>
          </div>
        )}

        {/* ── Operator stats ── */}
        {!isAdmin && (
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <p className="text-gray-500 text-xs font-medium">Today's Appointments</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats.todayAppointments}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <p className="text-gray-500 text-xs font-medium mb-2">Popular This Month</p>
              <div className="space-y-1">
                {stats.popularTreatments.slice(0, 3).map((t, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-gray-700">{t.name}</span>
                    <span className="font-semibold text-teal-600">{t.count}</span>
                  </div>
                ))}
                {stats.popularTreatments.length === 0 && <p className="text-gray-400 text-xs">No data yet</p>}
              </div>
            </div>
          </div>
        )}

        {/* ── Module grid ── */}
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Quick Access</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {modules.map(mod => (
              <button key={mod.path} onClick={() => navigate(mod.path)}
                className={`group relative overflow-hidden bg-gradient-to-br ${mod.color} rounded-xl p-6 transition border cursor-pointer text-left hover:shadow-md`}>
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-12 h-12 ${mod.btnColor} bg-opacity-10 rounded-xl flex items-center justify-center text-gray-700 group-hover:scale-110 transition`}>
                    {mod.icon}
                  </div>
                </div>
                <h3 className="text-lg font-bold text-gray-900">{mod.label}</h3>
                <p className="text-gray-600 text-sm mt-1">{mod.desc}</p>
                <div className={`mt-4 inline-block px-4 py-1.5 ${mod.btnColor} text-white rounded-lg text-sm font-semibold shadow-md`}>
                  Open →
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ── Popular treatments (admin) ── */}
        {isAdmin && stats.popularTreatments.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-base font-bold text-gray-900 mb-4">Popular Treatments This Month</h3>
            <div className="flex flex-wrap gap-3">
              {stats.popularTreatments.map((t, i) => (
                <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-lg px-4 py-2 border border-gray-200">
                  <span className="w-6 h-6 rounded-full bg-teal-100 text-teal-700 text-xs font-bold flex items-center justify-center">{i + 1}</span>
                  <span className="text-sm font-medium text-gray-800">{t.name}</span>
                  <span className="text-xs font-bold text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded">{t.count}x</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
