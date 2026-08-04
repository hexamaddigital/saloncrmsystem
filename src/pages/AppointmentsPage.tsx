import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, CreditCard as Edit2, Calendar, List, ChevronLeft, ChevronRight, X, AlertCircle, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Appointment } from '../lib/types';

type ViewType = 'list' | 'calendar';
type FilterDateRange = 'today' | 'week' | 'all';
type StatusType = 'scheduled' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';

interface FormData {
  client_name: string;
  client_phone: string;
  service_name: string;
  staff_name: string;
  scheduled_date: string;
  scheduled_time: string;
  duration_min: string;
  notes: string;
  status: StatusType;
}

const STATUS_COLORS: Record<StatusType, { bg: string; text: string; badge: string }> = {
  scheduled: { bg: 'bg-blue-50', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-800' },
  confirmed: { bg: 'bg-teal-50', text: 'text-teal-700', badge: 'bg-teal-100 text-teal-800' },
  in_progress: { bg: 'bg-amber-50', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-800' },
  completed: { bg: 'bg-green-50', text: 'text-green-700', badge: 'bg-green-100 text-green-800' },
  cancelled: { bg: 'bg-gray-50', text: 'text-gray-700', badge: 'bg-white/40 text-gray-800' },
  no_show: { bg: 'bg-red-50', text: 'text-red-700', badge: 'bg-red-100 text-red-800' },
};

const DURATIONS = [30, 45, 60, 90, 120];

function getWeekDates(date: Date): { start: Date; end: Date } {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const start = new Date(d.setDate(diff));
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start, end };
}

function formatDateISO(date: Date): string {
  return date.toISOString().split('T')[0];
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' + date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function getDayOfWeek(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'short' });
}

export function AppointmentsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [view, setView] = useState<ViewType>('list');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>({
    client_name: '',
    client_phone: '',
    service_name: '',
    staff_name: '',
    scheduled_date: '',
    scheduled_time: '10:00',
    duration_min: '60',
    notes: '',
    status: 'scheduled',
  });

  const [filterDateRange, setFilterDateRange] = useState<FilterDateRange>('all');
  const [filterStatus, setFilterStatus] = useState<StatusType | 'all'>('all');

  const [calendarWeek, setCalendarWeek] = useState(new Date());
  const [selectedAppointmentPopup, setSelectedAppointmentPopup] = useState<Appointment | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    fetchAppointments();
  }, [user, navigate]);

  async function fetchAppointments() {
    try {
      setLoading(true);
      setError(null);
      const { data, error: err } = await supabase
        .from('appointments')
        .select('*')
        .order('scheduled_at', { ascending: true });

      if (err) throw err;
      setAppointments(data || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch appointments';
      setError(message);
      console.error('Error fetching appointments:', err);
    } finally {
      setLoading(false);
    }
  }

  function getFilteredAppointments(): Appointment[] {
    return appointments.filter((apt) => {
      if (filterStatus !== 'all' && apt.status !== filterStatus) return false;

      if (filterDateRange === 'today') {
        const today = formatDateISO(new Date());
        const aptDate = apt.scheduled_at.split('T')[0];
        return aptDate === today;
      }
      if (filterDateRange === 'week') {
        const now = new Date();
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 7);
        const aptDate = new Date(apt.scheduled_at);
        return aptDate >= weekStart && aptDate < weekEnd;
      }

      return true;
    });
  }

  async function handleSaveAppointment() {
    if (!formData.client_name.trim() || !formData.service_name.trim() || !formData.scheduled_date || !formData.scheduled_time) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      const scheduledAt = new Date(`${formData.scheduled_date}T${formData.scheduled_time}:00`).toISOString();

      const payload = {
        client_name: formData.client_name.trim(),
        client_phone: formData.client_phone.trim(),
        service_name: formData.service_name.trim(),
        staff_name: formData.staff_name.trim() || null,
        scheduled_at: scheduledAt,
        duration_min: parseInt(formData.duration_min) || 60,
        notes: formData.notes.trim() || null,
        status: formData.status,
        created_by: user?.id,
        updated_at: new Date().toISOString(),
      };

      let result;
      if (editingId) {
        const { error: err } = await supabase
          .from('appointments')
          .update(payload)
          .eq('id', editingId);
        if (err) throw err;
      } else {
        const { error: err } = await supabase
          .from('appointments')
          .insert([payload]);
        if (err) throw err;
      }

      setShowModal(false);
      setEditingId(null);
      resetForm();
      await fetchAppointments();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save appointment';
      setError(message);
      console.error('Error saving appointment:', err);
    }
  }

  async function handleDeleteAppointment(id: string) {
    if (!isAdmin) {
      setError('Only admins can delete appointments');
      return;
    }

    if (!window.confirm('Are you sure you want to delete this appointment?')) return;

    try {
      const { error: err } = await supabase
        .from('appointments')
        .delete()
        .eq('id', id);

      if (err) throw err;
      await fetchAppointments();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete appointment';
      setError(message);
      console.error('Error deleting appointment:', err);
    }
  }

  async function handleStatusChange(id: string, newStatus: StatusType) {
    try {
      const { error: err } = await supabase
        .from('appointments')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (err) throw err;
      await fetchAppointments();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update status';
      setError(message);
      console.error('Error updating status:', err);
    }
  }

  function resetForm() {
    setFormData({
      client_name: '',
      client_phone: '',
      service_name: '',
      staff_name: '',
      scheduled_date: '',
      scheduled_time: '10:00',
      duration_min: '60',
      notes: '',
      status: 'scheduled',
    });
  }

  function openEditModal(apt: Appointment) {
    const date = new Date(apt.scheduled_at);
    const dateStr = formatDateISO(date);
    const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

    setFormData({
      client_name: apt.client_name,
      client_phone: apt.client_phone,
      service_name: apt.service_name,
      staff_name: apt.staff_name || '',
      scheduled_date: dateStr,
      scheduled_time: timeStr,
      duration_min: String(apt.duration_min || 60),
      notes: apt.notes || '',
      status: apt.status,
    });
    setEditingId(apt.id);
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingId(null);
    resetForm();
    setError(null);
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setSelectedAppointmentPopup(null);
      }
    }

    if (selectedAppointmentPopup) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [selectedAppointmentPopup]);

  const filteredAppointments = getFilteredAppointments();

  const weekDates = getWeekDates(calendarWeek);
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekDates.start);
    d.setDate(d.getDate() + i);
    return d;
  });

  const appointmentsByDay = weekDays.map((day) => {
    const dayStr = formatDateISO(day);
    return appointments.filter((apt) => apt.scheduled_at.split('T')[0] === dayStr);
  });

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/dashboard')}
                className="p-2 hover:bg-white/40 rounded-lg transition-colors"
                title="Back to Dashboard"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <img src="/Image_logo.png" alt="Salon Logo" className="h-10 w-auto object-contain" />
              <h1 className="text-2xl font-bold text-gray-900">Appointments</h1>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden sm:flex border border-white/40 rounded-lg p-1 bg-white/80">
                <button
                  onClick={() => setView('list')}
                  className={`px-3 py-1.5 rounded transition-colors flex items-center gap-2 ${
                    view === 'list'
                      ? 'bg-teal-100 text-teal-700 font-medium'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <List className="w-4 h-4" />
                  List
                </button>
                <button
                  onClick={() => setView('calendar')}
                  className={`px-3 py-1.5 rounded transition-colors flex items-center gap-2 ${
                    view === 'calendar'
                      ? 'bg-teal-100 text-teal-700 font-medium'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Calendar className="w-4 h-4" />
                  Calendar
                </button>
              </div>

              <button
                onClick={() => {
                  resetForm();
                  setShowModal(true);
                }}
                className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors flex items-center gap-2 font-medium"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">New Appointment</span>
                <span className="sm:hidden">New</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-500/15 border border-red-300/40 rounded-xl backdrop-blur-sm flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-800 font-medium">Error</p>
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          </div>
        )}

        {view === 'list' ? (
          <div className="space-y-4">
            <div className="glass-subtle rounded-lg border border-white/30 p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
                <select
                  value={filterDateRange}
                  onChange={(e) => setFilterDateRange(e.target.value as FilterDateRange)}
                  className="px-3 py-2 border border-white/40 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                >
                  <option value="all">All Dates</option>
                  <option value="today">Today</option>
                  <option value="week">This Week</option>
                </select>

                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as StatusType | 'all')}
                  className="px-3 py-2 border border-white/40 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                >
                  <option value="all">All Statuses</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="no_show">No Show</option>
                </select>
              </div>

              <p className="text-sm text-gray-600 font-medium">
                {filteredAppointments.length} {filteredAppointments.length === 1 ? 'appointment' : 'appointments'}
              </p>
            </div>

            {loading ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
                <p className="mt-4 text-gray-600">Loading appointments...</p>
              </div>
            ) : filteredAppointments.length === 0 ? (
              <div className="glass-subtle rounded-lg border border-white/30 p-12 text-center">
                <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-600 font-medium">No appointments found</p>
                <p className="text-gray-600 text-sm mt-1">Try adjusting your filters or create a new appointment</p>
              </div>
            ) : (
              <div className="hidden md:block glass-subtle rounded-lg border border-white/30 overflow-hidden">
                <table className="w-full">
                  <thead className="bg-white/30 border-b border-white/30">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Date & Time</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Client</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Phone</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Service</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Staff</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Duration</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Status</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredAppointments.map((apt) => (
                      <tr key={apt.id} className="hover:bg-white/40 transition-colors">
                        <td className="px-4 py-3 text-sm text-gray-900 font-medium whitespace-nowrap">
                          {formatDateTime(apt.scheduled_at)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">{apt.client_name}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{apt.client_phone}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{apt.service_name}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{apt.staff_name || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{apt.duration_min} min</td>
                        <td className="px-4 py-3">
                          <select
                            value={apt.status}
                            onChange={(e) => handleStatusChange(apt.id, e.target.value as StatusType)}
                            className={`px-2 py-1 rounded text-xs font-medium border-0 focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer ${
                              STATUS_COLORS[apt.status].badge
                            }`}
                          >
                            {Object.keys(STATUS_COLORS).map((status) => (
                              <option key={status} value={status}>
                                {status.replace('_', ' ').charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => openEditModal(apt)}
                              className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-white/40 rounded transition-colors"
                              title="Edit"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            {isAdmin && (
                              <button
                                onClick={() => handleDeleteAppointment(apt.id)}
                                className="p-1.5 text-red-600 hover:text-red-900 hover:bg-red-50 rounded transition-colors"
                                title="Delete"
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
            )}

            {filteredAppointments.length > 0 && (
              <div className="md:hidden space-y-3">
                {filteredAppointments.map((apt) => (
                  <div key={apt.id} className="glass-subtle rounded-lg border border-white/30 p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="font-semibold text-gray-900">{apt.client_name}</p>
                        <p className="text-sm text-gray-600">{formatDateTime(apt.scheduled_at)}</p>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${STATUS_COLORS[apt.status].badge}`}>
                        {apt.status.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="space-y-1 mb-4 text-sm text-gray-600">
                      <p>{apt.service_name}</p>
                      <p>{apt.client_phone}</p>
                      {apt.staff_name && <p>Staff: {apt.staff_name}</p>}
                      {apt.duration_min && <p>Duration: {apt.duration_min} min</p>}
                    </div>

                    <div className="flex gap-2">
                      <select
                        value={apt.status}
                        onChange={(e) => handleStatusChange(apt.id, e.target.value as StatusType)}
                        className={`flex-1 px-2 py-1.5 rounded text-xs font-medium border-0 focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer ${
                          STATUS_COLORS[apt.status].badge
                        }`}
                      >
                        {Object.keys(STATUS_COLORS).map((status) => (
                          <option key={status} value={status}>
                            {status.replace('_', ' ')}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => openEditModal(apt)}
                        className="p-2 text-gray-600 hover:text-gray-900 hover:bg-white/40 rounded transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      {isAdmin && (
                        <button
                          onClick={() => handleDeleteAppointment(apt.id)}
                          className="p-2 text-red-600 hover:text-red-900 hover:bg-red-50 rounded transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between glass-subtle rounded-lg border border-white/30 p-4">
              <button
                onClick={() => {
                  const prev = new Date(calendarWeek);
                  prev.setDate(prev.getDate() - 7);
                  setCalendarWeek(prev);
                }}
                className="p-2 hover:bg-white/40 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-gray-600" />
              </button>

              <h3 className="font-semibold text-gray-900 text-center">
                {formatDate(weekDates.start)} - {formatDate(weekDates.end)}
              </h3>

              <button
                onClick={() => {
                  const next = new Date(calendarWeek);
                  next.setDate(next.getDate() + 7);
                  setCalendarWeek(next);
                }}
                className="p-2 hover:bg-white/40 rounded-lg transition-colors"
              >
                <ChevronRight className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            {loading ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
                <p className="mt-4 text-gray-600">Loading calendar...</p>
              </div>
            ) : (
              <div className="glass-subtle rounded-lg border border-white/30 overflow-hidden">
                <div className="grid grid-cols-7 border-b border-white/30">
                  {weekDays.map((day, idx) => (
                    <div
                      key={idx}
                      className="border-r border-white/30 last:border-r-0 p-3 text-center glass-subtle"
                    >
                      <p className="text-xs font-semibold text-gray-700">{getDayOfWeek(day)}</p>
                      <p className="text-sm font-medium text-gray-900">{day.getDate()}</p>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7">
                  {weekDays.map((day, dayIdx) => (
                    <div
                      key={dayIdx}
                      className="border-r border-white/30 last:border-r-0 min-h-32 p-2 relative"
                    >
                      <div className="space-y-1">
                        {appointmentsByDay[dayIdx]?.map((apt) => (
                          <div
                            key={apt.id}
                            onClick={() => setSelectedAppointmentPopup(apt)}
                            className={`p-2 rounded text-xs cursor-pointer hover:shadow-md transition-shadow ${
                              STATUS_COLORS[apt.status].bg
                            } ${STATUS_COLORS[apt.status].text} font-medium truncate`}
                          >
                            <div className="truncate">{formatTime(apt.scheduled_at)}</div>
                            <div className="truncate">{apt.client_name}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {selectedAppointmentPopup && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div
            ref={popupRef}
            className="bg-white rounded-lg shadow-lg max-w-sm w-full p-6 space-y-4"
          >
            <div className="flex justify-between items-start">
              <h3 className="text-lg font-semibold text-gray-900">Appointment Details</h3>
              <button
                onClick={() => setSelectedAppointmentPopup(null)}
                className="text-gray-600 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold text-gray-600 uppercase">Client</p>
                <p className="text-sm text-gray-900 font-medium">{selectedAppointmentPopup.client_name}</p>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-600 uppercase">Phone</p>
                <p className="text-sm text-gray-900">{selectedAppointmentPopup.client_phone}</p>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-600 uppercase">Date & Time</p>
                <p className="text-sm text-gray-900">{formatDateTime(selectedAppointmentPopup.scheduled_at)}</p>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-600 uppercase">Service</p>
                <p className="text-sm text-gray-900">{selectedAppointmentPopup.service_name}</p>
              </div>

              {selectedAppointmentPopup.staff_name && (
                <div>
                  <p className="text-xs font-semibold text-gray-600 uppercase">Staff</p>
                  <p className="text-sm text-gray-900">{selectedAppointmentPopup.staff_name}</p>
                </div>
              )}

              {selectedAppointmentPopup.duration_min && (
                <div>
                  <p className="text-xs font-semibold text-gray-600 uppercase">Duration</p>
                  <p className="text-sm text-gray-900">{selectedAppointmentPopup.duration_min} minutes</p>
                </div>
              )}

              <div>
                <p className="text-xs font-semibold text-gray-600 uppercase">Status</p>
                <span className={`inline-block px-2 py-1 rounded text-xs font-medium mt-1 ${STATUS_COLORS[selectedAppointmentPopup.status].badge}`}>
                  {selectedAppointmentPopup.status.replace('_', ' ')}
                </span>
              </div>

              {selectedAppointmentPopup.notes && (
                <div>
                  <p className="text-xs font-semibold text-gray-600 uppercase">Notes</p>
                  <p className="text-sm text-gray-700">{selectedAppointmentPopup.notes}</p>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-4">
              <button
                onClick={() => {
                  openEditModal(selectedAppointmentPopup);
                  setSelectedAppointmentPopup(null);
                }}
                className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors flex items-center justify-center gap-2 font-medium text-sm"
              >
                <Edit2 className="w-4 h-4" />
                Edit
              </button>
              {isAdmin && (
                <button
                  onClick={() => {
                    handleDeleteAppointment(selectedAppointmentPopup.id);
                    setSelectedAppointmentPopup(null);
                  }}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-2 font-medium text-sm"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-900">
                  {editingId ? 'Edit Appointment' : 'Create Appointment'}
                </h2>
                <button
                  onClick={closeModal}
                  className="text-gray-600 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Client Name *
                  </label>
                  <input
                    type="text"
                    value={formData.client_name}
                    onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                    className="w-full px-3 py-2 border border-white/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    placeholder="Enter client name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={formData.client_phone}
                    onChange={(e) => setFormData({ ...formData, client_phone: e.target.value })}
                    className="w-full px-3 py-2 border border-white/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    placeholder="Enter phone number"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Service Name *
                  </label>
                  <input
                    type="text"
                    value={formData.service_name}
                    onChange={(e) => setFormData({ ...formData, service_name: e.target.value })}
                    className="w-full px-3 py-2 border border-white/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    placeholder="Enter service name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Staff Name
                  </label>
                  <input
                    type="text"
                    value={formData.staff_name}
                    onChange={(e) => setFormData({ ...formData, staff_name: e.target.value })}
                    className="w-full px-3 py-2 border border-white/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    placeholder="Enter staff name"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Date *
                    </label>
                    <input
                      type="date"
                      value={formData.scheduled_date}
                      onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
                      className="w-full px-3 py-2 border border-white/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Time *
                    </label>
                    <input
                      type="time"
                      value={formData.scheduled_time}
                      onChange={(e) => setFormData({ ...formData, scheduled_time: e.target.value })}
                      className="w-full px-3 py-2 border border-white/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Duration (minutes)
                  </label>
                  <select
                    value={formData.duration_min}
                    onChange={(e) => setFormData({ ...formData, duration_min: e.target.value })}
                    className="w-full px-3 py-2 border border-white/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    {DURATIONS.map((dur) => (
                      <option key={dur} value={dur}>
                        {dur} minutes
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as StatusType })}
                    className="w-full px-3 py-2 border border-white/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    {Object.keys(STATUS_COLORS).map((status) => (
                      <option key={status} value={status}>
                        {status.replace('_', ' ').charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full px-3 py-2 border border-white/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                    rows={3}
                    placeholder="Enter any additional notes"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={closeModal}
                  className="flex-1 px-4 py-2 border border-white/40 text-gray-700 rounded-lg hover:bg-white/40 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveAppointment}
                  className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors flex items-center justify-center gap-2 font-medium"
                >
                  <Check className="w-4 h-4" />
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
