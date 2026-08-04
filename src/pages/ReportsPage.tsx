import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Download,
  Calendar,
  ChevronDown,
  TrendingUp,
  Users,
  DollarSign,
  CreditCard,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Transaction, Client } from '../lib/types';

interface FilterState {
  dateRange: 'today' | 'week' | 'month' | 'year' | 'custom';
  startDate: string;
  endDate: string;
  selectedService: string;
  customServiceInput: string;
}

interface ServiceBreakdown {
  serviceName: string;
  count: number;
  totalRevenue: number;
  percentageOfRevenue: number;
  averagePrice: number;
}

interface DailyData {
  date: string;
  revenue: number;
}

interface TopClient {
  clientId: string;
  clientName: string;
  clientPhone: string;
  visitCount: number;
  totalSpent: number;
}

interface PaymentMethodData {
  method: string;
  count: number;
  amount: number;
}

const PREDEFINED_SERVICES = [
  'Hair Cut',
  'Hair Colour',
  'Facial',
  'Wax',
  'Cleanup',
  'Highlight',
  'Manicure',
  'Pedicure',
  'Keratin',
  'Smoothing',
];

export function ReportsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterState>({
    dateRange: 'month',
    startDate: getDateString(new Date(new Date().getFullYear(), new Date().getMonth(), 1)),
    endDate: getDateString(new Date()),
    selectedService: 'All Services',
    customServiceInput: '',
  });

  const [summaryStats, setSummaryStats] = useState({
    totalRevenue: 0,
    totalTransactions: 0,
    uniqueClients: 0,
    averageBillValue: 0,
  });

  const [serviceBreakdown, setServiceBreakdown] = useState<ServiceBreakdown[]>([]);
  const [dailyData, setDailyData] = useState<DailyData[]>([]);
  const [topClients, setTopClients] = useState<TopClient[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodData[]>([]);
  const [sortBy, setSortBy] = useState<keyof ServiceBreakdown>('totalRevenue');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    if (!isAdmin) {
      navigate('/dashboard');
      return;
    }

    fetchReportData();
  }, [user, navigate, isAdmin, filter]);

  function getDateString(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  function getDateRange() {
    let start = new Date();
    let end = new Date();

    switch (filter.dateRange) {
      case 'today':
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        break;
      case 'week':
        start = new Date();
        const day = start.getDay();
        const diff = start.getDate() - day;
        start.setDate(diff);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        break;
      case 'month':
        start = new Date(end.getFullYear(), end.getMonth(), 1);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        break;
      case 'year':
        start = new Date(end.getFullYear(), 0, 1);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        break;
      case 'custom':
        start = new Date(filter.startDate);
        start.setHours(0, 0, 0, 0);
        end = new Date(filter.endDate);
        end.setHours(23, 59, 59, 999);
        break;
    }

    return { start: start.toISOString(), end: end.toISOString() };
  }

  async function fetchReportData() {
    try {
      setLoading(true);
      const { start, end } = getDateRange();

      let query = supabase
        .from('transactions')
        .select('*, clients(id, name, phone)', { count: 'exact' })
        .gte('date', start)
        .lte('date', end)
        .eq('payment_status', 'paid');

      const { data: txnData, count } = await query;
      const allTransactions = (txnData || []) as any[];

      // Filter by service if needed
      let filteredTransactions = allTransactions;
      if (filter.selectedService !== 'All Services') {
        const serviceToFilter = filter.customServiceInput || filter.selectedService;
        filteredTransactions = allTransactions.filter(
          (tx) =>
            tx.treatment_name &&
            tx.treatment_name.toLowerCase().includes(serviceToFilter.toLowerCase())
        );
      }

      setTransactions(filteredTransactions);

      // Calculate summary stats
      const totalRevenue = filteredTransactions.reduce((sum, tx) => sum + (tx.price || 0), 0);
      const uniqueClientsSet = new Set(
        filteredTransactions
          .map((tx) => tx.client_id)
          .filter(Boolean)
      );
      const averageBillValue =
        filteredTransactions.length > 0 ? totalRevenue / filteredTransactions.length : 0;

      setSummaryStats({
        totalRevenue,
        totalTransactions: filteredTransactions.length,
        uniqueClients: uniqueClientsSet.size,
        averageBillValue,
      });

      // Calculate service breakdown
      const serviceMap = new Map<string, { count: number; revenue: number }>();
      filteredTransactions.forEach((tx) => {
        const service = tx.treatment_name || 'Unknown';
        const existing = serviceMap.get(service) || { count: 0, revenue: 0 };
        existing.count++;
        existing.revenue += tx.price || 0;
        serviceMap.set(service, existing);
      });

      const breakdown: ServiceBreakdown[] = Array.from(serviceMap.entries()).map(
        ([name, data]) => ({
          serviceName: name,
          count: data.count,
          totalRevenue: data.revenue,
          percentageOfRevenue: totalRevenue > 0 ? (data.revenue / totalRevenue) * 100 : 0,
          averagePrice: data.count > 0 ? data.revenue / data.count : 0,
        })
      );

      setServiceBreakdown(breakdown.sort((a, b) => b.totalRevenue - a.totalRevenue));

      // Calculate daily data (last 7 days or filtered range up to 14 days)
      const dailyMap = new Map<string, number>();
      filteredTransactions.forEach((tx) => {
        const dateStr = tx.date.split('T')[0];
        dailyMap.set(dateStr, (dailyMap.get(dateStr) || 0) + (tx.price || 0));
      });

      const sorted = Array.from(dailyMap.entries())
        .map(([date, revenue]) => ({ date, revenue }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(-14);

      setDailyData(sorted);

      // Calculate top clients
      const clientMap = new Map<
        string,
        { name: string; phone: string; count: number; spent: number }
      >();
      filteredTransactions.forEach((tx) => {
        if (tx.client_id) {
          const client = tx.clients;
          const clientName = client?.name || 'Unknown';
          const clientPhone = client?.phone || '';
          const key = tx.client_id;

          const existing = clientMap.get(key) || {
            name: clientName,
            phone: clientPhone,
            count: 0,
            spent: 0,
          };
          existing.count++;
          existing.spent += tx.price || 0;
          clientMap.set(key, existing);
        }
      });

      const topClientsList: TopClient[] = Array.from(clientMap.entries())
        .map(([clientId, data]) => ({
          clientId,
          clientName: data.name,
          clientPhone: data.phone,
          visitCount: data.count,
          totalSpent: data.spent,
        }))
        .sort((a, b) => b.totalSpent - a.totalSpent)
        .slice(0, 10);

      setTopClients(topClientsList);

      // Calculate payment method breakdown
      const paymentMap = new Map<string, { count: number; amount: number }>();
      filteredTransactions.forEach((tx) => {
        const method = tx.payment_method || 'Cash';
        const existing = paymentMap.get(method) || { count: 0, amount: 0 };
        existing.count++;
        existing.amount += tx.price || 0;
        paymentMap.set(method, existing);
      });

      const paymentBreakdown: PaymentMethodData[] = Array.from(paymentMap.entries()).map(
        ([method, data]) => ({
          method,
          count: data.count,
          amount: data.amount,
        })
      );

      setPaymentMethods(paymentBreakdown);
    } catch (error) {
      console.error('Error fetching report data:', error);
    } finally {
      setLoading(false);
    }
  }

  function updateDateRange(range: FilterState['dateRange']) {
    const newFilter = { ...filter, dateRange: range };

    if (range !== 'custom') {
      const now = new Date();
      let start = new Date();

      switch (range) {
        case 'today':
          start = new Date(now);
          start.setHours(0, 0, 0, 0);
          break;
        case 'week':
          start = new Date(now);
          const day = start.getDay();
          const diff = start.getDate() - day;
          start.setDate(diff);
          start.setHours(0, 0, 0, 0);
          break;
        case 'month':
          start = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'year':
          start = new Date(now.getFullYear(), 0, 1);
          break;
      }

      newFilter.startDate = getDateString(start);
      newFilter.endDate = getDateString(now);
    }

    setFilter(newFilter);
  }

  function handleServiceChange(service: string) {
    if (service === 'custom') {
      setFilter({ ...filter, selectedService: 'custom', customServiceInput: '' });
    } else {
      setFilter({ ...filter, selectedService: service, customServiceInput: '' });
    }
  }

  function handleCustomServiceInput(value: string) {
    setFilter({ ...filter, customServiceInput: value });
  }

  function exportToCSV() {
    if (transactions.length === 0) {
      alert('No data to export');
      return;
    }

    const headers = ['Date', 'Client Name', 'Service', 'Amount', 'Payment Method', 'Status'];
    const rows = transactions.map((tx) => [
      tx.date.split('T')[0],
      (tx.clients as any)?.name || 'Unknown',
      tx.treatment_name,
      tx.price,
      tx.payment_method || 'Cash',
      tx.payment_status || 'paid',
    ]);

    const csv =
      [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n') +
      '\n';

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reports-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  function sortTable(column: keyof ServiceBreakdown) {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  }

  const displayServices = filter.customServiceInput
    ? [filter.customServiceInput, ...PREDEFINED_SERVICES]
    : PREDEFINED_SERVICES;

  const sortedServiceBreakdown = [...serviceBreakdown].sort((a, b) => {
    const aVal = a[sortBy];
    const bVal = b[sortBy];
    const comparison = aVal > bVal ? 1 : -1;
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  const maxDailyRevenue = dailyData.length > 0 ? Math.max(...dailyData.map((d) => d.revenue)) : 1;

  if (loading && summaryStats.totalTransactions === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading reports...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/dashboard')}
                className="p-2 hover:bg-white/40 rounded-lg transition-colors"
                title="Back to dashboard"
              >
                <ArrowLeft className="w-5 h-5 text-gray-700" />
              </button>
              <img src="/Image_logo.png" alt="Logo" className="h-10 w-auto object-contain" />
              <h1 className="text-2xl font-bold text-gray-800 ml-2">Reports & Analytics</h1>
            </div>
            <button
              onClick={exportToCSV}
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>

          {/* Filters Row */}
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-4">
            {/* Date Range Filter */}
            <div className="flex flex-wrap gap-2">
              {(['today', 'week', 'month', 'year', 'custom'] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => updateDateRange(range)}
                  className={`px-3 py-1 text-sm font-medium rounded-lg transition-colors ${
                    filter.dateRange === range
                      ? 'bg-teal-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {range === 'today' ? 'Today' : range === 'week' ? 'This Week' : range === 'month' ? 'This Month' : range === 'year' ? 'This Year' : 'Custom'}
                </button>
              ))}
            </div>

            {/* Custom Date Pickers */}
            {filter.dateRange === 'custom' && (
              <div className="flex gap-2">
                <input
                  type="date"
                  value={filter.startDate}
                  onChange={(e) => setFilter({ ...filter, startDate: e.target.value })}
                  className="px-3 py-1 border border-white/40 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                <input
                  type="date"
                  value={filter.endDate}
                  onChange={(e) => setFilter({ ...filter, endDate: e.target.value })}
                  className="px-3 py-1 border border-white/40 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            )}

            {/* Service Filter */}
            <div className="relative">
              <select
                value={filter.selectedService}
                onChange={(e) => handleServiceChange(e.target.value)}
                className="pl-3 pr-8 py-1 border border-white/40 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 appearance-none bg-white"
              >
                <option value="All Services">All Services</option>
                {PREDEFINED_SERVICES.map((service) => (
                  <option key={service} value={service}>
                    {service}
                  </option>
                ))}
                <option value="custom">Custom</option>
              </select>
              <ChevronDown className="absolute right-2 top-2 w-4 h-4 text-gray-600 pointer-events-none" />
            </div>

            {/* Custom Service Input */}
            {filter.selectedService === 'custom' && (
              <input
                type="text"
                placeholder="Type service name..."
                value={filter.customServiceInput}
                onChange={(e) => handleCustomServiceInput(e.target.value)}
                className="px-3 py-1 border border-white/40 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg p-6 border-l-4 border-teal-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Total Revenue</p>
                <p className="text-3xl font-bold text-gray-800 mt-2">
                  ₹{summaryStats.totalRevenue.toLocaleString('en-IN', {
                    maximumFractionDigits: 0,
                  })}
                </p>
              </div>
              <DollarSign className="w-10 h-10 text-teal-100" />
            </div>
          </div>

          <div className="bg-white rounded-lg p-6 border-l-4 border-teal-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Total Transactions</p>
                <p className="text-3xl font-bold text-gray-800 mt-2">
                  {summaryStats.totalTransactions}
                </p>
              </div>
              <CreditCard className="w-10 h-10 text-teal-100" />
            </div>
          </div>

          <div className="bg-white rounded-lg p-6 border-l-4 border-teal-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Unique Clients Served</p>
                <p className="text-3xl font-bold text-gray-800 mt-2">
                  {summaryStats.uniqueClients}
                </p>
              </div>
              <Users className="w-10 h-10 text-teal-100" />
            </div>
          </div>

          <div className="bg-white rounded-lg p-6 border-l-4 border-teal-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Average Bill Value</p>
                <p className="text-3xl font-bold text-gray-800 mt-2">
                  ₹{summaryStats.averageBillValue.toLocaleString('en-IN', {
                    maximumFractionDigits: 0,
                  })}
                </p>
              </div>
              <TrendingUp className="w-10 h-10 text-teal-100" />
            </div>
          </div>
        </div>

        {/* Service Breakdown Table */}
        <div className="bg-white rounded-lg mb-8 overflow-hidden">
          <div className="px-6 py-4 border-b border-white/30">
            <h2 className="text-lg font-bold text-gray-800">Service Breakdown</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white/30 border-b border-white/30">
                <tr>
                  {[
                    { key: 'serviceName', label: 'Service Name' },
                    { key: 'count', label: 'Count' },
                    { key: 'totalRevenue', label: 'Total Revenue' },
                    { key: 'percentageOfRevenue', label: '% of Revenue' },
                    { key: 'averagePrice', label: 'Average Price' },
                  ].map((column) => (
                    <th
                      key={column.key}
                      onClick={() =>
                        sortTable(column.key as keyof ServiceBreakdown)
                      }
                      className="px-6 py-3 text-left text-sm font-semibold text-gray-700 cursor-pointer hover:bg-white/40 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {column.label}
                        {sortBy === column.key && (
                          <span className="text-xs">
                            {sortOrder === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {sortedServiceBreakdown.length > 0 ? (
                  sortedServiceBreakdown.map((service, index) => (
                    <tr
                      key={index}
                      className="hover:bg-white/40 transition-colors"
                    >
                      <td className="px-6 py-4 text-sm text-gray-800 font-medium">
                        {service.serviceName}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {service.count}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        ₹{service.totalRevenue.toLocaleString('en-IN', {
                          maximumFractionDigits: 0,
                        })}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {service.percentageOfRevenue.toFixed(1)}%
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        ₹{service.averagePrice.toLocaleString('en-IN', {
                          maximumFractionDigits: 0,
                        })}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-center text-gray-600">
                      No services found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Daily Revenue Chart */}
        {dailyData.length > 0 && (
          <div className="bg-white rounded-lg mb-8 p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4">Daily Revenue (Last 7-14 Days)</h2>
            <div className="space-y-3">
              {dailyData.map((day, index) => {
                const barWidth = (day.revenue / maxDailyRevenue) * 100;
                return (
                  <div key={index} className="flex items-center gap-4">
                    <div className="w-24 text-sm font-medium text-gray-700">
                      {new Date(day.date).toLocaleDateString('en-IN', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </div>
                    <div className="flex-1">
                      <div className="relative h-8 bg-white/40 rounded-lg overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-teal-500 to-teal-600 transition-all duration-300"
                          style={{ width: `${barWidth}%` }}
                        ></div>
                        <div className="absolute inset-0 flex items-center px-3">
                          <span className="text-xs font-semibold text-white">
                            ₹{day.revenue.toLocaleString('en-IN', {
                              maximumFractionDigits: 0,
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Top Clients Table */}
        <div className="bg-white rounded-lg mb-8 overflow-hidden">
          <div className="px-6 py-4 border-b border-white/30">
            <h2 className="text-lg font-bold text-gray-800">Top Clients</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white/30 border-b border-white/30">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                    Client Name
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                    Phone
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                    Visit Count
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                    Total Spent
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {topClients.length > 0 ? (
                  topClients.map((client, index) => (
                    <tr key={index} className="hover:bg-white/40 transition-colors">
                      <td className="px-6 py-4 text-sm text-gray-800 font-medium">
                        {client.clientName}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {client.clientPhone}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {client.visitCount}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700 font-medium">
                        ₹{client.totalSpent.toLocaleString('en-IN', {
                          maximumFractionDigits: 0,
                        })}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-6 py-4 text-center text-gray-600">
                      No clients found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Payment Method Breakdown */}
        <div className="bg-white rounded-lg mb-8 overflow-hidden">
          <div className="px-6 py-4 border-b border-white/30">
            <h2 className="text-lg font-bold text-gray-800">Payment Method Breakdown</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white/30 border-b border-white/30">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                    Payment Method
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                    Transaction Count
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                    Total Amount
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {paymentMethods.length > 0 ? (
                  paymentMethods.map((method, index) => (
                    <tr key={index} className="hover:bg-white/40 transition-colors">
                      <td className="px-6 py-4 text-sm text-gray-800 font-medium">
                        {method.method}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {method.count}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700 font-medium">
                        ₹{method.amount.toLocaleString('en-IN', {
                          maximumFractionDigits: 0,
                        })}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="px-6 py-4 text-center text-gray-600">
                      No payment data found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
