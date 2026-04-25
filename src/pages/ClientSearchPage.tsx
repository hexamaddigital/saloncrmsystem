import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Loader2, ChevronLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Client } from '../lib/types';

export function ClientSearchPage() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState('');

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setNotFound(false);
    setClient(null);

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
      const { data, error: queryError } = await supabase
        .from('clients')
        .select('*')
        .eq('phone', phone.trim())
        .maybeSingle();

      if (queryError) throw queryError;

      if (data) {
        setClient(data);
      } else {
        setNotFound(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  }

  function handleCreateNew() {
    navigate('/clients/new', { state: { phone } });
  }

  function handleViewProfile() {
    if (client) {
      navigate(`/clients/${client.id}`);
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
          <button
            onClick={() => navigate('/dashboard')}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <ChevronLeft className="w-6 h-6 text-gray-600" />
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-8">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-6">Find Existing Client</h2>

          <form onSubmit={handleSearch} className="mb-8">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Enter phone number (e.g., 9876543210)"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-3 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition flex items-center justify-center gap-2 shadow-lg shadow-teal-600/25"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Search className="w-5 h-5" />
                    Search
                  </>
                )}
              </button>
            </div>
          </form>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          {client && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
              <h3 className="text-lg font-semibold text-green-900 mb-4">Client Found</h3>
              <div className="space-y-3 mb-6">
                <div className="flex justify-between">
                  <span className="text-green-700 font-medium">Name:</span>
                  <span className="text-gray-900">{client.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-green-700 font-medium">Phone:</span>
                  <span className="text-gray-900">{client.phone}</span>
                </div>
                {client.age && (
                  <div className="flex justify-between">
                    <span className="text-green-700 font-medium">Age:</span>
                    <span className="text-gray-900">{client.age}</span>
                  </div>
                )}
                {client.gender && (
                  <div className="flex justify-between">
                    <span className="text-green-700 font-medium">Gender:</span>
                    <span className="text-gray-900 capitalize">{client.gender}</span>
                  </div>
                )}
              </div>
              <button
                onClick={handleViewProfile}
                className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition"
              >
                View Full Profile
              </button>
            </div>
          )}

          {notFound && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-blue-900 mb-4">Client Not Found</h3>
              <p className="text-blue-700 mb-6">
                No existing client with phone number <strong>{phone}</strong>. Would you like to create a new client?
              </p>
              <button
                onClick={handleCreateNew}
                className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Create New Client
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
