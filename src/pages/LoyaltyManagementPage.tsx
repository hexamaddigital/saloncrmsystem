import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft, Star, Plus, Loader2, AlertTriangle, RefreshCw,
  TrendingUp, Search, X, Check,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface LoyaltyRule {
  id: string; name: string; description?: string;
  points_per_rupee: number; min_bill_amount: number; is_active: boolean;
}
interface LedgerEntry {
  id: string; client_id: string; points: number; type: string;
  note?: string; created_at: string;
  clients?: { name: string; phone: string };
}
interface ClientPoints { id: string; name: string; phone: string; loyalty_points: number; }

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

type Tab = 'rules' | 'clients' | 'ledger';

export function LoyaltyManagementPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('rules');

  // Rules
  const [rules, setRules] = useState<LoyaltyRule[]>([]);
  const [rulesLoading, setRulesLoading] = useState(true);
  const [editRule, setEditRule] = useState<LoyaltyRule | null>(null);
  const [ruleForm, setRuleForm] = useState({ name: '', description: '', points_per_rupee: '0.01', min_bill_amount: '0', is_active: true });
  const [showRuleForm, setShowRuleForm] = useState(false);
  const [ruleError, setRuleError] = useState('');
  const [ruleSaving, setRuleSaving] = useState(false);

  // Clients
  const [clients, setClients] = useState<ClientPoints[]>([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [adjustClientId, setAdjustClientId] = useState('');
  const [adjustPoints, setAdjustPoints] = useState('');
  const [adjustNote, setAdjustNote] = useState('');
  const [adjusting, setAdjusting] = useState(false);
  const [adjustError, setAdjustError] = useState('');

  // Ledger
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);

  const fetchRules = useCallback(async () => {
    setRulesLoading(true);
    const { data } = await supabase.from('loyalty_rules').select('*').order('created_at');
    setRules(data || []);
    setRulesLoading(false);
  }, []);

  const fetchClients = useCallback(async () => {
    setClientsLoading(true);
    const { data } = await supabase.from('clients').select('id,name,phone,loyalty_points')
      .order('loyalty_points', { ascending: false });
    setClients(data || []);
    setClientsLoading(false);
  }, []);

  const fetchLedger = useCallback(async () => {
    setLedgerLoading(true);
    const { data } = await supabase.from('loyalty_ledger')
      .select('*, clients(name,phone)')
      .order('created_at', { ascending: false }).limit(200);
    setLedger(data || []);
    setLedgerLoading(false);
  }, []);

  useEffect(() => { fetchRules(); }, [fetchRules]);
  useEffect(() => { if (tab === 'clients') fetchClients(); }, [tab, fetchClients]);
  useEffect(() => { if (tab === 'ledger') fetchLedger(); }, [tab, fetchLedger]);

  async function saveRule() {
    if (!ruleForm.name.trim()) { setRuleError('Name is required'); return; }
    setRuleSaving(true); setRuleError('');
    try {
      const payload = {
        name: ruleForm.name.trim(), description: ruleForm.description || null,
        points_per_rupee: parseFloat(ruleForm.points_per_rupee),
        min_bill_amount: parseFloat(ruleForm.min_bill_amount),
        is_active: ruleForm.is_active,
      };
      if (editRule) {
        const { error } = await supabase.from('loyalty_rules').update(payload).eq('id', editRule.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('loyalty_rules').insert(payload);
        if (error) throw error;
      }
      setShowRuleForm(false); setEditRule(null); fetchRules();
    } catch (err) { setRuleError(err instanceof Error ? err.message : 'Failed'); }
    finally { setRuleSaving(false); }
  }

  function openEditRule(r: LoyaltyRule) {
    setEditRule(r);
    setRuleForm({ name: r.name, description: r.description || '', points_per_rupee: String(r.points_per_rupee), min_bill_amount: String(r.min_bill_amount), is_active: r.is_active });
    setRuleError(''); setShowRuleForm(true);
  }

  async function adjustClientPoints() {
    const pts = parseInt(adjustPoints);
    if (!adjustClientId) { setAdjustError('Select a client'); return; }
    if (isNaN(pts) || pts === 0) { setAdjustError('Enter a non-zero points value'); return; }
    setAdjusting(true); setAdjustError('');
    try {
      // Insert ledger entry
      const { error: le } = await supabase.from('loyalty_ledger').insert({
        client_id: adjustClientId, points: pts,
        type: 'adjust', reference_type: 'manual', note: adjustNote || 'Manual adjustment',
      });
      if (le) throw le;
      // Update client loyalty_points
      const client = clients.find(c => c.id === adjustClientId);
      const newPts = (client?.loyalty_points || 0) + pts;
      const { error: ce } = await supabase.from('clients')
        .update({ loyalty_points: Math.max(0, newPts) }).eq('id', adjustClientId);
      if (ce) throw ce;
      setAdjustClientId(''); setAdjustPoints(''); setAdjustNote('');
      fetchClients(); fetchLedger();
    } catch (err) { setAdjustError(err instanceof Error ? err.message : 'Failed'); }
    finally { setAdjusting(false); }
  }

  const filteredClients = clients.filter(c =>
    !clientSearch || c.name.toLowerCase().includes(clientSearch.toLowerCase()) || c.phone.includes(clientSearch));

  const typeColor: Record<string, string> = {
    earn: 'text-green-700 bg-green-50', redeem: 'text-blue-700 bg-blue-50',
    adjust: 'text-amber-700 bg-amber-50', expire: 'text-red-700 bg-red-50',
  };

  return (
    <div className="min-h-screen">
      <header className="glass-strong border-b border-white/30 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center gap-3">
          <button onClick={() => navigate('/dashboard')} className="p-2 hover:bg-white/40 rounded-lg transition">
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <Star className="w-5 h-5 text-amber-500" />
          <h1 className="text-xl font-bold text-gray-900">Loyalty Point System</h1>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex gap-1 p-1 bg-white/40 rounded-xl w-fit flex-wrap">
          {(['rules', 'clients', 'ledger'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${tab === t ? 'bg-white/80 text-teal-700' : 'text-gray-500 hover:text-gray-700'}`}>
              {t === 'rules' ? 'Loyalty Rules' : t === 'clients' ? 'Client Points' : 'Activity Ledger'}
            </button>
          ))}
        </div>

        {/* ─── Rules ─── */}
        {tab === 'rules' && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button onClick={() => { setEditRule(null); setRuleForm({ name: '', description: '', points_per_rupee: '0.01', min_bill_amount: '0', is_active: true }); setRuleError(''); setShowRuleForm(true); }}
                className="flex items-center gap-2 px-4 py-2 btn-lux text-white text-sm font-semibold rounded-xl transition">
                <Plus className="w-4 h-4" /> New Rule
              </button>
            </div>

            {showRuleForm && (
              <div className="bg-white rounded-2xl border-2 border-amber-200 p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-gray-900">{editRule ? 'Edit Rule' : 'New Loyalty Rule'}</h3>
                  <button onClick={() => setShowRuleForm(false)} className="p-1.5 hover:bg-white/40 rounded-lg"><X className="w-4 h-4" /></button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Rule Name *</label>
                    <input type="text" value={ruleForm.name} onChange={e => setRuleForm(p => ({ ...p, name: e.target.value }))} className="w-full px-3 py-2 border border-white/40 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Points per ₹1 spent</label>
                    <input type="number" min="0" step="0.001" value={ruleForm.points_per_rupee} onChange={e => setRuleForm(p => ({ ...p, points_per_rupee: e.target.value }))} className="w-full px-3 py-2 border border-white/40 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none" />
                    <p className="text-xs text-gray-400 mt-1">e.g. 0.01 = 1 point per ₹100</p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Min Bill Amount (₹)</label>
                    <input type="number" min="0" value={ruleForm.min_bill_amount} onChange={e => setRuleForm(p => ({ ...p, min_bill_amount: e.target.value }))} className="w-full px-3 py-2 border border-white/40 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Description</label>
                    <input type="text" value={ruleForm.description} onChange={e => setRuleForm(p => ({ ...p, description: e.target.value }))} className="w-full px-3 py-2 border border-white/40 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none" />
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="rule-active" checked={ruleForm.is_active} onChange={e => setRuleForm(p => ({ ...p, is_active: e.target.checked }))} className="w-4 h-4 accent-teal-600" />
                    <label htmlFor="rule-active" className="text-sm font-medium text-gray-700">Active</label>
                  </div>
                </div>
                {ruleError && <p className="text-sm text-red-700 bg-red-500/15 border border-red-300/40 rounded-xl backdrop-blur-sm px-3 py-2 flex items-center gap-2"><AlertTriangle className="w-3.5 h-3.5 shrink-0" />{ruleError}</p>}
                <div className="flex gap-2">
                  <button onClick={() => setShowRuleForm(false)} className="flex-1 py-2.5 btn-lux-ghost font-semibold rounded-xl transition text-sm">Cancel</button>
                  <button onClick={saveRule} disabled={ruleSaving} className="flex-1 py-2.5 btn-lux text-white font-bold rounded-xl transition text-sm flex items-center justify-center gap-2">
                    {ruleSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : <><Check className="w-4 h-4" /> Save Rule</>}
                  </button>
                </div>
              </div>
            )}

            {rulesLoading ? <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-teal-600" /></div> : (
              <div className="space-y-3">
                {rules.map(r => (
                  <div key={r.id} className="glass-subtle rounded-xl border border-white/20 p-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                      <Star className="w-5 h-5 text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-900">{r.name}</p>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${r.is_active ? 'bg-green-100 text-green-700' : 'bg-white/40 text-gray-500'}`}>{r.is_active ? 'Active' : 'Inactive'}</span>
                      </div>
                      {r.description && <p className="text-xs text-gray-500 mt-0.5">{r.description}</p>}
                      <p className="text-xs text-gray-600 mt-1">
                        <span className="font-semibold text-amber-600">{r.points_per_rupee} pts/₹1</span>
                        {r.min_bill_amount > 0 && <> · Min bill ₹{r.min_bill_amount}</>}
                      </p>
                    </div>
                    <button onClick={() => openEditRule(r)} className="p-2 hover:bg-white/40 rounded-lg transition shrink-0">
                      <TrendingUp className="w-4 h-4 text-gray-500" />
                    </button>
                  </div>
                ))}
                {rules.length === 0 && <div className="glass-subtle rounded-xl border border-white/20 p-8 text-center text-gray-400 text-sm">No rules yet.</div>}
              </div>
            )}
          </div>
        )}

        {/* ─── Client Points ─── */}
        {tab === 'clients' && (
          <div className="space-y-4">
            {/* Adjust points form */}
            <div className="bg-white rounded-2xl border border-white/20 p-5 space-y-3">
              <h3 className="font-bold text-gray-900 text-sm uppercase tracking-wide">Manual Point Adjustment</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Client</label>
                  <select value={adjustClientId} onChange={e => setAdjustClientId(e.target.value)}
                    className="w-full px-3 py-2 border border-white/40 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none">
                    <option value="">— select client —</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name} ({c.loyalty_points ?? 0} pts)</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Points (+ or −)</label>
                  <input type="number" value={adjustPoints} onChange={e => setAdjustPoints(e.target.value)}
                    placeholder="e.g. 50 or -20" className="w-full px-3 py-2 border border-white/40 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Note</label>
                  <input type="text" value={adjustNote} onChange={e => setAdjustNote(e.target.value)}
                    placeholder="Reason..." className="w-full px-3 py-2 border border-white/40 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none" />
                </div>
              </div>
              {adjustError && <p className="text-sm text-red-700 bg-red-500/15 border border-red-300/40 rounded-xl backdrop-blur-sm px-3 py-2 flex items-center gap-2"><AlertTriangle className="w-3.5 h-3.5 shrink-0" />{adjustError}</p>}
              <button onClick={adjustClientPoints} disabled={adjusting}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold rounded-xl transition disabled:bg-gray-400 flex items-center gap-2">
                {adjusting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Apply Adjustment
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-white/20">
              <div className="p-4 border-b border-white/20 flex items-center gap-3">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                  <input type="text" value={clientSearch} onChange={e => setClientSearch(e.target.value)}
                    placeholder="Search clients..." className="w-full pl-9 pr-3 py-2 border border-white/30 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none" />
                </div>
                <button onClick={fetchClients} className="p-2 hover:bg-white/40 rounded-lg transition"><RefreshCw className="w-4 h-4 text-gray-500" /></button>
              </div>
              {clientsLoading ? <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-teal-600" /></div> : (
                <div className="divide-y divide-gray-100">
                  {filteredClients.map((c, i) => (
                    <div key={c.id} className="flex items-center gap-3 px-4 py-3 hover:bg-white/40 transition">
                      <span className="w-7 h-7 rounded-full bg-amber-100 text-amber-700 text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 text-sm">{c.name}</p>
                        <p className="text-xs text-gray-500">{c.phone}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Star className="w-3.5 h-3.5 text-amber-500" />
                        <span className="font-bold text-amber-700">{c.loyalty_points ?? 0}</span>
                        <span className="text-xs text-gray-400">pts</span>
                      </div>
                    </div>
                  ))}
                  {filteredClients.length === 0 && <div className="p-8 text-center text-gray-400 text-sm">No clients found.</div>}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── Ledger ─── */}
        {tab === 'ledger' && (
          <div className="bg-white rounded-2xl border border-white/20">
            <div className="p-4 border-b border-white/20 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Activity Ledger</h3>
              <button onClick={fetchLedger} className="p-2 hover:bg-white/40 rounded-lg transition"><RefreshCw className="w-4 h-4 text-gray-500" /></button>
            </div>
            {ledgerLoading ? <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-teal-600" /></div> : (
              <div className="divide-y divide-gray-100">
                {ledger.map(e => (
                  <div key={e.id} className="flex items-center gap-3 px-4 py-3 hover:bg-white/40 transition">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold capitalize ${typeColor[e.type] || 'bg-white/40 text-gray-600'}`}>{e.type}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800">{e.clients?.name}</p>
                      <p className="text-xs text-gray-500">{e.note}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`font-bold text-sm ${e.points > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {e.points > 0 ? '+' : ''}{e.points} pts
                      </p>
                      <p className="text-xs text-gray-400">{fmtDate(e.created_at)}</p>
                    </div>
                  </div>
                ))}
                {ledger.length === 0 && <div className="p-8 text-center text-gray-400 text-sm">No activity yet.</div>}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
