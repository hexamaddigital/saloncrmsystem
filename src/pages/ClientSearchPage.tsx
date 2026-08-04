import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Plus, Loader2, ChevronLeft, ExternalLink, CalendarDays,
  ChevronDown, ChevronUp, Phone, User,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Client, Transaction } from '../lib/types';

const PREVIEW_COUNT = 4;

type SearchMode = 'phone' | 'name';

export function ClientSearchPage() {
  const navigate = useNavigate();
  const [searchMode, setSearchMode] = useState<SearchMode>('phone');
  const [query, setQuery] = useState('');
  const [client, setClient] = useState<Client | null>(null);
  const [nameResults, setNameResults] = useState<Client[]>([]);
  const [treatments, setTreatments] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState('');
  const [showAll, setShowAll] = useState(false);

  function reset() {
    setClient(null);
    setNameResults([]);
    setTreatments([]);
    setNotFound(false);
    setError('');
    setShowAll(false);
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    reset();

    const q = query.trim();
    if (!q) {
      setError('Please enter a search term');
      setLoading(false);
      return;
    }

    if (searchMode === 'phone') {
      if (!/^\d{10}$/.test(q)) {
        setError('Phone number must be exactly 10 digits');
        setLoading(false);
        return;
      }
      try {
        const { data, error: err } = await supabase
          .from('clients')
          .select('*')
          .eq('phone', q)
          .maybeSingle();
        if (err) throw err;
        if (data) {
          setClient(data);
          await loadTreatments(data.id);
        } else {
          setNotFound(true);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Search failed');
      }
    } else {
      // Name search — partial match
      if (q.length < 2) {
        setError('Enter at least 2 characters');
        setLoading(false);
        return;
      }
      try {
        const { data, error: err } = await supabase
          .from('clients')
          .select('*')
          .ilike('name', `%${q}%`)
          .order('name')
          .limit(20);
        if (err) throw err;
        if (data && data.length > 0) {
          if (data.length === 1) {
            setClient(data[0]);
            await loadTreatments(data[0].id);
          } else {
            setNameResults(data);
          }
        } else {
          setNotFound(true);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Search failed');
      }
    }
    setLoading(false);
  }

  async function selectNameResult(c: Client) {
    setNameResults([]);
    setClient(c);
    await loadTreatments(c.id);
  }

  async function loadTreatments(clientId: string) {
    const { data } = await supabase
      .from('transactions')
      .select('*')
      .eq('client_id', clientId)
      .order('date', { ascending: false });
    setTreatments(data || []);
  }

  const visibleTreatments = showAll ? treatments : treatments.slice(0, PREVIEW_COUNT);
  const hasMore = treatments.length > PREVIEW_COUNT;

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/Image_logo.png" alt="Image Skinn & Hair" className="h-10 w-auto object-contain" />
            <h1 className="text-xl font-bold text-gray-900">Client Search</h1>
          </div>
          <button onClick={() => navigate('/dashboard')} className="p-2 hover:bg-white/40 rounded-lg transition">
            <ChevronLeft className="w-6 h-6 text-gray-600" />
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Search Box */}
        <div className="glass rounded-2xl p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Find Client</h2>

          {/* Mode toggle */}
          <div className="flex gap-2 mb-4 p-1 bg-white/40 rounded-xl w-fit">
            <button
              onClick={() => { setSearchMode('phone'); reset(); setQuery(''); }}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-semibold transition ${searchMode === 'phone' ? 'bg-white/80 text-teal-700' : 'text-gray-500 hover:text-gray-700'}`}>
              <Phone className="w-3.5 h-3.5" /> Phone
            </button>
            <button
              onClick={() => { setSearchMode('name'); reset(); setQuery(''); }}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-semibold transition ${searchMode === 'name' ? 'bg-white/80 text-teal-700' : 'text-gray-500 hover:text-gray-700'}`}>
              <User className="w-3.5 h-3.5" /> Name
            </button>
          </div>

          <form onSubmit={handleSearch}>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <input
                  type={searchMode === 'phone' ? 'tel' : 'text'}
                  value={query}
                  onChange={e => { setQuery(e.target.value); setError(''); }}
                  placeholder={searchMode === 'phone' ? 'Enter 10-digit phone number' : 'Enter client name (min 2 chars)'}
                  className="w-full pl-10 pr-4 py-3 glass-input rounded-xl"
                />
              </div>
              <button type="submit" disabled={loading}
                className="px-6 py-3 btn-lux text-white font-semibold rounded-lg transition flex items-center justify-center gap-2 ">
                {loading
                  ? <><Loader2 className="w-5 h-5 animate-spin" /> Searching...</>
                  : <><Search className="w-5 h-5" /> Search</>}
              </button>
            </div>
          </form>

          {error && (
            <div className="mt-4 bg-red-500/15 border border-red-300/40 text-red-700 backdrop-blur-sm px-4 py-3 rounded-lg text-sm">{error}</div>
          )}
        </div>

        {/* Multiple name results */}
        {nameResults.length > 1 && (
          <div className="glass rounded-2xl p-6">
            <h3 className="text-base font-bold text-gray-900 mb-3">{nameResults.length} clients found</h3>
            <div className="space-y-2">
              {nameResults.map(c => (
                <button key={c.id} onClick={() => selectNameResult(c)}
                  className="w-full flex items-center justify-between p-3 glass-subtle hover:bg-teal-500/20 rounded-lg border border-white/40 hover:border-teal-300/60 transition text-left group">
                  <div>
                    <p className="font-semibold text-gray-900 group-hover:text-teal-800">{c.name}</p>
                    <p className="text-xs text-gray-500">{c.phone}{c.gender ? ` · ${c.gender}` : ''}</p>
                  </div>
                  <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-teal-600 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Single client result */}
        {client && (
          <div className="space-y-4">
            <div className="bg-teal-500/15 border border-teal-300/40 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-bold text-teal-900 text-lg">{client.name}</p>
                  {client.is_golden && (
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-bold rounded-full border border-amber-300">★ VIP</span>
                  )}
                </div>
                <p className="text-teal-700 text-sm">
                  {client.phone}{client.gender ? ` · ${client.gender}` : ''}
                  {client.profession ? ` · ${client.profession.replace('_', ' ')}` : ''}
                </p>
              </div>
              <button
                onClick={() => navigate(`/clients/${client.id}`)}
                className="flex items-center gap-2 px-4 py-2.5 btn-lux text-white font-semibold rounded-lg transition text-sm shadow-md shadow-teal-600/20 whitespace-nowrap"
              >
                <ExternalLink className="w-4 h-4" />
                Open Full Profile
              </button>
            </div>

            {/* Treatment History */}
            <div className="glass rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <CalendarDays className="w-5 h-5 text-teal-600" />
                  Treatment History
                  {treatments.length > 0 && (
                    <span className="ml-1 px-2 py-0.5 bg-teal-100 text-teal-800 text-xs font-semibold rounded-full">
                      {treatments.length}
                    </span>
                  )}
                </h3>
                {hasMore && showAll && (
                  <button onClick={() => setShowAll(false)}
                    className="flex items-center gap-1 text-xs text-gray-500 hover:text-teal-700 transition">
                    <ChevronUp className="w-3.5 h-3.5" /> Show less
                  </button>
                )}
              </div>

              {treatments.length > 0 ? (
                <>
                  <div className="space-y-2">
                    {visibleTreatments.map((tx, idx) => (
                      <div key={tx.id}
                        className={`flex items-start justify-between p-3 rounded-lg border transition ${idx === 0 ? 'bg-teal-500/15 border-teal-200' : 'glass-subtle'}`}>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-gray-900 text-sm">{tx.treatment_name}</p>
                            {idx === 0 && (
                              <span className="text-xs bg-teal-600 text-white px-1.5 py-0.5 rounded font-medium">Latest</span>
                            )}
                            {tx.payment_status === 'pending' && (
                              <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-medium">Pending</span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {new Date(tx.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            {tx.staff_name ? ` · ${tx.staff_name}` : ''}
                            {tx.notes ? ` · ${tx.notes}` : ''}
                          </p>
                        </div>
                        <span className="text-sm font-bold text-teal-700 whitespace-nowrap ml-4 shrink-0">
                          ₹{Number(tx.price).toFixed(0)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {hasMore && !showAll && (
                    <div className="mt-4 pt-4 border-t border-white/20">
                      <button onClick={() => setShowAll(true)}
                        className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-teal-700 hover:text-teal-800 hover:bg-teal-500/15 rounded-lg border border-teal-200 hover:border-teal-300 transition">
                        <ChevronDown className="w-4 h-4" />
                        View All History ({treatments.length} records)
                      </button>
                    </div>
                  )}

                  {showAll && (
                    <div className="mt-4 pt-4 border-t border-white/20 text-center">
                      <button onClick={() => navigate(`/clients/${client.id}`)}
                        className="inline-flex items-center gap-2 text-sm text-teal-700 hover:text-teal-800 font-medium transition">
                        <ExternalLink className="w-4 h-4" />
                        Open full profile for complete details
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-gray-500 text-sm text-center py-4">No treatments recorded yet</p>
              )}
            </div>
          </div>
        )}

        {/* Not found */}
        {notFound && (
          <div className="glass rounded-2xl p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-2">Client Not Found</h3>
            <p className="text-gray-600 text-sm mb-5">
              No client found for <strong>{query}</strong>. Create a new profile?
            </p>
            <button
              onClick={() => navigate('/clients/new', { state: { phone: searchMode === 'phone' ? query : '' } })}
              className="w-full px-4 py-3 btn-lux text-white font-semibold rounded-lg transition flex items-center justify-center gap-2">
              <Plus className="w-5 h-5" />
              Create New Client
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
