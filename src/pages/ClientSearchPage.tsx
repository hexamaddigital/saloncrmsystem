import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Loader2, ChevronLeft, ExternalLink, CalendarDays } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Client, Transaction } from '../lib/types';

export function ClientSearchPage() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [client, setClient] = useState<Client | null>(null);
  const [treatments, setTreatments] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState('');

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setNotFound(false);
    setClient(null);
    setTreatments([]);

    const trimmedPhone = phone.trim();
    if (!trimmedPhone) {
      setError('Please enter a phone number');
      setLoading(false);
      return;
    }
    if (!/^\d{10}$/.test(trimmedPhone)) {
      setError('Phone number must be exactly 10 digits');
      setLoading(false);
      return;
    }

    try {
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .eq('phone', trimmedPhone)
        .maybeSingle();

      if (clientError) throw clientError;

      if (clientData) {
        setClient(clientData);
        const { data: txData } = await supabase
          .from('transactions')
          .select('*')
          .eq('client_id', clientData.id)
          .order('date', { ascending: false });
        setTreatments(txData || []);
      } else {
        setNotFound(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/Image_logo.png" alt="Image Skinn & Hair" className="h-10 w-auto object-contain" />
            <h1 className="text-xl font-bold text-gray-900">Client Search</h1>
          </div>
          <button onClick={() => navigate('/dashboard')} className="p-2 hover:bg-gray-100 rounded-lg transition">
            <ChevronLeft className="w-6 h-6 text-gray-600" />
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Search Box */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-5">Find Client by Phone</h2>
          <form onSubmit={handleSearch}>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <input
                  type="tel"
                  value={phone}
                  onChange={e => { setPhone(e.target.value); setError(''); }}
                  placeholder="Enter 10-digit phone number"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition"
                />
              </div>
              <button type="submit" disabled={loading}
                className="px-6 py-3 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition flex items-center justify-center gap-2 shadow-lg shadow-teal-600/20">
                {loading
                  ? <><Loader2 className="w-5 h-5 animate-spin" /> Searching...</>
                  : <><Search className="w-5 h-5" /> Search</>}
              </button>
            </div>
          </form>

          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Client found */}
        {client && (
          <div className="space-y-4">
            {/* Client summary + Open Full Profile */}
            <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="font-bold text-teal-900 text-lg">{client.name}</p>
                <p className="text-teal-700 text-sm">
                  {client.phone}{client.gender ? ` • ${client.gender}` : ''}
                  {client.profession ? ` • ${client.profession.replace('_', ' ')}` : ''}
                </p>
              </div>
              <button
                onClick={() => navigate(`/clients/${client.id}`)}
                className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-lg transition text-sm shadow-md shadow-teal-600/20 whitespace-nowrap"
              >
                <ExternalLink className="w-4 h-4" />
                Open Full Profile
              </button>
            </div>

            {/* Treatment History */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-teal-600" />
                Treatment History
                {treatments.length > 0 && (
                  <span className="ml-1 px-2 py-0.5 bg-teal-100 text-teal-800 text-xs font-semibold rounded-full">
                    {treatments.length}
                  </span>
                )}
              </h3>

              {treatments.length > 0 ? (
                <div className="space-y-2">
                  {treatments.map(tx => (
                    <div key={tx.id} className="flex items-start justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">{tx.treatment_name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {new Date(tx.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          {tx.notes ? ` • ${tx.notes}` : ''}
                        </p>
                      </div>
                      <span className="text-sm font-bold text-teal-700 whitespace-nowrap ml-4">
                        ₹{Number(tx.price).toFixed(0)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm text-center py-4">No treatments recorded yet</p>
              )}
            </div>
          </div>
        )}

        {/* Not found */}
        {notFound && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-2">Client Not Found</h3>
            <p className="text-gray-600 text-sm mb-5">
              No client found with phone number <strong>{phone}</strong>. Create a new profile?
            </p>
            <button
              onClick={() => navigate('/clients/new', { state: { phone } })}
              className="w-full px-4 py-3 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-lg transition flex items-center justify-center gap-2">
              <Plus className="w-5 h-5" />
              Create New Client
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
