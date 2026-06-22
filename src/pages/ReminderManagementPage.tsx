import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft, Bell, Plus, Check, X, Loader2, AlertTriangle, RefreshCw,
  Cake, CalendarDays, Award, CreditCard, MessageSquare,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Reminder {
  id: string; type: string; client_name: string; client_phone: string;
  title: string; message?: string; due_date: string; is_done: boolean;
  done_at?: string; created_at: string;
}

const TYPE_META: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  birthday:    { icon: <Cake className="w-4 h-4" />,        color: 'bg-pink-100 text-pink-700',    label: 'Birthday' },
  appointment: { icon: <CalendarDays className="w-4 h-4" />, color: 'bg-violet-100 text-violet-700', label: 'Appointment' },
  membership:  { icon: <Award className="w-4 h-4" />,       color: 'bg-teal-100 text-teal-700',    label: 'Membership' },
  payment:     { icon: <CreditCard className="w-4 h-4" />,  color: 'bg-red-100 text-red-700',      label: 'Payment' },
  custom:      { icon: <MessageSquare className="w-4 h-4" />, color: 'bg-gray-100 text-gray-700',  label: 'Custom' },
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
function isOverdue(d: string) { return new Date(d) < new Date(); }
function isToday(d: string) {
  const t = new Date(); const dd = new Date(d);
  return dd.getFullYear() === t.getFullYear() && dd.getMonth() === t.getMonth() && dd.getDate() === t.getDate();
}

type Tab = 'upcoming' | 'done';

