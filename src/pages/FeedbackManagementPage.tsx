import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft, MessageSquare, Star, RefreshCw, Loader2, Plus, Check, X, AlertTriangle,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface FeedbackRow {
  id: string; client_id: string; rating: number; comment?: string; date: string;
  created_at: string;
  clients?: { name: string; phone: string };
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <Star key={n} className={`w-3.5 h-3.5 ${n <= rating ? 'text-amber-400 fill-amber-400' : 'text-gray-200'}`} />
      ))}
    </div>
  );
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

type Tab = 'all' | 'online' | 'manual';

export function FeedbackManagementPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('all');
  const [feedback, setFeedback] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [ratingFilter, setRatingFilter] = useState<number | 'all'>('all');

  // Manual entry
  const [showForm, setShowForm] = useState(false);
  const [clients, setClients] = useState<{ id: string; name: string; phone: string }[]>([]);
  const [form, setForm] = useState({ client_id: '', rating: '5', comment: '' });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchFeedback = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('feedback').select('*, clients(name,phone)')
      .order('date', { ascending: false });
    setFeedback(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchFeedback(); }, [fetchFeedback]);

  async function openManualForm() {
    const { data } = await supabase.from('clients').select('id,name,phone').order('name').limit(200);
    setClients(data || []);
    setForm({ client_id: '', rating: '5', comment: '' });
    setFormError(''); setShowForm(true);
  }

  async function saveFeedback() {
    if (!form.client_id) { setFormError('Select a client'); return; }
    setSaving(true); setFormError('');
    try {
      const { error } = await supabase.from('feedback').insert({
        client_id: form.client_id, rating: parseInt(form.rating),
        comment: form.comment.trim() || null, date: new Date().toISOString(),
      });
      if (error) throw error;
      setShowForm(false); fetchFeedback();
    } catch (err) { setFormError(err instanceof Error ? err.message : 'Failed'); }
    finally { setSaving(false); }
  }

  async function deleteFeedback(id: string) {
    if (!confirm('Delete this feedback?')) return;
    await supabase.from('feedback').delete().eq('id', id);
    fetchFeedback();
  }

  const filtered = feedback.filter(f => ratingFilter === 'all' || f.rating === ratingFilter);
  const avg = feedback.length > 0 ? (feedback.reduce((s, f) => s + f.rating, 0) / feedback.length).toFixed(1) : '—';
  const dist = [5, 4, 3, 2, 1].map(r => ({ r, count: feedback.filter(f => f.rating === r).length }));

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/dashboard')} className="p-2 hover:bg-gray-100 rounded-lg transition">
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            <MessageSquare className="w-5 h-5 text-teal-600" />
            <h1 className="text-xl font-bold text-gray-900">Feedback Management</h1>
          </div>
          <button onClick={openManualForm}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-xl transition shadow-sm">
            <Plus className="w-4 h-4" /> Add Feedback
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center">
              <Star className="w-8 h-8 text-amber-400 fill-amber-400" />
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Average Rating</p>
              <p className="text-4xl font-extrabold text-gray-900 mt-1">{avg}</p>
              <p className="text-xs text-gray-400">{feedback.length} total reviews</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-3">Rating Distribution</p>
            <div className="space-y-1.5">
              {dist.map(({ r, count }) => {
                const pct = feedback.length ? Math.round((count / feedback.length) * 100) : 0;
                return (
                  <div key={r} className="flex items-center gap-2 text-xs">
                    <span className="w-3 text-gray-500">{r}</span>
                    <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                    <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                      <div className="bg-amber-400 h-full rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-6 text-right text-gray-500">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Manual form */}
        {showForm && (
          <div className="bg-white rounded-2xl border-2 border-teal-200 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900">Add Feedback</h3>
              <button onClick={() => setShowForm(false)} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Client *</label>
                <select value={form.client_id} onChange={e => setForm(p => ({ ...p, client_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none">
                  <option value="">— select client —</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name} — {c.phone}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Rating *</label>
                <select value={form.rating} onChange={e => setForm(p => ({ ...p, rating: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none">
                  {[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{n} Star{n !== 1 ? 's' : ''}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Comment</label>
                <textarea rows={3} value={form.comment} onChange={e => setForm(p => ({ ...p, comment: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none resize-none" />
              </div>
            </div>
            {formError && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-center gap-2"><AlertTriangle className="w-3.5 h-3.5 shrink-0" />{formError}</p>}
            <div className="flex gap-2">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 border border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 text-sm">Cancel</button>
              <button onClick={saveFeedback} disabled={saving} className="flex-1 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 disabled:bg-gray-400">
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : <><Check className="w-4 h-4" /> Submit</>}
              </button>
            </div>
          </div>
        )}

        {/* Filter */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex gap-1 p-1 bg-gray-100 rounded-xl flex-wrap">
            <button onClick={() => setRatingFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition ${ratingFilter === 'all' ? 'bg-white text-teal-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>All</button>
            {[5, 4, 3, 2, 1].map(r => (
              <button key={r} onClick={() => setRatingFilter(r)}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition flex items-center gap-1 ${ratingFilter === r ? 'bg-white text-amber-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                {r}<Star className="w-3 h-3 fill-current" />
              </button>
            ))}
          </div>
          <button onClick={fetchFeedback} className="p-2 hover:bg-white rounded-lg transition"><RefreshCw className="w-4 h-4 text-gray-500" /></button>
        </div>

        {/* List */}
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-teal-600" /></div>
        ) : (
          <div className="space-y-3">
            {filtered.map(f => (
              <div key={f.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-semibold text-gray-900">{f.clients?.name}</span>
                    <span className="text-xs text-gray-400">{f.clients?.phone}</span>
                    <StarRating rating={f.rating} />
                  </div>
                  {f.comment && <p className="text-sm text-gray-700 leading-relaxed">{f.comment}</p>}
                  <p className="text-xs text-gray-400 mt-1">{fmtDate(f.date)}</p>
                </div>
                <button onClick={() => deleteFeedback(f.id)} className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition shrink-0 self-start">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            {filtered.length === 0 && <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-400 text-sm">No feedback found.</div>}
          </div>
        )}
      </main>
    </div>
  );
}
