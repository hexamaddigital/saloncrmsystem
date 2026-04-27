import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft, Search, Loader2, Users, Phone,
  ChevronRight, Scissors, Sparkles, X,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Client } from '../lib/types';

const SERVICE_TYPE_LABELS: Record<string, string> = {
  hair: 'Hair',
  skin: 'Skin',
  hair_and_skin: 'Hair & Skin',
};

const GENDER_LABELS: Record<string, string> = {
  male: 'Male',
  female: 'Female',
  other: 'Other',
};

function serviceColor(type?: string) {
  if (type === 'skin') return 'bg-rose-100 text-rose-700 border-rose-200';
  if (type === 'hair_and_skin') return 'bg-purple-100 text-purple-700 border-purple-200';
  return 'bg-teal-100 text-teal-700 border-teal-200';
}

function ServiceIcon({ type }: { type?: string }) {
  if (type === 'skin') return <Sparkles className="w-3 h-3" />;
  if (type === 'hair_and_skin') return <><Scissors className="w-3 h-3" /><Sparkles className="w-3 h-3" /></>;
  return <Scissors className="w-3 h-3" />;
}

export function AdminClientListPage() {
  const navigate = useNavigate();

  const [clients, setClients] = useState<Client[]>([]);
  const [filtered, setFiltered] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [serviceFilter, setServiceFilter] = useState('');
  const [genderFilter, setGenderFilter] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchClients();
  }, []);

  useEffect(() => {
    applyFilters(clients, query, serviceFilter, genderFilter);
  }, [query, serviceFilter, genderFilter, clients]);

  async function fetchClients() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setClients(data || []);
      setFiltered(data || []);
    } catch (err) {
      console.error('Error fetching clients:', err);
    } finally {
      setLoading(false);
    }
  }

  function applyFilters(list: Client[], q: string, svc: string, gen: string) {
    let result = list;
    if (q.trim()) {
      const lq = q.trim().toLowerCase();
      result = result.filter(c =>
        c.name.toLowerCase().includes(lq) ||
        c.phone.includes(lq) ||
        (c.address?.toLowerCase().includes(lq))
      );
    }
    if (svc) result = result.filter(c => c.service_type === svc);
    if (gen) result = result.filter(c => c.gender === gen);
    setFiltered(result);
  }

  function clearFilters() {
    setQuery('');
    setServiceFilter('');
    setGenderFilter('');
    searchRef.current?.focus();
  }

  const hasActiveFilters = query || serviceFilter || genderFilter;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/dashboard')}
              className="p-2 hover:bg-gray-100 rounded-lg transition -ml-2">
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            <img src="/Image_logo.png" alt="Image Skinn & Hair" className="h-9 w-auto object-contain" />
            <div>
              <h1 className="text-lg font-bold text-gray-900 leading-tight">All Clients</h1>
              <p className="text-xs text-gray-400">Admin view</p>
            </div>
          </div>
          {!loading && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 text-teal-700 text-sm font-semibold rounded-lg border border-teal-200">
              <Users className="w-4 h-4" />
              {filtered.length}{filtered.length !== clients.length ? ` / ${clients.length}` : ''}
            </span>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

        {/* Search & filters */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-5">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search by name, phone, or address..."
                className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition"
              />
            </div>

            {/* Service type filter */}
            <select
              value={serviceFilter}
              onChange={e => setServiceFilter(e.target.value)}
              className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition bg-white text-gray-700 min-w-[140px]">
              <option value="">All Services</option>
              <option value="hair">Hair</option>
              <option value="skin">Skin</option>
              <option value="hair_and_skin">Hair & Skin</option>
            </select>

            {/* Gender filter */}
            <select
              value={genderFilter}
              onChange={e => setGenderFilter(e.target.value)}
              className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition bg-white text-gray-700 min-w-[120px]">
              <option value="">All Genders</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>

            {hasActiveFilters && (
              <button onClick={clearFilters}
                className="flex items-center gap-1.5 px-3 py-2.5 text-sm text-gray-600 hover:text-red-600 border border-gray-300 hover:border-red-300 rounded-lg transition whitespace-nowrap">
                <X className="w-4 h-4" /> Clear
              </button>
            )}
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">
              {hasActiveFilters ? 'No clients match your filters' : 'No clients found'}
            </p>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="mt-3 text-teal-600 text-sm hover:underline">
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((client, idx) => (
              <button
                key={client.id}
                onClick={() => navigate(`/clients/${client.id}`)}
                className="w-full text-left bg-white rounded-xl border border-gray-200 hover:border-teal-300 hover:shadow-md shadow-sm p-4 transition group"
              >
                <div className="flex items-center justify-between gap-4">
                  {/* Left — number + info */}
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    {/* Row number */}
                    <span className="text-xs text-gray-400 font-mono w-6 shrink-0 text-right">
                      {idx + 1}
                    </span>

                    {/* Avatar circle */}
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center shrink-0 shadow-sm">
                      <span className="text-white font-bold text-sm">
                        {client.name.charAt(0).toUpperCase()}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-gray-900 text-sm group-hover:text-teal-700 transition">
                          {client.name}
                        </p>
                        {client.gender && (
                          <span className="text-xs text-gray-400">{GENDER_LABELS[client.gender] ?? client.gender}</span>
                        )}
                        {client.service_type && (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full border ${serviceColor(client.service_type)}`}>
                            <ServiceIcon type={client.service_type} />
                            {SERVICE_TYPE_LABELS[client.service_type] ?? client.service_type}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Phone className="w-3 h-3 text-gray-400 shrink-0" />
                        <span className="text-xs text-gray-500">{client.phone}</span>
                        {client.address && (
                          <span className="text-xs text-gray-400 truncate ml-2">· {client.address}</span>
                        )}
                      </div>
                      {client.service_items && client.service_items.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {client.service_items.slice(0, 4).map(item => (
                            <span key={item} className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                              {item}
                            </span>
                          ))}
                          {client.service_items.length > 4 && (
                            <span className="text-xs text-gray-400">+{client.service_items.length - 4} more</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right — date + arrow */}
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right hidden sm:block">
                      <p className="text-xs text-gray-400">Joined</p>
                      <p className="text-xs text-gray-600 font-medium">
                        {new Date(client.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-teal-600 group-hover:translate-x-0.5 transition-all" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
