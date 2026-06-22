import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ChevronLeft, Plus, Loader2, Trash2, Star,
  Scissors, Sparkles, ClipboardList, Pencil, X, Check, AlertTriangle, Receipt, ExternalLink,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Client, Transaction, Feedback, HealthProfile, HairProfile, Invoice } from '../lib/types';
import { useAuth } from '../context/AuthContext';

// ─── Constants ───────────────────────────────────────────────────────────────

const HAIR_SERVICE_OPTIONS = [
  'Hair Cut', 'Hair Colour', 'Highlight', 'Smoothing', 'Keratin',
  'Bluetox', 'Nano Plastia', 'Root Touch-up', 'Hair Spa', 'Blow Dry',
];
const SKIN_SERVICE_OPTIONS = [
  'Cleanup', 'Facial', 'Pimple Treatment', 'Pigmentation Treatment',
  'Wax', 'Threading', 'Bleach', 'D-Tan', 'Manicure', 'Pedicure',
];

// Used for filtering stored client service_items in profile display
const HAIR_SERVICES = HAIR_SERVICE_OPTIONS;
const SKIN_SERVICES = SKIN_SERVICE_OPTIONS;

// kept for backward compat with existing select
const TREATMENTS = [
  'Hair Cut', 'Hair Colour', 'Facial', 'Manicure',
  'Pedicure', 'Keratin', 'Bluetox', 'Nano Plastia', 'Highlighting',
  'Smoothing', 'Cleanup', 'Pimple Treatment', 'Pigmentation Treatment',
];

const HAIR_CONDITIONS = [
  'Lack of Hair Volume', 'Hair Thinning', 'Excessive Hair Fall',
  'Scalp Visibility', 'Receding Hairline', 'Receding Corners',
  'Dandruff', 'Sensitive Scalp', 'Allergic Scalp', 'Alopecia Areata',
  'Side Effects of Hair Colour on Scalp', 'Hair Length Reduction',
];

// ─── Small helpers ────────────────────────────────────────────────────────────

