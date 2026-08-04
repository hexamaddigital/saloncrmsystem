import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Plus, ArrowLeft, Eye, Trash2, X, Search, ChevronLeft, ChevronRight,
  MessageCircle, Printer, Loader2, Receipt, CheckCircle2, AlertCircle,
  User, Phone, Tag, ChevronDown, ChevronUp, RefreshCw, Download,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import type { Invoice, InvoiceItem, Client, Transaction } from '../lib/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const ITEMS_PER_PAGE = 20;

const HAIR_SERVICES = ['Hair Cut', 'Hair Colour', 'Smoothing', 'Keratin', 'Highlight', 'Bluetox', 'Nano Plastia', 'Root Touch-up', 'Hair Spa'];
const SKIN_SERVICES = ['Cleanup', 'Facial', 'Pimple Treatment', 'Pigmentation Treatment', 'Wax', 'Threading', 'Bleach', 'D-Tan'];
const CUSTOM_SERVICES: string[] = [];

type ServiceCategory = 'hair' | 'skin' | 'hair_and_skin' | 'custom';
type PaymentStatus   = 'paid' | 'pending' | 'partial';

interface LineItem {
  id: string;
  service_name: string;
  category: ServiceCategory | '';
  quantity: number;
  unit_price: number;
  item_discount: number;
  staff_name: string;
}

