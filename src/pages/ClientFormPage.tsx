import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

const HAIR_SERVICES = ['Hair Cut', 'Hair Colour', 'Smoothing', 'Highlight', 'Custom'];
const SKIN_SERVICES = ['Cleanup', 'Facial', 'Pimple Treatment', 'Pigmentation Treatment', 'Custom'];

const HAIR_CONDITIONS = [
  'Lack of Hair Volume', 'Hair Thinning', 'Excessive Hair Fall',
  'Scalp Visibility', 'Receding Hairline', 'Receding Corners',
  'Dandruff', 'Sensitive Scalp', 'Allergic Scalp', 'Alopecia Areata',
  'Side Effects of Hair Colour on Scalp', 'Hair Length Reduction',
];

interface FormData {
  name: string;
  phone: string;
  dob: string;
  gender: string;
  profession: string;
  address: string;
  notes: string;
  service_type: string;
  service_items: string[];
  oral_medication: string;
  skin_allergies: string;
  home_care: string;
  hair_conditions: string[];
}

function toggleItem(arr: string[], item: string): string[] {
  return arr.includes(item) ? arr.filter(i => i !== item) : [...arr, item];
}

export function ClientFormPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const prefilledPhone = (location.state?.phone || '') as string;

  const [form, setForm] = useState<FormData>({
    name: '',
    phone: prefilledPhone,
    dob: '',
    gender: '',
    profession: '',
    address: '',
    notes: '',
    service_type: '',
    service_items: [],
    oral_medication: '',
    skin_allergies: '',
    home_care: '',
    hair_conditions: [],
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  }

  function handleServiceTypeChange(value: string) {
    setForm(prev => ({
      ...prev,
      service_type: prev.service_type === value ? '' : value,
      service_items: [],
      oral_medication: '',
      skin_allergies: '',
      home_care: '',
      hair_conditions: [],
    }));
  }

  function toggleServiceItem(item: string) {
    setForm(prev => ({ ...prev, service_items: toggleItem(prev.service_items, item) }));
  }

  function toggleHairCondition(item: string) {
    setForm(prev => ({ ...prev, hair_conditions: toggleItem(prev.hair_conditions, item) }));
  }

  const showHair = form.service_type === 'hair' || form.service_type === 'hair_and_skin';
  const showSkin = form.service_type === 'skin' || form.service_type === 'hair_and_skin';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (!form.name.trim()) throw new Error('Name is required');
      if (!form.phone.trim()) throw new Error('Phone is required');
      if (!/^\d{10}$/.test(form.phone.trim())) throw new Error('Phone number must be exactly 10 digits');

      const { data, error: insertError } = await supabase
        .from('clients')
        .insert({
          name: form.name.trim(),
          phone: form.phone.trim(),
          dob: form.dob || null,
          gender: form.gender || null,
          profession: form.profession || null,
          address: form.address || null,
          notes: form.notes || null,
          service_type: form.service_type || null,
          service_items: form.service_items.length > 0 ? form.service_items : null,
          oral_medication: form.oral_medication || null,
          skin_allergies: form.skin_allergies || null,
          home_care: form.home_care || null,
          hair_conditions: form.hair_conditions.length > 0 ? form.hair_conditions : null,
        })
        .select()
        .single();

      if (insertError) {
        if (insertError.code === '23505') throw new Error('Phone number already exists');
        throw insertError;
      }

      navigate(`/clients/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create client');
    } finally {
      setLoading(false);
    }
  }

  const inputCls = 'w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition text-sm';
  const labelCls = 'block text-sm font-medium text-gray-700 mb-1.5';
  const sectionCls = 'bg-gray-50 border border-gray-200 rounded-xl p-5 space-y-4';
  const pillBase = 'px-3 py-1.5 rounded-full text-sm border transition font-medium';

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/Image_logo.png" alt="Image Skinn & Hair" className="h-10 w-auto object-contain" />
            <h1 className="text-xl font-bold text-gray-900">Add New Client</h1>
          </div>
          <button onClick={() => navigate('/dashboard')} className="p-2 hover:bg-gray-100 rounded-lg transition">
            <ChevronLeft className="w-6 h-6 text-gray-600" />
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-6">

            {/* Basic Information */}
            <div className={sectionCls}>
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Basic Information</h2>

              <div>
                <label className={labelCls}>Name *</label>
                <input type="text" name="name" value={form.name} onChange={handleChange}
                  placeholder="Client full name" required className={inputCls} />
              </div>

              <div>
                <label className={labelCls}>Phone *</label>
                <input type="tel" name="phone" value={form.phone} onChange={handleChange}
                  placeholder="10-digit phone number" required className={inputCls} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Date of Birth</label>
                  <input type="date" name="dob" value={form.dob} onChange={handleChange}
                    max={new Date().toISOString().split('T')[0]} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Gender</label>
                  <select name="gender" value={form.gender} onChange={handleChange} className={inputCls}>
                    <option value="">Select</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Profession</label>
                  <select name="profession" value={form.profession} onChange={handleChange} className={inputCls}>
                    <option value="">Select</option>
                    <option value="housewife">Housewife</option>
                    <option value="business">Business</option>
                    <option value="working_professional">Working Professional</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Address</label>
                  <input type="text" name="address" value={form.address} onChange={handleChange}
                    placeholder="Address" className={inputCls} />
                </div>
              </div>

              <div>
                <label className={labelCls}>Notes</label>
                <textarea name="notes" value={form.notes} onChange={handleChange}
                  placeholder="Any additional notes..." rows={2} className={inputCls} />
              </div>
            </div>

            {/* Service Type */}
            <div className={sectionCls}>
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Service Type</h2>

              <div className="grid grid-cols-3 gap-3">
                {[
                  { value: 'hair', label: 'Hair' },
                  { value: 'skin', label: 'Skin' },
                  { value: 'hair_and_skin', label: 'Hair & Skin' },
                ].map(opt => (
                  <button key={opt.value} type="button"
                    onClick={() => handleServiceTypeChange(opt.value)}
                    className={`py-2.5 rounded-lg text-sm font-semibold border-2 transition ${
                      form.service_type === opt.value
                        ? 'bg-teal-600 text-white border-teal-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-teal-400'
                    }`}>
                    {opt.label}
                  </button>
                ))}
              </div>

              {showHair && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Hair Services</p>
                  <div className="flex flex-wrap gap-2">
                    {HAIR_SERVICES.map(item => (
                      <button key={item} type="button" onClick={() => toggleServiceItem(item)}
                        className={`${pillBase} ${
                          form.service_items.includes(item)
                            ? 'bg-teal-600 text-white border-teal-600'
                            : 'bg-white text-gray-700 border-gray-300 hover:border-teal-400'
                        }`}>
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {showSkin && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Skin Services</p>
                  <div className="flex flex-wrap gap-2">
                    {SKIN_SERVICES.map(item => (
                      <button key={item} type="button" onClick={() => toggleServiceItem(item)}
                        className={`${pillBase} ${
                          form.service_items.includes(item)
                            ? 'bg-rose-600 text-white border-rose-600'
                            : 'bg-white text-gray-700 border-gray-300 hover:border-rose-400'
                        }`}>
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Cosmo Medico History */}
            {(showSkin || showHair) && (
              <div className={sectionCls}>
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Cosmo Medico History</h2>

                {showSkin && (
                  <div className="space-y-3">
                    <p className="text-sm font-semibold text-rose-700">Skin</p>
                    <div>
                      <label className={labelCls}>Any Oral Medication</label>
                      <input type="text" name="oral_medication" value={form.oral_medication}
                        onChange={handleChange} placeholder="e.g. Isotretinoin, antibiotics..." className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Any Allergies</label>
                      <input type="text" name="skin_allergies" value={form.skin_allergies}
                        onChange={handleChange} placeholder="e.g. Dust, pollen, fragrance..." className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Home Care</label>
                      <input type="text" name="home_care" value={form.home_care}
                        onChange={handleChange} placeholder="e.g. Moisturizer, sunscreen..." className={inputCls} />
                    </div>
                  </div>
                )}

                {showHair && (
                  <div className="space-y-3">
                    <p className="text-sm font-semibold text-teal-700">Hair Conditions</p>
                    <div className="flex flex-wrap gap-2">
                      {HAIR_CONDITIONS.map(item => (
                        <button key={item} type="button" onClick={() => toggleHairCondition(item)}
                          className={`${pillBase} ${
                            form.hair_conditions.includes(item)
                              ? 'bg-teal-600 text-white border-teal-600'
                              : 'bg-white text-gray-700 border-gray-300 hover:border-teal-400'
                          }`}>
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => navigate('/dashboard')}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition text-sm">
                Cancel
              </button>
              <button type="submit" disabled={loading}
                className="flex-1 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition flex items-center justify-center gap-2 text-sm">
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</> : 'Create Client'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
