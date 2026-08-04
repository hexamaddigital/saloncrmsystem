import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft, BarChart2, TrendingUp, Users, Receipt, Loader2,
  Download, RefreshCw, Award, Tag,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Summary { label: string; value: string | number; sub?: string; color: string; icon: React.ReactNode; }

function fmtMoney(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }
function fmtDate(d: string) { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }

const SERVICE_OPTIONS = [
  'All Services', 'Hair Cut', 'Hair Colour', 'Highlight', 'Smoothing', 'Keratin',
  'Bluetox', 'Nano Plastia', 'Root Touch-up', 'Hair Spa', 'Blow Dry',
  'Cleanup', 'Facial', 'Pimple Treatment', 'Pigmentation Treatment',
  'Wax', 'Threading', 'Bleach', 'D-Tan', 'Manicure', 'Pedicure',
];

type DateRange = 'today' | 'week' | 'month' | 'quarter' | 'custom';

function getRange(range: DateRange, from: string, to: string): { start: Date; end: Date } {
  const now = new Date();
  const end = new Date(now); end.setHours(23, 59, 59, 999);
  switch (range) {
    case 'today': { const s = new Date(now); s.setHours(0,0,0,0); return { start: s, end }; }
    case 'week': { const s = new Date(now); s.setDate(now.getDate() - 6); s.setHours(0,0,0,0); return { start: s, end }; }
    case 'month': { const s = new Date(now.getFullYear(), now.getMonth(), 1); return { start: s, end }; }
    case 'quarter': { const s = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1); return { start: s, end }; }
    case 'custom': return { start: new Date(from + 'T00:00:00'), end: new Date(to + 'T23:59:59') };
    default: return { start: new Date(now.getFullYear(), now.getMonth(), 1), end };
  }
}

