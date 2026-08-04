import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Phone, Plus, CreditCard as Edit2, Trash2, ArrowLeft, Search, CheckCircle, Clock, AlertCircle, X, ChevronDown, Calendar, User, MessageSquare, MapPin } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Inquiry } from '../lib/types';

type TabType = 'all' | 'new' | 'followup' | 'converted' | 'lost';
type SortField = 'created_at' | 'follow_up_date' | 'name';

interface FormData {
  name: string;
  phone: string;
  service_interest: string;
  source: string;
  status: string;
  follow_up_date: string;
  notes: string;
}

const INITIAL_FORM: FormData = {
  name: '',
  phone: '',
  service_interest: '',
  source: 'Walk-in',
  status: 'new',
  follow_up_date: '',
  notes: '',
};

const SOURCES = ['Walk-in', 'Phone Call', 'WhatsApp', 'Instagram', 'Referral', 'Online'];

const STATUS_COLORS: Record<string, { bg: string; text: string; badge: string }> = {
  new: { bg: 'bg-blue-50', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-800' },
  contacted: { bg: 'bg-amber-50', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-800' },
  follow_up: { bg: 'bg-orange-50', text: 'text-orange-700', badge: 'bg-orange-100 text-orange-800' },
  converted: { bg: 'bg-teal-50', text: 'text-teal-700', badge: 'bg-teal-100 text-teal-800' },
  lost: { bg: 'bg-gray-50', text: 'text-gray-700', badge: 'bg-white/40 text-gray-800' },
};

const isDateOverdue = (date: string): 'overdue' | 'today' | 'upcoming' | null => {
  if (!date) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const followUp = new Date(date);
  followUp.setHours(0, 0, 0, 0);
  const diff = followUp.getTime() - today.getTime();
  if (diff < 0) return 'overdue';
  if (diff === 0) return 'today';
  return 'upcoming';
};

const formatDate = (date: string): string => {
  if (!date) return '';
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

export function InquiryPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [filteredInquiries, setFilteredInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState<FormData>(INITIAL_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const isAdmin = user?.user_metadata?.role === 'admin';

  useEffect(() => {
    fetchInquiries();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [inquiries, activeTab, searchQuery]);

  const fetchInquiries = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data, error: fetchError } = await supabase
        .from('inquiries')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setInquiries(data || []);
    } catch (err) {
      console.error('Error fetching inquiries:', err);
      setError(err instanceof Error ? err.message : 'Failed to load inquiries');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...inquiries];

    // Filter by tab
    if (activeTab === 'new') {
      filtered = filtered.filter((i) => i.status === 'new');
    } else if (activeTab === 'followup') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      filtered = filtered.filter((i) => {
        if (i.status === 'converted' || i.status === 'lost') return false;
        if (!i.follow_up_date) return false;
        const followUp = new Date(i.follow_up_date);
        followUp.setHours(0, 0, 0, 0);
        return followUp <= today;
      });
      filtered.sort((a, b) => {
        const dateA = a.follow_up_date ? new Date(a.follow_up_date).getTime() : 0;
        const dateB = b.follow_up_date ? new Date(b.follow_up_date).getTime() : 0;
        return dateA - dateB;
      });
    } else if (activeTab === 'converted') {
      filtered = filtered.filter((i) => i.status === 'converted');
    } else if (activeTab === 'lost') {
      filtered = filtered.filter((i) => i.status === 'lost');
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (i) =>
          i.name.toLowerCase().includes(query) || i.phone.toLowerCase().includes(query)
      );
    }

    setFilteredInquiries(filtered);
  };

  const handleAddInquiry = () => {
    setEditingId(null);
    setFormData(INITIAL_FORM);
    setFormError(null);
    setShowModal(true);
  };

  const handleEditInquiry = (inquiry: Inquiry) => {
    setEditingId(inquiry.id);
    setFormData({
      name: inquiry.name,
      phone: inquiry.phone,
      service_interest: inquiry.service_interest || '',
      source: inquiry.source || 'Walk-in',
      status: inquiry.status,
      follow_up_date: inquiry.follow_up_date || '',
      notes: inquiry.notes || '',
    });
    setFormError(null);
    setShowModal(true);
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.name.trim() || !formData.phone.trim()) {
      setFormError('Name and phone are required');
      return;
    }

    try {
      if (editingId) {
        // Update existing
        const { error: updateError } = await supabase
          .from('inquiries')
          .update({
            name: formData.name.trim(),
            phone: formData.phone.trim(),
            service_interest: formData.service_interest.trim() || null,
            source: formData.source,
            status: formData.status,
            follow_up_date: formData.follow_up_date || null,
            notes: formData.notes.trim() || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingId);

        if (updateError) throw updateError;
      } else {
        // Create new
        const { error: insertError } = await supabase.from('inquiries').insert([
          {
            name: formData.name.trim(),
            phone: formData.phone.trim(),
            service_interest: formData.service_interest.trim() || null,
            source: formData.source,
            status: formData.status,
            follow_up_date: formData.follow_up_date || null,
            notes: formData.notes.trim() || null,
            created_by: user?.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ]);

        if (insertError) throw insertError;
      }

      setShowModal(false);
      await fetchInquiries();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save inquiry');
    }
  };

  const handleDeleteInquiry = async (id: string) => {
    try {
      const { error: deleteError } = await supabase.from('inquiries').delete().eq('id', id);

      if (deleteError) throw deleteError;
      setDeleteConfirm(null);
      await fetchInquiries();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete inquiry');
    }
  };

  const handleConvertToClient = (inquiry: Inquiry) => {
    navigate('/clients/new', {
      state: {
        prefill: {
          name: inquiry.name,
          phone: inquiry.phone,
        },
      },
    });
  };

  // Statistics
  const stats = {
    new: inquiries.filter((i) => i.status === 'new').length,
    contacted: inquiries.filter((i) => i.status === 'contacted').length,
    followup: (() => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return inquiries.filter((i) => {
        if (i.status === 'converted' || i.status === 'lost') return false;
        if (!i.follow_up_date) return false;
        const followUp = new Date(i.follow_up_date);
        followUp.setHours(0, 0, 0, 0);
        return followUp <= today;
      }).length;
    })(),
    converted: inquiries.filter((i) => i.status === 'converted').length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-teal-50 to-amber-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading inquiries...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-amber-50">
      {/* Header */}
      <div className="bg-white border-b border-white/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between gap-4 mb-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="p-2 hover:bg-white/40 rounded-lg transition-colors"
              title="Back to Dashboard"
            >
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
            <img src="/Image_logo.png" alt="Logo" className="h-8 object-contain" />
            <div className="flex-1" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Inquiries & Follow-ups</h1>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="glass-subtle rounded-lg border border-blue-200 p-4 sm:p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">New</p>
                <p className="text-2xl sm:text-3xl font-bold text-blue-700">{stats.new}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-blue-300" />
            </div>
          </div>
          <div className="glass-subtle rounded-lg border border-amber-200 p-4 sm:p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Contacted</p>
                <p className="text-2xl sm:text-3xl font-bold text-amber-700">{stats.contacted}</p>
              </div>
              <Phone className="w-8 h-8 text-amber-300" />
            </div>
          </div>
          <div className="glass-subtle rounded-lg border border-orange-200 p-4 sm:p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Follow-up Due</p>
                <p className="text-2xl sm:text-3xl font-bold text-orange-700">{stats.followup}</p>
              </div>
              <Clock className="w-8 h-8 text-orange-300" />
            </div>
          </div>
          <div className="glass-subtle rounded-lg border border-teal-200 p-4 sm:p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Converted</p>
                <p className="text-2xl sm:text-3xl font-bold text-teal-700">{stats.converted}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-teal-300" />
            </div>
          </div>
        </div>

        {/* Tabs & Controls */}
        <div className="glass-subtle rounded-lg border border-white/30 mb-6 overflow-hidden">
          <div className="flex flex-col sm:flex-row gap-4 p-4 sm:items-center sm:justify-between">
            <div className="flex gap-2 overflow-x-auto">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'new', label: 'New' },
                  { id: 'followup', label: 'Follow-up Due' },
                  { id: 'converted', label: 'Converted' },
                  { id: 'lost', label: 'Lost' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 sm:px-4 py-2 text-sm font-medium whitespace-nowrap rounded-lg transition-colors ${
                    activeTab === tab.id
                      ? 'bg-teal-600 text-white'
                      : 'bg-white/40 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <button
              onClick={handleAddInquiry}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors font-medium whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              Add Inquiry
            </button>
          </div>

          {/* Search */}
          <div className="px-4 pb-4 border-t border-white/30">
            <div className="relative">
              <Search className="w-5 h-5 absolute left-3 top-3 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-white/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/15 border border-red-300/40 rounded-xl backdrop-blur-sm text-red-800 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Error</p>
              <p className="text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Inquiries List - Mobile (Cards) */}
        {filteredInquiries.length > 0 ? (
          <div className="grid gap-4 md:hidden">
            {filteredInquiries.map((inquiry) => {
              const dateStatus = isDateOverdue(inquiry.follow_up_date || '');
              const colors = STATUS_COLORS[inquiry.status] || STATUS_COLORS.new;

              return (
                <div
                  key={inquiry.id}
                  className={`${colors.bg} rounded-lg border border-white/30 p-4`}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-900">{inquiry.name}</h3>
                      <p className="text-sm text-gray-600 flex items-center gap-1 mt-1">
                        <Phone className="w-3 h-3" />
                        {inquiry.phone}
                      </p>
                    </div>
                    <span className={`px-2 py-1 text-xs font-semibold rounded whitespace-nowrap ${colors.badge}`}>
                      {inquiry.status === 'follow_up' ? 'Follow-up' : inquiry.status.charAt(0).toUpperCase() + inquiry.status.slice(1)}
                    </span>
                  </div>

                  {/* Details */}
                  <div className="space-y-2 mb-3 text-sm">
                    {inquiry.service_interest && (
                      <p className="text-gray-700">
                        <span className="font-medium">Service:</span> {inquiry.service_interest}
                      </p>
                    )}
                    {inquiry.source && (
                      <p className="text-gray-700">
                        <span className="font-medium">Source:</span> {inquiry.source}
                      </p>
                    )}
                    {inquiry.follow_up_date && (
                      <p className={`font-medium ${
                        dateStatus === 'overdue'
                          ? 'text-red-600'
                          : dateStatus === 'today'
                          ? 'text-amber-600'
                          : 'text-gray-600'
                      }`}>
                        <Calendar className="w-3 h-3 inline mr-1" />
                        {formatDate(inquiry.follow_up_date)}
                        {dateStatus === 'overdue' && ' (Overdue)'}
                        {dateStatus === 'today' && ' (Today)'}
                      </p>
                    )}
                    {inquiry.notes && (
                      <p className="text-gray-700">
                        <span className="font-medium">Notes:</span> {inquiry.notes}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-3 border-t border-white/40">
                    <button
                      onClick={() => handleEditInquiry(inquiry)}
                      className="flex-1 px-3 py-2 text-xs font-medium glass border border-white/40 rounded text-gray-700 hover:bg-white/40 transition-colors flex items-center justify-center gap-1"
                    >
                      <Edit2 className="w-3 h-3" />
                      Edit
                    </button>
                    {inquiry.status === 'converted' && (
                      <button
                        onClick={() => handleConvertToClient(inquiry)}
                        className="flex-1 px-3 py-2 text-xs font-medium bg-teal-600 text-white rounded hover:bg-teal-700 transition-colors"
                      >
                        To Client
                      </button>
                    )}
                    {isAdmin && (
                      <button
                        onClick={() => setDeleteConfirm(inquiry.id)}
                        className="px-3 py-2 text-xs font-medium glass border border-red-300 rounded text-red-700 hover:bg-red-50 transition-colors flex items-center justify-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {/* Delete Confirm */}
                  {deleteConfirm === inquiry.id && (
                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded">
                      <p className="text-xs text-red-700 mb-2">Delete this inquiry?</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleDeleteInquiry(inquiry.id)}
                          className="flex-1 px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                        >
                          Delete
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="flex-1 px-2 py-1 text-xs bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : null}

        {/* Inquiries Table - Desktop */}
        {filteredInquiries.length > 0 ? (
          <div className="hidden md:block glass-subtle rounded-lg border border-white/30 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-white/30 border-b border-white/30">
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Phone
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Service
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Source
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Follow-up
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Notes
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredInquiries.map((inquiry) => {
                    const dateStatus = isDateOverdue(inquiry.follow_up_date || '');
                    const colors = STATUS_COLORS[inquiry.status] || STATUS_COLORS.new;

                    return (
                      <tr key={inquiry.id} className="hover:bg-white/40 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <p className="font-medium text-gray-900">{inquiry.name}</p>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <p className="text-sm text-gray-600">{inquiry.phone}</p>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <p className="text-sm text-gray-600">{inquiry.service_interest || '—'}</p>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <p className="text-sm text-gray-600">{inquiry.source || '—'}</p>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-3 py-1 text-xs font-semibold rounded-full ${colors.badge}`}>
                            {inquiry.status === 'follow_up' ? 'Follow-up' : inquiry.status.charAt(0).toUpperCase() + inquiry.status.slice(1)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {inquiry.follow_up_date ? (
                            <p className={`text-sm font-medium ${
                              dateStatus === 'overdue'
                                ? 'text-red-600'
                                : dateStatus === 'today'
                                ? 'text-amber-600'
                                : 'text-gray-600'
                            }`}>
                              {formatDate(inquiry.follow_up_date)}
                              {dateStatus === 'overdue' && ' 🔴'}
                              {dateStatus === 'today' && ' 🟡'}
                            </p>
                          ) : (
                            <p className="text-sm text-gray-400">—</p>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm text-gray-600 max-w-xs truncate">{inquiry.notes || '—'}</p>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => handleEditInquiry(inquiry)}
                              className="p-2 hover:bg-blue-50 rounded-lg transition-colors text-blue-600"
                              title="Edit"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            {inquiry.status === 'converted' && (
                              <button
                                onClick={() => handleConvertToClient(inquiry)}
                                className="p-2 hover:bg-teal-500/15 rounded-lg transition-colors text-teal-600 text-xs font-semibold"
                                title="Convert to Client"
                              >
                                <User className="w-4 h-4" />
                              </button>
                            )}
                            {isAdmin && (
                              <button
                                onClick={() => setDeleteConfirm(inquiry.id)}
                                className="p-2 hover:bg-red-50 rounded-lg transition-colors text-red-600"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>

                          {/* Delete Confirm Tooltip */}
                          {deleteConfirm === inquiry.id && (
                            <div className="absolute right-0 mt-2 glass border border-red-200 rounded-lg shadow-lg p-3 z-50">
                              <p className="text-xs text-gray-700 mb-2 whitespace-nowrap">
                                Delete this inquiry?
                              </p>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleDeleteInquiry(inquiry.id)}
                                  className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                                >
                                  Delete
                                </button>
                                <button
                                  onClick={() => setDeleteConfirm(null)}
                                  className="px-2 py-1 text-xs bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="glass-subtle rounded-lg border border-white/30 p-12 text-center">
            <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-2">
              {searchQuery ? 'No inquiries match your search' : `No ${activeTab !== 'all' ? activeTab : ''} inquiries`}
            </p>
            {!searchQuery && activeTab === 'all' && (
              <button
                onClick={handleAddInquiry}
                className="text-teal-600 hover:text-teal-700 font-medium text-sm mt-2"
              >
                Create your first inquiry
              </button>
            )}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-white/30 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">
                {editingId ? 'Edit Inquiry' : 'Add New Inquiry'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 hover:bg-white/40 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmitForm} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                  {formError}
                </div>
              )}

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-white/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="Client name"
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone <span className="text-red-600">*</span>
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-white/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="+1 (555) 000-0000"
                />
              </div>

              {/* Service Interest */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Service Interest
                </label>
                <input
                  type="text"
                  value={formData.service_interest}
                  onChange={(e) => setFormData({ ...formData, service_interest: e.target.value })}
                  className="w-full px-3 py-2 border border-white/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="e.g., Hair Styling, Facial"
                />
              </div>

              {/* Source */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Source
                </label>
                <div className="relative">
                  <select
                    value={formData.source}
                    onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                    className="w-full px-3 py-2 glass-input rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 appearance-none"
                  >
                    {SOURCES.map((source) => (
                      <option key={source} value={source}>
                        {source}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <div className="relative">
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 glass-input rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 appearance-none"
                  >
                    <option value="new">New</option>
                    <option value="contacted">Contacted</option>
                    <option value="follow_up">Follow-up</option>
                    <option value="converted">Converted</option>
                    <option value="lost">Lost</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {/* Follow-up Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Follow-up Date
                </label>
                <input
                  type="date"
                  value={formData.follow_up_date}
                  onChange={(e) => setFormData({ ...formData, follow_up_date: e.target.value })}
                  className="w-full px-3 py-2 border border-white/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-white/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
                  rows={3}
                  placeholder="Additional notes..."
                />
              </div>

              {/* Form Actions */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border border-white/40 text-gray-700 rounded-lg hover:bg-white/40 transition-colors font-medium"
                >
                  Cancel
                </button>
                {editingId && (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('Delete this inquiry?')) {
                        handleDeleteInquiry(editingId);
                        setShowModal(false);
                      }
                    }}
                    className="flex-1 px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 transition-colors font-medium flex items-center justify-center gap-1.5"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                )}
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors font-medium"
                >
                  {editingId ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
