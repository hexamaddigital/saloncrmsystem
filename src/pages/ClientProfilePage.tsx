import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ChevronLeft, Plus, Loader2, Trash2, Star,
  Scissors, Sparkles, ClipboardList, Pencil, X, Check,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Client, Transaction, Feedback, HealthProfile, HairProfile } from '../lib/types';
import { useAuth } from '../context/AuthContext';

// ─── Constants ───────────────────────────────────────────────────────────────

const TREATMENTS = [
  'Hair Cut', 'Hair Colour', 'Facial', 'Manicure',
  'Pedicure', 'Keratin', 'Bluetox', 'Nano Plastia', 'Highlighting',
  'Smoothing', 'Cleanup', 'Pimple Treatment', 'Pigmentation Treatment',
];

const HAIR_SERVICES = ['Hair Cut', 'Hair Colour', 'Smoothing', 'Highlight'];
const SKIN_SERVICES = ['Cleanup', 'Facial', 'Pimple Treatment', 'Pigmentation Treatment'];

const HAIR_CONDITIONS = [
  'Lack of Hair Volume', 'Hair Thinning', 'Excessive Hair Fall',
  'Scalp Visibility', 'Receding Hairline', 'Receding Corners',
  'Dandruff', 'Sensitive Scalp', 'Allergic Scalp', 'Alopecia Areata',
  'Side Effects of Hair Colour on Scalp', 'Hair Length Reduction',
];

// ─── Small helpers ────────────────────────────────────────────────────────────

function professionLabel(p: string) {
  return ({ housewife: 'Housewife', business: 'Business', working_professional: 'Working Professional' } as Record<string, string>)[p] ?? p;
}
function serviceTypeLabel(s: string) {
  return ({ hair: 'Hair', skin: 'Skin', hair_and_skin: 'Hair & Skin' } as Record<string, string>)[s] ?? s;
}
function toggleArr(arr: string[], item: string) {
  return arr.includes(item) ? arr.filter(i => i !== item) : [...arr, item];
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-gray-500 text-xs uppercase tracking-wide">{label}</p>
      <p className="text-gray-900 font-medium mt-0.5">{value}</p>
    </div>
  );
}

function ServiceTag({ label, color }: { label: string; color: 'teal' | 'rose' | 'blue' }) {
  const cls = { teal: 'bg-teal-100 text-teal-800 border-teal-200', rose: 'bg-rose-100 text-rose-800 border-rose-200', blue: 'bg-blue-100 text-blue-800 border-blue-200' }[color];
  return <span className={`px-2.5 py-1 text-xs font-medium rounded-full border ${cls}`}>{label}</span>;
}

function SectionHeader({ title, icon, editing, onEdit, onSave, onCancel, saving }: {
  title: string; icon: React.ReactNode;
  editing: boolean; onEdit: () => void; onSave: () => void; onCancel: () => void; saving?: boolean;
}) {
  return (
    <div className="flex items-center justify-between mb-5">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="text-lg font-bold text-gray-900">{title}</h2>
      </div>
      {!editing ? (
        <button onClick={onEdit}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-teal-700 hover:bg-teal-50 border border-gray-200 hover:border-teal-300 rounded-lg transition">
          <Pencil className="w-3.5 h-3.5" /> Edit
        </button>
      ) : (
        <div className="flex items-center gap-2">
          <button onClick={onCancel} disabled={saving}
            className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 border border-gray-200 rounded-lg transition disabled:opacity-50">
            <X className="w-3.5 h-3.5" /> Cancel
          </button>
          <button onClick={onSave} disabled={saving}
            className="flex items-center gap-1 px-3 py-1.5 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition disabled:opacity-60 shadow-sm">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            Save
          </button>
        </div>
      )}
    </div>
  );
}

function FieldInput({ label, name, value, onChange, type = 'text', placeholder }: {
  label: string; name: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string; placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</label>
      <input type={type} name={name} value={value} onChange={onChange} placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition bg-white" />
    </div>
  );
}

