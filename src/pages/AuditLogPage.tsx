import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft, Shield, RefreshCw, Loader2, Search, ChevronLeft as Prev, ChevronRight as Next,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface AuditEntry {
  id: string; table_name: string; record_id: string; operation: string;
  changed_by?: string; client_id?: string; changed_at: string;
  old_data?: Record<string, any>; new_data?: Record<string, any>;
  users?: { name: string; role: string };
  clients?: { name: string };
}

const OP_COLOR: Record<string, string> = {
  INSERT: 'bg-green-100 text-green-700',
  UPDATE: 'bg-blue-100 text-blue-700',
  DELETE: 'bg-red-100 text-red-700',
};

function fmtDateTime(d: string) {
  return new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
}

function buildSummary(entry: AuditEntry): string {
  const who = entry.users?.name || 'System';
  const role = entry.users?.role || '';
  const table = entry.table_name.replace(/_/g, ' ');
  const client = entry.clients?.name;
  const op = entry.operation.toLowerCase();

  if (op === 'insert') return `${role ? `${role.charAt(0).toUpperCase() + role.slice(1)} ` : ''}${who} created a new ${table.replace('s', '')}${client ? ` for ${client}` : ''}`;
  if (op === 'delete') return `${who} deleted a ${table.replace('s', '')}${client ? ` record for ${client}` : ''}`;

  // Update — find changed fields
  const old = entry.old_data || {};
  const nw = entry.new_data || {};
  const changed = Object.keys(nw).filter(k => JSON.stringify(old[k]) !== JSON.stringify(nw[k]) && !['updated_at'].includes(k));
  const fieldStr = changed.slice(0, 3).join(', ');
  return `${who} updated ${fieldStr || 'record'}${client ? ` for ${client}` : ''}`;
}

const PAGE_SIZE = 50;

export function AuditLogPage() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [opFilter, setOpFilter] = useState<'all' | 'INSERT' | 'UPDATE' | 'DELETE'>('all');
  const [tableFilter, setTableFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    let q = supabase.from('audit_log')
      .select('*, users(name,role), clients(name)', { count: 'exact' })
      .order('changed_at', { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

    if (opFilter !== 'all') q = q.eq('operation', opFilter);
    if (tableFilter !== 'all') q = q.eq('table_name', tableFilter);

    const { data, count } = await q;
    setEntries(data || []);
    setTotal(count || 0);
    setLoading(false);
  }, [page, opFilter, tableFilter]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const tables = ['all', 'clients', 'transactions', 'invoices', 'feedback', 'appointments', 'memberships', 'coupons'];
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const filtered = search
    ? entries.filter(e =>
        buildSummary(e).toLowerCase().includes(search.toLowerCase()) ||
        e.table_name.includes(search.toLowerCase()) ||
        (e.users?.name || '').toLowerCase().includes(search.toLowerCase()))
    : entries;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/dashboard')} className="p-2 hover:bg-gray-100 rounded-lg transition">
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            <Shield className="w-5 h-5 text-teal-600" />
            <h1 className="text-xl font-bold text-gray-900">Audit Log</h1>
          </div>
          <button onClick={fetchLogs} className="p-2 hover:bg-gray-100 rounded-lg transition">
            <RefreshCw className="w-4 h-4 text-gray-600" />
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/* Filters */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by user, action, or description..." className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none" />
          </div>
          <div className="flex flex-wrap gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Operation</label>
              <select value={opFilter} onChange={e => { setOpFilter(e.target.value as any); setPage(1); }}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none">
                <option value="all">All Operations</option>
                <option value="INSERT">INSERT</option>
                <option value="UPDATE">UPDATE</option>
                <option value="DELETE">DELETE</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Table</label>
              <select value={tableFilter} onChange={e => { setTableFilter(e.target.value); setPage(1); }}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none capitalize">
                {tables.map(t => <option key={t} value={t}>{t === 'all' ? 'All Tables' : t.replace('_', ' ')}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Entries */}
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-teal-600" /></div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 text-xs text-gray-500">
              {total} total entries — page {page} of {totalPages || 1}
            </div>
            {filtered.length === 0 ? (
              <div className="p-10 text-center text-gray-400 text-sm">No audit entries found.</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filtered.map(e => (
                  <div key={e.id} className="hover:bg-gray-50 transition">
                    <button className="w-full flex items-start gap-3 px-5 py-3.5 text-left" onClick={() => setExpanded(expanded === e.id ? null : e.id)}>
                      <span className={`mt-0.5 px-2 py-0.5 rounded-full text-xs font-bold shrink-0 ${OP_COLOR[e.operation] || 'bg-gray-100 text-gray-600'}`}>{e.operation}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-800">{buildSummary(e)}</p>
                        <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-2">
                          <span className="capitalize font-medium text-gray-500">{e.table_name.replace('_', ' ')}</span>
                          <span>·</span>
                          <span>{fmtDateTime(e.changed_at)}</span>
                        </p>
                      </div>
                    </button>
                    {expanded === e.id && (e.old_data || e.new_data) && (
                      <div className="px-5 pb-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {e.old_data && Object.keys(e.old_data).length > 0 && (
                          <div>
                            <p className="text-xs font-bold text-red-500 uppercase tracking-wide mb-1">Before</p>
                            <pre className="text-xs bg-red-50 rounded-lg p-3 overflow-x-auto border border-red-100 text-gray-700 max-h-40">
                              {JSON.stringify(e.old_data, null, 2)}
                            </pre>
                          </div>
                        )}
                        {e.new_data && Object.keys(e.new_data).length > 0 && (
                          <div>
                            <p className="text-xs font-bold text-green-500 uppercase tracking-wide mb-1">After</p>
                            <pre className="text-xs bg-green-50 rounded-lg p-3 overflow-x-auto border border-green-100 text-gray-700 max-h-40">
                              {JSON.stringify(e.new_data, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition disabled:opacity-40">
                  <Prev className="w-4 h-4" /> Prev
                </button>
                <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition disabled:opacity-40">
                  Next <Next className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
