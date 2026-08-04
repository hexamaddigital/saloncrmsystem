import { useState, useEffect } from 'react';
import { Loader2, Scissors, Sparkles, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface QrMenu { id: string; title: string; subtitle?: string; footer_note?: string; is_active: boolean; }
interface QrMenuItem { id: string; category: string; name: string; description?: string; price?: number; duration_min?: number; sort_order: number; }

function groupBy<T>(arr: T[], key: keyof T): Record<string, T[]> {
  return arr.reduce((acc, item) => {
    const k = String(item[key]);
    if (!acc[k]) acc[k] = [];
    acc[k].push(item);
    return acc;
  }, {} as Record<string, T[]>);
}

export function PublicMenuPage() {
  const [menu, setMenu] = useState<QrMenu | null>(null);
  const [items, setItems] = useState<QrMenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: m } = await supabase.from('qr_menus').select('*').eq('is_active', true).maybeSingle();
      if (!m) { setNotFound(true); setLoading(false); return; }
      setMenu(m);
      const { data: i } = await supabase.from('qr_menu_items').select('*')
        .eq('menu_id', m.id).eq('is_active', true).order('sort_order').order('name');
      setItems(i || []);
      setLoading(false);
    })();
  }, []);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
    </div>
  );

  if (notFound) return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="glass-strong rounded-3xl p-8 text-center max-w-sm animate-fade-in-up">
        <Scissors className="w-12 h-12 text-teal-400 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-gray-800 mb-2">Menu Unavailable</h1>
        <p className="text-gray-500">The service menu is currently offline. Please contact the salon.</p>
      </div>
    </div>
  );

  const grouped = groupBy(items, 'category');

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="glass-dark text-white text-center py-10 px-4">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Scissors className="w-6 h-6 text-teal-300" />
          <Sparkles className="w-5 h-5 text-teal-200" />
        </div>
        <h1 className="text-2xl font-extrabold">{menu?.title}</h1>
        {menu?.subtitle && <p className="text-teal-200 text-sm mt-1">{menu.subtitle}</p>}
      </div>

      <main className="max-w-xl mx-auto px-4 py-8 space-y-6">
        {Object.entries(grouped).map(([cat, catItems]) => (
          <div key={cat}>
            <h2 className="text-xs font-bold text-teal-700 uppercase tracking-widest mb-3 flex items-center gap-2">
              <span className="flex-1 h-px bg-teal-200" />
              {cat}
              <span className="flex-1 h-px bg-teal-200" />
            </h2>
            <div className="space-y-2">
              {catItems.map(item => (
                <div key={item.id} className="glass-subtle rounded-xl border border-white/20 px-4 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900">{item.name}</p>
                    {item.description && <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>}
                    {item.duration_min && (
                      <p className="text-xs text-gray-400 flex items-center gap-1 mt-1">
                        <Clock className="w-3 h-3" /> {item.duration_min} mins
                      </p>
                    )}
                  </div>
                  {item.price != null && (
                    <p className="text-base font-bold text-teal-700 shrink-0">₹{item.price}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        {items.length === 0 && (
          <p className="text-center text-gray-400 py-8">No services listed yet.</p>
        )}

        {menu?.footer_note && (
          <p className="text-center text-xs text-gray-400 pt-4 border-t border-white/30">{menu.footer_note}</p>
        )}
      </main>
    </div>
  );
}
