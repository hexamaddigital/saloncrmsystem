import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Plus, Loader2, Trash2, Star, Scissors, Sparkles, ClipboardList } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Client, Transaction, Feedback, HealthProfile, HairProfile } from '../lib/types';
import { useAuth } from '../context/AuthContext';

const TREATMENTS = [
  'Hair Cut', 'Hair Colour', 'Facial', 'Manicure',
  'Pedicure', 'Keratin', 'Bluetox', 'Nano Plastia', 'Highlighting',
  'Smoothing', 'Cleanup', 'Pimple Treatment', 'Pigmentation Treatment',
];

function ServiceTag({ label, color }: { label: string; color: 'teal' | 'rose' | 'blue' }) {
  const cls = {
    teal: 'bg-teal-100 text-teal-800 border-teal-200',
    rose: 'bg-rose-100 text-rose-800 border-rose-200',
    blue: 'bg-blue-100 text-blue-800 border-blue-200',
  }[color];
  return (
    <span className={`px-2.5 py-1 text-xs font-medium rounded-full border ${cls}`}>{label}</span>
  );
}

function professionLabel(p: string) {
  return { housewife: 'Housewife', business: 'Business', working_professional: 'Working Professional' }[p] ?? p;
}

function serviceTypeLabel(s: string) {
  return { hair: 'Hair', skin: 'Skin', hair_and_skin: 'Hair & Skin' }[s] ?? s;
}