function professionLabel(p: string) {
  return ({ housewife: 'Housewife', business: 'Business', working_professional: 'Working Professional', student: 'Student', doctor: 'Doctor (Dr.)' } as Record<string, string>)[p] ?? p;
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
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');

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

  // Delete client state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  // Service entry form (new rich form)
  const [showServiceEntry, setShowServiceEntry] = useState(false);
  const [serviceEntry, setServiceEntry] = useState({
    service_category: 'hair' as 'hair' | 'skin' | 'hair_and_skin' | 'custom',
    treatment_name: '',
    custom_name: '',
    price: '',
    staff_name: '',
    notes: '',
    date: new Date().toISOString().split('T')[0],
    payment_status: 'paid' as 'paid' | 'pending' | 'partial',
    payment_method: 'Cash',
  });
  const [serviceEntryError, setServiceEntryError] = useState('');
  const [serviceEntrySaving, setServiceEntrySaving] = useState(false);
  const [serviceEntryEditId, setServiceEntryEditId] = useState<string | null>(null);

  // Legacy form (kept for backward compat — hidden, replaced by above)
  const [showAddTreatment, setShowAddTreatment] = useState(false);
  const [treatmentForm, setTreatmentForm] = useState({ treatment_name: '', price: '', notes: '' });
  const [showAddFeedback, setShowAddFeedback] = useState(false);
  const [feedbackForm, setFeedbackForm] = useState({ rating: '5', comment: '' });

  useEffect(() => { if (id) fetchData(); }, [id]);

  async function fetchData() {
    setFetchError('');
    try {
      const { data: clientData, error: clientError } = await supabase
        .from('clients').select('*').eq('id', id).maybeSingle();
      if (clientError) throw clientError;
      setClient(clientData);

      if (clientData) {
        const [{ data: healthData }, { data: hairData }, { data: transData }, { data: feedbackData }, { data: invoiceData }] =
          await Promise.all([
            supabase.from('health_profiles').select('*').eq('client_id', id).maybeSingle(),
            supabase.from('hair_profiles').select('*').eq('client_id', id).maybeSingle(),
            supabase.from('transactions').select('*').eq('client_id', id).order('date', { ascending: false }),
            supabase.from('feedback').select('*').eq('client_id', id).order('date', { ascending: false }),
            supabase.from('invoices').select('*').eq('client_id', id).order('invoice_date', { ascending: false }),
          ]);
        setHealth(healthData);
        setHair(hairData);
        setTransactions(transData || []);
        setFeedback(feedbackData || []);
        setInvoices(invoiceData || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      setFetchError(error instanceof Error ? error.message : 'Failed to load client data');
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

  // ── Service Entry (rich form) ──

  function openNewServiceEntry() {
    setServiceEntryEditId(null);
    setServiceEntry({
      service_category: 'hair',
      treatment_name: '',
      custom_name: '',
      price: '',
      staff_name: '',
      notes: '',
      date: new Date().toISOString().split('T')[0],
      payment_status: 'paid',
      payment_method: 'Cash',
    });
    setServiceEntryError('');
    setShowServiceEntry(true);
  }

  function openEditServiceEntry(tx: Transaction) {
    setServiceEntryEditId(tx.id);
    setServiceEntry({
      service_category: (tx.service_category as 'hair' | 'skin' | 'hair_and_skin' | 'custom') || 'custom',
      treatment_name: tx.treatment_name,
      custom_name: '',
      price: String(tx.price),
      staff_name: tx.staff_name || '',
      notes: tx.notes || '',
      date: tx.date ? tx.date.split('T')[0] : new Date().toISOString().split('T')[0],
      payment_status: (tx.payment_status as 'paid' | 'pending' | 'partial') || 'paid',
      payment_method: tx.payment_method || 'Cash',
    });
    setServiceEntryError('');
    setShowServiceEntry(true);
  }

  async function handleSaveServiceEntry() {
    if (!client) return;
    const finalName = serviceEntry.service_category === 'custom'
      ? serviceEntry.custom_name.trim()
      : serviceEntry.treatment_name.trim();
    if (!finalName) { setServiceEntryError('Service name is required'); return; }
    if (!serviceEntry.price || parseFloat(serviceEntry.price) < 0) { setServiceEntryError('Enter a valid price'); return; }

    setServiceEntrySaving(true);
    setServiceEntryError('');
    try {
      const payload = {
        client_id:        client.id,
        treatment_name:   finalName,
        service_category: serviceEntry.service_category,
        price:            parseFloat(serviceEntry.price),
        staff_name:       serviceEntry.staff_name.trim() || null,
        notes:            serviceEntry.notes.trim() || null,
        date:             new Date(serviceEntry.date + 'T' + new Date().toTimeString().slice(0, 8)).toISOString(),
        payment_status:   serviceEntry.payment_status,
        payment_method:   serviceEntry.payment_method,
        discount:         0,
      };

      if (serviceEntryEditId) {
        const { error } = await supabase.from('transactions').update(payload).eq('id', serviceEntryEditId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('transactions').insert(payload);
        if (error) throw error;
      }

      setShowServiceEntry(false);
      setServiceEntryEditId(null);
      fetchData();
    } catch (err) {
      setServiceEntryError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setServiceEntrySaving(false);
    }
  }

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

  // ── Delete client (admin only) ──

  async function handleDeleteClient() {
    if (!client || !isAdmin) return;
    setDeleting(true);
    try {
      // Delete related records first, then the client
      await Promise.all([
        supabase.from('transactions').delete().eq('client_id', client.id),
        supabase.from('feedback').delete().eq('client_id', client.id),
        supabase.from('health_profiles').delete().eq('client_id', client.id),
        supabase.from('hair_profiles').delete().eq('client_id', client.id),
      ]);
      const { error } = await supabase.from('clients').delete().eq('id', client.id);
      if (error) throw error;
      navigate('/dashboard');
    } catch (err) {
      console.error('Error deleting client:', err);
      setDeleting(false);
    }
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
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <p className="text-gray-800 font-semibold text-lg mb-1">
            {fetchError ? 'Failed to load profile' : 'Client not found'}
          </p>
          {fetchError && <p className="text-gray-500 text-sm mb-4">{fetchError}</p>}
          <div className="flex gap-2 justify-center mt-4">
            {fetchError && (
              <button onClick={() => { setLoading(true); fetchData(); }}
                className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-semibold text-sm">
                Retry
              </button>
            )}
            <button onClick={() => navigate(-1)}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-semibold text-sm">
              Go Back
            </button>
          </div>
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
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              {client.name}
              {client.is_golden && (
                <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-bold rounded-full border border-amber-300">★ VIP</span>
              )}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {/* Golden / VIP toggle (admin only) */}
            {isAdmin && client && (
              <button
                onClick={async () => {
                  const newVal = !client.is_golden;
                  await supabase.from('clients').update({ is_golden: newVal }).eq('id', client.id);
                  setClient(prev => prev ? { ...prev, is_golden: newVal } : prev);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border transition ${client.is_golden ? 'bg-amber-100 text-amber-700 border-amber-300 hover:bg-amber-50' : 'text-gray-500 hover:text-amber-600 hover:bg-amber-50 border-gray-200 hover:border-amber-300'}`}
                title={client.is_golden ? 'Remove VIP status' : 'Mark as VIP'}
              >
                <span className="text-base leading-none">{client.is_golden ? '★' : '☆'}</span>
                <span className="hidden sm:inline">{client.is_golden ? 'VIP' : 'Mark VIP'}</span>
              </button>
            )}
            {isAdmin && (
              <button
                onClick={() => { setDeleteConfirmText(''); setShowDeleteModal(true); }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200 hover:border-red-300 rounded-lg transition"
                title="Delete Client Profile"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Delete Client</span>
              </button>
            )}
            <button onClick={() => navigate('/dashboard')} className="p-2 hover:bg-gray-100 rounded-lg transition">
              <ChevronLeft className="w-6 h-6 text-gray-600" />
            </button>
          </div>
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
                      options={[
                        { value: 'housewife', label: 'Housewife' },
                        { value: 'business', label: 'Business' },
                        { value: 'working_professional', label: 'Working Professional' },
                        { value: 'student', label: 'Student' },
                        { value: 'doctor', label: 'Doctor (Dr.)' },
                      ]} />
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

            {/* ── Service History ── */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Service History</h2>
                  {transactions.length > 0 && (
                    <p className="text-xs text-gray-400 mt-0.5">{transactions.length} visit{transactions.length !== 1 ? 's' : ''} recorded</p>
                  )}
                </div>
                <button
                  onClick={openNewServiceEntry}
                  className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-xl transition shadow-sm shadow-teal-600/20">
                  <Plus className="w-4 h-4" /> New Service Entry
                </button>
              </div>

              {/* ── Service Entry Modal/Drawer ── */}
              {showServiceEntry && (
                <div className="mb-6 bg-gradient-to-br from-teal-50 to-gray-50 border-2 border-teal-200 rounded-2xl p-5 space-y-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-gray-900 flex items-center gap-2">
                      <ClipboardList className="w-4 h-4 text-teal-600" />
                      {serviceEntryEditId ? 'Edit Service Entry' : 'New Service Entry'}
                    </h3>
                    <button onClick={() => { setShowServiceEntry(false); setServiceEntryEditId(null); }}
                      className="p-1.5 hover:bg-gray-200 rounded-lg transition">
                      <X className="w-4 h-4 text-gray-500" />
                    </button>
                  </div>

                  {/* Service category tabs */}
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Service Type</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {([
                        { v: 'hair',         label: '✂ Hair',       cls: 'teal' },
                        { v: 'skin',         label: '✦ Skin',       cls: 'rose' },
                        { v: 'hair_and_skin',label: '✂✦ Hair & Skin', cls: 'blue' },
                        { v: 'custom',       label: '★ Custom',     cls: 'amber' },
                      ] as const).map(opt => (
                        <button key={opt.v} type="button"
                          onClick={() => setServiceEntry(p => ({ ...p, service_category: opt.v, treatment_name: '' }))}
                          className={`py-2 px-3 rounded-xl text-xs font-semibold border-2 transition ${
                            serviceEntry.service_category === opt.v
                              ? opt.cls === 'teal'  ? 'bg-teal-600 text-white border-teal-600'
                              : opt.cls === 'rose'  ? 'bg-rose-600 text-white border-rose-600'
                              : opt.cls === 'blue'  ? 'bg-blue-600 text-white border-blue-600'
                              :                       'bg-amber-500 text-white border-amber-500'
                              : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                          }`}>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Service name — quick-pick chips + optional free text */}
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Treatment / Service Name</p>
                    {serviceEntry.service_category === 'hair' && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {HAIR_SERVICE_OPTIONS.map(s => (
                          <button key={s} type="button"
                            onClick={() => setServiceEntry(p => ({ ...p, treatment_name: s }))}
                            className={`px-2.5 py-1 text-xs rounded-full border font-medium transition ${
                              serviceEntry.treatment_name === s
                                ? 'bg-teal-600 text-white border-teal-600'
                                : 'bg-white text-teal-700 border-teal-200 hover:bg-teal-50'
                            }`}>{s}</button>
                        ))}
                      </div>
                    )}
                    {serviceEntry.service_category === 'skin' && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {SKIN_SERVICE_OPTIONS.map(s => (
                          <button key={s} type="button"
                            onClick={() => setServiceEntry(p => ({ ...p, treatment_name: s }))}
                            className={`px-2.5 py-1 text-xs rounded-full border font-medium transition ${
                              serviceEntry.treatment_name === s
                                ? 'bg-rose-600 text-white border-rose-600'
                                : 'bg-white text-rose-700 border-rose-200 hover:bg-rose-50'
                            }`}>{s}</button>
                        ))}
                      </div>
                    )}
                    {serviceEntry.service_category === 'hair_and_skin' && (
                      <div className="space-y-2 mb-2">
                        <div>
                          <p className="text-xs text-teal-700 font-medium mb-1">✂ Hair</p>
                          <div className="flex flex-wrap gap-1.5">
                            {HAIR_SERVICE_OPTIONS.map(s => (
                              <button key={s} type="button"
                                onClick={() => setServiceEntry(p => ({ ...p, treatment_name: s }))}
                                className={`px-2.5 py-1 text-xs rounded-full border font-medium transition ${
                                  serviceEntry.treatment_name === s
                                    ? 'bg-teal-600 text-white border-teal-600'
                                    : 'bg-white text-teal-700 border-teal-200 hover:bg-teal-50'
                                }`}>{s}</button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="text-xs text-rose-700 font-medium mb-1">✦ Skin</p>
                          <div className="flex flex-wrap gap-1.5">
                            {SKIN_SERVICE_OPTIONS.map(s => (
                              <button key={s} type="button"
                                onClick={() => setServiceEntry(p => ({ ...p, treatment_name: s }))}
                                className={`px-2.5 py-1 text-xs rounded-full border font-medium transition ${
                                  serviceEntry.treatment_name === s
                                    ? 'bg-rose-600 text-white border-rose-600'
                                    : 'bg-white text-rose-700 border-rose-200 hover:bg-rose-50'
                                }`}>{s}</button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {serviceEntry.service_category === 'custom' ? (
                      <input type="text" placeholder="Enter custom service name *"
                        value={serviceEntry.custom_name}
                        onChange={e => setServiceEntry(p => ({ ...p, custom_name: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition bg-white" />
                    ) : (
                      <input type="text" placeholder="Or type a custom name..."
                        value={serviceEntry.treatment_name}
                        onChange={e => setServiceEntry(p => ({ ...p, treatment_name: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition bg-white" />
                    )}
                  </div>

                  {/* Price, Date, Staff row */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Price (₹) *</label>
                      <input type="number" min="0" step="0.01" placeholder="0.00"
                        value={serviceEntry.price}
                        onChange={e => setServiceEntry(p => ({ ...p, price: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition bg-white" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Date *</label>
                      <input type="date" value={serviceEntry.date}
                        max={new Date().toISOString().split('T')[0]}
                        onChange={e => setServiceEntry(p => ({ ...p, date: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition bg-white" />
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Staff / Operator</label>
                      <input type="text" placeholder="Who performed this?"
                        value={serviceEntry.staff_name}
                        onChange={e => setServiceEntry(p => ({ ...p, staff_name: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition bg-white" />
                    </div>
                  </div>

                  {/* Payment */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Payment Method</label>
                      <select value={serviceEntry.payment_method}
                        onChange={e => setServiceEntry(p => ({ ...p, payment_method: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition bg-white">
                        <option value="Cash">Cash</option>
                        <option value="UPI">UPI</option>
                        <option value="Card">Card</option>
                        <option value="Online">Online Transfer</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Payment Status</label>
                      <select value={serviceEntry.payment_status}
                        onChange={e => setServiceEntry(p => ({ ...p, payment_status: e.target.value as 'paid' | 'pending' | 'partial' }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition bg-white">
                        <option value="paid">Paid</option>
                        <option value="partial">Partial</option>
                        <option value="pending">Pending</option>
                      </select>
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Treatment Notes</label>
                    <textarea rows={2} placeholder="Products used, observations, next visit recommendations..."
                      value={serviceEntry.notes}
                      onChange={e => setServiceEntry(p => ({ ...p, notes: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition bg-white resize-none" />
                  </div>

                  {serviceEntryError && (
                    <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-center gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />{serviceEntryError}
                    </p>
                  )}

                  <div className="flex gap-2 pt-1">
                    <button type="button" onClick={() => { setShowServiceEntry(false); setServiceEntryEditId(null); }}
                      disabled={serviceEntrySaving}
                      className="flex-1 px-3 py-2.5 border border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition text-sm disabled:opacity-50">
                      Cancel
                    </button>
                    <button type="button" onClick={handleSaveServiceEntry}
                      disabled={serviceEntrySaving}
                      className="flex-1 px-3 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl transition text-sm disabled:bg-gray-400 flex items-center justify-center gap-2 shadow-sm">
                      {serviceEntrySaving
                        ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
                        : <><Check className="w-4 h-4" /> {serviceEntryEditId ? 'Update Entry' : 'Save Entry'}</>}
                    </button>
                  </div>
                </div>
              )}

              {/* ── History list ── */}
              <div className="space-y-2">
                {transactions.length > 0 ? transactions.map((trans, idx) => (
                  <div key={trans.id}
                    className={`rounded-xl border transition ${idx === 0 ? 'border-teal-200 bg-teal-50/60' : 'border-gray-200 bg-gray-50/60 hover:border-gray-300'}`}>
                    <div className="flex items-start gap-3 p-3.5">
                      {/* Category icon badge */}
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-base ${
                        trans.service_category === 'skin' ? 'bg-rose-100 text-rose-700' :
                        trans.service_category === 'hair_and_skin' ? 'bg-blue-100 text-blue-700' :
                        trans.service_category === 'custom' ? 'bg-amber-100 text-amber-700' :
                        'bg-teal-100 text-teal-700'
                      }`}>
                        {trans.service_category === 'skin' ? '✦' :
                         trans.service_category === 'hair_and_skin' ? '✂' :
                         trans.service_category === 'custom' ? '★' : '✂'}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold text-gray-900 text-sm">{trans.treatment_name}</p>
                              {idx === 0 && (
                                <span className="text-xs bg-teal-600 text-white px-1.5 py-0.5 rounded font-medium leading-none">Latest</span>
                              )}
                              {trans.payment_status === 'pending' && (
                                <span className="text-xs bg-red-100 text-red-700 border border-red-200 px-1.5 py-0.5 rounded font-medium leading-none">Pending</span>
                              )}
                              {trans.payment_status === 'partial' && (
                                <span className="text-xs bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded font-medium leading-none">Partial</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <span className="text-xs text-gray-500">
                                {new Date(trans.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </span>
                              {trans.staff_name && (
                                <span className="text-xs text-gray-400">· by {trans.staff_name}</span>
                              )}
                              {trans.payment_method && (
                                <span className="text-xs text-gray-400">· {trans.payment_method}</span>
                              )}
                              {trans.service_category && (
                                <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full border capitalize ${
                                  trans.service_category === 'skin' ? 'bg-rose-50 text-rose-600 border-rose-200' :
                                  trans.service_category === 'hair_and_skin' ? 'bg-blue-50 text-blue-600 border-blue-200' :
                                  trans.service_category === 'custom' ? 'bg-amber-50 text-amber-600 border-amber-200' :
                                  'bg-teal-50 text-teal-600 border-teal-200'
                                }`}>{trans.service_category.replace('_', ' & ')}</span>
                              )}
                            </div>
                            {trans.notes && (
                              <p className="text-xs text-gray-600 mt-1 bg-white/70 rounded px-2 py-1 border border-gray-100">{trans.notes}</p>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-bold text-gray-900 text-sm">₹{Number(trans.price).toLocaleString('en-IN')}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    {/* Admin actions */}
                    {isAdmin && (
                      <div className="flex border-t border-gray-200/80 divide-x divide-gray-200/80">
                        <button
                          onClick={() => openEditServiceEntry(trans)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs text-gray-500 hover:text-teal-700 hover:bg-teal-50/50 transition rounded-bl-xl">
                          <Pencil className="w-3 h-3" /> Edit
                        </button>
                        <button
                          onClick={() => handleDeleteTransaction(trans.id)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs text-gray-500 hover:text-red-600 hover:bg-red-50/50 transition rounded-br-xl">
                          <Trash2 className="w-3 h-3" /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                )) : (
                  <div className="text-center py-10">
                    <div className="w-14 h-14 rounded-full bg-teal-50 flex items-center justify-center mx-auto mb-3">
                      <ClipboardList className="w-7 h-7 text-teal-400" />
                    </div>
                    <p className="text-gray-500 text-sm font-medium">No service entries yet</p>
                    <p className="text-gray-400 text-xs mt-1">Click "New Service Entry" to record this client's first visit</p>
                  </div>
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

            {/* ── Billing History ── */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-teal-600" />
                  Billing History
                </h2>
                <button
                  onClick={() => navigate('/billing', { state: { clientId: id } })}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-lg transition">
                  <Plus className="w-3.5 h-3.5" /> New Bill
                </button>
              </div>

              {invoices.length > 0 ? (
                <div className="space-y-2">
                  {invoices.map(inv => (
                    <div key={inv.id} className="p-3 bg-gray-50 rounded-xl border border-gray-200 hover:border-teal-200 transition">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-teal-700">{inv.invoice_number}</span>
                            <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${
                              inv.payment_status === 'paid' ? 'bg-green-100 text-green-700' :
                              inv.payment_status === 'partial' ? 'bg-amber-100 text-amber-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                              {inv.payment_status.charAt(0).toUpperCase() + inv.payment_status.slice(1)}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {new Date(inv.invoice_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            {inv.payment_method ? ` · ${inv.payment_method}` : ''}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-bold text-gray-900 text-sm">₹{Number(inv.total).toLocaleString('en-IN')}</p>
                          {inv.payment_status !== 'paid' && (
                            <p className="text-xs text-red-600 font-medium">
                              Due ₹{(Number(inv.total) - Number(inv.amount_paid)).toLocaleString('en-IN')}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={() => navigate('/billing')}
                    className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-teal-700 hover:text-teal-900 font-medium transition">
                    <ExternalLink className="w-3.5 h-3.5" /> View all in Billing
                  </button>
                </div>
              ) : (
                <div className="text-center py-6">
                  <Receipt className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">No invoices yet</p>
                  <button
                    onClick={() => navigate('/billing', { state: { clientId: id } })}
                    className="mt-3 inline-flex items-center gap-1.5 text-teal-700 font-semibold text-xs hover:text-teal-900 transition">
                    <Plus className="w-3.5 h-3.5" /> Create first invoice
                  </button>
                </div>
              )}
            </div>
          </div>

        </div>
      </main>

      {/* ── Delete Client Confirmation Modal (Admin only) ── */}
      {showDeleteModal && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => !deleting && setShowDeleteModal(false)}
          />
          {/* Modal */}
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-fade-in">
            <div className="flex items-start gap-4 mb-5">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Delete Client Profile</h3>
                <p className="text-sm text-gray-600 mt-1">
                  This will permanently delete <span className="font-semibold text-gray-900">{client.name}</span>'s
                  profile, all treatment history, and all related records. This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="mb-5">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Type <span className="font-bold text-red-600">DELETE</span> to confirm
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={e => setDeleteConfirmText(e.target.value)}
                placeholder="Type DELETE"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition"
                disabled={deleting}
                autoFocus
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition text-sm disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteClient}
                disabled={deleteConfirmText !== 'DELETE' || deleting}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition text-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {deleting ? <><Loader2 className="w-4 h-4 animate-spin" /> Deleting...</> : <><Trash2 className="w-4 h-4" /> Delete Permanently</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