export function AdvancedReportsPage() {
  const navigate = useNavigate();
  const [dateRange, setDateRange] = useState<DateRange>('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [serviceFilter, setServiceFilter] = useState('All Services');
  const [loading, setLoading] = useState(false);

  // Data
  const [transactions, setTransactions] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [clientMems, setClientMems] = useState<any[]>([]);
  const [couponUsage, setCouponUsage] = useState<any[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { start, end } = getRange(dateRange, customFrom, customTo);
    const [{ data: tx }, { data: inv }, { data: mems }, { data: coupons }] = await Promise.all([
      supabase.from('transactions').select('treatment_name,price,service_category,staff_name,date,client_id').gte('date', start.toISOString()).lte('date', end.toISOString()),
      supabase.from('invoices').select('total,payment_status,amount_paid,invoice_date,coupon_code,coupon_discount').gte('invoice_date', start.toISOString()).lte('invoice_date', end.toISOString()),
      supabase.from('client_memberships').select('membership_name,amount_paid,started_at,status').gte('started_at', start.toISOString()).lte('started_at', end.toISOString()),
      supabase.from('coupons').select('code,uses_count,discount_type,discount_value').gt('uses_count', 0),
    ]);
    setTransactions(tx || []);
    setInvoices(inv || []);
    setClientMems(mems || []);
    setCouponUsage(coupons || []);
    setLoading(false);
  }, [dateRange, customFrom, customTo]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Derived metrics
  const filteredTx = serviceFilter === 'All Services' ? transactions : transactions.filter(t => t.treatment_name === serviceFilter);
  const totalRevTx = filteredTx.reduce((s, t) => s + Number(t.price), 0);
  const totalInvRevenue = invoices.reduce((s, i) => s + Number(i.amount_paid), 0);
  const paidInvoices = invoices.filter(i => i.payment_status === 'paid').length;
  const pendingInvoices = invoices.filter(i => i.payment_status === 'pending').length;
  const memRevenue = clientMems.reduce((s, m) => s + Number(m.amount_paid), 0);

  // Service frequency
  const svcFreq: Record<string, number> = {};
  filteredTx.forEach(t => { svcFreq[t.treatment_name] = (svcFreq[t.treatment_name] || 0) + 1; });
  const topServices = Object.entries(svcFreq).sort((a, b) => b[1] - a[1]).slice(0, 10);

  // Staff performance
  const staffRev: Record<string, { count: number; revenue: number }> = {};
  filteredTx.forEach(t => {
    const s = t.staff_name || 'Unknown';
    if (!staffRev[s]) staffRev[s] = { count: 0, revenue: 0 };
    staffRev[s].count++; staffRev[s].revenue += Number(t.price);
  });
  const topStaff = Object.entries(staffRev).sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 5);

  function downloadCSV() {
    const rows = [
      ['Date', 'Service', 'Category', 'Staff', 'Amount'],
      ...filteredTx.map(t => [fmtDate(t.date), t.treatment_name, t.service_category || '', t.staff_name || '', t.price]),
    ];
    const csv = rows.map(r => r.map(String).map(v => `"${v.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'report.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  const summaries: Summary[] = [
    { label: 'Services Revenue', value: fmtMoney(totalRevTx), sub: `${filteredTx.length} transactions`, color: 'text-teal-600', icon: <TrendingUp className="w-5 h-5" /> },
    { label: 'Invoice Revenue', value: fmtMoney(totalInvRevenue), sub: `${paidInvoices} paid · ${pendingInvoices} pending`, color: 'text-blue-600', icon: <Receipt className="w-5 h-5" /> },
    { label: 'Membership Revenue', value: fmtMoney(memRevenue), sub: `${clientMems.length} sold`, color: 'text-amber-600', icon: <Award className="w-5 h-5" /> },
    { label: 'Active Coupons', value: couponUsage.length, sub: `total coupon uses`, color: 'text-rose-600', icon: <Tag className="w-5 h-5" /> },
  ];

  const rangeLabels: Record<DateRange, string> = { today: 'Today', week: 'Last 7 Days', month: 'This Month', quarter: 'This Quarter', custom: 'Custom' };

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/dashboard')} className="p-2 hover:bg-white/40 rounded-lg transition">
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            <BarChart2 className="w-5 h-5 text-teal-600" />
            <h1 className="text-xl font-bold text-gray-900">Reports & Analytics</h1>
          </div>
          <div className="flex gap-2">
            <button onClick={downloadCSV} className="flex items-center gap-1.5 px-3 py-2 bg-white/40 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-xl transition">
              <Download className="w-4 h-4" /> CSV
            </button>
            <button onClick={fetchData} disabled={loading} className="p-2 hover:bg-white/40 rounded-lg transition">
              <RefreshCw className={`w-4 h-4 text-gray-600 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/* Filters */}
        <div className="bg-white rounded-2xl border border-white/20 p-5 space-y-4">
          <h3 className="font-bold text-gray-900 text-sm uppercase tracking-wide">Filters</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {(Object.keys(rangeLabels) as DateRange[]).map(r => (
              <button key={r} onClick={() => setDateRange(r)}
                className={`py-2 px-3 rounded-xl text-sm font-semibold border-2 transition ${dateRange === r ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-gray-600 border-white/40 hover:border-teal-300/60'}`}>
                {rangeLabels[r]}
              </button>
            ))}
          </div>
          {dateRange === 'custom' && (
            <div className="flex gap-3 flex-wrap">
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">From</label>
                <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="px-3 py-2 border border-white/40 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">To</label>
                <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="px-3 py-2 border border-white/40 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none" />
              </div>
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Service Filter</label>
            <select value={serviceFilter} onChange={e => setServiceFilter(e.target.value)} className="w-full sm:w-64 px-3 py-2 border border-white/40 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none">
              {SERVICE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-teal-600" /></div>
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {summaries.map(s => (
                <div key={s.label} className="bg-white rounded-2xl border border-white/20 p-5">
                  <div className={`w-10 h-10 rounded-xl bg-white/30 flex items-center justify-center ${s.color} mb-3`}>{s.icon}</div>
                  <p className="text-xs text-gray-600 font-semibold uppercase tracking-wide">{s.label}</p>
                  <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
                  {s.sub && <p className="text-xs text-gray-600 mt-0.5">{s.sub}</p>}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top services */}
              <div className="bg-white rounded-2xl border border-white/20 p-6">
                <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-teal-600" /> Top Services</h3>
                {topServices.length === 0 ? <p className="text-gray-600 text-sm text-center py-6">No data in this period.</p> : (
                  <div className="space-y-3">
                    {topServices.map(([name, count], i) => {
                      const pct = topServices[0][1] > 0 ? Math.round((count / topServices[0][1]) * 100) : 0;
                      return (
                        <div key={name}>
                          <div className="flex items-center justify-between text-sm mb-1">
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-teal-100 text-teal-700 text-xs font-bold flex items-center justify-center">{i + 1}</span>
                              <span className="font-medium text-gray-800 truncate max-w-[160px]">{name}</span>
                            </div>
                            <span className="font-bold text-teal-700">{count}×</span>
                          </div>
                          <div className="bg-white/40 rounded-full h-1.5 overflow-hidden">
                            <div className="bg-teal-500 h-full rounded-full transition-all" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Staff performance */}
              <div className="bg-white rounded-2xl border border-white/20 p-6">
                <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><Users className="w-4 h-4 text-blue-600" /> Staff Performance</h3>
                {topStaff.length === 0 ? <p className="text-gray-600 text-sm text-center py-6">No data in this period.</p> : (
                  <div className="space-y-3">
                    {topStaff.map(([name, { count, revenue }], i) => (
                      <div key={name} className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-800 text-sm truncate">{name}</p>
                          <p className="text-xs text-gray-600">{count} services</p>
                        </div>
                        <p className="font-bold text-blue-700 text-sm shrink-0">{fmtMoney(revenue)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Membership report */}
            {clientMems.length > 0 && (
              <div className="bg-white rounded-2xl border border-white/20 p-6">
                <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><Award className="w-4 h-4 text-amber-600" /> Membership Sales</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-white/30">
                      <th className="text-left py-2 px-3 text-xs font-semibold text-gray-600 uppercase">Plan</th>
                      <th className="text-left py-2 px-3 text-xs font-semibold text-gray-600 uppercase">Status</th>
                      <th className="text-right py-2 px-3 text-xs font-semibold text-gray-600 uppercase">Amount</th>
                    </tr></thead>
                    <tbody>
                      {clientMems.map((m, i) => (
                        <tr key={i} className="border-b border-gray-50 hover:glass-subtle">
                          <td className="py-2.5 px-3 font-medium text-gray-800">{m.membership_name}</td>
                          <td className="py-2.5 px-3"><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${m.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-white/40 text-gray-600'}`}>{m.status}</span></td>
                          <td className="py-2.5 px-3 text-right font-bold text-amber-700">{fmtMoney(Number(m.amount_paid))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Coupon usage */}
            {couponUsage.length > 0 && (
              <div className="bg-white rounded-2xl border border-white/20 p-6">
                <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><Tag className="w-4 h-4 text-rose-600" /> Coupon Usage</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {couponUsage.map(c => (
                    <div key={c.code} className="glass-subtle rounded-xl border border-white/30 p-3 text-center">
                      <p className="font-mono font-bold text-teal-700">{c.code}</p>
                      <p className="text-xs text-gray-600 mt-1">{c.discount_type === 'percentage' ? `${c.discount_value}%` : `₹${c.discount_value}`} off</p>
                      <p className="text-sm font-bold text-gray-800 mt-1">{c.uses_count} uses</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
