import { Tour } from '@/design-system/Tour';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera } from 'lucide-react';
import { useStore } from '@/app/store';
import { Field, PageHeader, Spinner } from '@/design-system/ui';
import { Mascot } from '@/design-system/Mascot';
import { AnimatePresence, motion } from 'framer-motion';
import { compressImage } from '@/lib/native';

export function NewGroupPage() {
  const { adapter, refresh, toast } = useStore();
  const nav = useNavigate();
  const [name, setName] = useState(''); const [desc, setDesc] = useState(''); const [cover, setCover] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) { setErr('نام گروه را وارد کنید'); return; }
    setBusy(true);
    try { const g = await adapter.createGroup(name, desc, cover); await refresh(); toast('گروه ساخته شد', 'ok'); nav(`/g/${g.id}/invite`, { replace: true }); }
    catch (ex) { setErr((ex as Error).message); } finally { setBusy(false); }
  };
  return (
    <div className="min-h-dvh mx-auto max-w-lg">
      <PageHeader title="گروه جدید" />
      <Tour id="new-group" delay={500} steps={[
        { title: 'یک گروه برای هر ماجرا', text: 'اسم گروه رو بنویس (مثلاً «سفر شمال»). بعد از ساختن، مستقیم می‌ری به صفحه دعوت تا دوستات رو با QR یا لینک اضافه کنی.', mood: 'happy' },
      ]} />
      <form onSubmit={submit} className="px-5 pt-4 pb-10">
        <label className="block relative h-40 rounded-card overflow-hidden mb-6 cursor-pointer grain" style={{ background: cover ? undefined : 'var(--grad-brand)' }}>
          {cover && <img src={cover} className="absolute inset-0 w-full h-full object-cover" alt="" />}
          <div className="absolute inset-0 grid place-items-center text-white"><span className="glass rounded-full px-4 py-2 text-sm font-bold flex items-center gap-2"><Camera size={16} /> {cover ? 'تغییر کاور' : 'کاور (اختیاری)'}</span></div>
          <input type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setCover(await compressImage(f, 'cover')); }} />
        </label>
        <Field label="نام گروه" error={err}><input className="input text-lg font-bold" value={name} onChange={(e) => setName(e.target.value)} placeholder="مثلاً سفر شمال، خونه بچه‌ها، …" autoFocus /></Field>
        <Field label="توضیح (اختیاری)"><input className="input" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="یه توضیح کوتاه" /></Field>
        <button className="btn-primary w-full text-base" disabled={busy}>{busy ? <><Spinner size={22} /> در حال ساخت گروه…</> : 'ساخت گروه و دعوت دوستان'}</button>
      </form>
      <AnimatePresence>
        {busy && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 grid place-items-center" style={{ background: 'rgb(var(--c-bg) / 0.72)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}>
            <motion.div initial={{ scale: 0.9, y: 8 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0 }} className="card px-8 py-7 flex flex-col items-center gap-4 text-center">
              <div className="relative grid place-items-center"><Spinner size={88} className="text-brand" /><div className="absolute"><Mascot mood="happy" size={54} /></div></div>
              <div><p className="font-extrabold">در حال ساخت «{name.trim()}»</p><p className="text-xs text-ink-2 mt-1">چند لحظه…</p></div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
