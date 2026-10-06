/** "Get it on" badges for the Iranian app stores. Plain anchors (new tab) so they work in every browser/webview. */
export const STORES = [
  { id: 'bazaar', name: 'کافه‌بازار', hint: 'دریافت از', url: 'https://cafebazaar.ir/app/ir.dong.app', icon: 'icons/store-bazaar.png', bg: 'linear-gradient(135deg,#f0fbf1,#dff5e4)', ring: '#9ad8a7', text: '#1b5e32' },
  { id: 'myket', name: 'مایکت', hint: 'دریافت از', url: 'https://myket.ir/app/ir.dong.app', icon: 'icons/store-myket.svg', bg: 'linear-gradient(135deg,#eef6ff,#dcecfd)', ring: '#9cc7f3', text: '#0d4f8a' },
] as const;

export function StoreBadges({ compact = false, light = false }: { compact?: boolean; light?: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {STORES.map((s) => (
        <a key={s.id} href={s.url} target="_blank" rel="noopener" dir="rtl"
          className="flex items-center gap-2.5 rounded-2xl px-3 border transition-transform active:scale-[.98] hover:brightness-105"
          style={{ background: light ? 'rgba(255,255,255,.92)' : s.bg, borderColor: light ? 'transparent' : s.ring, minHeight: compact ? 44 : 52, color: s.text }}>
          <img src={import.meta.env.BASE_URL + s.icon} alt="" className={compact ? 'w-7 h-7 object-contain' : 'w-8 h-8 object-contain'} />
          <span className="leading-tight">
            <span className="block text-[10px] opacity-70 font-medium">{s.hint}</span>
            <span className={`block font-black ${compact ? 'text-[13px]' : 'text-sm'}`}>{s.name}</span>
          </span>
        </a>
      ))}
    </div>
  );
}
