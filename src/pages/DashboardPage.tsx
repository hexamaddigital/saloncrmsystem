import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, Users, TrendingUp, LogOut, Settings, UserCog } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { signOut } from '../lib/auth';

interface DashboardStats {
  totalClients: number;
  dailySales: number;
  monthlySales: number;
  popularTreatments: Array<{ name: string; count: number }>;
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalClients: 0,
    dailySales: 0,
    monthlySales: 0,
    popularTreatments: []
  });

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    fetchStats();
  }, [user, navigate]);

  async function fetchStats() {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

      const { count: clientCount } = await supabase
        .from('clients')
        .select('*', { count: 'exact' });

      const { data: todayTransactions } = await supabase
        .from('transactions')
        .select('price')
        .gte('date', today.toISOString());

      const { data: monthTransactions } = await supabase
        .from('transactions')
        .select('price, treatment_name')
        .gte('date', monthStart.toISOString());

      const dailySales = todayTransactions?.reduce((sum, t) => sum + (t.price || 0), 0) || 0;
      const monthlySales = monthTransactions?.reduce((sum, t) => sum + (t.price || 0), 0) || 0;

      const treatmentCounts = (monthTransactions || []).reduce((acc, t) => {
        const existing = acc.find(item => item.name === t.treatment_name);
        if (existing) {
          existing.count++;
        } else {
          acc.push({ name: t.treatment_name, count: 1 });
        }
        return acc;
      }, [] as Array<{ name: string; count: number }>).sort((a, b) => b.count - a.count).slice(0, 5);

      setStats({
        totalClients: clientCount || 0,
        dailySales,
        monthlySales,
        popularTreatments: treatmentCounts
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  }

  async function handleLogout() {
    await signOut();
    navigate('/login');
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/Image_logo.png" alt="Image Skinn & Hair" className="h-12 w-auto object-contain" />
            <p className="text-xs text-gray-400 font-medium hidden sm:block">Salon CRM System</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <span className="text-sm font-medium text-gray-700 hidden sm:inline">{user?.name}</span>
            <span className="px-3 py-1 bg-teal-100 text-teal-800 text-xs font-semibold rounded-full capitalize">
              {user?.role}
            </span>
            {user?.role === 'admin' && (
              <>
                <button
                  onClick={() => navigate('/admin/users')}
                  className="p-2 hover:bg-gray-100 rounded-lg transition"
                  title="User Management"
                >
                  <UserCog className="w-5 h-5 text-gray-600" />
                </button>
                <button
                  onClick={() => navigate('/settings')}
                  className="p-2 hover:bg-gray-100 rounded-lg transition"
                  title="Settings"
                >
                  <Settings className="w-5 h-5 text-gray-600" />
                </button>
              </>
            )}
            <button
              onClick={handleLogout}
              className="p-2 hover:bg-red-50 rounded-lg transition"
              title="Logout"
            >
              <LogOut className="w-5 h-5 text-red-600" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Total Clients</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.totalClients}</p>
              </div>
              <Users className="w-12 h-12 text-teal-100" />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Today's Sales</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">₹{stats.dailySales.toFixed(2)}</p>
              </div>
              <BarChart3 className="w-12 h-12 text-blue-100" />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Monthly Sales</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">₹{stats.monthlySales.toFixed(2)}</p>
              </div>
              <TrendingUp className="w-12 h-12 text-green-100" />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div>
              <p className="text-gray-600 text-sm font-medium mb-3">Popular Treatments</p>
              <div className="space-y-2">
                {stats.popularTreatments.length > 0 ? (
                  stats.popularTreatments.slice(0, 3).map((treatment, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700">{treatment.name}</span>
                      <span className="font-semibold text-teal-600">{treatment.count}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-sm">No data yet</p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <button
            onClick={() => navigate('/clients/search')}
            className="lg:col-span-2 group relative overflow-hidden bg-gradient-to-br from-teal-50 to-teal-100 hover:from-teal-100 hover:to-teal-200 rounded-xl p-6 sm:p-8 transition border border-teal-200 cursor-pointer"
          >
            <div className="relative z-10">
              <h3 className="text-xl sm:text-2xl font-bold text-gray-900">Search Client</h3>
              <p className="text-gray-600 mt-2">Find or create client by phone number</p>
              <div className="mt-4 inline-block px-4 py-2 bg-teal-600 text-white rounded-lg font-semibold shadow-lg shadow-teal-600/25">
                Get Started
              </div>
            </div>
          </button>

          <button
            onClick={() => navigate('/clients/new')}
            className="group relative overflow-hidden bg-gradient-to-br from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 rounded-xl p-6 sm:p-8 transition border border-blue-200 cursor-pointer"
          >
            <div className="relative z-10">
              <h3 className="text-xl sm:text-2xl font-bold text-gray-900">Add New Client</h3>
              <p className="text-gray-600 mt-2">Quick entry form</p>
              <div className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold shadow-lg shadow-blue-600/25">
                Create
              </div>
            </div>
          </button>
        </div>
      </main>
    </div>
  );
}
