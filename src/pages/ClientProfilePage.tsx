import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Plus, Loader2, Trash2, Star } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Client, Transaction, Feedback, HealthProfile, HairProfile } from '../lib/types';

// Hair and health data definitions (for future profile completion)
// const HAIR_PROBLEMS = [
//   'Lack of Hair Volume', 'Hair Thinning', 'Excessive Hair Fall',
//   'Scalp Visibility', 'Receding Hairline', 'Receding Corners',
//   'Dandruff', 'Sensitive Scalp', 'Allergic Scalp', 'Alopecia Areata',
//   'Hair Length Reduction', 'Side Effects of Hair Colour'
// ];

// const HAIR_TEXTURE = ['Thin Hair', 'Thick Hair', 'Split Ends', 'Frizzy Hair'];

// const HEALTH_ISSUES = [
//   'Thyroid', 'Diabetes', 'PCOD', 'Vitamin D3 Low',
//   'Vitamin B12 Low', 'Hormone Imbalance', 'Obesity', 'Fungal Infection',
//   'Weakness', 'Hypertension'
// ];

const TREATMENTS = [
  'Hair Cut', 'Hair Color', 'Facial', 'Manicure',
  'Pedicure', 'Keratin', 'Bluetox', 'Nano Plastia', 'Highlighting'
];

