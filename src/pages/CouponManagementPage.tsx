import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft, Tag, Plus, Pencil, Trash2, X, Check, Loader2, AlertTriangle, RefreshCw,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Coupon } from '../lib/types';

function fmtDate(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
function isExpired(d?: string | null) {
  if (!d) return false;
  return new Date(d) < new Date();
}

const blankForm = () => ({
  code: '', description: '',
  discount_type: 'percentage' as 'percentage' | 'fixed',
  discount_value: '', min_amount: '',
  max_uses: '', valid_from: '', valid_until: '', is_active: true,
});

export function CouponManagementPage() {
  const navigate = useNavigate();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(blankForm());
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const fetchCoupons = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('coupons').select('*').order('created_at', { ascending: false });
    setCoupons(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchCoupons(); }, [fetchCoupons]);

  function openNew() {
    setEditId(null); setForm(blankForm()); setFormError(''); setShowForm(true);
  }
  function openEdit(c: Coupon) {
    setEditId(c.id);
    setForm({
      code: c.code, description: c.description || '',
      discount_type: c.discount_type, discount_value: String(c.discount_value),
      min_amount: c.min_amount != null ? String(c.min_amount) : '',
      max_uses: c.max_uses != null ? String(c.max_uses) : '',
      valid_from: c.valid_from ? c.valid_from.split('T')[0] : '',
      valid_until: c.valid_until ? c.valid_until.split('T')[0] : '',
      is_active: c.is_active,
    });
    setFormError(''); setShowForm(true);
  }

  async function saveCoupon() {
    const code = form.code.trim().toUpperCase();
    if (!code) { setFormError('Coupon code is required'); return; }
    if (!form.discount_value || parseFloat(form.discount_value) <= 0) { setFormError('Enter a valid discount value'); return; }
    if (form.discount_type === 'percentage' && parseFloat(form.discount_value) > 100) { setFormError('Percentage cannot exceed 100'); return; }
    setSaving(true); setFormError('');
    try {
      const payload: Partial<Coupon> = {
        code, description: form.description || undefined,
        discount_type: form.discount_type,
        discount_value: parseFloat(form.discount_value),
        min_amount: form.min_amount ? parseFloat(form.min_amount) : undefined,
        max_uses: form.max_uses ? parseInt(form.max_uses) : undefined,
        valid_from: form.valid_from ? new Date(form.valid_from).toISOString() : undefined,
        valid_until: form.valid_until ? new Date(form.valid_until).toISOString() : undefined,
        is_active: form.is_active,
      };
      if (editId) {
        const { error } = await supabase.from('coupons').update(payload).eq('id', editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('coupons').insert({ ...payload, uses_count: 0 });
        if (error) throw error;
      }
      setShowForm(false); fetchCoupons();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save');
    } finally { setSaving(false); }
  }

  async function deleteCoupon(id: string) {
    if (!confirm('Delete this coupon?')) return;
    await supabase.from('coupons').delete().eq('id', id);
    fetchCoupons();
  }

  async function toggleActive(c: Coupon) {
    await supabase.from('coupons').update({ is_active: !c.is_active }).eq('id', c.id);
    fetchCoupons();
  }

  const filtered = coupons.filter(c => {
    if (filter === 'active') return c.is_active && !isExpired(c.valid_until);
    if (filter === 'inactive') return !c.is_active || isExpired(c.valid_until);
    return true;
  });

  const inputCls = 'w-full px-3 py-2 border border-white/40 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none';

  return (
    <div className="min-h-screen">
      <header className="glass-strong border-b border-white/30 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/dashboard')} className="p-2 hover:bg-white/40 rounded-lg transition">
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            <Tag className="w-5 h-5 text-teal-600" />
            <h1 className="text-xl font-bold text-gray-900">Coupon Management</h1>
          </div>
          <button onClick={openNew}
            className="flex items-center gap-2 px-4 py-2 btn-lux text-white text-sm font-semibold rounded-xl transition">
            <Plus className="w-4 h-4" /> New Coupon
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {showForm && (
          <div className="bg-white rounded-2xl border-2 border-teal-200 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900">{editId ? 'Edit Coupon' : 'New Coupon'}</h3>
              <button onClick={() => setShowForm(false)} className="p-1.5 hover:bg-white/40 rounded-lg"><X className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Coupon Code *</label>
                <input type="text" value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                  placeholder="e.g. SAVE20" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Discount Type *</label>
                <select value={form.discount_type} onChange={e => setForm(p => ({ ...p, discount_type: e.target.value as 'percentage' | 'fixed' }))} className={inputCls}>
                  <option value="percentage">Percentage (%)</option>
                  <option value="fixed">Fixed Amount (₹)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  Discount Value * {form.discount_type === 'percentage' ? '(%)' : '(₹)'}
                </label>
                <input type="number" min="0" value={form.discount_value} onChange={e => setForm(p => ({ ...p, discount_value: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Min Bill Amount (₹)</label>
                <input type="number" min="0" value={form.min_amount} onChange={e => setForm(p => ({ ...p, min_amount: e.target.value }))} placeholder="0 = no minimum" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Max Uses</label>
                <input type="number" min="1" value={form.max_uses} onChange={e => setForm(p => ({ ...p, max_uses: e.target.value }))} placeholder="Leave blank = unlimited" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Valid From</label>
                <input type="date" value={form.valid_from} onChange={e => setForm(p => ({ ...p, valid_from: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Valid Until</label>
                <input type="date" value={form.valid_until} onChange={e => setForm(p => ({ ...p, valid_until: e.target.value }))} className={inputCls} />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Description</label>
                <input type="text" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Optional description" className={inputCls} />
              </div>
              <div className="flex items-center gap-2 pt-4">
                <input type="checkbox" id="coup-active" checked={form.is_active} onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} className="w-4 h-4 accent-teal-600" />
                <label htmlFor="coup-active" className="text-sm font-medium text-gray-700">Active</label>
              </div>
            </div>
            {formError && <p className="text-sm text-red-700 bg-red-500/15 border border-red-300/40 rounded-xl backdrop-blur-sm px-3 py-2 flex items-center gap-2"><AlertTriangle className="w-3.5 h-3.5 shrink-0" />{formError}</p>}
            <div className="flex gap-2">
              <button onClick={() => setShowForm(false)} disabled={saving} className="flex-1 py-2.5 btn-lux-ghost font-semibold rounded-xl transition text-sm">Cancel</button>
              <button onClick={saveCoupon} disabled={saving} className="flex-1 py-2.5 btn-lux text-white font-bold rounded-xl transition text-sm flex items-center justify-center gap-2 disabled:bg-gray-400">
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : <><Check className="w-4 h-4" /> {editId ? 'Update' : 'Create Coupon'}</>}
              </button>
            </div>
          </div>
        )}

        {/* Filter + refresh */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex gap-1 p-1 bg-white/40 rounded-xl">
            {(['all', 'active', 'inactive'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition capitalize ${filter === f ? 'bg-white/80 text-teal-700' : 'text-gray-500 hover:text-gray-700'}`}>
                {f}
              </button>
            ))}
          </div>
          <button onClick={fetchCoupons} className="p-2 hover:bg-white rounded-lg transition"><RefreshCw className="w-4 h-4 text-gray-500" /></button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-teal-600" /></div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-white/20 p-12 text-center">
            <Tag className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No coupons found.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(c => {
              const expired = isExpired(c.valid_until);
              const exhausted = c.max_uses != null && c.uses_count >= c.max_uses;
              const status = !c.is_active ? 'Disabled' : expired ? 'Expired' : exhausted ? 'Exhausted' : 'Active';
              const statusColor = status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700';
              return (
                <div key={c.id} className="bg-white rounded-2xl border border-white/20 p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-mono font-bold text-lg text-teal-700 bg-teal-500/15 px-3 py-0.5 rounded-lg">{c.code}</span>
                      {c.description && <p className="text-xs text-gray-500 mt-1.5">{c.description}</p>}
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold shrink-0 ${statusColor}`}>{status}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-xs text-gray-400">Discount</p>
                      <p className="font-bold text-gray-900">
                        {c.discount_type === 'percentage' ? `${c.discount_value}%` : `₹${c.discount_value}`}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Used</p>
                      <p className="font-semibold text-gray-700">{c.uses_count}{c.max_uses ? ` / ${c.max_uses}` : ''}</p>
                    </div>
                    {c.min_amount ? <div><p className="text-xs text-gray-400">Min Bill</p><p className="font-semibold text-gray-700">₹{c.min_amount}</p></div> : null}
                    <div>
                      <p className="text-xs text-gray-400">Expires</p>
                      <p className="font-semibold text-gray-700">{fmtDate(c.valid_until)}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2 border-t border-white/20">
                    <button onClick={() => toggleActive(c)}
                      className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition ${c.is_active ? 'text-red-600 border-red-200 hover:bg-red-50' : 'text-green-600 border-green-200 hover:bg-green-50'}`}>
                      {c.is_active ? 'Disable' : 'Enable'}
                    </button>
                    <button onClick={() => openEdit(c)} className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-semibold text-gray-600 hover:text-teal-700 hover:bg-teal-500/15 rounded-lg border border-white/40 hover:border-teal-300/60 transition">
                      <Pencil className="w-3 h-3" /> Edit
                    </button>
                    <button onClick={() => deleteCoupon(c.id)} className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-semibold text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg border border-white/30 hover:border-red-300 transition">
                      <Trash2 className="w-3 h-3" /> Delete
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