export function ReminderManagementPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('upcoming');
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ type: 'custom', client_name: '', client_phone: '', title: '', message: '', due_date: new Date().toISOString().split('T')[0] });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  // Birthday auto-detect
  const [birthdayCount, setBirthdayCount] = useState(0);
  const [generating, setGenerating] = useState(false);

  const fetchReminders = useCallback(async () => {
    setLoading(true);
    const q = supabase.from('reminders').select('*').order('due_date');
    const { data } = await q;
    setReminders(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchReminders(); detectBirthdays(); }, [fetchReminders]);

  async function detectBirthdays() {
    // Count clients with birthday today or in next 7 days not yet reminded
    const today = new Date();
    const month = today.getMonth() + 1;
    const day = today.getDate();
    const { data: clients } = await supabase.from('clients').select('id,name,phone,dob').not('dob', 'is', null);
    const upcoming = (clients || []).filter(c => {
      if (!c.dob) return false;
      const [, m, d] = c.dob.split('-').map(Number);
      // Check if birthday falls within next 7 days (month-day comparison)
      for (let i = 0; i <= 7; i++) {
        const check = new Date(today); check.setDate(today.getDate() + i);
        if (check.getMonth() + 1 === m && check.getDate() === d) return true;
      }
      return false;
    });
    setBirthdayCount(upcoming.length);
    return upcoming;
  }

  async function generateBirthdayReminders() {
    setGenerating(true);
    const today = new Date();
    const { data: clients } = await supabase.from('clients').select('id,name,phone,dob').not('dob', 'is', null);
    const upcoming = (clients || []).filter(c => {
      if (!c.dob) return false;
      const [, m, d] = c.dob.split('-').map(Number);
      for (let i = 0; i <= 7; i++) {
        const check = new Date(today); check.setDate(today.getDate() + i);
        if (check.getMonth() + 1 === m && check.getDate() === d) return true;
      }
      return false;
    });
    // Insert only non-existing ones
    const { data: existing } = await supabase.from('reminders')
      .select('client_phone').eq('type', 'birthday')
      .gte('due_date', today.toISOString().split('T')[0]);
    const existingPhones = new Set((existing || []).map((r: any) => r.client_phone));
    const toInsert = upcoming.filter(c => !existingPhones.has(c.phone)).map(c => {
      const [, m, d] = c.dob!.split('-').map(Number);
      const year = new Date().getFullYear();
      const bday = new Date(year, m - 1, d);
      return {
        type: 'birthday', client_id: c.id, client_name: c.name, client_phone: c.phone,
        title: `Birthday — ${c.name}`,
        message: `Wish ${c.name} a happy birthday and offer a special birthday discount!`,
        due_date: bday.toISOString().split('T')[0],
      };
    });
    if (toInsert.length > 0) await supabase.from('reminders').insert(toInsert);
    setGenerating(false);
    fetchReminders();
  }

  async function saveReminder() {
    if (!form.client_name.trim() || !form.title.trim() || !form.due_date) {
      setFormError('Client name, title, and due date are required'); return;
    }
    setSaving(true); setFormError('');
    try {
      const { error } = await supabase.from('reminders').insert({
        type: form.type, client_name: form.client_name.trim(),
        client_phone: form.client_phone.trim(), title: form.title.trim(),
        message: form.message.trim() || null, due_date: form.due_date,
      });
      if (error) throw error;
      setShowForm(false);
      setForm({ type: 'custom', client_name: '', client_phone: '', title: '', message: '', due_date: new Date().toISOString().split('T')[0] });
      fetchReminders();
    } catch (err) { setFormError(err instanceof Error ? err.message : 'Failed'); }
    finally { setSaving(false); }
  }

  async function markDone(id: string) {
    await supabase.from('reminders').update({ is_done: true, done_at: new Date().toISOString() }).eq('id', id);
    fetchReminders();
  }
  async function markUndone(id: string) {
    await supabase.from('reminders').update({ is_done: false, done_at: null }).eq('id', id);
    fetchReminders();
  }
  async function deleteReminder(id: string) {
    if (!confirm('Delete this reminder?')) return;
    await supabase.from('reminders').delete().eq('id', id);
    fetchReminders();
  }

  const upcoming = reminders.filter(r => !r.is_done);
  const done = reminders.filter(r => r.is_done);
  const todayCount = upcoming.filter(r => isToday(r.due_date)).length;
  const overdueCount = upcoming.filter(r => isOverdue(r.due_date) && !isToday(r.due_date)).length;

  const displayed = tab === 'upcoming' ? upcoming : done;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/dashboard')} className="p-2 hover:bg-gray-100 rounded-lg transition">
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            <Bell className="w-5 h-5 text-amber-500" />
            <h1 className="text-xl font-bold text-gray-900">Reminder Management</h1>
          </div>
          <button onClick={() => { setShowForm(true); setFormError(''); }}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-xl transition shadow-sm">
            <Plus className="w-4 h-4" /> New Reminder
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Today', value: todayCount, color: 'text-teal-600', bg: 'bg-teal-50 border-teal-200' },
            { label: 'Overdue', value: overdueCount, color: 'text-red-600', bg: 'bg-red-50 border-red-200' },
            { label: 'Pending', value: upcoming.length, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
            { label: 'Completed', value: done.length, color: 'text-green-600', bg: 'bg-green-50 border-green-200' },
          ].map(s => (
            <div key={s.label} className={`rounded-xl border p-4 ${s.bg}`}>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{s.label}</p>
              <p className={`text-3xl font-bold mt-1 ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Birthday auto-detect */}
        {birthdayCount > 0 && (
          <div className="bg-pink-50 border border-pink-200 rounded-xl p-4 flex items-center gap-3">
            <Cake className="w-5 h-5 text-pink-600 shrink-0" />
            <div className="flex-1">
              <p className="font-semibold text-pink-800 text-sm">{birthdayCount} client birthday(s) in the next 7 days</p>
              <p className="text-xs text-pink-600 mt-0.5">Auto-generate birthday reminders</p>
            </div>
            <button onClick={generateBirthdayReminders} disabled={generating}
              className="px-3 py-1.5 bg-pink-600 hover:bg-pink-700 text-white text-xs font-semibold rounded-lg transition flex items-center gap-1.5 disabled:opacity-60">
              {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Cake className="w-3.5 h-3.5" />}
              Generate
            </button>
          </div>
        )}

        {/* New reminder form */}
        {showForm && (
          <div className="bg-white rounded-2xl border-2 border-amber-200 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900">New Reminder</h3>
              <button onClick={() => setShowForm(false)} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Type</label>
                <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none">
                  {Object.entries(TYPE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Due Date *</label>
                <input type="date" value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Client Name *</label>
                <input type="text" value={form.client_name} onChange={e => setForm(p => ({ ...p, client_name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Client Phone</label>
                <input type="text" value={form.client_phone} onChange={e => setForm(p => ({ ...p, client_phone: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Title *</label>
                <input type="text" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Message</label>
                <textarea rows={2} value={form.message} onChange={e => setForm(p => ({ ...p, message: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none resize-none" />
              </div>
            </div>
            {formError && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-center gap-2"><AlertTriangle className="w-3.5 h-3.5 shrink-0" />{formError}</p>}
            <div className="flex gap-2">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 border border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition text-sm">Cancel</button>
              <button onClick={saveReminder} disabled={saving} className="flex-1 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl transition text-sm flex items-center justify-center gap-2 disabled:bg-gray-400">
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : <><Check className="w-4 h-4" /> Save</>}
              </button>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center justify-between">
          <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
            {(['upcoming', 'done'] as Tab[]).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition capitalize ${tab === t ? 'bg-white text-teal-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                {t === 'upcoming' ? `Pending (${upcoming.length})` : `Completed (${done.length})`}
              </button>
            ))}
          </div>
          <button onClick={fetchReminders} className="p-2 hover:bg-white rounded-lg transition"><RefreshCw className="w-4 h-4 text-gray-500" /></button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-teal-600" /></div>
        ) : displayed.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-400 text-sm">
            {tab === 'upcoming' ? 'No pending reminders.' : 'No completed reminders yet.'}
          </div>
        ) : (
          <div className="space-y-3">
            {displayed.map(r => {
              const meta = TYPE_META[r.type] || TYPE_META.custom;
              const overdue = !r.is_done && isOverdue(r.due_date) && !isToday(r.due_date);
              const today = isToday(r.due_date);
              return (
                <div key={r.id} className={`bg-white rounded-xl border shadow-sm p-4 flex items-start gap-3 ${overdue ? 'border-red-200' : today ? 'border-amber-200' : 'border-gray-100'}`}>
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${meta.color}`}>
                    {meta.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900 text-sm">{r.title}</p>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${meta.color}`}>{meta.label}</span>
                      {overdue && <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">Overdue</span>}
                      {today && <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">Today</span>}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{r.client_name}{r.client_phone ? ` · ${r.client_phone}` : ''}</p>
                    {r.message && <p className="text-xs text-gray-600 mt-1">{r.message}</p>}
                    <p className="text-xs text-gray-400 mt-1">Due: {fmtDate(r.due_date)}</p>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    {!r.is_done ? (
                      <button onClick={() => markDone(r.id)} title="Mark done"
                        className="p-1.5 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg transition">
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <button onClick={() => markUndone(r.id)} title="Mark pending"
                        className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition">
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button onClick={() => deleteReminder(r.id)} className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