export function ClientProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [client, setClient] = useState<Client | null>(null);
  const [health, setHealth] = useState<HealthProfile | null>(null);
  const [hair, setHair] = useState<HairProfile | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);

  const [showAddTreatment, setShowAddTreatment] = useState(false);
  const [treatmentForm, setTreatmentForm] = useState({ treatment_name: '', price: '', notes: '' });

  const [showAddFeedback, setShowAddFeedback] = useState(false);
  const [feedbackForm, setFeedbackForm] = useState({ rating: '5', comment: '' });

  useEffect(() => {
    if (id) fetchData();
  }, [id]);

  async function fetchData() {
    try {
      const { data: clientData, error: clientError } = await supabase
        .from('clients').select('*').eq('id', id).maybeSingle();
      if (clientError) throw clientError;
      setClient(clientData);

      if (clientData) {
        const [{ data: healthData }, { data: hairData }, { data: transData }, { data: feedbackData }] =
          await Promise.all([
            supabase.from('health_profiles').select('*').eq('client_id', id).maybeSingle(),
            supabase.from('hair_profiles').select('*').eq('client_id', id).maybeSingle(),
            supabase.from('transactions').select('*').eq('client_id', id).order('date', { ascending: false }),
            supabase.from('feedback').select('*').eq('client_id', id).order('date', { ascending: false }),
          ]);

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
        date: new Date().toISOString(),
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
        date: new Date().toISOString(),
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
          <button onClick={() => navigate('/dashboard')}
            className="mt-4 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700">
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const hairItems = (client.service_items || []).filter(i =>
    ['Hair Cut', 'Hair Colour', 'Smoothing', 'Highlight'].includes(i) || (i.startsWith('Custom:') && client.service_type !== 'skin')
  );
  const skinItems = (client.service_items || []).filter(i =>
    ['Cleanup', 'Facial', 'Pimple Treatment', 'Pigmentation Treatment'].includes(i) || (i.startsWith('Custom:') && client.service_type === 'skin')
  );
  // For hair_and_skin, show all items together since we can't always differentiate custom
  const allItems = client.service_items || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/Image_logo.png" alt="Image Skinn & Hair" className="h-10 w-auto object-contain" />
            <h1 className="text-xl font-bold text-gray-900">{client.name}</h1>
          </div>
          <button onClick={() => navigate('/dashboard')} className="p-2 hover:bg-gray-100 rounded-lg transition">
            <ChevronLeft className="w-6 h-6 text-gray-600" />
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* LEFT COLUMN */}
          <div className="lg:col-span-2 space-y-6">

            {/* Basic Information */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Basic Information</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-gray-500 text-xs uppercase tracking-wide">Phone</p>
                  <p className="text-gray-900 font-medium mt-0.5">{client.phone}</p>
                </div>
                {client.dob && (
                  <div>
                    <p className="text-gray-500 text-xs uppercase tracking-wide">Date of Birth</p>
                    <p className="text-gray-900 font-medium mt-0.5">
                      {new Date(client.dob + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                )}
                {!client.dob && client.age && (
                  <div>
                    <p className="text-gray-500 text-xs uppercase tracking-wide">Age</p>
                    <p className="text-gray-900 font-medium mt-0.5">{client.age}</p>
                  </div>
                )}
                {client.gender && (
                  <div>
                    <p className="text-gray-500 text-xs uppercase tracking-wide">Gender</p>
                    <p className="text-gray-900 font-medium mt-0.5 capitalize">{client.gender}</p>
                  </div>
                )}
                {client.profession && (
                  <div>
                    <p className="text-gray-500 text-xs uppercase tracking-wide">Profession</p>
                    <p className="text-gray-900 font-medium mt-0.5">{professionLabel(client.profession)}</p>
                  </div>
                )}
                {client.blood_group && (
                  <div>
                    <p className="text-gray-500 text-xs uppercase tracking-wide">Blood Group</p>
                    <p className="text-gray-900 font-medium mt-0.5">{client.blood_group}</p>
                  </div>
                )}
              </div>
              {client.address && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-gray-500 text-xs uppercase tracking-wide">Address</p>
                  <p className="text-gray-900 mt-0.5">{client.address}</p>
                </div>
              )}
              {client.notes && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-gray-500 text-xs uppercase tracking-wide">Notes</p>
                  <p className="text-gray-900 mt-0.5">{client.notes}</p>
                </div>
              )}
            </div>

            {/* Services & Cosmo Medico */}
            {(client.service_type || allItems.length > 0 || client.hair_conditions?.length ||
              client.oral_medication || client.skin_allergies || client.home_care) && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center gap-2 mb-5">
                  <ClipboardList className="w-5 h-5 text-teal-600" />
                  <h2 className="text-lg font-bold text-gray-900">Service & Cosmo Medico Profile</h2>
                </div>

                {/* Service Type badge */}
                {client.service_type && (
                  <div className="mb-4">
                    <p className="text-gray-500 text-xs uppercase tracking-wide mb-2">Service Type</p>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 text-white text-sm font-semibold rounded-lg">
                      {client.service_type !== 'skin' && <Scissors className="w-3.5 h-3.5" />}
                      {client.service_type !== 'hair' && <Sparkles className="w-3.5 h-3.5" />}
                      {serviceTypeLabel(client.service_type)}
                    </span>
                  </div>
                )}

                {/* Selected Services */}
                {allItems.length > 0 && (
                  <div className="mb-4">
                    <p className="text-gray-500 text-xs uppercase tracking-wide mb-2">Selected Services</p>
                    {client.service_type === 'hair_and_skin' ? (
                      <div className="space-y-2">
                        {hairItems.length > 0 && (
                          <div>
                            <p className="text-xs text-teal-700 font-medium mb-1.5 flex items-center gap-1">
                              <Scissors className="w-3 h-3" /> Hair
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {hairItems.map(item => <ServiceTag key={item} label={item} color="teal" />)}
                            </div>
                          </div>
                        )}
                        {skinItems.length > 0 && (
                          <div>
                            <p className="text-xs text-rose-700 font-medium mb-1.5 flex items-center gap-1">
                              <Sparkles className="w-3 h-3" /> Skin
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {skinItems.map(item => <ServiceTag key={item} label={item} color="rose" />)}
                            </div>
                          </div>
                        )}
                        {/* Any custom items not matched above */}
                        {allItems.filter(i => !hairItems.includes(i) && !skinItems.includes(i)).map(item => (
                          <ServiceTag key={item} label={item} color="teal" />
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {allItems.map(item => (
                          <ServiceTag key={item} label={item}
                            color={client.service_type === 'skin' ? 'rose' : 'teal'} />
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Cosmo Medico — Skin */}
                {(client.oral_medication || client.skin_allergies || client.home_care) && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <p className="text-xs text-rose-700 font-semibold uppercase tracking-wide mb-3 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> Skin — Cosmo Medico
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {client.oral_medication && (
                        <div className="bg-rose-50 rounded-lg p-3">
                          <p className="text-xs text-rose-600 font-medium">Oral Medication</p>
                          <p className="text-gray-900 text-sm mt-1">{client.oral_medication}</p>
                        </div>
                      )}
                      {client.skin_allergies && (
                        <div className="bg-rose-50 rounded-lg p-3">
                          <p className="text-xs text-rose-600 font-medium">Allergies</p>
                          <p className="text-gray-900 text-sm mt-1">{client.skin_allergies}</p>
                        </div>
                      )}
                      {client.home_care && (
                        <div className="bg-rose-50 rounded-lg p-3">
                          <p className="text-xs text-rose-600 font-medium">Home Care</p>
                          <p className="text-gray-900 text-sm mt-1">{client.home_care}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Cosmo Medico — Hair */}
                {client.hair_conditions && client.hair_conditions.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <p className="text-xs text-teal-700 font-semibold uppercase tracking-wide mb-3 flex items-center gap-1">
                      <Scissors className="w-3 h-3" /> Hair Conditions — Cosmo Medico
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {client.hair_conditions.map(cond => (
                        <ServiceTag key={cond} label={cond} color="blue" />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Legacy health_profiles / hair_profiles (backward compat) */}
            {health && (health.allergies || health.special_requirements) && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Health & Safety</h2>
                {health.allergies && (
                  <div className="mb-3">
                    <p className="text-gray-500 text-xs uppercase tracking-wide">Allergies</p>
                    <p className="text-gray-900 mt-0.5">{health.allergies}</p>
                  </div>
                )}
                {health.special_requirements && (
                  <div>
                    <p className="text-gray-500 text-xs uppercase tracking-wide">Special Requirements</p>
                    <p className="text-gray-900 mt-0.5">{health.special_requirements}</p>
                  </div>
                )}
              </div>
            )}

            {hair && (hair.hair_problems?.length > 0 || hair.hair_texture?.length > 0 || hair.health_issues?.length > 0) && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Hair & Health Profile</h2>
                {hair.hair_problems?.length > 0 && (
                  <div className="mb-4">
                    <p className="text-gray-500 text-xs uppercase tracking-wide mb-2">Hair Problems</p>
                    <div className="flex flex-wrap gap-1.5">
                      {hair.hair_problems.map(p => <ServiceTag key={p} label={p} color="blue" />)}
                    </div>
                  </div>
                )}
                {hair.hair_texture?.length > 0 && (
                  <div className="mb-4">
                    <p className="text-gray-500 text-xs uppercase tracking-wide mb-2">Hair Texture</p>
                    <div className="flex flex-wrap gap-1.5">
                      {hair.hair_texture.map(t => <ServiceTag key={t} label={t} color="teal" />)}
                    </div>
                  </div>
                )}
                {hair.health_issues?.length > 0 && (
                  <div>
                    <p className="text-gray-500 text-xs uppercase tracking-wide mb-2">Health Issues</p>
                    <div className="flex flex-wrap gap-1.5">
                      {hair.health_issues.map(i => <ServiceTag key={i} label={i} color="rose" />)}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Treatment History */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900">Treatment History</h2>
                <button onClick={() => setShowAddTreatment(true)}
                  className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-lg transition flex items-center gap-1">
                  <Plus className="w-4 h-4" /> Add Treatment
                </button>
              </div>

              {showAddTreatment && (
                <form onSubmit={handleAddTreatment} className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="space-y-3">
                    <select
                      value={treatmentForm.treatment_name}
                      onChange={e => setTreatmentForm(prev => ({ ...prev, treatment_name: e.target.value }))}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition text-sm">
                      <option value="">Select treatment</option>
                      {TREATMENTS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <input type="number" placeholder="Price (₹)"
                      value={treatmentForm.price}
                      onChange={e => setTreatmentForm(prev => ({ ...prev, price: e.target.value }))}
                      required step="0.01" min="0"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition text-sm" />
                    <textarea placeholder="Notes (optional)"
                      value={treatmentForm.notes}
                      onChange={e => setTreatmentForm(prev => ({ ...prev, notes: e.target.value }))}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition text-sm" />
                    <div className="flex gap-2">
                      <button type="submit"
                        className="flex-1 px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-lg transition text-sm">
                        Save Treatment
                      </button>
                      <button type="button" onClick={() => setShowAddTreatment(false)}
                        className="flex-1 px-3 py-2 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition text-sm">
                        Cancel
                      </button>
                    </div>
                  </div>
                </form>
              )}

              <div className="space-y-2">
                {transactions.length > 0 ? (
                  transactions.map(trans => (
                    <div key={trans.id}
                      className="flex items-start justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-gray-300 transition">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 text-sm">{trans.treatment_name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          ₹{Number(trans.price).toFixed(2)} &bull;&nbsp;
                          {new Date(trans.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                        {trans.notes && <p className="text-xs text-gray-600 mt-1">{trans.notes}</p>}
                      </div>
                      {isAdmin && (
                        <button onClick={() => handleDeleteTransaction(trans.id)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition ml-2 flex-shrink-0">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-center text-gray-500 text-sm py-6">No treatments recorded yet</p>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900">Feedback</h2>
                <button onClick={() => setShowAddFeedback(true)}
                  className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-lg transition flex items-center gap-1">
                  <Plus className="w-4 h-4" /> Add
                </button>
              </div>

              {showAddFeedback && (
                <form onSubmit={handleAddFeedback} className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium text-gray-700 block mb-2">Rating</label>
                      <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map(r => (
                          <button key={r} type="button"
                            onClick={() => setFeedbackForm(prev => ({ ...prev, rating: r.toString() }))}
                            className={`w-9 h-9 rounded-lg font-semibold transition text-sm ${
                              parseInt(feedbackForm.rating) >= r ? 'bg-yellow-400 text-white' : 'bg-gray-200 text-gray-700'
                            }`}>
                            {r}
                          </button>
                        ))}
                      </div>
                    </div>
                    <textarea placeholder="Comment (optional)"
                      value={feedbackForm.comment}
                      onChange={e => setFeedbackForm(prev => ({ ...prev, comment: e.target.value }))}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition text-sm" />
                    <div className="flex gap-2">
                      <button type="submit"
                        className="flex-1 px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-lg transition text-sm">
                        Save
                      </button>
                      <button type="button" onClick={() => setShowAddFeedback(false)}
                        className="flex-1 px-3 py-2 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition text-sm">
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
                      <div className="flex items-center gap-0.5 mb-1.5">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} className={`w-4 h-4 ${i < fb.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} />
                        ))}
                      </div>
                      {fb.comment && <p className="text-sm text-gray-700">{fb.comment}</p>}
                      <p className="text-xs text-gray-400 mt-1.5">
                        {new Date(fb.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-gray-500 text-sm py-4">No feedback yet</p>
                )}
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
