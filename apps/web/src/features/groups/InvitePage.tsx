import { useNavigate, useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { Share2, RefreshCw, Link as LinkIcon, UserPlus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useStore } from '@/app/store';
import { CopyButton, PageHeader, Sheet } from '@/design-system/ui';
import { shareText } from '@/lib/native';

export function inviteUrl(token: string, snapshot?: string) {
  const base = import.meta.env.VITE_PUBLIC_URL || `${location.origin}${location.pathname}`;
  return `${base.replace(/\/?$/, '/')}#/join/${token}${snapshot ? `?s=${snapshot}` : ''}`;
}

export function InvitePage() {
  const { id } = useParams();
  const { groups, adapter, toast } = useStore();
  const nav = useNavigate();
  const g = groups.find((x) => x.group.id === id);
  const [addOpen, setAddOpen] = useState(false); const [name, setName] = useState('');
  const [snap, setSnap] = useState<string>('');
  useEffect(() => { if (g && adapter.kind === 'local') adapter.exportSnapshot?.(g.group.id).then(setSnap); }, [g, adapter, g?.expenses.length, g?.settlements.length, g?.members.length]);
  if (!g) return null;
  const url = inviteUrl(g.group.inviteToken, adapter.kind === 'local' ? snap : undefined);
  return (
    <div className="min-h-dvh mx-auto max-w-lg">
      <PageHeader title="دعوت به گروه" right={<button onClick={() => nav(`/g/${id}`, { replace: true })} className="text-brand font-bold text-sm px-3">رفتن به گروه</button>} />
      <div className="px-5 pt-4 flex flex-col items-center gap-5">
        <p className="text-ink-2 text-sm text-center leading-7">دوستانت رو با اسکن QR یا لینک به «{g.group.name}» دعوت کن.{adapter.kind === 'local' && ' اطلاعات گروه داخل خود لینک است؛ هر بار لینک جدید بفرستی، آخرین هزینه‌ها هم منتقل می‌شود.'}</p>
        <div className="bg-white p-5 rounded-[28px] shadow-xl"><QRCodeSVG value={url} size={220} level="L" fgColor="#0e3b52" /></div>
        <div className="card w-full p-3 flex items-center gap-2">
          <LinkIcon size={16} className="text-ink-2 shrink-0" />
          <span className="text-xs text-ink-2 truncate flex-1" dir="ltr">{url}</span>
          <CopyButton text={url} label="کپی لینک" small />
        </div>
        <div className="grid grid-cols-2 gap-3 w-full">
          <button onClick={() => shareText('دعوت به دُنگ', `بیا به گروه «${g.group.name}» توی دُنگ:`, url)} className="btn-primary"><Share2 size={18} /> اشتراک‌گذاری</button>
          <button onClick={async () => { await adapter.regenerateInvite(g.group.id); toast('لینک جدید ساخته شد', 'ok'); }} className="btn-ghost"><RefreshCw size={18} /> لینک جدید</button>
        </div>
        <div className="card w-full p-4">
          <p className="font-bold text-sm mb-1">دوستت اپ نداره؟</p>
          <p className="text-xs text-ink-2 leading-6 mb-3">می‌تونی خودت اسمش رو اضافه کنی و به‌جای او هزینه‌ها و پرداخت‌هاش رو ثبت کنی.</p>
          <button onClick={() => setAddOpen(true)} className="btn-ghost w-full"><UserPlus size={18} /> افزودن عضو بدون حساب</button>
        </div>
      </div>
      <Sheet open={addOpen} onClose={() => setAddOpen(false)} title="افزودن عضو">
        <input className="input mb-4" placeholder="نام (مثلاً حسین)" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        <button className="btn-primary w-full" onClick={async () => { try { await adapter.addLocalMember?.(g.group.id, name); setName(''); setAddOpen(false); toast('اضافه شد', 'ok'); } catch (e) { toast((e as Error).message, 'err'); } }}>افزودن</button>
      </Sheet>
    </div>
  );
}
