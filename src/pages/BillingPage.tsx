import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  ArrowLeft,
  Eye,
  Trash2,
  X,
  Search,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  Printer,
  Download,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import type { Invoice, InvoiceItem } from '../lib/types';

const ITEMS_PER_PAGE = 20;

type PaymentStatus = 'paid' | 'pending' | 'partial';

interface LineItemRow {
  service_name: string;
  quantity: number;
  unit_price: number;
  discount: number;
  staff_name?: string;
}

export function BillingPage() {
  const navigate = useNavigate();
  const { user, role } = useAuth();

  // State management
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | 'all'>('all');
  const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'month' | 'all'>('all');
  const [currentPage, setCurrentPage] = useState(1);

  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [selectedInvoiceItems, setSelectedInvoiceItems] = useState<InvoiceItem[]>([]);

  // Form state
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [lineItems, setLineItems] = useState<LineItemRow[]>([
    { service_name: '', quantity: 1, unit_price: 0, discount: 0, staff_name: '' },
  ]);
  const [discount, setDiscount] = useState(0);
  const [taxPercent, setTaxPercent] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<string>('Cash');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('pending');
  const [amountPaid, setAmountPaid] = useState(0);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Summary stats
  const [todayRevenue, setTodayRevenue] = useState(0);
  const [monthlyRevenue, setMonthlyRevenue] = useState(0);
  const [pendingAmount, setPendingAmount] = useState(0);

  // Fetch invoices
  useEffect(() => {
    fetchInvoices();
    if (role === 'admin') {
      fetchSummaryStats();
    }
  }, []);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('invoices').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setInvoices(data || []);
    } catch (err) {
      console.error('Error fetching invoices:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSummaryStats = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        .toISOString()
        .split('T')[0];

      // Today's revenue
      const { data: todayData } = await supabase
        .from('invoices')
        .select('total')
        .eq('payment_status', 'paid')
        .gte('invoice_date', today);

      // Monthly revenue
      const { data: monthlyData } = await supabase
        .from('invoices')
        .select('total')
        .eq('payment_status', 'paid')
        .gte('invoice_date', monthStart);

      // Pending amount
      const { data: pendingData } = await supabase
        .from('invoices')
        .select('total, amount_paid')
        .in('payment_status', ['pending', 'partial']);

      const today_revenue = todayData?.reduce((sum, inv) => sum + (inv.total || 0), 0) || 0;
      const monthly_revenue = monthlyData?.reduce((sum, inv) => sum + (inv.total || 0), 0) || 0;
      const pending_amount =
        pendingData?.reduce((sum, inv) => sum + ((inv.total || 0) - (inv.amount_paid || 0)), 0) || 0;

      setTodayRevenue(today_revenue);
      setMonthlyRevenue(monthly_revenue);
      setPendingAmount(pending_amount);
    } catch (err) {
      console.error('Error fetching summary stats:', err);
    }
  };

  // Filter and paginate invoices
  const filteredInvoices = useMemo(() => {
    let filtered = [...invoices];

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((inv) => inv.payment_status === statusFilter);
    }

    // Date filter
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (dateFilter === 'today') {
      filtered = filtered.filter((inv) => {
        const invDate = new Date(inv.invoice_date);
        invDate.setHours(0, 0, 0, 0);
        return invDate.getTime() === today.getTime();
      });
    } else if (dateFilter === 'week') {
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay());
      filtered = filtered.filter((inv) => new Date(inv.invoice_date) >= weekStart);
    } else if (dateFilter === 'month') {
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      filtered = filtered.filter((inv) => new Date(inv.invoice_date) >= monthStart);
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (inv) =>
          inv.client_name.toLowerCase().includes(query) ||
          inv.client_phone.includes(query) ||
          inv.invoice_number.includes(query)
      );
    }

    return filtered;
  }, [invoices, statusFilter, dateFilter, searchQuery]);

  const paginatedInvoices = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredInvoices.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredInvoices, currentPage]);

  const totalPages = Math.ceil(filteredInvoices.length / ITEMS_PER_PAGE);

  // Calculate line items total
  const lineItemsTotal = useMemo(() => {
    return lineItems.reduce((sum, item) => {
      const itemTotal = item.quantity * item.unit_price - item.discount;
      return sum + Math.max(0, itemTotal);
    }, 0);
  }, [lineItems]);

  const subtotal = lineItemsTotal;
  const taxAmount = (subtotal - discount) * (taxPercent / 100);
  const grandTotal = subtotal - discount + taxAmount;

  // Handle line item changes
  const updateLineItem = (index: number, field: keyof LineItemRow, value: any) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };
    setLineItems(updated);
  };

  const addLineItem = () => {
    setLineItems([...lineItems, { service_name: '', quantity: 1, unit_price: 0, discount: 0, staff_name: '' }]);
  };

  const removeLineItem = (index: number) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter((_, i) => i !== index));
    }
  };

  // Handle create invoice
  const handleCreateInvoice = async () => {
    if (!clientName.trim() || !clientPhone.trim()) {
      alert('Client name and phone are required');
      return;
    }

    if (lineItems.some((item) => !item.service_name.trim() || item.unit_price <= 0)) {
      alert('All line items must have service name and unit price');
      return;
    }

    if (paymentStatus === 'partial' && amountPaid <= 0) {
      alert('Amount paid must be greater than 0 for partial payments');
      return;
    }

    setSubmitting(true);
    try {
      // Get next invoice number
      const { data: nextNumberData, error: rpcError } = await supabase.rpc('next_invoice_number');
      if (rpcError) throw rpcError;

      const invoice_number = nextNumberData || 'INV-001';

      // Create invoice
      const invoiceData = {
        invoice_number,
        client_name: clientName,
        client_phone: clientPhone,
        subtotal,
        discount,
        tax: taxAmount,
        total: grandTotal,
        payment_method: paymentMethod,
        payment_status: paymentStatus,
        amount_paid: paymentStatus === 'paid' ? grandTotal : amountPaid,
        notes: notes || null,
        invoice_date: new Date().toISOString().split('T')[0],
        created_by: user?.id,
      };

      const { data: invoiceResult, error: invoiceError } = await supabase
        .from('invoices')
        .insert([invoiceData])
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // Create invoice items
      const itemsToInsert = lineItems.map((item) => ({
        invoice_id: invoiceResult.id,
        service_name: item.service_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount: item.discount,
        total: item.quantity * item.unit_price - item.discount,
        staff_name: item.staff_name || null,
      }));

      const { error: itemsError } = await supabase.from('invoice_items').insert(itemsToInsert);
      if (itemsError) throw itemsError;

      // Reset form and close modal
      setClientName('');
      setClientPhone('');
      setLineItems([{ service_name: '', quantity: 1, unit_price: 0, discount: 0, staff_name: '' }]);
      setDiscount(0);
      setTaxPercent(0);
      setPaymentMethod('Cash');
      setPaymentStatus('pending');
      setAmountPaid(0);
      setNotes('');
      setShowCreateModal(false);

      // Refresh invoices
      await fetchInvoices();
      if (role === 'admin') {
        await fetchSummaryStats();
      }
    } catch (err) {
      console.error('Error creating invoice:', err);
      alert('Failed to create invoice');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle view invoice
  const handleViewInvoice = async (invoice: Invoice) => {
    try {
      const { data: items, error } = await supabase
        .from('invoice_items')
        .select('*')
        .eq('invoice_id', invoice.id);

      if (error) throw error;

      setSelectedInvoice(invoice);
      setSelectedInvoiceItems(items || []);
      setShowViewModal(true);
    } catch (err) {
      console.error('Error fetching invoice items:', err);
    }
  };

  // Handle delete invoice
  const handleDeleteInvoice = async (invoiceId: string) => {
    if (!confirm('Are you sure you want to delete this invoice?')) return;

    try {
      // Delete invoice items first
      await supabase.from('invoice_items').delete().eq('invoice_id', invoiceId);

      // Delete invoice
      const { error } = await supabase.from('invoices').delete().eq('id', invoiceId);
      if (error) throw error;

      await fetchInvoices();
      if (role === 'admin') {
        await fetchSummaryStats();
      }
    } catch (err) {
      console.error('Error deleting invoice:', err);
      alert('Failed to delete invoice');
    }
  };

  const getStatusColor = (status: PaymentStatus) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-red-100 text-red-800';
      case 'partial':
        return 'bg-amber-100 text-amber-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusBadgeText = (status: PaymentStatus) => {
    switch (status) {
      case 'paid':
        return 'Paid';
      case 'pending':
        return 'Pending';
      case 'partial':
        return 'Partial';
      default:
        return status;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div className="flex items-center gap-3">
                <img src="/Image_logo.png" alt="Logo" className="h-8 w-8 object-contain" />
                <h1 className="text-2xl font-bold text-gray-900">Billing</h1>
              </div>
            </div>
            {(role === 'admin' || role === 'operator') && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 transition"
              >
                <Plus className="w-5 h-5" />
                Create Invoice
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Summary Stats - Admin Only */}
      {role === 'admin' && (
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-gradient-to-br from-teal-50 to-teal-100 rounded-lg p-6 border border-teal-200">
                <p className="text-teal-600 text-sm font-semibold uppercase tracking-wider">Today's Revenue</p>
                <p className="text-3xl font-bold text-teal-900 mt-2">₹{todayRevenue.toLocaleString()}</p>
              </div>
              <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg p-6 border border-amber-200">
                <p className="text-amber-600 text-sm font-semibold uppercase tracking-wider">Monthly Revenue</p>
                <p className="text-3xl font-bold text-amber-900 mt-2">₹{monthlyRevenue.toLocaleString()}</p>
              </div>
              <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-6 border border-red-200">
                <p className="text-red-600 text-sm font-semibold uppercase tracking-wider">Pending Amount</p>
                <p className="text-3xl font-bold text-red-900 mt-2">₹{pendingAmount.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters and Search */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by client name, phone, or invoice number..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as PaymentStatus | 'all');
                  setCurrentPage(1);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              >
                <option value="all">All Status</option>
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
                <option value="partial">Partial</option>
              </select>

              <select
                value={dateFilter}
                onChange={(e) => {
                  setDateFilter(e.target.value as 'today' | 'week' | 'month' | 'all');
                  setCurrentPage(1);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Invoice List */}
      <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-500">Loading invoices...</p>
          </div>
        ) : paginatedInvoices.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <p className="text-gray-500">No invoices found</p>
          </div>
        ) : (
          <>
            {/* Table - Desktop */}
            <div className="hidden md:block bg-white rounded-lg border border-gray-200 overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                      Invoice #
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                      Client
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-900 uppercase tracking-wider">
                      Total
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                      Method
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-semibold text-gray-900 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {paginatedInvoices.map((invoice) => (
                    <tr key={invoice.id} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4 text-sm font-semibold text-teal-600">{invoice.invoice_number}</td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{invoice.client_name}</p>
                          <p className="text-xs text-gray-500">{invoice.client_phone}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {new Date(invoice.invoice_date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-gray-900 text-right">
                        ₹{(invoice.total || 0).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{invoice.payment_method || '-'}</td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(invoice.payment_status)}`}>
                          {getStatusBadgeText(invoice.payment_status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleViewInvoice(invoice)}
                            className="p-2 hover:bg-teal-50 text-teal-600 rounded transition"
                            title="View invoice"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {role === 'admin' && (
                            <button
                              onClick={() => handleDeleteInvoice(invoice.id)}
                              className="p-2 hover:bg-red-50 text-red-600 rounded transition"
                              title="Delete invoice"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
              {paginatedInvoices.map((invoice) => (
                <div key={invoice.id} className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-semibold text-teal-600">{invoice.invoice_number}</p>
                      <p className="text-sm font-medium text-gray-900 mt-1">{invoice.client_name}</p>
                      <p className="text-xs text-gray-500">{invoice.client_phone}</p>
                    </div>
                    <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${getStatusColor(invoice.payment_status)}`}>
                      {getStatusBadgeText(invoice.payment_status)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-gray-500">Date</p>
                      <p className="font-medium text-gray-900">{new Date(invoice.invoice_date).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Total</p>
                      <p className="font-medium text-gray-900">₹{(invoice.total || 0).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Method</p>
                      <p className="font-medium text-gray-900">{invoice.payment_method || '-'}</p>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => handleViewInvoice(invoice)}
                      className="flex-1 py-2 bg-teal-50 text-teal-600 rounded font-medium text-sm hover:bg-teal-100 transition"
                    >
                      View
                    </button>
                    {role === 'admin' && (
                      <button
                        onClick={() => handleDeleteInvoice(invoice.id)}
                        className="flex-1 py-2 bg-red-50 text-red-600 rounded font-medium text-sm hover:bg-red-100 transition"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-4 mt-6">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="p-2 hover:bg-gray-100 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                <span className="text-sm text-gray-600">
                  Page {currentPage} of {totalPages}
                </span>

                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 hover:bg-gray-100 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Create Invoice Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-t-lg sm:rounded-lg w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between bg-white border-b border-gray-200 sticky top-0 p-6">
              <h2 className="text-xl font-bold text-gray-900">Create New Invoice</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-2 hover:bg-gray-100 rounded transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              {/* Client Information */}
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-900">Client Information</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <input
                    type="text"
                    placeholder="Client Name *"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                  <input
                    type="tel"
                    placeholder="Phone Number *"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Line Items */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">Services</h3>
                  <button
                    onClick={addLineItem}
                    className="flex items-center gap-1 text-teal-600 hover:text-teal-700 text-sm font-medium"
                  >
                    <Plus className="w-4 h-4" /> Add Service
                  </button>
                </div>

                <div className="space-y-3 overflow-x-auto">
                  {lineItems.map((item, index) => (
                    <div key={index} className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                      <input
                        type="text"
                        placeholder="Service Name"
                        value={item.service_name}
                        onChange={(e) => updateLineItem(index, 'service_name', e.target.value)}
                        className="col-span-2 sm:col-span-2 px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      />
                      <input
                        type="number"
                        placeholder="Qty"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateLineItem(index, 'quantity', Math.max(1, parseInt(e.target.value) || 1))}
                        className="px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      />
                      <input
                        type="number"
                        placeholder="Price"
                        min="0"
                        step="0.01"
                        value={item.unit_price}
                        onChange={(e) => updateLineItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                        className="px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      />
                      <input
                        type="text"
                        placeholder="Staff"
                        value={item.staff_name || ''}
                        onChange={(e) => updateLineItem(index, 'staff_name', e.target.value)}
                        className="hidden sm:block px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      />
                      <div className="col-span-2 sm:col-span-1 flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">
                          ₹{(item.quantity * item.unit_price - item.discount).toLocaleString()}
                        </span>
                        {lineItems.length > 1 && (
                          <button
                            onClick={() => removeLineItem(index)}
                            className="p-1 hover:bg-red-50 text-red-600 rounded"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-gray-600">Discount (₹)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={discount}
                      onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded mt-1 focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">Tax %</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={taxPercent}
                      onChange={(e) => setTaxPercent(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded mt-1 focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-3 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Subtotal</span>
                    <span className="text-sm font-medium">₹{subtotal.toLocaleString()}</span>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Discount</span>
                      <span className="text-sm font-medium">-₹{discount.toLocaleString()}</span>
                    </div>
                  )}
                  {taxAmount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Tax</span>
                      <span className="text-sm font-medium">₹{taxAmount.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between bg-teal-50 p-2 rounded border border-teal-200">
                    <span className="font-semibold text-teal-900">Total</span>
                    <span className="font-bold text-lg text-teal-900">₹{grandTotal.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Payment Information */}
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-900">Payment Information</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  >
                    <option value="Cash">Cash</option>
                    <option value="Card">Card</option>
                    <option value="UPI">UPI</option>
                    <option value="Online">Online Transfer</option>
                  </select>

                  <select
                    value={paymentStatus}
                    onChange={(e) => setPaymentStatus(e.target.value as PaymentStatus)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  >
                    <option value="paid">Paid</option>
                    <option value="pending">Pending</option>
                    <option value="partial">Partial</option>
                  </select>
                </div>

                {paymentStatus === 'partial' && (
                  <input
                    type="number"
                    placeholder="Amount Paid (₹)"
                    min="0"
                    step="0.01"
                    max={grandTotal}
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                )}
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Notes</label>
                <textarea
                  placeholder="Add any notes for this invoice..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-gray-50 border-t border-gray-200 p-6 flex gap-3 sticky bottom-0">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateInvoice}
                disabled={submitting}
                className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Creating...' : 'Create Invoice'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Invoice Modal */}
      {showViewModal && selectedInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-t-lg sm:rounded-lg w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between bg-white border-b border-gray-200 sticky top-0 p-6">
              <h2 className="text-xl font-bold text-gray-900">Invoice #{selectedInvoice.invoice_number}</h2>
              <button
                onClick={() => setShowViewModal(false)}
                className="p-2 hover:bg-gray-100 rounded transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Invoice Content - Print Ready */}
            <div className="p-6 space-y-6" id="invoice-print-content">
              {/* Salon Header */}
              <div className="text-center border-b border-gray-300 pb-6">
                <div className="flex justify-center mb-4">
                  <img src="/Image_logo.png" alt="Logo" className="h-12 w-12 object-contain" />
                </div>
                <h1 className="text-3xl font-bold text-gray-900">Image Skinn & Hair</h1>
                <p className="text-gray-600 text-sm mt-2">Premium Salon & Hair Care</p>
              </div>

              {/* Invoice Info */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Invoice Number</p>
                  <p className="text-lg font-bold text-teal-600 mt-1">{selectedInvoice.invoice_number}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Invoice Date</p>
                  <p className="text-lg font-semibold text-gray-900 mt-1">
                    {new Date(selectedInvoice.invoice_date).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {/* Client Details */}
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-3">Client Information</p>
                <div className="space-y-2">
                  <p className="font-semibold text-gray-900">{selectedInvoice.client_name}</p>
                  <p className="text-gray-600 text-sm">Phone: {selectedInvoice.client_phone}</p>
                </div>
              </div>

              {/* Line Items Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-teal-600">
                      <th className="text-left py-2 font-semibold text-gray-900">Service</th>
                      <th className="text-center py-2 font-semibold text-gray-900">Qty</th>
                      <th className="text-right py-2 font-semibold text-gray-900">Unit Price</th>
                      <th className="text-right py-2 font-semibold text-gray-900">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {selectedInvoiceItems.map((item) => (
                      <tr key={item.id}>
                        <td className="py-3 text-gray-900">
                          <div>
                            <p className="font-medium">{item.service_name}</p>
                            {item.staff_name && <p className="text-xs text-gray-500">By: {item.staff_name}</p>}
                          </div>
                        </td>
                        <td className="py-3 text-center text-gray-600">{item.quantity}</td>
                        <td className="py-3 text-right text-gray-600">₹{(item.unit_price || 0).toLocaleString()}</td>
                        <td className="py-3 text-right font-medium text-gray-900">
                          ₹{((item.quantity || 1) * (item.unit_price || 0) - (item.discount || 0)).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div className="flex justify-end">
                <div className="w-full sm:w-80 space-y-2 bg-gray-50 rounded-lg p-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Subtotal</span>
                    <span className="font-medium text-gray-900">₹{(selectedInvoice.subtotal || 0).toLocaleString()}</span>
                  </div>
                  {selectedInvoice.discount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Discount</span>
                      <span className="font-medium text-gray-900">-₹{(selectedInvoice.discount || 0).toLocaleString()}</span>
                    </div>
                  )}
                  {selectedInvoice.tax > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Tax</span>
                      <span className="font-medium text-gray-900">₹{(selectedInvoice.tax || 0).toLocaleString()}</span>
                    </div>
                  )}
                  <div className="border-t border-gray-300 pt-2 flex justify-between">
                    <span className="font-bold text-gray-900">Total</span>
                    <span className="font-bold text-lg text-teal-600">₹{(selectedInvoice.total || 0).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Payment Info */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-teal-50 rounded-lg border border-teal-200">
                <div>
                  <p className="text-xs text-teal-600 uppercase tracking-wider font-semibold">Payment Method</p>
                  <p className="font-medium text-gray-900 mt-1">{selectedInvoice.payment_method || '-'}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-teal-600 uppercase tracking-wider font-semibold">Payment Status</p>
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-xs font-semibold mt-1 ${getStatusColor(selectedInvoice.payment_status)}`}
                  >
                    {getStatusBadgeText(selectedInvoice.payment_status)}
                  </span>
                </div>
              </div>

              {selectedInvoice.notes && (
                <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                  <p className="text-xs text-amber-700 uppercase tracking-wider font-semibold">Notes</p>
                  <p className="text-gray-700 mt-2">{selectedInvoice.notes}</p>
                </div>
              )}

              {/* Amount Paid Info */}
              {selectedInvoice.payment_status !== 'paid' && (
                <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-red-700 uppercase tracking-wider font-semibold">Amount Paid</p>
                      <p className="font-medium text-gray-900 mt-1">₹{(selectedInvoice.amount_paid || 0).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-red-700 uppercase tracking-wider font-semibold">Outstanding</p>
                      <p className="font-medium text-red-700 mt-1">
                        ₹{((selectedInvoice.total || 0) - (selectedInvoice.amount_paid || 0)).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer with Actions */}
            <div className="bg-gray-50 border-t border-gray-200 p-6 flex flex-col sm:flex-row gap-3 sticky bottom-0">
              <button
                onClick={() => window.print()}
                className="flex items-center justify-center gap-2 flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
              >
                <Printer className="w-4 h-4" />
                Print / PDF
              </button>

              <button
                onClick={() => {
                  const whatsappText = `Invoice ${selectedInvoice.invoice_number} Total ₹${selectedInvoice.total}`;
                  const whatsappUrl = `https://wa.me/${selectedInvoice.client_phone}?text=${encodeURIComponent(whatsappText)}`;
                  window.open(whatsappUrl, '_blank');
                }}
                className="flex items-center justify-center gap-2 flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium"
              >
                <MessageCircle className="w-4 h-4" />
                WhatsApp
              </button>

              <button
                onClick={() => setShowViewModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