export function ClientProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [client, setClient] = useState<Client | null>(null);
  const [health, setHealth] = useState<HealthProfile | null>(null);
  const [hair, setHair] = useState<HairProfile | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);

  const [showAddTreatment, setShowAddTreatment] = useState(false);
  const [treatmentForm, setTreatmentForm] = useState({
    treatment_name: '',
    price: '',
    notes: ''
  });

  const [showAddFeedback, setShowAddFeedback] = useState(false);
  const [feedbackForm, setFeedbackForm] = useState({
    rating: '5',
    comment: ''
  });

  useEffect(() => {
    if (id) {
      fetchData();
    }
  }, [id]);

  async function fetchData() {
    try {
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (clientError) throw clientError;
      setClient(clientData);

      if (clientData) {
        const { data: healthData } = await supabase
          .from('health_profiles')
          .select('*')
          .eq('client_id', id)
          .maybeSingle();

        const { data: hairData } = await supabase
          .from('hair_profiles')
          .select('*')
          .eq('client_id', id)
          .maybeSingle();

        const { data: transData } = await supabase
          .from('transactions')
          .select('*')
          .eq('client_id', id)
          .order('date', { ascending: false });

        const { data: feedbackData } = await supabase
          .from('feedback')
          .select('*')
          .eq('client_id', id)
          .order('date', { ascending: false });

        setHealth(healthData);
        setHair(hairData);
        setTransactions(transData || []);
        setFeedback(feedbackData || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddTreatment(e: React.FormEvent) {
    e.preventDefault();
    if (!client) return;

    try {
      await supabase.from('transactions').insert({
        client_id: client.id,
        treatment_name: treatmentForm.treatment_name,
        price: parseFloat(treatmentForm.price),
        notes: treatmentForm.notes || null,
        date: new Date().toISOString()
      });

      setTreatmentForm({ treatment_name: '', price: '', notes: '' });
      setShowAddTreatment(false);
      fetchData();
    } catch (error) {
      console.error('Error adding treatment:', error);
    }
  }

  async function handleAddFeedback(e: React.FormEvent) {
    e.preventDefault();
    if (!client) return;

    try {
      await supabase.from('feedback').insert({
        client_id: client.id,
        rating: parseInt(feedbackForm.rating),
        comment: feedbackForm.comment || null,
        date: new Date().toISOString()
      });

      setFeedbackForm({ rating: '5', comment: '' });
      setShowAddFeedback(false);
      fetchData();
    } catch (error) {
      console.error('Error adding feedback:', error);
    }
  }

  async function handleDeleteTransaction(transId: string) {
    if (confirm('Delete this transaction?')) {
      await supabase.from('transactions').delete().eq('id', transId);
      fetchData();
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 text-lg">Client not found</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="mt-4 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/Image_logo.png" alt="Image Skinn & Hair" className="h-10" />
            <h1 className="text-xl font-bold text-gray-900">{client.name}</h1>
          </div>
          <button
            onClick={() => navigate('/dashboard')}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <ChevronLeft className="w-6 h-6 text-gray-600" />
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Basic Information</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-gray-600 text-sm">Phone</p>
                  <p className="text-gray-900 font-medium">{client.phone}</p>
                </div>
                {client.age && (
                  <div>
                    <p className="text-gray-600 text-sm">Age</p>
                    <p className="text-gray-900 font-medium">{client.age}</p>
                  </div>
                )}
                {client.gender && (
                  <div>
                    <p className="text-gray-600 text-sm">Gender</p>
                    <p className="text-gray-900 font-medium capitalize">{client.gender}</p>
                  </div>
                )}
                {client.blood_group && (
                  <div>
                    <p className="text-gray-600 text-sm">Blood Group</p>
                    <p className="text-gray-900 font-medium">{client.blood_group}</p>
                  </div>
                )}
              </div>
              {client.address && (
                <div className="mt-4">
                  <p className="text-gray-600 text-sm">Address</p>
                  <p className="text-gray-900">{client.address}</p>
                </div>
              )}
              {client.notes && (
                <div className="mt-4">
                  <p className="text-gray-600 text-sm">Notes</p>
                  <p className="text-gray-900">{client.notes}</p>
                </div>
              )}
            </div>

            {health && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Health & Safety</h2>
                {health.allergies && (
                  <div className="mb-3">
                    <p className="text-gray-600 text-sm">Allergies</p>
                    <p className="text-gray-900">{health.allergies}</p>
                  </div>
                )}
                {health.special_requirements && (
                  <div>
                    <p className="text-gray-600 text-sm">Special Requirements</p>
                    <p className="text-gray-900">{health.special_requirements}</p>
                  </div>
                )}
              </div>
            )}

            {hair && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Hair & Health Profile</h2>
                {hair.hair_problems?.length > 0 && (
                  <div className="mb-4">
                    <p className="text-gray-600 text-sm font-medium mb-2">Hair Problems</p>
                    <div className="flex flex-wrap gap-2">
                      {hair.hair_problems.map(prob => (
                        <span key={prob} className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full">
                          {prob}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {hair.hair_texture?.length > 0 && (
                  <div className="mb-4">
                    <p className="text-gray-600 text-sm font-medium mb-2">Hair Texture</p>
                    <div className="flex flex-wrap gap-2">
                      {hair.hair_texture.map(tex => (
                        <span key={tex} className="px-3 py-1 bg-green-100 text-green-800 text-sm rounded-full">
                          {tex}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {hair.health_issues?.length > 0 && (
                  <div className="mb-4">
                    <p className="text-gray-600 text-sm font-medium mb-2">Health Issues</p>
                    <div className="flex flex-wrap gap-2">
                      {hair.health_issues.map(issue => (
                        <span key={issue} className="px-3 py-1 bg-orange-100 text-orange-800 text-sm rounded-full">
                          {issue}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900">Treatment History</h2>
                <button
                  onClick={() => setShowAddTreatment(true)}
                  className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-lg transition flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" />
                  Add Treatment
                </button>
              </div>

              {showAddTreatment && (
                <form onSubmit={handleAddTreatment} className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="space-y-3">
                    <select
                      value={treatmentForm.treatment_name}
                      onChange={(e) => setTreatmentForm(prev => ({ ...prev, treatment_name: e.target.value }))}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition"
                    >
                      <option value="">Select treatment</option>
                      {TREATMENTS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <input
                      type="number"
                      placeholder="Price"
                      value={treatmentForm.price}
                      onChange={(e) => setTreatmentForm(prev => ({ ...prev, price: e.target.value }))}
                      required
                      step="0.01"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition"
                    />
                    <textarea
                      placeholder="Notes (optional)"
                      value={treatmentForm.notes}
                      onChange={(e) => setTreatmentForm(prev => ({ ...prev, notes: e.target.value }))}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition"
                    />
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        className="flex-1 px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-lg transition"
                      >
                        Save Treatment
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowAddTreatment(false)}
                        className="flex-1 px-3 py-2 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </form>
              )}

              <div className="space-y-2">
                {transactions.length > 0 ? (
                  transactions.map(trans => (
                    <div key={trans.id} className="flex items-start justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-gray-300 transition">
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900">{trans.treatment_name}</p>
                        <p className="text-sm text-gray-600">₹{Number(trans.price).toFixed(2)} • {new Date(trans.date).toLocaleDateString()}</p>
                        {trans.notes && <p className="text-sm text-gray-600 mt-1">{trans.notes}</p>}
                      </div>
                      <button
                        onClick={() => handleDeleteTransaction(trans.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-gray-500 py-4">No treatments yet</p>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900">Feedback</h2>
                <button
                  onClick={() => setShowAddFeedback(true)}
                  className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-lg transition flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" />
                  Add
                </button>
              </div>

              {showAddFeedback && (
                <form onSubmit={handleAddFeedback} className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium text-gray-700 block mb-2">Rating</label>
                      <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map(r => (
                          <button
                            key={r}
                            type="button"
                            onClick={() => setFeedbackForm(prev => ({ ...prev, rating: r.toString() }))}
                            className={`px-3 py-2 rounded-lg font-semibold transition ${
                              parseInt(feedbackForm.rating) >= r
                                ? 'bg-yellow-500 text-white'
                                : 'bg-gray-200 text-gray-700'
                            }`}
                          >
                            {r}
                          </button>
                        ))}
                      </div>
                    </div>
                    <textarea
                      placeholder="Comment (optional)"
                      value={feedbackForm.comment}
                      onChange={(e) => setFeedbackForm(prev => ({ ...prev, comment: e.target.value }))}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition"
                    />
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        className="flex-1 px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-lg transition"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowAddFeedback(false)}
                        className="flex-1 px-3 py-2 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </form>
              )}

              <div className="space-y-2">
                {feedback.length > 0 ? (
                  feedback.map(fb => (
                    <div key={fb.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex items-center gap-1 mb-2">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`w-4 h-4 ${
                              i < fb.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
                            }`}
                          />
                        ))}
                      </div>
                      {fb.comment && <p className="text-sm text-gray-700">{fb.comment}</p>}
                      <p className="text-xs text-gray-500 mt-2">{new Date(fb.date).toLocaleDateString()}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-gray-500 py-4">No feedback yet</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
