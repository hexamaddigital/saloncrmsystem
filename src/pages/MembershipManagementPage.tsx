import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft, Plus, Pencil, Trash2, X, Check, Loader2, AlertTriangle,
  Award, Search, UserPlus, CalendarDays, RefreshCw, History, Gift,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Membership, ClientMembership, Client } from '../lib/types';

type Tab = 'plans' | 'clients';

interface ClientMemRow extends ClientMembership {
  client_name?: string;
  client_phone?: string;
  benefits?: string | null;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
function daysLeft(exp: string) {
  const diff = new Date(exp).getTime() - Date.now();
  return Math.ceil(diff / 86400000);
}

const blankPlan = (): Partial<Membership> => ({
  name: '', description: '', price: 0, validity_days: 30,
  discount_pct: 0, benefits: '', is_active: true,
});

export function MembershipManagementPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('plans');

  // Plans
  const [plans, setPlans] = useState<Membership[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Membership>>(blankPlan());
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  // Assign membership
  const [showAssign, setShowAssign] = useState(false);
  const [assignPlanId, setAssignPlanId] = useState('');
  const [assignClient, setAssignClient] = useState<Client | null>(null);
  const [assignSearch, setAssignSearch] = useState('');
  const [assignResults, setAssignResults] = useState<Client[]>([]);
  const [assignNotes, setAssignNotes] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState('');

  // Client memberships
  const [clientMems, setClientMems] = useState<ClientMemRow[]>([]);
  const [memsLoading, setMemsLoading] = useState(false);
  const [memSearch, setMemSearch] = useState('');

  // History modal
  const [historyClient, setHistoryClient] = useState<ClientMemRow | null>(null);
  const [historyRows, setHistoryRows] = useState<ClientMemRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Renew modal
  const [renewTarget, setRenewTarget] = useState<ClientMemRow | null>(null);
  const [renewing, setRenewing] = useState(false);

  const fetchPlans = useCallback(async () => {
    setPlansLoading(true);
    const { data } = await supabase.from('memberships').select('*').order('created_at');
    setPlans(data || []);
    setPlansLoading(false);
  }, []);

  const fetchClientMems = useCallback(async () => {
    setMemsLoading(true);
    const { data } = await supabase
      .from('client_memberships')
      .select('*, clients(name, phone), memberships!inner(benefits)')
      .order('created_at', { ascending: false });
    setClientMems((data || []).map((r: any) => ({
      ...r,
      client_name: r.clients?.name,
      client_phone: r.clients?.phone,
      benefits: r.memberships?.benefits ?? null,
    })));
    setMemsLoading(false);
  }, []);

  useEffect(() => { fetchPlans(); }, [fetchPlans]);
  useEffect(() => { if (tab === 'clients') fetchClientMems(); }, [tab, fetchClientMems]);

  function openNew() {
    setEditId(null); setForm(blankPlan()); setFormError(''); setShowForm(true);
  }
  function openEdit(p: Membership) {
    setEditId(p.id); setForm({ ...p }); setFormError(''); setShowForm(true);
  }

  async function savePlan() {
    if (!form.name?.trim()) { setFormError('Plan name is required'); return; }
    if (!form.price || form.price < 0) { setFormError('Enter a valid price'); return; }
    if (!form.validity_days || form.validity_days < 1) { setFormError('Enter validity (days)'); return; }
    setSaving(true); setFormError('');
    try {
      const payload = {
        name: form.name!.trim(), description: form.description || null,
        price: Number(form.price), validity_days: Number(form.validity_days),
        discount_pct: Number(form.discount_pct || 0),
        benefits: form.benefits || null, is_active: form.is_active ?? true,
      };
      if (editId) {
        const { error } = await supabase.from('memberships').update(payload).eq('id', editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('memberships').insert(payload);
        if (error) throw error;
      }
      setShowForm(false); fetchPlans();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save');
    } finally { setSaving(false); }
  }

  async function deletePlan(id: string) {
    if (!confirm('Delete this membership plan? Existing client memberships will remain.')) return;
    await supabase.from('memberships').delete().eq('id', id);
    fetchPlans();
  }

  async function searchAssignClient() {
    const q = assignSearch.trim();
    if (!q) return;
    const { data } = await supabase.from('clients').select('*')
      .or(`phone.eq.${q},name.ilike.%${q}%`).limit(10);
    setAssignResults(data || []);
  }

  async function assignMembership() {
    if (!assignPlanId || !assignClient) { setAssignError('Select a plan and client'); return; }
    const plan = plans.find(p => p.id === assignPlanId);
    if (!plan) return;
    setAssigning(true); setAssignError('');
    try {
      const started_at = new Date().toISOString();
      const expires_at = new Date(Date.now() + plan.validity_days * 86400000).toISOString();
      const { error } = await supabase.from('client_memberships').insert({
        client_id: assignClient.id, membership_id: plan.id,
        membership_name: plan.name, started_at, expires_at,
        amount_paid: plan.price, status: 'active', notes: assignNotes || null,
      });
      if (error) throw error;
      setShowAssign(false); setAssignClient(null); setAssignSearch(''); setAssignResults([]); setAssignNotes('');
      fetchClientMems();
    } catch (err) {
      setAssignError(err instanceof Error ? err.message : 'Failed to assign');
    } finally { setAssigning(false); }
  }

  async function confirmRenew() {
    if (!renewTarget) return;
    const plan = plans.find(p => p.id === renewTarget.membership_id);
    if (!plan) { alert('Plan not found — the plan may have been deleted.'); setRenewTarget(null); return; }
    setRenewing(true);
    try {
      const base = renewTarget.status === 'active' && new Date(renewTarget.expires_at) > new Date()
        ? new Date(renewTarget.expires_at) : new Date();
      const expires_at = new Date(base.getTime() + plan.validity_days * 86400000).toISOString();
      const { error } = await supabase.from('client_memberships').insert({
        client_id: renewTarget.client_id, membership_id: plan.id,
        membership_name: plan.name, started_at: new Date().toISOString(),
        expires_at, amount_paid: plan.price, status: 'active',
        notes: 'Renewed',
      });
      if (error) throw error;
      setRenewTarget(null);
      fetchClientMems();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to renew');
    } finally { setRenewing(false); }
  }

  async function openHistory(cm: ClientMemRow) {
    setHistoryClient(cm);
    setHistoryLoading(true);
    const { data } = await supabase
      .from('client_memberships')
      .select('*, memberships!inner(benefits)')
      .eq('client_id', cm.client_id)
      .order('created_at', { ascending: false });
    setHistoryRows((data || []).map((r: any) => ({ ...r, benefits: r.memberships?.benefits ?? null })));
    setHistoryLoading(false);
  }

  const filteredMems = clientMems.filter(m =>
    !memSearch || m.client_name?.toLowerCase().includes(memSearch.toLowerCase()) ||
    m.client_phone?.includes(memSearch));

  const inputCls = 'w-full px-3 py-2 border border-white/40 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none';

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/dashboard')} className="p-2 hover:bg-white/40 rounded-lg transition">
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            <Award className="w-5 h-5 text-teal-600" />
            <h1 className="text-xl font-bold text-gray-900">Membership Management</h1>
          </div>
          <div className="flex gap-2">
            {tab === 'plans' && (
              <button onClick={openNew}
                className="flex items-center gap-2 px-4 py-2 btn-lux text-white text-sm font-semibold rounded-xl transition">
                <Plus className="w-4 h-4" /> New Plan
              </button>
            )}
            {tab === 'clients' && (
              <button onClick={() => { setShowAssign(true); setAssignPlanId(''); setAssignClient(null); setAssignSearch(''); setAssignResults([]); setAssignError(''); }}
                className="flex items-center gap-2 px-4 py-2 btn-lux text-white text-sm font-semibold rounded-xl transition">
                <UserPlus className="w-4 h-4" /> Assign Membership
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-white/40 rounded-xl w-fit">
          {(['plans', 'clients'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition capitalize ${tab === t ? 'bg-white/80 text-teal-700' : 'text-gray-500 hover:text-gray-700'}`}>
              {t === 'plans' ? 'Membership Plans' : 'Client Memberships'}
            </button>
          ))}
        </div>

        {/* ─── Plans tab ─── */}
        {tab === 'plans' && (
          <>
            {/* Create / Edit form */}
            {showForm && (
              <div className="bg-white rounded-2xl border-2 border-teal-200 p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-gray-900">{editId ? 'Edit Plan' : 'New Membership Plan'}</h3>
                  <button onClick={() => setShowForm(false)} className="p-1.5 hover:bg-white/40 rounded-lg transition"><X className="w-4 h-4" /></button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Plan Name *</label>
                    <input type="text" value={form.name || ''} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                      className={inputCls} placeholder="e.g. Gold Membership" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Price (₹) *</label>
                    <input type="number" min="0" value={form.price || ''} onChange={e => setForm(p => ({ ...p, price: Number(e.target.value) }))}
                      className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Validity (days) *</label>
                    <input type="number" min="1" value={form.validity_days || ''} onChange={e => setForm(p => ({ ...p, validity_days: Number(e.target.value) }))}
                      className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Discount %</label>
                    <input type="number" min="0" max="100" value={form.discount_pct || ''} onChange={e => setForm(p => ({ ...p, discount_pct: Number(e.target.value) }))}
                      className={inputCls} />
                  </div>
                  <div className="flex items-center gap-2 pt-5">
                    <input type="checkbox" id="plan-active" checked={form.is_active ?? true} onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} className="w-4 h-4 accent-teal-600" />
                    <label htmlFor="plan-active" className="text-sm font-medium text-gray-700">Active</label>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Description</label>
                    <input type="text" value={form.description || ''} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                      className={inputCls} placeholder="Short description" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Benefits / Included Services</label>
                    <textarea rows={2} value={form.benefits || ''} onChange={e => setForm(p => ({ ...p, benefits: e.target.value }))}
                      className={`${inputCls} resize-none`} placeholder="e.g. 2 Free Facials, 10% off all services..." />
                  </div>
                </div>
                {formError && (
                  <p className="text-sm text-red-700 bg-red-500/15 border border-red-300/40 rounded-xl backdrop-blur-sm px-3 py-2 flex items-center gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />{formError}
                  </p>
                )}
                <div className="flex gap-2">
                  <button onClick={() => setShowForm(false)} disabled={saving} className="flex-1 py-2.5 btn-lux-ghost font-semibold rounded-xl transition text-sm disabled:opacity-50">Cancel</button>
                  <button onClick={savePlan} disabled={saving} className="flex-1 py-2.5 btn-lux text-white font-bold rounded-xl transition text-sm disabled:bg-gray-400 flex items-center justify-center gap-2">
                    {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : <><Check className="w-4 h-4" /> {editId ? 'Update Plan' : 'Create Plan'}</>}
                  </button>
                </div>
              </div>
            )}

            {plansLoading ? (
              <div className="flex items-center justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-teal-600" /></div>
            ) : plans.length === 0 ? (
              <div className="bg-white rounded-2xl border border-white/20 p-12 text-center">
                <Award className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No membership plans yet. Create your first plan.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {plans.map(p => (
                  <div key={p.id} className={`bg-white rounded-2xl border p-5 flex flex-col gap-3 ${p.is_active ? 'border-white/20' : 'border-dashed border-white/40 opacity-60'}`}>
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-bold text-gray-900">{p.name}</h3>
                        {p.description && <p className="text-xs text-gray-500 mt-0.5">{p.description}</p>}
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${p.is_active ? 'bg-green-100 text-green-700' : 'bg-white/40 text-gray-500'}`}>
                        {p.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className="flex gap-4 text-sm">
                      <div><p className="text-gray-400 text-xs">Price</p><p className="font-bold text-teal-700">₹{Number(p.price).toLocaleString('en-IN')}</p></div>
                      <div><p className="text-gray-400 text-xs">Validity</p><p className="font-semibold text-gray-900">{p.validity_days} days</p></div>
                      {p.discount_pct ? <div><p className="text-gray-400 text-xs">Discount</p><p className="font-semibold text-green-600">{p.discount_pct}%</p></div> : null}
                    </div>
                    {p.benefits && (
                      <div className="text-xs text-gray-600 bg-teal-500/15 rounded-lg px-3 py-2 flex items-start gap-1.5">
                        <Gift className="w-3.5 h-3.5 text-teal-600 shrink-0 mt-0.5" />
                        <span>{p.benefits}</span>
                      </div>
                    )}
                    <div className="flex gap-2 mt-auto pt-2 border-t border-white/20">
                      <button onClick={() => openEdit(p)} className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-semibold text-gray-600 hover:text-teal-700 hover:bg-teal-500/15 rounded-lg border border-white/40 hover:border-teal-300/60 transition">
                        <Pencil className="w-3.5 h-3.5" /> Edit
                      </button>
                      <button onClick={() => deletePlan(p.id)} className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-semibold text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg border border-white/30 hover:border-red-300 transition">
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ─── Client memberships tab ─── */}
        {tab === 'clients' && (
          <>
            {showAssign && (
              <div className="bg-white rounded-2xl border-2 border-teal-200 p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-gray-900">Assign Membership</h3>
                  <button onClick={() => setShowAssign(false)} className="p-1.5 hover:bg-white/40 rounded-lg transition"><X className="w-4 h-4" /></button>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Select Plan *</label>
                  <select value={assignPlanId} onChange={e => setAssignPlanId(e.target.value)}
                    className={inputCls}>
                    <option value="">— choose plan —</option>
                    {plans.filter(p => p.is_active).map(p => (
                      <option key={p.id} value={p.id}>{p.name} — ₹{Number(p.price).toLocaleString('en-IN')} / {p.validity_days}d</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Search Client</label>
                  <div className="flex gap-2">
                    <input type="text" value={assignSearch} onChange={e => setAssignSearch(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && searchAssignClient()}
                      placeholder="Name or phone..." className="flex-1 px-3 py-2 border border-white/40 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none" />
                    <button onClick={searchAssignClient} className="px-4 py-2 bg-white/40 hover:bg-gray-200 rounded-lg transition"><Search className="w-4 h-4" /></button>
                  </div>
                  {assignResults.length > 0 && !assignClient && (
                    <div className="mt-2 border border-white/30 rounded-lg overflow-hidden">
                      {assignResults.map(c => (
                        <button key={c.id} onClick={() => { setAssignClient(c); setAssignResults([]); }}
                          className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-teal-500/15 text-left border-b border-white/20 last:border-0 transition">
                          <span className="font-medium text-sm text-gray-800">{c.name}</span>
                          <span className="text-xs text-gray-500">{c.phone}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {assignClient && (
                    <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-teal-500/15 border border-teal-300/40 rounded-lg">
                      <span className="font-semibold text-teal-800 text-sm">{assignClient.name}</span>
                      <span className="text-xs text-teal-600">{assignClient.phone}</span>
                      <button onClick={() => setAssignClient(null)} className="ml-auto text-gray-400 hover:text-gray-600"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Notes</label>
                  <input type="text" value={assignNotes} onChange={e => setAssignNotes(e.target.value)}
                    className={inputCls} placeholder="Optional note" />
                </div>
                {assignError && (
                  <p className="text-sm text-red-700 bg-red-500/15 border border-red-300/40 rounded-xl backdrop-blur-sm px-3 py-2 flex items-center gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />{assignError}
                  </p>
                )}
                <div className="flex gap-2">
                  <button onClick={() => setShowAssign(false)} disabled={assigning} className="flex-1 py-2.5 btn-lux-ghost font-semibold rounded-xl transition text-sm">Cancel</button>
                  <button onClick={assignMembership} disabled={assigning} className="flex-1 py-2.5 btn-lux text-white font-bold rounded-xl transition text-sm disabled:bg-gray-400 flex items-center justify-center gap-2">
                    {assigning ? <><Loader2 className="w-4 h-4 animate-spin" /> Assigning...</> : <><Check className="w-4 h-4" /> Assign</>}
                  </button>
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl border border-white/20">
              <div className="p-4 border-b border-white/20 flex items-center gap-3">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                  <input type="text" value={memSearch} onChange={e => setMemSearch(e.target.value)}
                    placeholder="Search by client name or phone..." className="w-full pl-9 pr-3 py-2 border border-white/30 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none" />
                </div>
                <button onClick={fetchClientMems} className="p-2 hover:bg-white/40 rounded-lg transition"><RefreshCw className="w-4 h-4 text-gray-500" /></button>
              </div>
              {memsLoading ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-teal-600" /></div>
              ) : filteredMems.length === 0 ? (
                <div className="p-12 text-center text-gray-400 text-sm">No memberships assigned yet.</div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {filteredMems.map(m => {
                    const left = daysLeft(m.expires_at);
                    const isExpiring = left <= 7 && left > 0;
                    return (
                      <div key={m.id} className="p-4 hover:bg-white/40 transition">
                        <div className="flex items-start sm:items-center gap-4 flex-col sm:flex-row">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-gray-900">{m.client_name}</span>
                              <span className="text-xs text-gray-500">{m.client_phone}</span>
                            </div>
                            <p className="text-sm text-teal-700 font-medium mt-0.5">{m.membership_name}</p>
                            <p className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                              <CalendarDays className="w-3 h-3" />
                              {fmtDate(m.started_at)} → {fmtDate(m.expires_at)}
                            </p>
                            {m.benefits && (
                              <p className="text-xs text-gray-600 mt-1.5 flex items-start gap-1.5">
                                <Gift className="w-3 h-3 text-teal-600 shrink-0 mt-0.5" />
                                <span>{m.benefits}</span>
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                              m.status === 'active' && left > 0
                                ? isExpiring ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                                : 'bg-red-100 text-red-700'}`}>
                              {m.status === 'active' && left > 0
                                ? isExpiring ? `Expiring in ${left}d` : `Active · ${left}d left`
                                : left <= 0 ? 'Expired' : 'Cancelled'}
                            </span>
                            <button onClick={() => openHistory(m)}
                              className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-white/40 rounded-lg border border-white/30 hover:border-white/40 transition">
                              <History className="w-3 h-3" /> History
                            </button>
                            <button onClick={() => setRenewTarget(m)}
                              className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-teal-700 hover:bg-teal-500/15 rounded-lg border border-teal-200 hover:border-teal-400 transition">
                              <RefreshCw className="w-3 h-3" /> Renew
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {/* Renew confirmation modal */}
      {renewTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="glass-strong rounded-3xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/20">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-teal-600" />
                <h2 className="font-bold text-gray-900">Renew Membership</h2>
              </div>
              <button onClick={() => setRenewTarget(null)} className="p-1.5 hover:bg-white/40 rounded-lg transition"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-teal-500/15 border border-teal-100 rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm"><span className="text-gray-500">Client</span><span className="font-semibold text-gray-900">{renewTarget.client_name}</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-500">Plan</span><span className="font-semibold text-teal-700">{renewTarget.membership_name}</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-500">Current expiry</span><span className="font-medium text-gray-700">{fmtDate(renewTarget.expires_at)}</span></div>
                {(() => {
                  const plan = plans.find(p => p.id === renewTarget.membership_id);
                  if (!plan) return <p className="text-xs text-red-600">Plan no longer exists.</p>;
                  const base = renewTarget.status === 'active' && new Date(renewTarget.expires_at) > new Date()
                    ? new Date(renewTarget.expires_at) : new Date();
                  const newExp = new Date(base.getTime() + plan.validity_days * 86400000);
                  return <div className="flex justify-between text-sm"><span className="text-gray-500">New expiry</span><span className="font-bold text-teal-700">{fmtDate(newExp.toISOString())}</span></div>;
                })()}
              </div>
              <p className="text-xs text-gray-500">
                {renewTarget.status === 'active' && new Date(renewTarget.expires_at) > new Date()
                  ? 'The new period will be added to the end of the current membership.'
                  : 'The new membership period starts from today.'}
              </p>
              <div className="flex gap-2">
                <button onClick={() => setRenewTarget(null)} disabled={renewing} className="flex-1 py-2.5 btn-lux-ghost font-semibold rounded-xl transition text-sm">Cancel</button>
                <button onClick={confirmRenew} disabled={renewing} className="flex-1 py-2.5 btn-lux text-white font-bold rounded-xl transition text-sm disabled:bg-gray-400 flex items-center justify-center gap-2">
                  {renewing ? <><Loader2 className="w-4 h-4 animate-spin" /> Renewing...</> : <><RefreshCw className="w-4 h-4" /> Confirm Renew</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* History modal */}
      {historyClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="glass-strong rounded-3xl w-full max-w-lg max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 sticky top-0 bg-white">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-teal-600" />
                <div>
                  <h2 className="font-bold text-gray-900">Membership History</h2>
                  <p className="text-xs text-gray-500">{historyClient.client_name} · {historyClient.client_phone}</p>
                </div>
              </div>
              <button onClick={() => { setHistoryClient(null); setHistoryRows([]); }} className="p-1.5 hover:bg-white/40 rounded-lg transition"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-3">
              {historyLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-teal-600" /></div>
              ) : historyRows.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-8">No history found.</p>
              ) : (
                historyRows.map((h, idx) => {
                  const left = daysLeft(h.expires_at);
                  const isExpiring = left <= 7 && left > 0;
                  return (
                    <div key={h.id} className={`rounded-xl border p-4 ${idx === 0 ? 'border-teal-200 bg-teal-50' : 'glass-subtle border-white/30'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-sm text-gray-900">{h.membership_name}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                          h.status === 'active' && left > 0
                            ? isExpiring ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'}`}>
                          {h.status === 'active' && left > 0
                            ? isExpiring ? `Expiring in ${left}d` : `${left}d left`
                            : left <= 0 ? 'Expired' : 'Cancelled'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                        <CalendarDays className="w-3 h-3" />
                        {fmtDate(h.started_at)} → {fmtDate(h.expires_at)}
                      </div>
                      {h.benefits && (
                        <p className="text-xs text-gray-600 flex items-start gap-1.5 mb-1">
                          <Gift className="w-3 h-3 text-teal-600 shrink-0 mt-0.5" />
                          <span>{h.benefits}</span>
                        </p>
                      )}
                      <div className="flex gap-4 text-xs text-gray-500">
                        <span>Paid: <strong className="text-gray-700">₹{Number(h.amount_paid).toLocaleString('en-IN')}</strong></span>
                        {h.notes && <span>· {h.notes}</span>}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
