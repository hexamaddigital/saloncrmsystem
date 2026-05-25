import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft, Download, RefreshCw, Loader2, Database,
  Search, Filter, X, ShieldAlert, Eye, Clock, Users,
  ChevronUp, ChevronDown, AlertCircle,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MasterRow {
  client_id: string;
  client_name: string;
  phone: string;
  gender: string | null;
  dob: string | null;
  age: number | null;
  blood_group: string | null;
  profession: string | null;
  address: string | null;
  client_notes: string | null;
  service_type: string | null;
  service_items: string | null;
  oral_medication: string | null;
  skin_allergies: string | null;
  home_care: string | null;
  hair_conditions: string | null;
  health_allergies: string | null;
  special_requirements: string | null;
  hair_problems: string | null;
  hair_texture: string | null;
  health_issues: string | null;
  diet_type: string | null;
  medical_history: string | null;
  total_treatments: number;
  total_spent: number;
  last_visit: string | null;
  avg_rating: number | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  deleted_by: string | null;
}

interface AuditRow {
  id: string;
  table_name: string;
  record_id: string;
  operation: string;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  changed_by: string | null;
  changed_at: string;
  client_id: string | null;
}

type Tab = 'master' | 'audit';
type SortKey = keyof MasterRow;
type SortDir = 'asc' | 'desc';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(date: string | null) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtTs(date: string | null) {
  if (!date) return '—';
  return new Date(date).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function operationBadge(op: string) {
  const map: Record<string, string> = {
    INSERT: 'bg-green-100 text-green-700 border-green-200',
    UPDATE: 'bg-blue-100 text-blue-700 border-blue-200',
    DELETE: 'bg-red-100 text-red-700 border-red-200',
  };
  return map[op] ?? 'bg-gray-100 text-gray-700 border-gray-200';
}

function tableBadge(t: string) {
  const map: Record<string, string> = {
    clients: 'bg-teal-100 text-teal-700',
    transactions: 'bg-amber-100 text-amber-700',
    feedback: 'bg-yellow-100 text-yellow-700',
    health_profiles: 'bg-rose-100 text-rose-700',
    hair_profiles: 'bg-purple-100 text-purple-700',
  };
  return map[t] ?? 'bg-gray-100 text-gray-600';
}

// ─── CSV export ───────────────────────────────────────────────────────────────

function toCSV(rows: MasterRow[]): string {
  const headers: Array<keyof MasterRow> = [
    'client_name', 'phone', 'gender', 'dob', 'age', 'blood_group',
    'profession', 'address', 'client_notes', 'service_type', 'service_items',
    'oral_medication', 'skin_allergies', 'home_care', 'hair_conditions',
    'health_allergies', 'special_requirements', 'hair_problems', 'hair_texture',
    'health_issues', 'diet_type', 'medical_history',
    'total_treatments', 'total_spent', 'last_visit', 'avg_rating',
    'created_at', 'updated_at', 'deleted_at',
  ];
  const escape = (v: unknown) => {
    if (v === null || v === undefined) return '';
    const s = String(v).replace(/"/g, '""');
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s}"` : s;
  };
  const lines = [
    headers.join(','),
    ...rows.map(r => headers.map(h => escape(r[h])).join(',')),
  ];
  return lines.join('\n');
}

function downloadCSV(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── SortIcon ─────────────────────────────────────────────────────────────────

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (col !== sortKey) return <ChevronUp className="w-3 h-3 text-gray-300" />;
  return sortDir === 'asc'
    ? <ChevronUp className="w-3 h-3 text-teal-600" />
    : <ChevronDown className="w-3 h-3 text-teal-600" />;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AdminMasterDataPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('master');

  // Master data state
  const [masterRows, setMasterRows] = useState<MasterRow[]>([]);
  const [masterLoading, setMasterLoading] = useState(true);
  const [masterError, setMasterError] = useState('');
  const [showDeleted, setShowDeleted] = useState(false);

  // Filters
  const [searchQ, setSearchQ] = useState('');
  const [serviceFilter, setServiceFilter] = useState('');
  const [genderFilter, setGenderFilter] = useState('');

  // Sort
  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Audit state
  const [auditRows, setAuditRows] = useState<AuditRow[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState('');
  const [auditTableFilter, setAuditTableFilter] = useState('');
  const [auditOpFilter, setAuditOpFilter] = useState('');
  const [auditPage, setAuditPage] = useState(0);
  const AUDIT_PAGE_SIZE = 50;

  // Detail panel
  const [selectedRow, setSelectedRow] = useState<MasterRow | null>(null);

  useEffect(() => { fetchMaster(); }, [showDeleted]);
  useEffect(() => { if (tab === 'audit') fetchAudit(); }, [tab, auditTableFilter, auditOpFilter, auditPage]);

  async function fetchMaster() {
    setMasterLoading(true);
    setMasterError('');
    try {
      const viewName = showDeleted ? 'master_client_data_all' : 'master_client_data';
      const { data, error } = await supabase.from(viewName).select('*');
      if (error) throw error;
      setMasterRows(data as MasterRow[] || []);
    } catch (err) {
      setMasterError(err instanceof Error ? err.message : 'Failed to load master data');
    } finally {
      setMasterLoading(false);
    }
  }

  const fetchAudit = useCallback(async () => {
    setAuditLoading(true);
    setAuditError('');
    try {
      let q = supabase
        .from('audit_log')
        .select('*')
        .order('changed_at', { ascending: false })
        .range(auditPage * AUDIT_PAGE_SIZE, (auditPage + 1) * AUDIT_PAGE_SIZE - 1);
      if (auditTableFilter) q = q.eq('table_name', auditTableFilter);
      if (auditOpFilter) q = q.eq('operation', auditOpFilter);
      const { data, error } = await q;
      if (error) throw error;
      setAuditRows(data as AuditRow[] || []);
    } catch (err) {
      setAuditError(err instanceof Error ? err.message : 'Failed to load audit log');
    } finally {
      setAuditLoading(false);
    }
  }, [auditTableFilter, auditOpFilter, auditPage]);

  // ── Derived filtered + sorted master rows ──
  const filteredRows = masterRows.filter(r => {
    if (serviceFilter && r.service_type !== serviceFilter) return false;
    if (genderFilter && r.gender !== genderFilter) return false;
    if (searchQ) {
      const q = searchQ.toLowerCase();
      if (!r.client_name.toLowerCase().includes(q) &&
          !r.phone.includes(q) &&
          !(r.address?.toLowerCase().includes(q))) return false;
    }
    return true;
  }).sort((a, b) => {
    const av = a[sortKey];
    const bv = b[sortKey];
    const cmp = av === null ? 1 : bv === null ? -1
      : typeof av === 'number' && typeof bv === 'number' ? av - bv
      : String(av).localeCompare(String(bv));
    return sortDir === 'asc' ? cmp : -cmp;
  });

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }

  function handleExport() {
    const csv = toCSV(filteredRows);
    const ts = new Date().toISOString().slice(0, 10);
    downloadCSV(csv, `salon-crm-master-data-${ts}.csv`);
  }

  const hasFilters = searchQ || serviceFilter || genderFilter;

  // ── Stats ──
  const totalSpent = filteredRows.reduce((s, r) => s + (r.total_spent ?? 0), 0);
  const totalTx = filteredRows.reduce((s, r) => s + (r.total_treatments ?? 0), 0);

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">

      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/dashboard')}
              className="p-2 hover:bg-gray-100 rounded-lg transition -ml-2">
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            <img src="/Image_logo.png" alt="Image Skinn & Hair" className="h-9 w-auto object-contain" />
            <div>
              <h1 className="text-lg font-bold text-gray-900 leading-tight">Master Data Repository</h1>
              <p className="text-xs text-gray-400">Permanent record system · Admin only</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchMaster}
              className="p-2 hover:bg-gray-100 rounded-lg transition" title="Refresh">
              <RefreshCw className="w-4 h-4 text-gray-500" />
            </button>
            <button onClick={handleExport}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition shadow-sm">
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 flex gap-0 border-t border-gray-100">
          {(['master', 'audit'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-5 py-3 text-sm font-semibold border-b-2 transition ${
                tab === t
                  ? 'border-teal-600 text-teal-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              {t === 'master' ? (
                <span className="flex items-center gap-1.5"><Database className="w-4 h-4" />Master Data</span>
              ) : (
                <span className="flex items-center gap-1.5"><Clock className="w-4 h-4" />Audit Log</span>
              )}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

        {/* ════ MASTER DATA TAB ════ */}
        {tab === 'master' && (
          <div className="space-y-4">

            {/* Stats bar */}
            {!masterLoading && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Total Clients', value: filteredRows.length, icon: <Users className="w-4 h-4 text-teal-500" /> },
                  { label: 'Total Treatments', value: totalTx, icon: <Database className="w-4 h-4 text-blue-500" /> },
                  { label: 'Total Revenue', value: `₹${totalSpent.toLocaleString('en-IN')}`, icon: <Filter className="w-4 h-4 text-green-500" /> },
                  { label: 'Deleted (hidden)', value: masterRows.filter(r => r.deleted_at).length, icon: <ShieldAlert className="w-4 h-4 text-red-400" /> },
                ].map(s => (
                  <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3">
                    {s.icon}
                    <div>
                      <p className="text-xs text-gray-500">{s.label}</p>
                      <p className="text-lg font-bold text-gray-900">{s.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Filters */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input type="text" value={searchQ} onChange={e => setSearchQ(e.target.value)}
                  placeholder="Search name, phone, address..."
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none" />
              </div>
              <select value={serviceFilter} onChange={e => setServiceFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500 bg-white text-gray-700">
                <option value="">All Services</option>
                <option value="hair">Hair</option>
                <option value="skin">Skin</option>
                <option value="hair_and_skin">Hair & Skin</option>
              </select>
              <select value={genderFilter} onChange={e => setGenderFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500 bg-white text-gray-700">
                <option value="">All Genders</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
              <label className="flex items-center gap-2 cursor-pointer px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition select-none">
                <input type="checkbox" checked={showDeleted} onChange={e => setShowDeleted(e.target.checked)}
                  className="accent-red-600 w-3.5 h-3.5" />
                Show deleted
              </label>
              {hasFilters && (
                <button onClick={() => { setSearchQ(''); setServiceFilter(''); setGenderFilter(''); }}
                  className="flex items-center gap-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:text-red-600 hover:border-red-300 transition">
                  <X className="w-3.5 h-3.5" /> Clear
                </button>
              )}
              <span className="ml-auto flex items-center text-xs text-gray-400 self-center">
                {filteredRows.length} row{filteredRows.length !== 1 ? 's' : ''}
                {filteredRows.length !== masterRows.length ? ` of ${masterRows.length}` : ''}
              </span>
            </div>

            {/* Error */}
            {masterError && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />{masterError}
              </div>
            )}

            {/* Table */}
            {masterLoading ? (
              <div className="flex items-center justify-center py-24">
                <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
              </div>
            ) : filteredRows.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                <Database className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">{hasFilters ? 'No records match your filters' : 'No records found'}</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[1100px]">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        {[
                          { key: 'client_name' as SortKey, label: 'Name' },
                          { key: 'phone' as SortKey, label: 'Phone' },
                          { key: 'gender' as SortKey, label: 'Gender' },
                          { key: 'dob' as SortKey, label: 'DOB' },
                          { key: 'profession' as SortKey, label: 'Profession' },
                          { key: 'service_type' as SortKey, label: 'Service' },
                          { key: 'total_treatments' as SortKey, label: 'Txns' },
                          { key: 'total_spent' as SortKey, label: 'Total Spent' },
                          { key: 'last_visit' as SortKey, label: 'Last Visit' },
                          { key: 'avg_rating' as SortKey, label: 'Rating' },
                          { key: 'created_at' as SortKey, label: 'Joined' },
                          { key: 'updated_at' as SortKey, label: 'Updated' },
                        ].map(col => (
                          <th key={col.key}
                            className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap cursor-pointer hover:text-teal-700 transition select-none"
                            onClick={() => toggleSort(col.key)}>
                            <span className="flex items-center gap-1">
                              {col.label}
                              <SortIcon col={col.key} sortKey={sortKey} sortDir={sortDir} />
                            </span>
                          </th>
                        ))}
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Detail</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredRows.map((row, idx) => (
                        <tr key={row.client_id}
                          className={`hover:bg-teal-50/40 transition ${row.deleted_at ? 'opacity-50 bg-red-50/30' : idx % 2 === 0 ? '' : 'bg-gray-50/40'}`}>
                          <td className="px-3 py-2.5 font-medium text-gray-900 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-teal-500 flex items-center justify-center shrink-0">
                                <span className="text-white text-xs font-bold">{row.client_name.charAt(0).toUpperCase()}</span>
                              </div>
                              {row.client_name}
                              {row.deleted_at && <span className="text-xs text-red-500 font-normal">(deleted)</span>}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{row.phone}</td>
                          <td className="px-3 py-2.5 text-gray-600 capitalize">{row.gender ?? '—'}</td>
                          <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{row.dob ?? '—'}</td>
                          <td className="px-3 py-2.5 text-gray-600">{row.profession?.replace('_', ' ') ?? '—'}</td>
                          <td className="px-3 py-2.5">
                            {row.service_type ? (
                              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-teal-100 text-teal-700">
                                {row.service_type.replace('_', ' & ')}
                              </span>
                            ) : '—'}
                          </td>
                          <td className="px-3 py-2.5 text-center font-semibold text-gray-700">{row.total_treatments}</td>
                          <td className="px-3 py-2.5 font-semibold text-teal-700 whitespace-nowrap">₹{Number(row.total_spent).toLocaleString('en-IN')}</td>
                          <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{fmt(row.last_visit)}</td>
                          <td className="px-3 py-2.5 text-center">
                            {row.avg_rating != null
                              ? <span className="text-yellow-600 font-semibold">{Number(row.avg_rating).toFixed(1)} ★</span>
                              : '—'}
                          </td>
                          <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap text-xs">{fmt(row.created_at)}</td>
                          <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap text-xs">{fmt(row.updated_at)}</td>
                          <td className="px-3 py-2.5">
                            <button onClick={() => setSelectedRow(row)}
                              className="p-1.5 hover:bg-teal-100 rounded-lg transition text-teal-600">
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ════ AUDIT LOG TAB ════ */}
        {tab === 'audit' && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-wrap gap-3 items-center">
              <select value={auditTableFilter} onChange={e => { setAuditTableFilter(e.target.value); setAuditPage(0); }}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500 bg-white text-gray-700">
                <option value="">All Tables</option>
                <option value="clients">clients</option>
                <option value="transactions">transactions</option>
                <option value="feedback">feedback</option>
                <option value="health_profiles">health_profiles</option>
                <option value="hair_profiles">hair_profiles</option>
              </select>
              <select value={auditOpFilter} onChange={e => { setAuditOpFilter(e.target.value); setAuditPage(0); }}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500 bg-white text-gray-700">
                <option value="">All Operations</option>
                <option value="INSERT">INSERT</option>
                <option value="UPDATE">UPDATE</option>
                <option value="DELETE">DELETE</option>
              </select>
              {(auditTableFilter || auditOpFilter) && (
                <button onClick={() => { setAuditTableFilter(''); setAuditOpFilter(''); setAuditPage(0); }}
                  className="flex items-center gap-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:text-red-600 hover:border-red-300 transition">
                  <X className="w-3.5 h-3.5" /> Clear
                </button>
              )}
              <button onClick={fetchAudit}
                className="ml-auto flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition">
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </button>
            </div>

            {auditError && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />{auditError}
              </div>
            )}

            {auditLoading ? (
              <div className="flex items-center justify-center py-24">
                <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
              </div>
            ) : auditRows.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                <Clock className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No audit entries found</p>
              </div>
            ) : (
              <>
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[800px]">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          {['Timestamp', 'Table', 'Operation', 'Record ID', 'Changed By'].map(h => (
                            <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">{h}</th>
                          ))}
                          <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Changes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {auditRows.map(row => (
                          <tr key={row.id} className="hover:bg-gray-50/60 transition">
                            <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap text-xs">{fmtTs(row.changed_at)}</td>
                            <td className="px-3 py-2.5">
                              <span className={`px-2 py-0.5 text-xs font-medium rounded ${tableBadge(row.table_name)}`}>
                                {row.table_name}
                              </span>
                            </td>
                            <td className="px-3 py-2.5">
                              <span className={`px-2 py-0.5 text-xs font-semibold rounded border ${operationBadge(row.operation)}`}>
                                {row.operation}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-gray-400 text-xs font-mono">{row.record_id.slice(0, 8)}…</td>
                            <td className="px-3 py-2.5 text-gray-400 text-xs font-mono">
                              {row.changed_by ? row.changed_by.slice(0, 8) + '…' : 'system'}
                            </td>
                            <td className="px-3 py-2.5">
                              <AuditDiff old_data={row.old_data} new_data={row.new_data} op={row.operation} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3">
                  <p className="text-sm text-gray-500">
                    Page {auditPage + 1} · showing {auditRows.length} entries
                  </p>
                  <div className="flex gap-2">
                    <button disabled={auditPage === 0} onClick={() => setAuditPage(p => p - 1)}
                      className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition">
                      Previous
                    </button>
                    <button disabled={auditRows.length < AUDIT_PAGE_SIZE} onClick={() => setAuditPage(p => p + 1)}
                      className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition">
                      Next
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </main>

      {/* ── Row Detail Slide-over ── */}
      {selectedRow && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedRow(null)} />
          <div className="relative w-full max-w-lg bg-white h-full overflow-y-auto shadow-2xl flex flex-col">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="font-bold text-gray-900">{selectedRow.client_name}</h2>
                <p className="text-xs text-gray-500">{selectedRow.phone}</p>
              </div>
              <button onClick={() => setSelectedRow(null)} className="p-2 hover:bg-gray-100 rounded-lg transition">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6 space-y-5 flex-1">
              <DetailSection title="Basic Information">
                <DetailRow label="Name" value={selectedRow.client_name} />
                <DetailRow label="Phone" value={selectedRow.phone} />
                <DetailRow label="Gender" value={selectedRow.gender} capitalize />
                <DetailRow label="Date of Birth" value={selectedRow.dob} />
                <DetailRow label="Age" value={selectedRow.age} />
                <DetailRow label="Blood Group" value={selectedRow.blood_group} />
                <DetailRow label="Profession" value={selectedRow.profession?.replace('_', ' ')} />
                <DetailRow label="Address" value={selectedRow.address} />
                <DetailRow label="Notes" value={selectedRow.client_notes} />
              </DetailSection>

              <DetailSection title="Services & Cosmo Medico">
                <DetailRow label="Service Type" value={selectedRow.service_type?.replace('_', ' & ')} />
                <DetailRow label="Service Items" value={selectedRow.service_items} />
                <DetailRow label="Hair Conditions" value={selectedRow.hair_conditions} />
                <DetailRow label="Oral Medication" value={selectedRow.oral_medication} />
                <DetailRow label="Skin Allergies" value={selectedRow.skin_allergies} />
                <DetailRow label="Home Care" value={selectedRow.home_care} />
              </DetailSection>

              <DetailSection title="Health Profile">
                <DetailRow label="Allergies" value={selectedRow.health_allergies} />
                <DetailRow label="Special Requirements" value={selectedRow.special_requirements} />
              </DetailSection>

              <DetailSection title="Hair Profile">
                <DetailRow label="Hair Problems" value={selectedRow.hair_problems} />
                <DetailRow label="Hair Texture" value={selectedRow.hair_texture} />
                <DetailRow label="Health Issues" value={selectedRow.health_issues} />
                <DetailRow label="Diet Type" value={selectedRow.diet_type} capitalize />
                <DetailRow label="Medical History" value={selectedRow.medical_history} />
              </DetailSection>

              <DetailSection title="Treatment Summary">
                <DetailRow label="Total Treatments" value={selectedRow.total_treatments} />
                <DetailRow label="Total Spent" value={`₹${Number(selectedRow.total_spent).toLocaleString('en-IN')}`} />
                <DetailRow label="Last Visit" value={fmt(selectedRow.last_visit)} />
                <DetailRow label="Avg Rating" value={selectedRow.avg_rating != null ? `${Number(selectedRow.avg_rating).toFixed(1)} / 5` : null} />
              </DetailSection>

              <DetailSection title="Record Timestamps">
                <DetailRow label="Created" value={fmtTs(selectedRow.created_at)} />
                <DetailRow label="Updated" value={fmtTs(selectedRow.updated_at)} />
                {selectedRow.deleted_at && (
                  <DetailRow label="Deleted" value={fmtTs(selectedRow.deleted_at)} danger />
                )}
              </DetailSection>
            </div>

            <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-3">
              <button
                onClick={() => { navigate(`/clients/${selectedRow.client_id}`); setSelectedRow(null); }}
                className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm rounded-lg transition"
              >
                Open Full Profile
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Small sub-components ─────────────────────────────────────────────────────

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">{title}</h3>
      <div className="bg-gray-50 rounded-lg border border-gray-200 divide-y divide-gray-100">
        {children}
      </div>
    </div>
  );
}

function DetailRow({ label, value, capitalize, danger }: {
  label: string; value: unknown; capitalize?: boolean; danger?: boolean;
}) {
  const display = value === null || value === undefined || value === '' ? '—' : String(value);
  return (
    <div className="flex justify-between items-start px-3 py-2 gap-3">
      <span className="text-xs text-gray-500 shrink-0">{label}</span>
      <span className={`text-xs font-medium text-right break-all ${capitalize ? 'capitalize' : ''} ${danger ? 'text-red-600' : 'text-gray-800'}`}>
        {display}
      </span>
    </div>
  );
}

function AuditDiff({ old_data, new_data, op }: {
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  op: string;
}) {
  const SKIP = new Set(['updated_at', 'created_at', 'id']);

  if (op === 'INSERT') {
    const fields = Object.keys(new_data ?? {}).filter(k => !SKIP.has(k) && new_data![k] !== null).slice(0, 3);
    return <span className="text-xs text-green-700">{fields.length > 0 ? `+${fields.join(', ')}` : 'new record'}</span>;
  }

  if (op === 'DELETE') {
    return <span className="text-xs text-red-600">record removed</span>;
  }

  // UPDATE — show changed keys
  const changed = Object.keys(new_data ?? {}).filter(k => {
    if (SKIP.has(k)) return false;
    return JSON.stringify((old_data ?? {})[k]) !== JSON.stringify((new_data ?? {})[k]);
  }).slice(0, 3);

  if (changed.length === 0) return <span className="text-xs text-gray-400">no field changes</span>;
  return <span className="text-xs text-blue-700">{changed.join(', ')} changed</span>;
}
