import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft, QrCode, Plus, Pencil, Trash2, X, Check, Loader2, AlertTriangle,
  ToggleLeft, ToggleRight, Download, Printer, Link as LinkIcon, Eye,
} from 'lucide-react';
import QRCode from 'qrcode';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

interface QrMenu { id: string; title: string; subtitle?: string; footer_note?: string; is_active: boolean; }
interface QrMenuItem { id: string; menu_id: string; category: string; name: string; description?: string; price?: number; duration_min?: number; is_active: boolean; sort_order: number; }

function groupBy<T>(arr: T[], key: keyof T): Record<string, T[]> {
  return arr.reduce((acc, item) => {
    const k = String(item[key]);
    if (!acc[k]) acc[k] = [];
    acc[k].push(item);
    return acc;
  }, {} as Record<string, T[]>);
}

const CATEGORIES = ['Hair', 'Skin', 'Hair & Skin', 'Nail', 'Makeup', 'Packages', 'Other'];

export function QrMenuPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [menu, setMenu] = useState<QrMenu | null>(null);
  const [items, setItems] = useState<QrMenuItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Menu settings form
  const [menuForm, setMenuForm] = useState({ title: '', subtitle: '', footer_note: '' });
  const [menuSaving, setMenuSaving] = useState(false);

  // Item form
  const [showItemForm, setShowItemForm] = useState(false);
  const [editItemId, setEditItemId] = useState<string | null>(null);
  const [itemForm, setItemForm] = useState({ category: 'Hair', name: '', description: '', price: '', duration_min: '', is_active: true });
  const [itemError, setItemError] = useState('');
  const [itemSaving, setItemSaving] = useState(false);

  // QR code
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [showQrModal, setShowQrModal] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const fetchMenu = useCallback(async () => {
    setLoading(true);
    const { data: menus } = await supabase.from('qr_menus').select('*').limit(1).maybeSingle();
    if (menus) {
      setMenu(menus);
      setMenuForm({ title: menus.title, subtitle: menus.subtitle || '', footer_note: menus.footer_note || '' });
      const { data: menuItems } = await supabase.from('qr_menu_items').select('*').eq('menu_id', menus.id).order('sort_order').order('name');
      setItems(menuItems || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchMenu(); }, [fetchMenu]);

  // Generate QR code data URL whenever menu is active
  useEffect(() => {
    if (menu?.is_active) {
      const url = `${window.location.origin}/menu`;
      QRCode.toDataURL(url, { width: 512, margin: 2, color: { dark: '#0f766e', light: '#ffffff' } })
        .then(setQrDataUrl)
        .catch(() => setQrDataUrl(''));
    } else {
      setQrDataUrl('');
    }
  }, [menu?.is_active]);

  async function saveMenuSettings() {
    if (!menu) return;
    setMenuSaving(true);
    await supabase.from('qr_menus').update({ title: menuForm.title, subtitle: menuForm.subtitle || null, footer_note: menuForm.footer_note || null }).eq('id', menu.id);
    setMenuSaving(false); fetchMenu();
  }

  async function toggleMenuActive() {
    if (!menu) return;
    await supabase.from('qr_menus').update({ is_active: !menu.is_active }).eq('id', menu.id);
    fetchMenu();
  }

  function openNewItem() {
    setEditItemId(null);
    setItemForm({ category: 'Hair', name: '', description: '', price: '', duration_min: '', is_active: true });
    setItemError(''); setShowItemForm(true);
  }
  function openEditItem(it: QrMenuItem) {
    setEditItemId(it.id);
    setItemForm({ category: it.category, name: it.name, description: it.description || '', price: it.price != null ? String(it.price) : '', duration_min: it.duration_min != null ? String(it.duration_min) : '', is_active: it.is_active });
    setItemError(''); setShowItemForm(true);
  }

  async function saveItem() {
    if (!menu) return;
    if (!itemForm.name.trim()) { setItemError('Service name is required'); return; }
    setItemSaving(true); setItemError('');
    try {
      const payload = {
        menu_id: menu.id, category: itemForm.category, name: itemForm.name.trim(),
        description: itemForm.description.trim() || null,
        price: itemForm.price ? parseFloat(itemForm.price) : null,
        duration_min: itemForm.duration_min ? parseInt(itemForm.duration_min) : null,
        is_active: itemForm.is_active,
        sort_order: editItemId ? undefined : items.filter(i => i.category === itemForm.category).length,
      };
      if (editItemId) {
        const { error } = await supabase.from('qr_menu_items').update(payload).eq('id', editItemId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('qr_menu_items').insert(payload);
        if (error) throw error;
      }
      setShowItemForm(false); fetchMenu();
    } catch (err) { setItemError(err instanceof Error ? err.message : 'Failed'); }
    finally { setItemSaving(false); }
  }

  async function deleteItem(id: string) {
    if (!confirm('Remove this service from the menu?')) return;
    await supabase.from('qr_menu_items').delete().eq('id', id);
    fetchMenu();
  }

  async function toggleItem(it: QrMenuItem) {
    await supabase.from('qr_menu_items').update({ is_active: !it.is_active }).eq('id', it.id);
    fetchMenu();
  }

  // QR code actions
  function openQrModal() {
    setShowQrModal(true);
    setLinkCopied(false);
    // Draw QR on canvas for printing
    if (qrCanvasRef.current && qrDataUrl) {
      const ctx = qrCanvasRef.current.getContext('2d');
      if (ctx) {
        const img = new Image();
        img.onload = () => {
          ctx.clearRect(0, 0, qrCanvasRef.current!.width, qrCanvasRef.current!.height);
          ctx.drawImage(img, 0, 0, qrCanvasRef.current!.width, qrCanvasRef.current!.height);
        };
        img.src = qrDataUrl;
      }
    }
  }

  function downloadQr() {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = 'qr-service-menu.png';
    link.click();
  }

  function printQr() {
    if (!qrDataUrl) return;
    const win = window.open('', '_blank', 'noopener,noreferrer');
    if (!win) return;
    win.document.write(`
      <html><head><title>QR Code - Service Menu</title>
      <style>
        body { display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; margin:0; font-family:system-ui,sans-serif; }
        img { width:300px; height:300px; }
        h2 { color:#0f766e; margin:16px 0 4px; }
        p { color:#666; font-size:14px; margin:4px 0 0; }
      </style></head><body>
      <img src="${qrDataUrl}" alt="QR Code" />
      <h2>${menu?.title || 'Service Menu'}</h2>
      <p>Scan to view our live service menu</p>
      </body></html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 300);
  }

  function copyMenuLink() {
    const url = `${window.location.origin}/menu`;
    navigator.clipboard.writeText(url).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    });
  }

  const grouped = groupBy(items, 'category');
  const activeItems = items.filter(i => i.is_active);
  const qrUrl = `${window.location.origin}/menu`;
  const inputCls = 'w-full px-3 py-2 border border-white/40 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none';

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/dashboard')} className="p-2 hover:bg-white/40 rounded-lg transition">
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            <QrCode className="w-5 h-5 text-teal-600" />
            <h1 className="text-xl font-bold text-gray-900">QR Service Menu</h1>
            {!isAdmin && <span className="ml-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-white/40 text-gray-600">View Only</span>}
          </div>
          {isAdmin && (
            <button onClick={openNewItem}
              className="flex items-center gap-2 px-4 py-2 btn-lux text-white text-sm font-semibold rounded-xl transition">
              <Plus className="w-4 h-4" /> Add Service
            </button>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-teal-600" /></div>
        ) : (
          <>
            {/* Menu status card */}
            <div className="bg-white rounded-2xl border border-white/20 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-gray-900">Menu Status</h3>
                  <p className="text-sm text-gray-600 mt-0.5">{activeItems.length} active services</p>
                </div>
                {isAdmin ? (
                  <button onClick={toggleMenuActive} className="flex items-center gap-2 text-sm font-semibold">
                    {menu?.is_active
                      ? <><ToggleRight className="w-8 h-8 text-teal-600" /><span className="text-teal-700">Live</span></>
                      : <><ToggleLeft className="w-8 h-8 text-gray-600" /><span className="text-gray-600">Offline</span></>}
                  </button>
                ) : (
                  <span className={`flex items-center gap-2 text-sm font-semibold ${menu?.is_active ? 'text-teal-700' : 'text-gray-600'}`}>
                    {menu?.is_active ? <ToggleRight className="w-8 h-8 text-teal-600" /> : <ToggleLeft className="w-8 h-8 text-gray-600" />}
                    {menu?.is_active ? 'Live' : 'Offline'}
                  </span>
                )}
              </div>

              {menu?.is_active && (
                <div className="bg-teal-500/15 border border-teal-300/40 rounded-xl p-4">
                  <p className="text-xs font-semibold text-teal-700 uppercase tracking-wide mb-2">Public Menu URL</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <code className="flex-1 min-w-0 text-xs glass border border-teal-200 rounded-lg px-3 py-2 text-teal-800 font-mono truncate">{qrUrl}</code>
                    {isAdmin && (
                      <button onClick={openQrModal}
                        className="flex items-center gap-1.5 px-3 py-2 btn-lux text-white text-xs font-semibold rounded-lg transition whitespace-nowrap">
                        <QrCode className="w-3.5 h-3.5" /> Generate QR Code
                      </button>
                    )}
                    <button onClick={copyMenuLink}
                      className="flex items-center gap-1.5 px-3 py-2 btn-lux text-white text-xs font-semibold rounded-lg transition whitespace-nowrap">
                      {linkCopied ? <><Check className="w-3.5 h-3.5" /> Copied!</> : <><LinkIcon className="w-3.5 h-3.5" /> Copy Menu Link</>}
                    </button>
                    <button onClick={() => window.open(qrUrl, '_blank', 'noopener,noreferrer')}
                      className="flex items-center gap-1.5 px-3 py-2 bg-white/40 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg transition whitespace-nowrap">
                      <Eye className="w-3.5 h-3.5" /> Preview
                    </button>
                  </div>
                  <p className="text-xs text-teal-600 mt-2">Customers can scan the QR code to view the live menu — no login needed. Operators can also scan or open the link to view.</p>
                </div>
              )}
            </div>

            {/* Menu settings — admin only */}
            {isAdmin && (
              <div className="bg-white rounded-2xl border border-white/20 p-6 space-y-4">
                <h3 className="font-bold text-gray-900">Menu Settings</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Menu Title</label>
                    <input type="text" value={menuForm.title} onChange={e => setMenuForm(p => ({ ...p, title: e.target.value }))} className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Subtitle</label>
                    <input type="text" value={menuForm.subtitle} onChange={e => setMenuForm(p => ({ ...p, subtitle: e.target.value }))} className={inputCls} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Footer Note</label>
                    <input type="text" value={menuForm.footer_note} onChange={e => setMenuForm(p => ({ ...p, footer_note: e.target.value }))} className={inputCls} />
                  </div>
                </div>
                <button onClick={saveMenuSettings} disabled={menuSaving}
                  className="flex items-center gap-2 px-4 py-2 btn-lux text-white text-sm font-semibold rounded-xl transition disabled:bg-gray-400">
                  {menuSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : <><Check className="w-4 h-4" /> Save Settings</>}
                </button>
              </div>
            )}

            {/* Add/Edit item form — admin only */}
            {isAdmin && showItemForm && (
              <div className="bg-white rounded-2xl border-2 border-teal-200 p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-gray-900">{editItemId ? 'Edit Service' : 'Add Service'}</h3>
                  <button onClick={() => setShowItemForm(false)} className="p-1.5 hover:bg-white/40 rounded-lg"><X className="w-4 h-4" /></button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Category</label>
                    <select value={itemForm.category} onChange={e => setItemForm(p => ({ ...p, category: e.target.value }))} className={inputCls}>
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Service Name *</label>
                    <input type="text" value={itemForm.name} onChange={e => setItemForm(p => ({ ...p, name: e.target.value }))} className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Price (₹)</label>
                    <input type="number" min="0" value={itemForm.price} onChange={e => setItemForm(p => ({ ...p, price: e.target.value }))} placeholder="Leave blank to hide price" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Duration (mins)</label>
                    <input type="number" min="0" value={itemForm.duration_min} onChange={e => setItemForm(p => ({ ...p, duration_min: e.target.value }))} className={inputCls} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Description</label>
                    <input type="text" value={itemForm.description} onChange={e => setItemForm(p => ({ ...p, description: e.target.value }))} className={inputCls} />
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="item-active" checked={itemForm.is_active} onChange={e => setItemForm(p => ({ ...p, is_active: e.target.checked }))} className="w-4 h-4 accent-teal-600" />
                    <label htmlFor="item-active" className="text-sm font-medium text-gray-700">Visible on menu</label>
                  </div>
                </div>
                {itemError && <p className="text-sm text-red-700 bg-red-500/15 border border-red-300/40 rounded-xl backdrop-blur-sm px-3 py-2 flex items-center gap-2"><AlertTriangle className="w-3.5 h-3.5 shrink-0" />{itemError}</p>}
                <div className="flex gap-2">
                  <button onClick={() => setShowItemForm(false)} className="flex-1 py-2.5 border border-white/40 text-gray-700 font-semibold rounded-xl hover:bg-white/40 text-sm">Cancel</button>
                  <button onClick={saveItem} disabled={itemSaving} className="flex-1 py-2.5 btn-lux text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 disabled:bg-gray-400">
                    {itemSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : <><Check className="w-4 h-4" /> {editItemId ? 'Update' : 'Add'}</>}
                  </button>
                </div>
              </div>
            )}

            {/* Services by category */}
            <div className="space-y-4">
              {Object.entries(grouped).map(([cat, catItems]) => (
                <div key={cat} className="bg-white rounded-2xl border border-white/20 overflow-hidden">
                  <div className="px-5 py-3 bg-white/30 border-b border-white/20 flex items-center justify-between">
                    <h3 className="font-bold text-gray-800">{cat}</h3>
                    <span className="text-xs text-gray-600">{catItems.filter(i => i.is_active).length} active / {catItems.length}</span>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {catItems.map(it => (
                      <div key={it.id} className={`flex items-center gap-3 px-4 py-3 hover:bg-white/40 transition ${!it.is_active ? 'opacity-50' : ''}`}>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 text-sm">{it.name}</p>
                          {it.description && <p className="text-xs text-gray-600 mt-0.5 truncate">{it.description}</p>}
                        </div>
                        <div className="flex items-center gap-3 shrink-0 text-sm">
                          {it.price != null && <span className="font-bold text-teal-700">₹{it.price}</span>}
                          {it.duration_min && <span className="text-gray-600 text-xs">{it.duration_min}m</span>}
                          {isAdmin && (
                            <>
                              <button onClick={() => toggleItem(it)} className={`p-1 rounded ${it.is_active ? 'text-teal-600 hover:bg-teal-500/20' : 'text-gray-600 hover:bg-white/40'}`} title={it.is_active ? 'Hide' : 'Show'}>
                                {it.is_active ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                              </button>
                              <button onClick={() => openEditItem(it)} className="p-1 text-gray-600 hover:text-teal-600 rounded"><Pencil className="w-3.5 h-3.5" /></button>
                              <button onClick={() => deleteItem(it.id)} className="p-1 text-gray-600 hover:text-red-600 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {items.length === 0 && (
                <div className="bg-white rounded-2xl border border-white/20 p-12 text-center">
                  <QrCode className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-600">{isAdmin ? 'No services added yet. Add your first service to the menu.' : 'No services listed on the menu yet.'}</p>
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {/* Hidden canvas for QR printing */}
      <canvas ref={qrCanvasRef} width={300} height={300} className="hidden" />

      {/* QR Code Modal */}
      {showQrModal && qrDataUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="glass-strong rounded-3xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/20">
              <div className="flex items-center gap-2">
                <QrCode className="w-5 h-5 text-teal-600" />
                <h2 className="font-bold text-gray-900">QR Code — Service Menu</h2>
              </div>
              <button onClick={() => setShowQrModal(false)} className="p-1.5 hover:bg-white/40 rounded-lg transition">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div className="flex flex-col items-center">
                <div className="bg-white border-2 border-teal-200 rounded-2xl p-4">
                  <img src={qrDataUrl} alt="Service Menu QR Code" className="w-56 h-56" />
                </div>
                <p className="text-sm font-bold text-gray-900 mt-4">{menu?.title || 'Service Menu'}</p>
                <p className="text-xs text-gray-600 mt-1 text-center">Scan to open the live public menu — no login needed</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button onClick={downloadQr}
                  className="flex items-center justify-center gap-2 py-2.5 btn-lux text-white font-semibold rounded-xl transition text-sm">
                  <Download className="w-4 h-4" /> Download QR
                </button>
                <button onClick={printQr}
                  className="flex items-center justify-center gap-2 py-2.5 bg-white/40 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition text-sm">
                  <Printer className="w-4 h-4" /> Print QR
                </button>
                <button onClick={copyMenuLink}
                  className="flex items-center justify-center gap-2 py-2.5 bg-white/40 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition text-sm">
                  {linkCopied ? <><Check className="w-4 h-4 text-green-600" /> Copied!</> : <><LinkIcon className="w-4 h-4" /> Copy Link</>}
                </button>
              </div>

              <div className="bg-teal-500/15 border border-teal-100 rounded-xl p-3">
                <p className="text-xs text-teal-700 leading-relaxed">
                  This QR code always opens the live public menu. Any service, package, or price changes you make will appear instantly when customers scan it.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