function FieldSelect({ label, name, value, onChange, options }: {
  label: string; name: string; value: string; onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="block text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</label>
      <select name={name} value={value} onChange={onChange}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition bg-white">
        <option value="">— Select —</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function ChipToggle({ label, active, color, onClick }: {
  label: string; active: boolean; color: 'teal' | 'rose'; onClick: () => void;
}) {
  const on = color === 'teal' ? 'bg-teal-600 text-white border-teal-600' : 'bg-rose-600 text-white border-rose-600';
  const hover = color === 'teal' ? 'hover:border-teal-400' : 'hover:border-rose-400';
  return (
    <button type="button" onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-sm border font-medium transition ${active ? on : `bg-white text-gray-700 border-gray-300 ${hover}`}`}>
      {label}
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface BasicEdit {
  name: string; phone: string; dob: string; gender: string;
  profession: string; address: string; notes: string;
}

interface ServiceEdit {
  service_type: string;
  service_items: string[];
  custom_text: string;
  oral_medication: string; skin_allergies: string; home_care: string;
  hair_conditions: string[];
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

  // Basic info edit state
  const [editingBasic, setEditingBasic] = useState(false);
  const [basicForm, setBasicForm] = useState<BasicEdit>({ name: '', phone: '', dob: '', gender: '', profession: '', address: '', notes: '' });
  const [basicError, setBasicError] = useState('');
  const [savingBasic, setSavingBasic] = useState(false);

  // Service edit state
  const [editingService, setEditingService] = useState(false);
  const [serviceForm, setServiceForm] = useState<ServiceEdit>({
    service_type: '', service_items: [], custom_text: '',
    oral_medication: '', skin_allergies: '', home_care: '', hair_conditions: [],
  });
  const [serviceError, setServiceError] = useState('');
  const [savingService, setSavingService] = useState(false);

  // Treatment / feedback forms
  const [showAddTreatment, setShowAddTreatment] = useState(false);
  const [treatmentForm, setTreatmentForm] = useState({ treatment_name: '', price: '', notes: '' });
  const [showAddFeedback, setShowAddFeedback] = useState(false);
  const [feedbackForm, setFeedbackForm] = useState({ rating: '5', comment: '' });

  useEffect(() => { if (id) fetchData(); }, [id]);

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

  // ── Basic info edit ──

  function startEditBasic() {
    if (!client) return;
    setBasicForm({
      name: client.name ?? '',
      phone: client.phone ?? '',
      dob: client.dob ?? '',
      gender: client.gender ?? '',
      profession: client.profession ?? '',
      address: client.address ?? '',
      notes: client.notes ?? '',
    });
    setBasicError('');
    setEditingBasic(true);
  }

  function cancelEditBasic() {
    setEditingBasic(false);
    setBasicError('');
  }

  async function saveBasic() {
    setBasicError('');
    if (!basicForm.name.trim()) { setBasicError('Name is required'); return; }
    if (!basicForm.phone.trim()) { setBasicError('Phone is required'); return; }
    if (!/^\d{10}$/.test(basicForm.phone.trim())) { setBasicError('Phone must be exactly 10 digits'); return; }

    setSavingBasic(true);
    try {
      const { error } = await supabase.from('clients').update({
        name: basicForm.name.trim(),
        phone: basicForm.phone.trim(),
        dob: basicForm.dob || null,
        gender: basicForm.gender || null,
        profession: basicForm.profession || null,
        address: basicForm.address.trim() || null,
        notes: basicForm.notes.trim() || null,
      }).eq('id', id!);
      if (error) {
        if (error.code === '23505') throw new Error('Phone number already in use');
        throw error;
      }
      await fetchData();
      setEditingBasic(false);
    } catch (err) {
      setBasicError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSavingBasic(false);
    }
  }

  // ── Service edit ──

  function startEditService() {
    if (!client) return;
    const items = client.service_items ?? [];
    // Detect any Custom: … item
    const customItem = items.find(i => i.startsWith('Custom:'));
    const customText = customItem ? customItem.replace(/^Custom:\s*/, '') : '';
    setServiceForm({
      service_type: client.service_type ?? '',
      service_items: items.filter(i => !i.startsWith('Custom:')),
      custom_text: customText,
      oral_medication: client.oral_medication ?? '',
      skin_allergies: client.skin_allergies ?? '',
      home_care: client.home_care ?? '',
      hair_conditions: client.hair_conditions ?? [],
    });
    setServiceError('');
    setEditingService(true);
  }

  function cancelEditService() {
    setEditingService(false);
    setServiceError('');
  }

  async function saveService() {
    setServiceError('');
    setSavingService(true);
    try {
      const items = [...serviceForm.service_items];
      if (serviceForm.custom_text.trim()) items.push(`Custom: ${serviceForm.custom_text.trim()}`);

      const { error } = await supabase.from('clients').update({
        service_type: serviceForm.service_type || null,
        service_items: items.length > 0 ? items : null,
        oral_medication: serviceForm.oral_medication.trim() || null,
        skin_allergies: serviceForm.skin_allergies.trim() || null,
        home_care: serviceForm.home_care.trim() || null,
        hair_conditions: serviceForm.hair_conditions.length > 0 ? serviceForm.hair_conditions : null,
      }).eq('id', id!);
      if (error) throw error;
      await fetchData();
      setEditingService(false);
    } catch (err) {
      setServiceError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSavingService(false);
    }
  }

  function sfChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = e.target;
    setServiceForm(prev => ({ ...prev, [name]: value }));
  }

  function changeServiceType(val: string) {
    setServiceForm(prev => ({
      ...prev,
      service_type: prev.service_type === val ? '' : val,
      service_items: [],
      custom_text: '',
      oral_medication: '',
      skin_allergies: '',
      home_care: '',
      hair_conditions: [],
    }));
  }

  const showHair = serviceForm.service_type === 'hair' || serviceForm.service_type === 'hair_and_skin';
  const showSkin = serviceForm.service_type === 'skin' || serviceForm.service_type === 'hair_and_skin';

  // ── Treatment / feedback ──

  async function handleAddTreatment(e: React.FormEvent) {
    e.preventDefault();
    if (!client) return;
    try {
      await supabase.from('transactions').insert({
        client_id: client.id, treatment_name: treatmentForm.treatment_name,
        price: parseFloat(treatmentForm.price), notes: treatmentForm.notes || null,
        date: new Date().toISOString(),
      });
      setTreatmentForm({ treatment_name: '', price: '', notes: '' });
      setShowAddTreatment(false);
      fetchData();
    } catch (error) { console.error('Error adding treatment:', error); }
  }

  async function handleAddFeedback(e: React.FormEvent) {
    e.preventDefault();
    if (!client) return;
    try {
      await supabase.from('feedback').insert({
        client_id: client.id, rating: parseInt(feedbackForm.rating),
        comment: feedbackForm.comment || null, date: new Date().toISOString(),
      });
      setFeedbackForm({ rating: '5', comment: '' });
      setShowAddFeedback(false);
      fetchData();
    } catch (error) { console.error('Error adding feedback:', error); }
  }

  async function handleDeleteTransaction(transId: string) {
    if (confirm('Delete this transaction?')) {
      await supabase.from('transactions').delete().eq('id', transId);
      fetchData();
    }
  }

  // ── Loading / not found ──

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

  const allItems = client.service_items ?? [];
  const hairItems = allItems.filter(i => HAIR_SERVICES.includes(i) || (i.startsWith('Custom:') && client.service_type !== 'skin'));
  const skinItems = allItems.filter(i => SKIN_SERVICES.includes(i) || (i.startsWith('Custom:') && client.service_type === 'skin'));
  const hasServiceSection = client.service_type || allItems.length > 0
    || (client.hair_conditions?.length ?? 0) > 0
    || client.oral_medication || client.skin_allergies || client.home_care;

  const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition bg-white';

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
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

            {/* ── Basic Information ── */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <SectionHeader
                title="Basic Information"
                icon={<span className="w-5 h-5" />}
                editing={editingBasic}
                onEdit={startEditBasic}
                onSave={saveBasic}
                onCancel={cancelEditBasic}
                saving={savingBasic}
              />

              {editingBasic ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FieldInput label="Name *" name="name" value={basicForm.name}
                      onChange={e => setBasicForm(p => ({ ...p, name: e.target.value }))} placeholder="Full name" />
                    <FieldInput label="Phone *" name="phone" value={basicForm.phone}
                      onChange={e => setBasicForm(p => ({ ...p, phone: e.target.value }))} placeholder="10-digit number" />
                    <FieldInput label="Date of Birth" name="dob" type="date" value={basicForm.dob}
                      onChange={e => setBasicForm(p => ({ ...p, dob: e.target.value }))} />
                    <FieldSelect label="Gender" name="gender" value={basicForm.gender}
                      onChange={e => setBasicForm(p => ({ ...p, gender: e.target.value }))}
                      options={[{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }, { value: 'other', label: 'Other' }]} />
                    <FieldSelect label="Profession" name="profession" value={basicForm.profession}
                      onChange={e => setBasicForm(p => ({ ...p, profession: e.target.value }))}
                      options={[{ value: 'housewife', label: 'Housewife' }, { value: 'business', label: 'Business' }, { value: 'working_professional', label: 'Working Professional' }]} />
                    <FieldInput label="Address" name="address" value={basicForm.address}
                      onChange={e => setBasicForm(p => ({ ...p, address: e.target.value }))} placeholder="Address" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 uppercase tracking-wide mb-1">Notes</label>
                    <textarea name="notes" value={basicForm.notes}
                      onChange={e => setBasicForm(p => ({ ...p, notes: e.target.value }))}
                      rows={2} placeholder="Any notes..."
                      className={inputCls} />
                  </div>
                  {basicError && (
                    <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{basicError}</p>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <InfoRow label="Phone" value={client.phone} />
                  {client.dob && (
                    <InfoRow label="Date of Birth"
                      value={new Date(client.dob + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })} />
                  )}
                  {!client.dob && client.age && <InfoRow label="Age" value={client.age} />}
                  <InfoRow label="Gender" value={client.gender ? client.gender.charAt(0).toUpperCase() + client.gender.slice(1) : undefined} />
                  <InfoRow label="Profession" value={client.profession ? professionLabel(client.profession) : undefined} />
                  {client.blood_group && <InfoRow label="Blood Group" value={client.blood_group} />}
                  {client.address && (
                    <div className="sm:col-span-2 pt-4 border-t border-gray-100">
                      <InfoRow label="Address" value={client.address} />
                    </div>
                  )}
                  {client.notes && (
                    <div className="sm:col-span-2 pt-4 border-t border-gray-100">
                      <InfoRow label="Notes" value={client.notes} />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Service & Cosmo Medico Profile ── */}
            {(hasServiceSection || editingService) && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <SectionHeader
                  title="Service & Cosmo Medico Profile"
                  icon={<ClipboardList className="w-5 h-5 text-teal-600" />}
                  editing={editingService}
                  onEdit={startEditService}
                  onSave={saveService}
                  onCancel={cancelEditService}
                  saving={savingService}
                />

                {editingService ? (
                  <div className="space-y-5">
                    {/* Service Type */}
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Service Type</p>
                      <div className="flex flex-wrap gap-2">
                        {[{ value: 'hair', label: 'Hair' }, { value: 'skin', label: 'Skin' }, { value: 'hair_and_skin', label: 'Hair & Skin' }].map(opt => (
                          <button key={opt.value} type="button" onClick={() => changeServiceType(opt.value)}
                            className={`px-4 py-2 rounded-lg text-sm font-semibold border-2 transition ${
                              serviceForm.service_type === opt.value
                                ? 'bg-teal-600 text-white border-teal-600'
                                : 'bg-white text-gray-700 border-gray-300 hover:border-teal-400'
                            }`}>
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Hair services */}
                    {showHair && (
                      <div>
                        <p className="text-xs text-teal-700 font-semibold uppercase tracking-wide mb-2 flex items-center gap-1">
                          <Scissors className="w-3 h-3" /> Hair Services
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {HAIR_SERVICES.map(item => (
                            <ChipToggle key={item} label={item} color="teal"
                              active={serviceForm.service_items.includes(item)}
                              onClick={() => setServiceForm(p => ({ ...p, service_items: toggleArr(p.service_items, item) }))} />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Skin services */}
                    {showSkin && (
                      <div>
                        <p className="text-xs text-rose-700 font-semibold uppercase tracking-wide mb-2 flex items-center gap-1">
                          <Sparkles className="w-3 h-3" /> Skin Services
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {SKIN_SERVICES.map(item => (
                            <ChipToggle key={item} label={item} color="rose"
                              active={serviceForm.service_items.includes(item)}
                              onClick={() => setServiceForm(p => ({ ...p, service_items: toggleArr(p.service_items, item) }))} />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Custom service */}
                    {serviceForm.service_type && (
                      <div>
                        <label className="block text-xs text-gray-500 uppercase tracking-wide mb-1">Custom Service</label>
                        <input type="text" name="custom_text" value={serviceForm.custom_text} onChange={sfChange}
                          placeholder="e.g. Keratin Repair, Bridal Package..."
                          className={inputCls} />
                      </div>
                    )}

                    {/* Cosmo Medico — Skin */}
                    {showSkin && (
                      <div className="pt-4 border-t border-gray-100 space-y-3">
                        <p className="text-xs text-rose-700 font-semibold uppercase tracking-wide flex items-center gap-1">
                          <Sparkles className="w-3 h-3" /> Skin — Cosmo Medico
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <FieldInput label="Oral Medication" name="oral_medication" value={serviceForm.oral_medication}
                            onChange={sfChange} placeholder="e.g. Isotretinoin..." />
                          <FieldInput label="Allergies" name="skin_allergies" value={serviceForm.skin_allergies}
                            onChange={sfChange} placeholder="e.g. Dust, pollen..." />
                          <FieldInput label="Home Care" name="home_care" value={serviceForm.home_care}
                            onChange={sfChange} placeholder="e.g. Moisturizer..." />
                        </div>
                      </div>
                    )}

                    {/* Cosmo Medico — Hair */}
                    {showHair && (
                      <div className="pt-4 border-t border-gray-100 space-y-3">
                        <p className="text-xs text-teal-700 font-semibold uppercase tracking-wide flex items-center gap-1">
                          <Scissors className="w-3 h-3" /> Hair Conditions — Cosmo Medico
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {HAIR_CONDITIONS.map(item => (
                            <ChipToggle key={item} label={item} color="teal"
                              active={serviceForm.hair_conditions.includes(item)}
                              onClick={() => setServiceForm(p => ({ ...p, hair_conditions: toggleArr(p.hair_conditions, item) }))} />
                          ))}
                        </div>
                      </div>
                    )}

                    {serviceError && (
                      <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{serviceError}</p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Service Type badge */}
                    {client.service_type && (
                      <div>
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
                      <div>
                        <p className="text-gray-500 text-xs uppercase tracking-wide mb-2">Selected Services</p>
                        {client.service_type === 'hair_and_skin' ? (
                          <div className="space-y-2">
                            {hairItems.length > 0 && (
                              <div>
                                <p className="text-xs text-teal-700 font-medium mb-1.5 flex items-center gap-1">
                                  <Scissors className="w-3 h-3" /> Hair
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                  {hairItems.map(i => <ServiceTag key={i} label={i} color="teal" />)}
                                </div>
                              </div>
                            )}
                            {skinItems.length > 0 && (
                              <div>
                                <p className="text-xs text-rose-700 font-medium mb-1.5 flex items-center gap-1">
                                  <Sparkles className="w-3 h-3" /> Skin
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                  {skinItems.map(i => <ServiceTag key={i} label={i} color="rose" />)}
                                </div>
                              </div>
                            )}
                            {allItems.filter(i => !hairItems.includes(i) && !skinItems.includes(i)).map(i => (
                              <ServiceTag key={i} label={i} color="teal" />
                            ))}
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {allItems.map(i => (
                              <ServiceTag key={i} label={i} color={client.service_type === 'skin' ? 'rose' : 'teal'} />
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Cosmo Medico — Skin */}
                    {(client.oral_medication || client.skin_allergies || client.home_care) && (
                      <div className="pt-4 border-t border-gray-100">
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
                      <div className="pt-4 border-t border-gray-100">
                        <p className="text-xs text-teal-700 font-semibold uppercase tracking-wide mb-3 flex items-center gap-1">
                          <Scissors className="w-3 h-3" /> Hair Conditions — Cosmo Medico
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {client.hair_conditions.map(c => <ServiceTag key={c} label={c} color="blue" />)}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── Add Service section button when none exists yet ── */}
            {!hasServiceSection && !editingService && (
              <button onClick={() => { startEditService(); }}
                className="w-full bg-white rounded-xl shadow-sm border border-dashed border-gray-300 hover:border-teal-400 p-5 text-sm text-gray-500 hover:text-teal-600 transition flex items-center justify-center gap-2">
                <Plus className="w-4 h-4" /> Add Service & Cosmo Medico Profile
              </button>
            )}

            {/* Legacy health_profiles */}
            {health && (health.allergies || health.special_requirements) && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Health & Safety</h2>
                {health.allergies && <InfoRow label="Allergies" value={health.allergies} />}
                {health.special_requirements && <div className="mt-3"><InfoRow label="Special Requirements" value={health.special_requirements} /></div>}
              </div>
            )}

            {/* Legacy hair_profiles */}
            {hair && (hair.hair_problems?.length > 0 || hair.hair_texture?.length > 0 || hair.health_issues?.length > 0) && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Hair & Health Profile</h2>
                {hair.hair_problems?.length > 0 && (
                  <div className="mb-4">
                    <p className="text-gray-500 text-xs uppercase tracking-wide mb-2">Hair Problems</p>
                    <div className="flex flex-wrap gap-1.5">{hair.hair_problems.map(p => <ServiceTag key={p} label={p} color="blue" />)}</div>
                  </div>
                )}
                {hair.hair_texture?.length > 0 && (
                  <div className="mb-4">
                    <p className="text-gray-500 text-xs uppercase tracking-wide mb-2">Hair Texture</p>
                    <div className="flex flex-wrap gap-1.5">{hair.hair_texture.map(t => <ServiceTag key={t} label={t} color="teal" />)}</div>
                  </div>
                )}
                {hair.health_issues?.length > 0 && (
                  <div>
                    <p className="text-gray-500 text-xs uppercase tracking-wide mb-2">Health Issues</p>
                    <div className="flex flex-wrap gap-1.5">{hair.health_issues.map(i => <ServiceTag key={i} label={i} color="rose" />)}</div>
                  </div>
                )}
              </div>
            )}

            {/* ── Treatment History (unchanged behaviour) ── */}
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
                    <select value={treatmentForm.treatment_name}
                      onChange={e => setTreatmentForm(p => ({ ...p, treatment_name: e.target.value }))}
                      required className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition">
                      <option value="">Select treatment</option>
                      {TREATMENTS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <input type="number" placeholder="Price (₹)" value={treatmentForm.price}
                      onChange={e => setTreatmentForm(p => ({ ...p, price: e.target.value }))}
                      required step="0.01" min="0" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition" />
                    <textarea placeholder="Notes (optional)" value={treatmentForm.notes}
                      onChange={e => setTreatmentForm(p => ({ ...p, notes: e.target.value }))}
                      rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition" />
                    <div className="flex gap-2">
                      <button type="submit" className="flex-1 px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-lg transition text-sm">
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
                {transactions.length > 0 ? transactions.map(trans => (
                  <div key={trans.id} className="flex items-start justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-gray-300 transition">
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
                )) : (
                  <p className="text-center text-gray-500 text-sm py-6">No treatments recorded yet</p>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN — Feedback */}
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
                            onClick={() => setFeedbackForm(p => ({ ...p, rating: r.toString() }))}
                            className={`w-9 h-9 rounded-lg font-semibold transition text-sm ${parseInt(feedbackForm.rating) >= r ? 'bg-yellow-400 text-white' : 'bg-gray-200 text-gray-700'}`}>
                            {r}
                          </button>
                        ))}
                      </div>
                    </div>
                    <textarea placeholder="Comment (optional)" value={feedbackForm.comment}
                      onChange={e => setFeedbackForm(p => ({ ...p, comment: e.target.value }))}
                      rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition" />
                    <div className="flex gap-2">
                      <button type="submit" className="flex-1 px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-lg transition text-sm">Save</button>
                      <button type="button" onClick={() => setShowAddFeedback(false)}
                        className="flex-1 px-3 py-2 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition text-sm">Cancel</button>
                    </div>
                  </div>
                </form>
              )}

              <div className="space-y-2">
                {feedback.length > 0 ? feedback.map(fb => (
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
                )) : (
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
