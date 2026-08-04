import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart3, Users, TrendingUp, LogOut, Settings, UserCog, Database,
  Search, Plus, CalendarDays, Receipt, MessageSquare, BarChart2,
  Award, Star, Tag, Bell, QrCode, MessageCircle, Shield,
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
    totalClients: 0, dailySales: 0, monthlySales: 0,
    popularTreatments: [], todayAppointments: 0, pendingInvoices: 0,
  });

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    fetchStats();
  }, [user, navigate]);

  async function fetchStats() {
    try {
      const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
      const { data: monthTransactions } = await supabase.from('transactions').select('treatment_name').gte('date', monthStart.toISOString());
      const treatmentCounts = (monthTransactions || []).reduce((acc, t) => {
        const existing = acc.find((item: any) => item.name === t.treatment_name);
        if (existing) existing.count++; else acc.push({ name: t.treatment_name, count: 1 });
        return acc;
      }, [] as Array<{ name: string; count: number }>).sort((a: any, b: any) => b.count - a.count).slice(0, 5);

      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
      const { count: apptCount } = await supabase.from('appointments').select('*', { count: 'exact' })
        .gte('scheduled_at', todayStart.toISOString()).lte('scheduled_at', todayEnd.toISOString())
        .in('status', ['scheduled', 'confirmed', 'in_progress']);

      if (isAdmin) {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const [{ count: clientCount }, { data: todayTx }, { data: monthSales }, { count: pendingCount }] = await Promise.all([
          supabase.from('clients').select('*', { count: 'exact' }),
          supabase.from('transactions').select('price').gte('date', today.toISOString()),
          supabase.from('transactions').select('price').gte('date', monthStart.toISOString()),
          supabase.from('invoices').select('*', { count: 'exact' }).eq('payment_status', 'pending'),
        ]);
        setStats({
          totalClients: clientCount || 0,
          dailySales: todayTx?.reduce((s, t) => s + (t.price || 0), 0) || 0,
          monthlySales: monthSales?.reduce((s, t) => s + (t.price || 0), 0) || 0,
          popularTreatments: treatmentCounts,
          todayAppointments: apptCount || 0,
          pendingInvoices: pendingCount || 0,
        });
      } else {
        setStats(prev => ({ ...prev, popularTreatments: treatmentCounts, todayAppointments: apptCount || 0 }));
      }
    } catch (error) { console.error('Error fetching stats:', error); }
  }

  async function handleLogout() { await signOut(); navigate('/login'); }

  const operatorModules = [
    { label: 'Search Client',  desc: 'Find by phone or name',    path: '/clients/search', icon: <Search className="w-6 h-6" />,      accent: 'text-teal-600', glow: 'bg-teal-500/20', rgb: '20, 184, 166' },
    { label: 'Add New Client', desc: 'Create a new profile',     path: '/clients/new',    icon: <Plus className="w-6 h-6" />,        accent: 'text-blue-600', glow: 'bg-blue-500/20', rgb: '59, 130, 246' },
    { label: 'Appointments',   desc: `${stats.todayAppointments} today`, path: '/appointments', icon: <CalendarDays className="w-6 h-6" />, accent: 'text-violet-600', glow: 'bg-violet-500/20', rgb: '139, 92, 246' },
    { label: 'Billing',        desc: 'Invoices & payments',      path: '/billing',        icon: <Receipt className="w-6 h-6" />,     accent: 'text-amber-600', glow: 'bg-amber-500/20', rgb: '245, 158, 11' },
    { label: 'Inquiries',      desc: 'Leads & follow-ups',       path: '/inquiries',      icon: <MessageSquare className="w-6 h-6" />, accent: 'text-green-600', glow: 'bg-green-500/20', rgb: '34, 197, 94' },
    { label: 'QR Menu',        desc: 'View & scan public menu',  path: '/admin/qr-menu',  icon: <QrCode className="w-6 h-6" />,      accent: 'text-cyan-600', glow: 'bg-cyan-500/20', rgb: '6, 182, 212' },
  ];

  const adminOnlyModules = [
    { label: 'Memberships',    desc: 'Plans & client memberships', path: '/admin/memberships', icon: <Award className="w-6 h-6" />,       accent: 'text-emerald-600', glow: 'bg-emerald-500/20', rgb: '16, 185, 129' },
    { label: 'Loyalty Points', desc: 'Rewards & point rules',     path: '/admin/loyalty',     icon: <Star className="w-6 h-6" />,        accent: 'text-yellow-600', glow: 'bg-yellow-500/20', rgb: '234, 179, 8' },
    { label: 'Coupons',        desc: 'Discount codes',            path: '/admin/coupons',     icon: <Tag className="w-6 h-6" />,         accent: 'text-rose-600', glow: 'bg-rose-500/20', rgb: '244, 63, 94' },
    { label: 'Reminders',      desc: 'Alerts & follow-ups',       path: '/admin/reminders',   icon: <Bell className="w-6 h-6" />,        accent: 'text-orange-600', glow: 'bg-orange-500/20', rgb: '249, 115, 22' },
    { label: 'QR Menu',        desc: 'Public service menu',       path: '/admin/qr-menu',     icon: <QrCode className="w-6 h-6" />,      accent: 'text-cyan-600', glow: 'bg-cyan-500/20', rgb: '6, 182, 212' },
    { label: 'Feedback',       desc: 'Reviews & ratings',         path: '/admin/feedback',    icon: <MessageCircle className="w-6 h-6" />, accent: 'text-pink-600', glow: 'bg-pink-500/20', rgb: '236, 72, 153' },
    { label: 'Reports',        desc: 'Analytics & export',        path: '/admin/reports',     icon: <BarChart2 className="w-6 h-6" />,   accent: 'text-indigo-600', glow: 'bg-indigo-500/20', rgb: '99, 102, 241' },
    { label: 'Audit Log',      desc: 'Change history',            path: '/admin/audit',       icon: <Shield className="w-6 h-6" />,      accent: 'text-slate-600', glow: 'bg-slate-500/20', rgb: '100, 116, 139' },
  ];

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/Image_logo.png" alt="Image Skinn & Hair" className="h-12 w-auto object-contain" />
            <p className="text-xs text-gray-600 font-medium hidden sm:block">Salon Management Platform</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="text-sm font-medium text-gray-700 hidden sm:inline">{user?.name}</span>
            <span className="px-3 py-1 bg-teal-500/20 text-teal-700 text-xs font-semibold rounded-full capitalize border border-teal-300/40">{user?.role}</span>
            {isAdmin && (
              <>
                <button onClick={() => navigate('/admin/master-data')} className="p-2 hover:bg-white/40 rounded-lg transition" title="Master Data"><Database className="w-5 h-5 text-gray-600" /></button>
                <button onClick={() => navigate('/admin/users')} className="p-2 hover:bg-white/40 rounded-lg transition" title="Users"><UserCog className="w-5 h-5 text-gray-600" /></button>
                <button onClick={() => navigate('/settings')} className="p-2 hover:bg-white/40 rounded-lg transition" title="Settings"><Settings className="w-5 h-5 text-gray-600" /></button>
              </>
            )}
            <button onClick={handleLogout} className="p-2 hover:bg-red-500/20 rounded-lg transition" title="Logout"><LogOut className="w-5 h-5 text-red-500" /></button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        {/* Admin stats */}
        {isAdmin && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 animate-fade-in-up">
            <button onClick={() => navigate('/admin/clients')}
              className="dash-card glass rounded-2xl p-5 text-left group col-span-1" style={{ '--card-accent': '20, 184, 166' } as React.CSSProperties}>
              <p className="text-gray-600 text-xs font-medium group-hover:text-teal-600 transition">Total Clients</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats.totalClients}</p>
              <div className="flex items-center justify-between mt-2">
                <Users className="w-8 h-8 text-teal-400 group-hover:text-teal-500 transition" />
                <span className="text-xs text-teal-600 opacity-0 group-hover:opacity-100 transition font-medium">View →</span>
              </div>
            </button>
            <div className="dash-card glass rounded-2xl p-5" style={{ '--card-accent': '59, 130, 246' } as React.CSSProperties}>
              <p className="text-gray-600 text-xs font-medium">Today's Sales</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">₹{stats.dailySales.toLocaleString('en-IN')}</p>
              <BarChart3 className="w-8 h-8 text-blue-400 mt-2" />
            </div>
            <div className="dash-card glass rounded-2xl p-5" style={{ '--card-accent': '34, 197, 94' } as React.CSSProperties}>
              <p className="text-gray-600 text-xs font-medium">Monthly Sales</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">₹{stats.monthlySales.toLocaleString('en-IN')}</p>
              <TrendingUp className="w-8 h-8 text-green-400 mt-2" />
            </div>
            <div className="dash-card glass rounded-2xl p-5" style={{ '--card-accent': '139, 92, 246' } as React.CSSProperties}>
              <p className="text-gray-600 text-xs font-medium">Today's Appts</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats.todayAppointments}</p>
              <CalendarDays className="w-8 h-8 text-violet-400 mt-2" />
            </div>
            <div className="dash-card glass rounded-2xl p-5" style={{ '--card-accent': '245, 158, 11' } as React.CSSProperties}>
              <p className="text-gray-600 text-xs font-medium">Pending Bills</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats.pendingInvoices}</p>
              <Receipt className="w-8 h-8 text-amber-400 mt-2" />
            </div>
          </div>
        )}

        {/* Operator stats */}
        {!isAdmin && (
          <div className="grid grid-cols-2 gap-4 animate-fade-in-up">
            <div className="dash-card glass rounded-2xl p-5" style={{ '--card-accent': '139, 92, 246' } as React.CSSProperties}>
              <p className="text-gray-600 text-xs font-medium">Today's Appointments</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats.todayAppointments}</p>
            </div>
            <div className="dash-card glass rounded-2xl p-5" style={{ '--card-accent': '20, 184, 166' } as React.CSSProperties}>
              <p className="text-gray-600 text-xs font-medium mb-2">Popular This Month</p>
              <div className="space-y-1">
                {stats.popularTreatments.slice(0, 3).map((t, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-gray-700">{t.name}</span>
                    <span className="font-semibold text-teal-600">{t.count}</span>
                  </div>
                ))}
                {stats.popularTreatments.length === 0 && <p className="text-gray-600 text-xs">No data yet</p>}
              </div>
            </div>
          </div>
        )}

        {/* Operator modules */}
        <div className="animate-fade-in-up">
          <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-4">Quick Access</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {operatorModules.map(mod => (
              <button key={mod.path} onClick={() => navigate(mod.path)}
                className="dash-card group relative overflow-hidden glass rounded-2xl p-6 cursor-pointer text-left" style={{ '--card-accent': mod.rgb } as React.CSSProperties}>
                <div className="flex items-start justify-between mb-4">
                  <div className={`dash-card-accent w-12 h-12 ${mod.glow} rounded-xl flex items-center justify-center ${mod.accent}`}>
                    {mod.icon}
                  </div>
                </div>
                <h3 className="text-lg font-bold text-gray-900">{mod.label}</h3>
                <p className="text-gray-600 text-sm mt-1">{mod.desc}</p>
                <div className="mt-4 inline-block px-4 py-1.5 btn-lux text-white rounded-lg text-sm font-semibold">Open →</div>
              </button>
            ))}
          </div>
        </div>

        {/* Admin-only modules */}
        {isAdmin && (
          <div className="animate-fade-in-up">
            <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-4">Admin Control Panel</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {adminOnlyModules.map(mod => (
                <button key={mod.path} onClick={() => navigate(mod.path)}
                  className="dash-card group relative overflow-hidden glass rounded-2xl p-5 cursor-pointer text-left" style={{ '--card-accent': mod.rgb } as React.CSSProperties}>
                  <div className={`dash-card-accent w-10 h-10 ${mod.glow} rounded-xl flex items-center justify-center ${mod.accent} mb-3`}>
                    {mod.icon}
                  </div>
                  <h3 className="text-base font-bold text-gray-900">{mod.label}</h3>
                  <p className="text-gray-600 text-xs mt-1">{mod.desc}</p>
                  <div className="mt-3 inline-block px-3 py-1 btn-lux text-white rounded-lg text-xs font-semibold">Open →</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Popular treatments (admin) */}
        {isAdmin && stats.popularTreatments.length > 0 && (
          <div className="dash-card glass rounded-2xl p-6 animate-fade-in-up" style={{ '--card-accent': '20, 184, 166' } as React.CSSProperties}>
            <h3 className="text-base font-bold text-gray-900 mb-4">Popular Treatments This Month</h3>
            <div className="flex flex-wrap gap-3">
              {stats.popularTreatments.map((t, i) => (
                <div key={i} className="flex items-center gap-2 glass-subtle rounded-lg px-4 py-2">
                  <span className="w-6 h-6 rounded-full bg-teal-500/20 text-teal-700 text-xs font-bold flex items-center justify-center">{i + 1}</span>
                  <span className="text-sm font-medium text-gray-800">{t.name}</span>
                  <span className="text-xs font-bold text-teal-600 bg-teal-500/15 px-1.5 py-0.5 rounded">{t.count}x</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