function newLine(): LineItem {
  return { id: crypto.randomUUID(), service_name: '', category: '', quantity: 1, unit_price: 0, item_discount: 0, staff_name: '' };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function statusBadge(s: PaymentStatus) {
  const map: Record<PaymentStatus, string> = {
    paid:    'bg-green-100 text-green-800 border-green-200',
    pending: 'bg-red-100 text-red-800 border-red-200',
    partial: 'bg-amber-100 text-amber-800 border-amber-200',
  };
  return map[s] ?? 'bg-white/40 text-gray-700';
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── WhatsApp helper ──────────────────────────────────────────────────────────
// Normalises an Indian phone number to E.164 (+91XXXXXXXXXX).
// wa.me links require the full international number — without +91 they silently
// fail on mobile or open the wrong contact.
function buildWhatsAppUrl(rawPhone: string, message: string): string {
  // Strip everything that isn't a digit
  let digits = rawPhone.replace(/\D/g, '');
  // If it's already 12 digits starting with 91, trust it
  // If it's 10 digits (Indian mobile), prepend 91
  if (digits.length === 10) digits = '91' + digits;
  // If someone stored it as +91XXXXXXXXXX (11–12 digits with leading 0s) normalise
  if (digits.startsWith('0')) digits = digits.slice(1);
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

// ─── PDF / Print helper ───────────────────────────────────────────────────────
// Opens a NEW browser window containing a complete self-contained HTML invoice.
// This is the only reliable cross-browser approach:
//   • No React DOM / Tailwind CSS interference
//   • No nested-display:none battle
//   • Works on Chrome, Firefox, Safari, Edge, mobile Chrome/Safari
// "Save as PDF" is done via the browser's built-in print → Save as PDF option,
// which the in-popup "Print" button triggers.
function buildInvoiceHTML(inv: Invoice, items: InvoiceItem[], logoUrl: string): string {
  const fmt = (n: number) =>
    Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const statusColorMap: Record<string, string> = {
    paid:    '#15803d',
    pending: '#dc2626',
    partial: '#b45309',
  };
  const statusBgMap: Record<string, string> = {
    paid:    '#f0fdf4',
    pending: '#fef2f2',
    partial: '#fffbeb',
  };

  const itemRows = items.map(it => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #f3f4f6;">
        <span style="font-weight:600;color:#111827;">${it.service_name}</span>
      </td>
      <td style="padding:10px 12px;border-bottom:1px solid #f3f4f6;color:#374151;">${it.staff_name || '—'}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #f3f4f6;text-align:center;color:#6b7280;">${it.quantity}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #f3f4f6;text-align:right;color:#374151;">₹${fmt(Number(it.unit_price))}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #f3f4f6;text-align:right;font-weight:700;color:#111827;">₹${fmt(Number(it.total))}</td>
    </tr>`).join('');

  // Split discount into manual discount and coupon discount for clarity
  const couponAmt = Number(inv.coupon_discount) || 0;
  const manualDiscount = Math.max(0, Number(inv.discount) - couponAmt);
  const couponCode = inv.coupon_code || '';

  const manualDiscountRow = manualDiscount > 0
    ? `<tr><td colspan="4" style="padding:5px 14px;text-align:right;color:#6b7280;font-size:13px;">Discount</td><td style="padding:5px 14px;text-align:right;color:#16a34a;font-weight:600;">−₹${fmt(manualDiscount)}</td></tr>`
    : '';
  const couponRow = couponAmt > 0
    ? `<tr><td colspan="4" style="padding:5px 14px;text-align:right;color:#6b7280;font-size:13px;">Coupon Applied: ${couponCode}</td><td style="padding:5px 14px;text-align:right;color:#16a34a;font-weight:600;">−₹${fmt(couponAmt)}</td></tr>`
    : '';
  const taxRow = Number(inv.tax) > 0
    ? `<tr><td colspan="4" style="padding:5px 14px;text-align:right;color:#6b7280;font-size:13px;">Tax</td><td style="padding:5px 14px;text-align:right;color:#374151;">₹${fmt(Number(inv.tax))}</td></tr>`
    : '';

  const amountPaid = Number(inv.amount_paid) || 0;
  const balanceDue = Math.max(0, Number(inv.total) - amountPaid);
  // Always show Amount Paid & Balance Due; for fully paid invoices balance is 0
  const paymentBreakdownBlock = `
    <div style="margin-top:16px;padding:14px 16px;background:${inv.payment_status === 'paid' ? '#f0fdf4' : '#fef2f2'};border:1px solid ${inv.payment_status === 'paid' ? '#bbf7d0' : '#fecaca'};border-radius:10px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
        <span style="color:#6b7280;font-size:13px;">Amount Paid</span>
        <strong style="color:#111827;">₹${fmt(amountPaid)}</strong>
      </div>
      <div style="display:flex;justify-content:space-between;">
        <span style="color:${balanceDue > 0 ? '#dc2626' : '#15803d'};font-weight:700;font-size:13px;">Balance Due</span>
        <strong style="color:${balanceDue > 0 ? '#dc2626' : '#15803d'};font-size:15px;">₹${fmt(balanceDue)}</strong>
      </div>
    </div>`;

  const notesBlock = inv.notes ? `
    <div style="margin-top:16px;padding:14px 16px;background:#fffbeb;border:1px solid #fde68a;border-radius:10px;">
      <p style="font-size:11px;color:#92400e;font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin:0 0 6px;">Notes</p>
      <p style="font-size:13px;color:#374151;margin:0;">${inv.notes}</p>
    </div>` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Invoice ${inv.invoice_number} — Image Skinn &amp; Hair</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0;}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:13px;color:#111827;background:#fff;}
    .page{max-width:640px;margin:0 auto;padding:36px 32px;}
    h1{font-size:22px;font-weight:800;letter-spacing:-.5px;}
    table{width:100%;border-collapse:collapse;}
    th{font-size:11px;text-transform:uppercase;letter-spacing:.05em;font-weight:700;}
    .btn{display:inline-flex;align-items:center;gap:6px;padding:10px 22px;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;border:none;text-decoration:none;}
    @media print{
      .no-print{display:none!important;}
      body{background:#fff;}
      .page{padding:20px;}
    }
  </style>
</head>
<body>
<div class="page">

  <!-- Salon header -->
  <div style="text-align:center;padding-bottom:20px;border-bottom:3px solid #0d9488;margin-bottom:24px;">
    <img src="${logoUrl}" alt="Image Skinn & Hair" style="height:64px;width:auto;margin:0 auto 8px;display:block;object-fit:contain;" onerror="this.style.display='none'"/>
    <h1 style="color:#111827;">Image Skinn &amp; Hair</h1>
    <p style="color:#6b7280;font-size:12px;margin-top:5px;">Premium Salon &amp; Hair Care</p>
    <p style="color:#9ca3af;font-size:11px;margin-top:2px;">Tax Invoice</p>
  </div>

  <!-- Invoice meta -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;gap:16px;">
    <div>
      <p style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;font-weight:600;">Invoice No.</p>
      <p style="font-size:20px;font-weight:800;color:#0d9488;margin-top:3px;">${inv.invoice_number}</p>
    </div>
    <div style="text-align:right;">
      <p style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;font-weight:600;">Date</p>
      <p style="font-size:14px;font-weight:700;color:#111827;margin-top:3px;">${fmtDate(inv.invoice_date)}</p>
    </div>
  </div>

  <!-- Client details -->
  <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:16px;margin-bottom:24px;">
    <p style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;font-weight:700;margin-bottom:10px;">Bill To</p>
    <p style="font-size:16px;font-weight:800;color:#111827;">${inv.client_name}</p>
    <p style="color:#6b7280;margin-top:5px;font-size:13px;">📞 ${inv.client_phone}</p>
  </div>

  <!-- Services table -->
  <div style="border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;margin-bottom:20px;">
    <table>
      <thead>
        <tr style="background:#0d9488;">
          <th style="padding:11px 12px;text-align:left;color:#fff;">Service</th>
          <th style="padding:11px 12px;text-align:left;color:#fff;">Staff</th>
          <th style="padding:11px 12px;text-align:center;color:#fff;">Qty</th>
          <th style="padding:11px 12px;text-align:right;color:#fff;">Rate</th>
          <th style="padding:11px 12px;text-align:right;color:#fff;">Total</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>
  </div>

  <!-- Totals -->
  <div style="display:flex;justify-content:flex-end;margin-bottom:20px;">
    <div style="min-width:260px;">
      <table>
        <tr><td colspan="4" style="padding:5px 14px;text-align:right;color:#6b7280;font-size:13px;">Subtotal</td><td style="padding:5px 14px;text-align:right;color:#374151;">₹${fmt(Number(inv.subtotal))}</td></tr>
        ${manualDiscountRow}${couponRow}${taxRow}
        <tr>
          <td colspan="4" style="padding:12px 14px;text-align:right;font-weight:800;font-size:15px;color:#111827;border-top:2px solid #0d9488;">Grand Total</td>
          <td style="padding:12px 14px;text-align:right;font-weight:800;font-size:18px;color:#0d9488;border-top:2px solid #0d9488;">₹${fmt(Number(inv.total))}</td>
        </tr>
      </table>
    </div>
  </div>

  <!-- Payment info -->
  <div style="background:${statusBgMap[inv.payment_status] ?? '#f9fafb'};border:1px solid #e5e7eb;border-radius:12px;padding:16px;margin-bottom:4px;">
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
      <div>
        <p style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;font-weight:700;margin-bottom:5px;">Payment Method</p>
        <p style="font-size:14px;font-weight:700;color:#111827;">${inv.payment_method || '—'}</p>
      </div>
      <div style="text-align:right;">
        <p style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;font-weight:700;margin-bottom:5px;">Status</p>
        <span style="display:inline-block;padding:4px 12px;border-radius:999px;font-size:12px;font-weight:800;color:#fff;background:${statusColorMap[inv.payment_status] ?? '#6b7280'};">
          ${inv.payment_status.charAt(0).toUpperCase() + inv.payment_status.slice(1)}
        </span>
      </div>
    </div>
  </div>

  ${paymentBreakdownBlock}
  ${notesBlock}

  <!-- Footer -->
  <p style="text-align:center;font-size:12px;color:#9ca3af;margin-top:28px;padding-top:16px;border-top:1px solid #e5e7eb;">
    Thank you for visiting Image Skinn &amp; Hair! ✨<br>
    <span style="font-size:11px;">Please keep this invoice for your records.</span>
  </p>

  <!-- Action buttons (hidden when printing) -->
  <div class="no-print" style="text-align:center;margin-top:28px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
    <button class="btn" onclick="window.print()" style="background:#0d9488;color:#fff;">
      🖨 Print / Save as PDF
    </button>
    <button class="btn" onclick="window.close()" style="background:#f3f4f6;color:#374151;border:1px solid #d1d5db;">
      ✕ Close
    </button>
  </div>

</div>
</body>
</html>`;
}

function openInvoicePrintWindow(inv: Invoice, items: InvoiceItem[]) {
  const logoUrl = `${window.location.origin}/Image_logo.png`;
  const html = buildInvoiceHTML(inv, items, logoUrl);
  const win = window.open('', '_blank', 'width=760,height=960,scrollbars=yes,resizable=yes,menubar=no,toolbar=no');
  if (!win) {
    // Fallback: try without window features (some browsers block popups with features)
    const win2 = window.open('', '_blank');
    if (!win2) {
      alert('Popup blocked.\n\nTo generate the PDF:\n1. Allow popups for this site in your browser settings\n2. Try again');
      return;
    }
    win2.document.open();
    win2.document.write(html);
    win2.document.close();
    win2.focus();
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
}


// ─── Main Component ───────────────────────────────────────────────────────────

export function BillingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  // ── List state ──
  const [invoices, setInvoices]         = useState<Invoice[]>([]);
  const [listLoading, setListLoading]   = useState(true);
  const [searchQuery, setSearchQuery]   = useState('');
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | 'all'>('all');
  const [dateFilter, setDateFilter]     = useState<'today' | 'week' | 'month' | 'all'>('all');
  const [currentPage, setCurrentPage]   = useState(1);

  // ── Stats ──
  const [todayRevenue, setTodayRevenue]   = useState(0);
  const [monthRevenue, setMonthRevenue]   = useState(0);
  const [pendingAmt, setPendingAmt]       = useState(0);

  // ── Create modal ──
  const [showCreate, setShowCreate]       = useState(false);
  // Step 1 = client search, Step 2 = bill form
  const [createStep, setCreateStep]       = useState<1 | 2>(1);

  // Client search inside modal
  const [searchMode, setSearchMode]       = useState<'phone' | 'name'>('phone');
  const [clientQuery, setClientQuery]     = useState('');
  const [clientResults, setClientResults] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientHistory, setClientHistory] = useState<Transaction[]>([]);
  const [clientSearching, setClientSearching] = useState(false);
  const [showHistory, setShowHistory]     = useState(false);

  // Bill form
  const [lineItems, setLineItems]         = useState<LineItem[]>([newLine()]);
  const [billDiscount, setBillDiscount]   = useState(0);
  const [couponCode, setCouponCode]       = useState('');
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponMsg, setCouponMsg]         = useState('');
  const [couponChecking, setCouponChecking] = useState(false);
  const [taxPercent, setTaxPercent]       = useState(0);
  const [payMethod, setPayMethod]         = useState('Cash');
  const [payStatus, setPayStatus]         = useState<PaymentStatus>('paid');
  const [amountPaid, setAmountPaid]       = useState(0);
  const [billNotes, setBillNotes]         = useState('');
  const [submitting, setSubmitting]       = useState(false);
  const [submitError, setSubmitError]     = useState('');

  // ── View modal ──
  const [showView, setShowView]           = useState(false);
  const [viewInvoice, setViewInvoice]     = useState<Invoice | null>(null);
  const [viewItems, setViewItems]         = useState<InvoiceItem[]>([]);
  const [viewLoading, setViewLoading]     = useState(false);

  // Pre-select client if navigated from profile
  useEffect(() => {
    if (location.state?.clientId) {
      loadClientById(location.state.clientId);
    }
  }, [location.state]);

  // ── Data fetching ──
  const fetchInvoices = useCallback(async () => {
    setListLoading(true);
    try {
      const { data, error } = await supabase
        .from('invoices').select('*').order('invoice_date', { ascending: false });
      if (error) throw error;
      setInvoices(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setListLoading(false);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const today     = new Date(); today.setHours(0, 0, 0, 0);
      const mStart    = new Date(today.getFullYear(), today.getMonth(), 1);
      const [{ data: td }, { data: mo }, { data: pnd }] = await Promise.all([
        supabase.from('invoices').select('total').eq('payment_status','paid').gte('invoice_date', today.toISOString()),
        supabase.from('invoices').select('total').eq('payment_status','paid').gte('invoice_date', mStart.toISOString()),
        supabase.from('invoices').select('total,amount_paid').in('payment_status',['pending','partial']),
      ]);
      setTodayRevenue(td?.reduce((s, i) => s + Number(i.total), 0) ?? 0);
      setMonthRevenue(mo?.reduce((s, i) => s + Number(i.total), 0) ?? 0);
      setPendingAmt(pnd?.reduce((s, i) => s + (Number(i.total) - Number(i.amount_paid)), 0) ?? 0);
    } catch (err) { console.error(err); }
  }, [isAdmin]);

  useEffect(() => {
    fetchInvoices();
    fetchStats();
  }, [fetchInvoices, fetchStats]);

  // ── Client search ──
  async function searchClient() {
    const q = clientQuery.trim();
    if (!q) return;
    setClientSearching(true);
    setClientResults([]);
    try {
      let query = supabase.from('clients').select('*');
      if (searchMode === 'phone') {
        query = query.eq('phone', q);
      } else {
        query = query.ilike('name', `%${q}%`).limit(10);
      }
      const { data } = await query;
      setClientResults(data || []);
    } finally {
      setClientSearching(false);
    }
  }

  async function loadClientById(clientId: string) {
    const { data } = await supabase.from('clients').select('*').eq('id', clientId).maybeSingle();
    if (data) {
      await selectClient(data);
      setShowCreate(true);
    }
  }

  async function selectClient(c: Client) {
    setSelectedClient(c);
    setClientQuery(c.name);
    setClientResults([]);
    // load recent history
    const { data } = await supabase
      .from('transactions').select('*').eq('client_id', c.id)
      .order('date', { ascending: false }).limit(5);
    setClientHistory(data || []);
    setCreateStep(2);
  }

  // ── Coupon check ──
  async function applyCoupon() {
    const code = couponCode.trim().toUpperCase();
    if (!code) return;
    setCouponChecking(true);
    setCouponMsg('');
    try {
      const { data, error } = await supabase
        .from('coupons')
        .select('*')
        .eq('code', code)
        .eq('is_active', true)
        .maybeSingle();
      if (error || !data) { setCouponMsg('Invalid or expired coupon'); setCouponDiscount(0); return; }
      const today = new Date().toISOString().split('T')[0];
      if (data.valid_until && data.valid_until < today) { setCouponMsg('Coupon expired'); setCouponDiscount(0); return; }
      if (data.valid_from && data.valid_from > today) { setCouponMsg('Coupon not yet valid'); setCouponDiscount(0); return; }
      if (data.max_uses && data.uses_count >= data.max_uses) { setCouponMsg('Coupon usage limit reached'); setCouponDiscount(0); return; }

      // Calculate discount
      const sub = lineItems.reduce((s, i) => s + Math.max(0, i.quantity * i.unit_price - i.item_discount), 0);
      if (data.min_amount && sub < data.min_amount) {
        setCouponMsg(`Min bill of ₹${data.min_amount} required`); setCouponDiscount(0); return;
      }
      const disc = data.discount_type === 'percentage'
        ? Math.round((sub * data.discount_value) / 100)
        : data.discount_value;
      setCouponDiscount(disc);
      setCouponMsg(`Coupon applied! ₹${disc} off`);
    } finally { setCouponChecking(false); }
  }

  // ── Calculations ──
  const subtotal = useMemo(() =>
    lineItems.reduce((s, i) => s + Math.max(0, i.quantity * i.unit_price - i.item_discount), 0),
    [lineItems]);
  const totalDiscount = billDiscount + couponDiscount;
  const taxable       = Math.max(0, subtotal - totalDiscount);
  const taxAmt        = taxable * (taxPercent / 100);
  const grandTotal    = taxable + taxAmt;
  const remaining     = payStatus === 'partial' ? Math.max(0, grandTotal - amountPaid) : 0;

  // ── Line item helpers ──
  function updateLine(id: string, field: keyof LineItem, val: unknown) {
    setLineItems(prev => prev.map(l => l.id === id ? { ...l, [field]: val } : l));
  }
  function addLine() { setLineItems(prev => [...prev, newLine()]); }
  function removeLine(id: string) {
    if (lineItems.length > 1) setLineItems(prev => prev.filter(l => l.id !== id));
  }

  function quickAddService(name: string, category: ServiceCategory) {
    // If last line is empty, fill it; otherwise add new
    const last = lineItems[lineItems.length - 1];
    if (!last.service_name) {
      updateLine(last.id, 'service_name', name);
      updateLine(last.id, 'category', category);
    } else {
      setLineItems(prev => [...prev, { ...newLine(), service_name: name, category }]);
    }
  }

  // ── Submit ──
  async function handleSubmit() {
    if (!selectedClient) { setSubmitError('Please select a client'); return; }
    const validLines = lineItems.filter(l => l.service_name.trim() && l.unit_price > 0);
    if (validLines.length === 0) { setSubmitError('Add at least one service with a price'); return; }
    if (payStatus === 'partial' && amountPaid <= 0) { setSubmitError('Enter amount paid for partial payment'); return; }
    if (payStatus === 'partial' && amountPaid >= grandTotal) { setSubmitError('Amount paid equals total — use "Paid" status instead'); return; }

    setSubmitting(true);
    setSubmitError('');
    try {
      const { data: numData, error: rpcErr } = await supabase.rpc('next_invoice_number');
      if (rpcErr) throw rpcErr;

      const effectiveAmountPaid = payStatus === 'paid' ? grandTotal : payStatus === 'pending' ? 0 : amountPaid;

      const { data: inv, error: invErr } = await supabase.from('invoices').insert({
        invoice_number: numData,
        client_id:      selectedClient.id,
        client_name:    selectedClient.name,
        client_phone:   selectedClient.phone,
        subtotal,
        discount:       totalDiscount,
        tax:            taxAmt,
        total:          grandTotal,
        payment_method: payMethod,
        payment_status: payStatus,
        amount_paid:    effectiveAmountPaid,
        coupon_code:    couponCode.trim() || null,
        coupon_discount: couponDiscount || null,
        notes:          billNotes.trim() || null,
        invoice_date:   new Date().toISOString(),
        created_by:     user?.id,
      }).select().single();
      if (invErr) throw invErr;

      const itemsToInsert = validLines.map(l => ({
        invoice_id:   inv.id,
        service_name: l.service_name,
        quantity:     l.quantity,
        unit_price:   l.unit_price,
        discount:     l.item_discount,
        total:        Math.max(0, l.quantity * l.unit_price - l.item_discount),
        staff_name:   l.staff_name || null,
      }));
      const { error: itmErr } = await supabase.from('invoice_items').insert(itemsToInsert);
      if (itmErr) throw itmErr;

      // Also record in payments table if not fully pending
      if (payStatus !== 'pending') {
        await supabase.from('payments').insert({
          invoice_id:     inv.id,
          amount:         effectiveAmountPaid,
          payment_method: payMethod,
          payment_date:   new Date().toISOString(),
          created_by:     user?.id,
        });
      }

      // Also record in transactions table for treatment history continuity
      for (const l of validLines) {
        await supabase.from('transactions').insert({
          client_id:       selectedClient.id,
          treatment_name:  l.service_name,
          price:           Math.max(0, l.quantity * l.unit_price - l.item_discount),
          notes:           billNotes.trim() || null,
          date:            new Date().toISOString(),
          staff_name:      l.staff_name || null,
          service_category: l.category || null,
          payment_method:  payMethod,
          payment_status:  payStatus,
        });
      }

      // Increment coupon usage
      if (couponCode.trim() && couponDiscount > 0) {
        await supabase.rpc('increment_coupon_usage', { coupon_code: couponCode.trim().toUpperCase() }).maybeSingle();
      }

      // Open the just-created invoice
      resetCreateForm();
      await fetchInvoices();
      await fetchStats();
      await openInvoice(inv as Invoice);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to create bill');
    } finally { setSubmitting(false); }
  }

  function resetCreateForm() {
    setShowCreate(false);
    setCreateStep(1);
    setSelectedClient(null);
    setClientQuery('');
    setClientResults([]);
    setClientHistory([]);
    setShowHistory(false);
    setLineItems([newLine()]);
    setBillDiscount(0);
    setCouponCode('');
    setCouponDiscount(0);
    setCouponMsg('');
    setTaxPercent(0);
    setPayMethod('Cash');
    setPayStatus('paid');
    setAmountPaid(0);
    setBillNotes('');
    setSubmitError('');
  }

  async function openInvoice(inv: Invoice) {
    setViewLoading(true);
    setViewInvoice(inv);
    setShowView(true);
    try {
      const { data } = await supabase.from('invoice_items').select('*').eq('invoice_id', inv.id);
      setViewItems(data || []);
    } finally { setViewLoading(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this invoice? This cannot be undone.')) return;
    await supabase.from('invoice_items').delete().eq('invoice_id', id);
    await supabase.from('payments').delete().eq('invoice_id', id);
    await supabase.from('invoices').delete().eq('id', id);
    await fetchInvoices();
    await fetchStats();
  }

  // ── Filters ──
  const filtered = useMemo(() => {
    let list = [...invoices];
    if (statusFilter !== 'all') list = list.filter(i => i.payment_status === statusFilter);
    const now = new Date(); now.setHours(0, 0, 0, 0);
    if (dateFilter === 'today')  list = list.filter(i => new Date(i.invoice_date) >= now);
    if (dateFilter === 'week') {
      const ws = new Date(now); ws.setDate(now.getDate() - now.getDay());
      list = list.filter(i => new Date(i.invoice_date) >= ws);
    }
    if (dateFilter === 'month') {
      const ms = new Date(now.getFullYear(), now.getMonth(), 1);
      list = list.filter(i => new Date(i.invoice_date) >= ms);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(i =>
        i.client_name.toLowerCase().includes(q) ||
        i.client_phone.includes(q) ||
        i.invoice_number.toLowerCase().includes(q));
    }
    return list;
  }, [invoices, statusFilter, dateFilter, searchQuery]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated  = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const inputCls = 'w-full px-3 py-2 glass-input rounded-lg text-sm';

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen">

      {/* ── Header ── */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/dashboard')} className="p-2 hover:bg-white/40 rounded-lg transition">
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <img src="/Image_logo.png" alt="Logo" className="h-9 w-auto object-contain" />
            <div>
              <h1 className="text-xl font-bold text-gray-900 leading-tight">Billing</h1>
              <p className="text-xs text-gray-600">Invoices & Payments</p>
            </div>
          </div>
          <button onClick={() => { resetCreateForm(); setShowCreate(true); }}
            className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2.5 rounded-lg transition font-semibold text-sm shadow-md shadow-teal-600/20">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New Bill</span>
            <span className="sm:hidden">New</span>
          </button>
        </div>
      </header>

      {/* ── Stats (admin) ── */}
      {isAdmin && (
        <div className="border-b border-white/30 glass-strong">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-teal-50 to-teal-100 rounded-xl p-5 border border-teal-200">
              <p className="text-teal-600 text-xs font-semibold uppercase tracking-wider">Today's Revenue</p>
              <p className="text-3xl font-bold text-teal-900 mt-1">₹{todayRevenue.toLocaleString('en-IN')}</p>
            </div>
            <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl p-5 border border-amber-200">
              <p className="text-amber-600 text-xs font-semibold uppercase tracking-wider">Monthly Revenue</p>
              <p className="text-3xl font-bold text-amber-900 mt-1">₹{monthRevenue.toLocaleString('en-IN')}</p>
            </div>
            <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-5 border border-red-200">
              <p className="text-red-600 text-xs font-semibold uppercase tracking-wider">Pending Amount</p>
              <p className="text-3xl font-bold text-red-900 mt-1">₹{pendingAmt.toLocaleString('en-IN')}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Filters ── */}
      <div className="bg-white border-b border-white/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-600 pointer-events-none" />
            <input type="text" placeholder="Search invoice, client, phone..."
              value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="w-full pl-9 pr-3 py-2 border border-white/40 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500" />
          </div>
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value as PaymentStatus | 'all'); setCurrentPage(1); }}
            className="px-3 py-2 border border-white/40 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500 bg-white/60 text-gray-700">
            <option value="all">All Status</option>
            <option value="paid">Paid</option>
            <option value="pending">Pending</option>
            <option value="partial">Partial</option>
          </select>
          <select value={dateFilter} onChange={e => { setDateFilter(e.target.value as typeof dateFilter); setCurrentPage(1); }}
            className="px-3 py-2 border border-white/40 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500 bg-white/60 text-gray-700">
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
          </select>
          <button onClick={() => { fetchInvoices(); fetchStats(); }}
            className="p-2 border border-white/40 rounded-lg hover:bg-white/40 transition text-gray-600" title="Refresh">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── List ── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {listLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
          </div>
        ) : paginated.length === 0 ? (
          <div className="glass-subtle rounded-xl border border-white/30 p-12 text-center">
            <Receipt className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-600">{filtered.length === 0 && invoices.length > 0 ? 'No invoices match filters' : 'No invoices yet. Create your first bill!'}</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block glass-subtle rounded-xl border border-white/30 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-white/30 border-b border-white/30">
                    {['Invoice #', 'Client', 'Date', 'Services', 'Total', 'Method', 'Status', 'Actions'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginated.map(inv => (
                    <tr key={inv.id} className="hover:glass-subtle transition">
                      <td className="px-4 py-3 font-semibold text-teal-700">{inv.invoice_number}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{inv.client_name}</p>
                        <p className="text-xs text-gray-600">{inv.client_phone}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmtDate(inv.invoice_date)}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs max-w-[140px] truncate">—</td>
                      <td className="px-4 py-3 font-bold text-gray-900 whitespace-nowrap">₹{Number(inv.total).toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 text-gray-600">{inv.payment_method || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${statusBadge(inv.payment_status)}`}>
                          {inv.payment_status.charAt(0).toUpperCase() + inv.payment_status.slice(1)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => openInvoice(inv)}
                            className="p-1.5 hover:bg-teal-500/15 text-teal-600 rounded-lg transition" title="View">
                            <Eye className="w-4 h-4" />
                          </button>
                          {isAdmin && (
                            <button onClick={() => handleDelete(inv.id)}
                              className="p-1.5 hover:bg-red-50 text-red-500 rounded-lg transition" title="Delete">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-3">
              {paginated.map(inv => (
                <div key={inv.id} className="glass-subtle rounded-xl border border-white/30 p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-bold text-teal-700">{inv.invoice_number}</p>
                      <p className="font-semibold text-gray-900 mt-0.5">{inv.client_name}</p>
                      <p className="text-xs text-gray-600">{inv.client_phone}</p>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${statusBadge(inv.payment_status)}`}>
                      {inv.payment_status.charAt(0).toUpperCase() + inv.payment_status.slice(1)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">{fmtDate(inv.invoice_date)}</span>
                    <span className="font-bold text-gray-900">₹{Number(inv.total).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => openInvoice(inv)}
                      className="flex-1 py-2 bg-teal-500/15 text-teal-700 rounded-lg text-sm font-semibold hover:bg-teal-100 transition">
                      View Invoice
                    </button>
                    {isAdmin && (
                      <button onClick={() => handleDelete(inv.id)}
                        className="py-2 px-4 bg-red-50 text-red-600 rounded-lg text-sm font-semibold hover:bg-red-100 transition">
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 mt-6">
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                  className="p-2 border border-white/40 rounded-lg hover:bg-white/40 disabled:opacity-40 disabled:cursor-not-allowed transition">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm text-gray-600">Page {currentPage} of {totalPages} · {filtered.length} records</span>
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                  className="p-2 border border-white/40 rounded-lg hover:bg-white/40 disabled:opacity-40 disabled:cursor-not-allowed transition">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {/* ══════════════════════════════════════════════════════════════════════
           CREATE BILL DRAWER
      ════════════════════════════════════════════════════════════════════════ */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={resetCreateForm} />
          <div className="relative w-full max-w-2xl bg-white h-full flex flex-col shadow-2xl overflow-hidden">

            {/* Drawer header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/30 bg-white sticky top-0 z-10">
              <div className="flex items-center gap-3">
                {createStep === 2 && (
                  <button onClick={() => setCreateStep(1)} className="p-1.5 hover:bg-white/40 rounded-lg transition">
                    <ChevronLeft className="w-5 h-5 text-gray-600" />
                  </button>
                )}
                <div>
                  <h2 className="text-lg font-bold text-gray-900">
                    {createStep === 1 ? 'Select Client' : 'Create Bill'}
                  </h2>
                  <p className="text-xs text-gray-600">
                    {createStep === 1 ? 'Search by phone or name' : selectedClient?.name}
                  </p>
                </div>
              </div>
              <button onClick={resetCreateForm} className="p-2 hover:bg-white/40 rounded-lg transition">
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            {/* Step indicator */}
            <div className="flex border-b border-white/20">
              {[{ n: 1, label: 'Client' }, { n: 2, label: 'Bill' }].map(s => (
                <div key={s.n} className={`flex-1 py-2.5 text-center text-xs font-semibold transition ${createStep === s.n ? 'border-b-2 border-teal-600 text-teal-700' : 'text-gray-600'}`}>
                  {s.n}. {s.label}
                </div>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto">

              {/* ── STEP 1: Client Search ── */}
              {createStep === 1 && (
                <div className="p-6 space-y-5">
                  {/* Mode toggle */}
                  <div className="flex gap-2 p-1 bg-white/40 rounded-xl w-fit">
                    {(['phone', 'name'] as const).map(m => (
                      <button key={m} onClick={() => { setSearchMode(m); setClientQuery(''); setClientResults([]); }}
                        className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-semibold transition ${searchMode === m ? 'bg-white/80 text-teal-700' : 'text-gray-600 hover:text-gray-700'}`}>
                        {m === 'phone' ? <Phone className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
                        {m === 'phone' ? 'By Phone' : 'By Name'}
                      </button>
                    ))}
                  </div>

                  <form onSubmit={e => { e.preventDefault(); searchClient(); }} className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-600 pointer-events-none" />
                      <input type={searchMode === 'phone' ? 'tel' : 'text'} value={clientQuery}
                        onChange={e => setClientQuery(e.target.value)}
                        placeholder={searchMode === 'phone' ? '10-digit phone' : 'Client name'}
                        className="w-full pl-9 pr-3 py-2 border border-white/40 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500" />
                    </div>
                    <button type="submit" disabled={clientSearching}
                      className="px-4 py-2 bg-teal-600 text-white rounded-lg font-semibold text-sm hover:bg-teal-700 disabled:bg-gray-400 transition flex items-center gap-1.5">
                      {clientSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                      Find
                    </button>
                  </form>

                  {clientResults.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{clientResults.length} found</p>
                      {clientResults.map(c => (
                        <button key={c.id} onClick={() => selectClient(c)}
                          className="w-full flex items-center justify-between p-3.5 glass-subtle hover:bg-teal-500/20 rounded-xl border border-white/40 hover:border-teal-300/60 transition text-left group">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-teal-500 flex items-center justify-center shrink-0">
                              <span className="text-white text-sm font-bold">{c.name.charAt(0).toUpperCase()}</span>
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900 group-hover:text-teal-800">
                                {c.name}
                                {c.is_golden && <span className="ml-1.5 text-amber-500 text-xs">★ VIP</span>}
                              </p>
                              <p className="text-xs text-gray-600">{c.phone}{c.gender ? ` · ${c.gender}` : ''}</p>
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-teal-600" />
                        </button>
                      ))}
                    </div>
                  )}

                  {clientResults.length === 0 && clientQuery.trim() && !clientSearching && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-center">
                      <p className="text-amber-800 font-medium text-sm">No client found</p>
                      <button onClick={() => navigate('/clients/new', { state: { phone: searchMode === 'phone' ? clientQuery : '' } })}
                        className="mt-3 inline-flex items-center gap-1.5 text-teal-700 font-semibold text-sm hover:underline">
                        <Plus className="w-4 h-4" /> Create new client profile
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* ── STEP 2: Bill Form ── */}
              {createStep === 2 && selectedClient && (
                <div className="p-6 space-y-6">

                  {/* Client card */}
                  <div className="bg-teal-500/15 border border-teal-300/40 rounded-xl p-4 flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-teal-900">{selectedClient.name}</p>
                        {selectedClient.is_golden && <span className="text-xs bg-amber-100 text-amber-700 border border-amber-300 px-1.5 py-0.5 rounded font-bold">★ VIP</span>}
                      </div>
                      <p className="text-teal-700 text-sm">{selectedClient.phone}</p>
                      {selectedClient.profession && <p className="text-teal-600 text-xs capitalize mt-0.5">{selectedClient.profession.replace('_',' ')}</p>}
                    </div>
                    <button onClick={() => { setShowHistory(h => !h); }}
                      className="text-xs text-teal-600 hover:text-teal-800 font-medium flex items-center gap-0.5">
                      History {showHistory ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  {/* Previous history snippet */}
                  {showHistory && (
                    <div className="glass-subtle rounded-2xl p-4 space-y-2">
                      <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Recent Treatments</p>
                      {clientHistory.length > 0 ? clientHistory.map(t => (
                        <div key={t.id} className="flex justify-between text-sm">
                          <span className="text-gray-700">{t.treatment_name}</span>
                          <span className="text-gray-600 text-xs">{fmtDate(t.date)} · ₹{Number(t.price).toLocaleString('en-IN')}</span>
                        </div>
                      )) : <p className="text-gray-600 text-sm">No previous treatments</p>}
                    </div>
                  )}

                  {/* Quick-add service buttons */}
                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Quick Add Services</p>
                    <div>
                      <p className="text-xs text-teal-700 font-medium mb-1.5 flex items-center gap-1">✂ Hair</p>
                      <div className="flex flex-wrap gap-1.5">
                        {HAIR_SERVICES.map(s => (
                          <button key={s} type="button" onClick={() => quickAddService(s, 'hair')}
                            className="px-2.5 py-1 text-xs bg-teal-500/15 hover:bg-teal-100 text-teal-700 rounded-full border border-teal-200 transition font-medium">
                            + {s}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-rose-700 font-medium mb-1.5 flex items-center gap-1">✦ Skin</p>
                      <div className="flex flex-wrap gap-1.5">
                        {SKIN_SERVICES.map(s => (
                          <button key={s} type="button" onClick={() => quickAddService(s, 'skin')}
                            className="px-2.5 py-1 text-xs bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-full border border-rose-200 transition font-medium">
                            + {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Line items */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-gray-800">Services in This Bill</p>
                      <button onClick={addLine}
                        className="text-xs text-teal-600 hover:text-teal-800 font-semibold flex items-center gap-1 transition">
                        <Plus className="w-3.5 h-3.5" /> Add Row
                      </button>
                    </div>

                    {lineItems.map((item, idx) => (
                      <div key={item.id} className="glass-subtle rounded-xl border border-white/30 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-gray-600">Service {idx + 1}</span>
                          {lineItems.length > 1 && (
                            <button onClick={() => removeLine(item.id)} className="p-1 hover:bg-red-50 text-red-500 rounded-lg transition">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="col-span-2">
                            <input type="text" placeholder="Service name *" value={item.service_name}
                              onChange={e => updateLine(item.id, 'service_name', e.target.value)}
                              className={inputCls} />
                          </div>
                          <div>
                            <label className="text-xs text-gray-600 mb-1 block">Category</label>
                            <select value={item.category} onChange={e => updateLine(item.id, 'category', e.target.value)}
                              className={inputCls}>
                              <option value="">Select</option>
                              <option value="hair">Hair</option>
                              <option value="skin">Skin</option>
                              <option value="hair_and_skin">Hair & Skin</option>
                              <option value="custom">Custom</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-xs text-gray-600 mb-1 block">Staff Name</label>
                            <input type="text" placeholder="Who did this?" value={item.staff_name}
                              onChange={e => updateLine(item.id, 'staff_name', e.target.value)}
                              className={inputCls} />
                          </div>
                          <div>
                            <label className="text-xs text-gray-600 mb-1 block">Price (₹) *</label>
                            <input type="number" min="0" step="0.01" placeholder="0.00"
                              value={item.unit_price || ''}
                              onChange={e => updateLine(item.id, 'unit_price', parseFloat(e.target.value) || 0)}
                              className={inputCls} />
                          </div>
                          <div>
                            <label className="text-xs text-gray-600 mb-1 block">Qty</label>
                            <input type="number" min="1" placeholder="1"
                              value={item.quantity}
                              onChange={e => updateLine(item.id, 'quantity', Math.max(1, parseInt(e.target.value) || 1))}
                              className={inputCls} />
                          </div>
                        </div>
                        <div className="flex justify-between items-center pt-1 border-t border-white/30">
                          <span className="text-xs text-gray-600">Item Total</span>
                          <span className="font-bold text-teal-700">₹{Math.max(0, item.quantity * item.unit_price - item.item_discount).toLocaleString('en-IN')}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Discount & Coupon */}
                  <div className="glass-subtle rounded-2xl p-4 space-y-4">
                    <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Discounts & Coupon</p>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-gray-600 mb-1 block">Manual Discount (₹)</label>
                        <input type="number" min="0" step="0.01" value={billDiscount || ''}
                          onChange={e => setBillDiscount(parseFloat(e.target.value) || 0)}
                          className={inputCls} placeholder="0.00" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-600 mb-1 block">Tax %</label>
                        <input type="number" min="0" max="100" step="0.01" value={taxPercent || ''}
                          onChange={e => setTaxPercent(parseFloat(e.target.value) || 0)}
                          className={inputCls} placeholder="0" />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-gray-600 mb-1 block">Coupon Code</label>
                      <div className="flex gap-2">
                        <input type="text" placeholder="Enter coupon code" value={couponCode}
                          onChange={e => { setCouponCode(e.target.value.toUpperCase()); setCouponDiscount(0); setCouponMsg(''); }}
                          className={`${inputCls} flex-1`} />
                        <button type="button" onClick={applyCoupon} disabled={couponChecking || !couponCode.trim()}
                          className="px-3 py-2 bg-teal-600 text-white rounded-lg text-sm font-semibold hover:bg-teal-700 disabled:bg-gray-300 transition flex items-center gap-1">
                          {couponChecking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Tag className="w-3.5 h-3.5" />}
                          Apply
                        </button>
                      </div>
                      {couponMsg && (
                        <p className={`text-xs mt-1.5 font-medium ${couponDiscount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {couponMsg}
                        </p>
                      )}
                    </div>

                    {/* Bill summary */}
                    <div className="border-t border-white/30 pt-3 space-y-1.5 text-sm">
                      <div className="flex justify-between text-gray-600">
                        <span>Subtotal</span><span>₹{subtotal.toLocaleString('en-IN')}</span>
                      </div>
                      {billDiscount > 0 && (
                        <div className="flex justify-between text-green-700">
                          <span>Discount</span><span>−₹{billDiscount.toLocaleString('en-IN')}</span>
                        </div>
                      )}
                      {couponDiscount > 0 && (
                        <div className="flex justify-between text-green-700">
                          <span>Coupon ({couponCode})</span><span>−₹{couponDiscount.toLocaleString('en-IN')}</span>
                        </div>
                      )}
                      {taxAmt > 0 && (
                        <div className="flex justify-between text-gray-600">
                          <span>Tax ({taxPercent}%)</span><span>₹{taxAmt.toLocaleString('en-IN')}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-bold text-base pt-1.5 border-t border-white/40 text-teal-900">
                        <span>Grand Total</span><span>₹{grandTotal.toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                  </div>

                  {/* Payment */}
                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Payment</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-gray-600 mb-1 block">Method</label>
                        <select value={payMethod} onChange={e => setPayMethod(e.target.value)} className={inputCls}>
                          <option value="Cash">Cash</option>
                          <option value="UPI">UPI</option>
                          <option value="Card">Card</option>
                          <option value="Online">Online Transfer</option>
                          <option value="Pending">Pending</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-gray-600 mb-1 block">Status</label>
                        <select value={payStatus} onChange={e => setPayStatus(e.target.value as PaymentStatus)} className={inputCls}>
                          <option value="paid">Paid ✓</option>
                          <option value="partial">Partial Payment</option>
                          <option value="pending">Pending</option>
                        </select>
                      </div>
                    </div>

                    {payStatus === 'partial' && (
                      <div className="grid grid-cols-2 gap-3 bg-amber-50 border border-amber-200 rounded-xl p-3">
                        <div>
                          <label className="text-xs text-amber-700 mb-1 block font-medium">Amount Paid (₹)</label>
                          <input type="number" min="0" max={grandTotal} step="0.01" value={amountPaid || ''}
                            onChange={e => setAmountPaid(parseFloat(e.target.value) || 0)}
                            className={inputCls} placeholder="0.00" />
                        </div>
                        <div>
                          <label className="text-xs text-red-600 mb-1 block font-medium">Remaining (₹)</label>
                          <div className="px-3 py-2 border border-red-200 rounded-lg bg-red-50 text-red-700 font-bold text-sm">
                            ₹{remaining.toLocaleString('en-IN')}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="text-xs text-gray-600 mb-1.5 block font-semibold uppercase tracking-wide">Notes (optional)</label>
                    <textarea rows={2} value={billNotes} onChange={e => setBillNotes(e.target.value)}
                      placeholder="Any notes for this bill..."
                      className={inputCls + ' resize-none'} />
                  </div>

                  {submitError && (
                    <div className="flex items-center gap-2 bg-red-500/15 border border-red-300/40 text-red-700 backdrop-blur-sm rounded-lg px-4 py-3 text-sm">
                      <AlertCircle className="w-4 h-4 shrink-0" />{submitError}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Drawer footer */}
            {createStep === 2 && (
              <div className="border-t border-white/30 bg-white px-6 py-4 flex gap-3">
                <button onClick={resetCreateForm}
                  className="flex-1 px-4 py-2.5 border border-white/40 rounded-lg text-sm font-semibold text-gray-700 hover:bg-white/40 transition">
                  Cancel
                </button>
                <button onClick={handleSubmit} disabled={submitting}
                  className="flex-1 px-4 py-2.5 btn-lux text-white font-bold rounded-lg transition disabled:bg-gray-400 flex items-center justify-center gap-2 text-sm shadow-md shadow-teal-600/20">
                  {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</> : <><CheckCircle2 className="w-4 h-4" /> Generate Bill</>}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
           VIEW / PRINT INVOICE MODAL
      ════════════════════════════════════════════════════════════════════════ */}
      {showView && viewInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowView(false)} />
          <div className="relative w-full max-w-lg glass-strong rounded-3xl flex flex-col max-h-[92vh] overflow-hidden">

            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/30">
              <h2 className="font-bold text-gray-900">Invoice {viewInvoice.invoice_number}</h2>
              <button onClick={() => setShowView(false)} className="p-2 hover:bg-white/40 rounded-lg transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Invoice body (scrollable) */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5" id="invoice-print-area">
              {viewLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="w-7 h-7 animate-spin text-teal-600" /></div>
              ) : (
                <>
                  {/* Salon header */}
                  <div className="text-center pb-5 border-b border-white/30">
                    <img src="/Image_logo.png" alt="Logo" className="h-12 w-auto mx-auto mb-2 object-contain" />
                    <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Image Skinn & Hair</h1>
                    <p className="text-gray-600 text-sm mt-0.5">Premium Salon & Hair Care</p>
                  </div>

                  {/* Invoice meta */}
                  <div className="flex justify-between text-sm">
                    <div>
                      <p className="text-gray-600 text-xs uppercase tracking-wide">Invoice No.</p>
                      <p className="font-bold text-teal-700 text-lg">{viewInvoice.invoice_number}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-gray-600 text-xs uppercase tracking-wide">Date</p>
                      <p className="font-semibold text-gray-900">{fmtDate(viewInvoice.invoice_date)}</p>
                    </div>
                  </div>

                  {/* Client */}
                  <div className="glass-subtle rounded-xl p-4 border border-white/30">
                    <p className="text-xs text-gray-600 uppercase tracking-wide font-semibold mb-2">Bill To</p>
                    <p className="font-bold text-gray-900 text-base">{viewInvoice.client_name}</p>
                    <p className="text-gray-600 text-sm">📞 {viewInvoice.client_phone}</p>
                  </div>

                  {/* Items table */}
                  <div className="overflow-x-auto rounded-xl border border-white/30">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-teal-600 text-white">
                          <th className="px-3 py-2.5 text-left font-semibold">Service</th>
                          <th className="px-3 py-2.5 text-left font-semibold">Staff</th>
                          <th className="px-3 py-2.5 text-center font-semibold">Qty</th>
                          <th className="px-3 py-2.5 text-right font-semibold">Rate</th>
                          <th className="px-3 py-2.5 text-right font-semibold">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {viewItems.map(item => (
                          <tr key={item.id} className="even:glass-subtle">
                            <td className="px-3 py-2.5">
                              <p className="font-medium text-gray-900">{item.service_name}</p>
                            </td>
                            <td className="px-3 py-2.5 text-gray-700">{item.staff_name || '—'}</td>
                            <td className="px-3 py-2.5 text-center text-gray-600">{item.quantity}</td>
                            <td className="px-3 py-2.5 text-right text-gray-600">₹{Number(item.unit_price).toLocaleString('en-IN')}</td>
                            <td className="px-3 py-2.5 text-right font-semibold text-gray-900">₹{Number(item.total).toLocaleString('en-IN')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Totals */}
                  <div className="flex justify-end">
                    <div className="w-72 space-y-1.5 text-sm">
                      <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>₹{Number(viewInvoice.subtotal).toLocaleString('en-IN')}</span></div>
                      {(() => {
                        const cAmt = Number(viewInvoice.coupon_discount) || 0;
                        const manual = Math.max(0, Number(viewInvoice.discount) - cAmt);
                        return manual > 0 ? (
                          <div className="flex justify-between text-green-700"><span>Discount</span><span>−₹{manual.toLocaleString('en-IN')}</span></div>
                        ) : null;
                      })()}
                      {Number(viewInvoice.coupon_discount) > 0 && (
                        <div className="flex justify-between text-green-700">
                          <span>Coupon Applied: {viewInvoice.coupon_code}</span>
                          <span>−₹{Number(viewInvoice.coupon_discount).toLocaleString('en-IN')}</span>
                        </div>
                      )}
                      {Number(viewInvoice.tax) > 0 && (
                        <div className="flex justify-between text-gray-600"><span>Tax</span><span>₹{Number(viewInvoice.tax).toLocaleString('en-IN')}</span></div>
                      )}
                      <div className="flex justify-between font-bold text-base pt-1.5 border-t border-white/40">
                        <span>Grand Total</span><span className="text-teal-700">₹{Number(viewInvoice.total).toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                  </div>

                  {/* Payment info */}
                  <div className="bg-teal-500/15 border border-teal-300/40 rounded-xl p-4 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-teal-600 font-semibold uppercase tracking-wide">Method</p>
                      <p className="font-semibold text-gray-900 mt-0.5">{viewInvoice.payment_method || '—'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-teal-600 font-semibold uppercase tracking-wide">Status</p>
                      <span className={`inline-block mt-0.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${statusBadge(viewInvoice.payment_status)}`}>
                        {viewInvoice.payment_status.charAt(0).toUpperCase() + viewInvoice.payment_status.slice(1)}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs text-teal-600 font-semibold uppercase tracking-wide">Amount Paid</p>
                      <p className="font-semibold text-gray-900 mt-0.5">₹{Number(viewInvoice.amount_paid).toLocaleString('en-IN')}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-xs font-semibold uppercase tracking-wide ${(Number(viewInvoice.total) - Number(viewInvoice.amount_paid)) > 0 ? 'text-red-500' : 'text-green-600'}`}>Balance Due</p>
                      <p className={`font-bold mt-0.5 ${(Number(viewInvoice.total) - Number(viewInvoice.amount_paid)) > 0 ? 'text-red-600' : 'text-green-600'}`}>₹{Math.max(0, Number(viewInvoice.total) - Number(viewInvoice.amount_paid)).toLocaleString('en-IN')}</p>
                    </div>
                  </div>

                  {viewInvoice.notes && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                      <p className="text-xs text-amber-700 font-semibold uppercase tracking-wide mb-1">Notes</p>
                      <p className="text-gray-700 text-sm">{viewInvoice.notes}</p>
                    </div>
                  )}

                  <p className="text-center text-xs text-gray-600 pt-2">Thank you for visiting Image Skinn & Hair!</p>
                </>
              )}
            </div>

            {/* Action buttons */}
            <div className="border-t border-white/30 px-4 py-4 glass">
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={() => openInvoicePrintWindow(viewInvoice, viewItems)}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold rounded-xl transition text-sm">
                  <Printer className="w-4 h-4" /> Print Preview
                </button>
                <button
                  onClick={() => openInvoicePrintWindow(viewInvoice, viewItems)}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-teal-700 hover:bg-teal-800 active:bg-teal-900 text-white font-semibold rounded-xl transition text-sm">
                  <Download className="w-4 h-4" /> Download PDF
                </button>
                <button
                  onClick={() => {
                    const inv = viewInvoice;
                    const services = viewItems.map(i => `• ${i.service_name} — ₹${Number(i.total).toLocaleString('en-IN')}`).join('\n');
                    const text =
                      `Hello ${inv.client_name},\n\n` +
                      `Thank you for visiting *Image Skinn & Hair*! 💫\n\n` +
                      `*Invoice: ${inv.invoice_number}*\n` +
                      `Date: ${fmtDate(inv.invoice_date)}\n\n` +
                      `*Services:*\n${services}\n\n` +
                      (Number(inv.coupon_discount) > 0
                        ? `Coupon Applied: ${inv.coupon_code} (−₹${Number(inv.coupon_discount).toLocaleString('en-IN')})\n`
                        : '') +
                      (Number(inv.discount) > 0 ? `Discount: −₹${Number(inv.discount).toLocaleString('en-IN')}\n` : '') +
                      `*Total: ₹${Number(inv.total).toLocaleString('en-IN')}*\n` +
                      `Payment: ${inv.payment_method} (${inv.payment_status.charAt(0).toUpperCase() + inv.payment_status.slice(1)})\n` +
                      `Amount Paid: ₹${Number(inv.amount_paid).toLocaleString('en-IN')}\n` +
                      `Balance Due: ₹${Math.max(0, Number(inv.total) - Number(inv.amount_paid)).toLocaleString('en-IN')}\n` +
                      `\nWe look forward to your next visit! 🌟\n— Image Skinn & Hair`;
                    window.open(buildWhatsAppUrl(inv.client_phone, text), '_blank', 'noopener,noreferrer');
                  }}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white font-semibold rounded-xl transition text-sm">
                  <MessageCircle className="w-4 h-4" /> WhatsApp
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
