import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera } from 'lucide-react';
import { useStore } from '@/app/store';
import { Field, PageHeader } from '@/design-system/ui';
import { fileToDataUrl } from '@/lib/native';

export function NewGroupPage() {
  const { adapter, refresh, toast } = useStore();
  const nav = useNavigate();
  const [name, setName] = useState(''); const [desc, setDesc] = useState(''); const [cover, setCover] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) { setErr('نام گروه را وارد کنید'); return; }
    setBusy(true);
    try { const g = await adapter.createGroup(name, desc, cover); await refresh(); toast('گروه ساخته شد 🎉', 'ok'); nav(`/g/${g.id}/invite`, { replace: true }); }
    catch (ex) { setErr((ex as Error).message); } finally { setBusy(false); }
  };
  return (
    <div className="min-h-dvh mx-auto max-w-lg">
      <PageHeader title="گروه جدید" />
      <form onSubmit={submit} className="px-5 pt-4 pb-10">
        <label className="block relative h-40 rounded-card overflow-hidden mb-6 cursor-pointer grain" style={{ background: cover ? undefined : 'var(--grad-brand)' }}>
          {cover && <img src={cover} className="absolute inset-0 w-full h-full object-cover" alt="" />}
          <div className="absolute inset-0 grid place-items-center text-white"><span className="glass rounded-full px-4 py-2 text-sm font-bold flex items-center gap-2"><Camera size={16} /> {cover ? 'تغییر کاور' : 'کاور (اختیاری)'}</span></div>
          <input type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setCover(await fileToDataUrl(f, 1200, 0.8)); }} />
        </label>
        <Field label="نام گروه" error={err}><input className="input text-lg font-bold" value={name} onChange={(e) => setName(e.target.value)} placeholder="مثلاً سفر شمال، خونه بچه‌ها، …" autoFocus /></Field>
        <Field label="توضیح (اختیاری)"><input className="input" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="یه توضیح کوتاه" /></Field>
        <button className="btn-primary w-full text-base" disabled={busy}>ساخت گروه و دعوت دوستان</button>
      </form>
    </div>
  );
}
