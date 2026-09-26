import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { Group } from '@dong/core';
import { useStore } from '@/app/store';
import { Mascot } from '@/design-system/Mascot';
import { formatAmount } from '@dong/core';
import { extractSnapshot } from '@/data/snapshot';

export function JoinPage() {
  const { token = '' } = useParams();
  const [sp] = useSearchParams();
  const snap = sp.get('s') ?? '';
  const { adapter, user, refresh, toast } = useStore();
  const nav = useNavigate();
  const [info, setInfo] = useState<{ group: Group; memberCount: number } | null | undefined>(undefined);
  const [pasted, setPasted] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    (async () => {
      if (token === 'paste' && !snap) return setInfo(null);
      const local = await adapter.groupByInvite(token);
      if (local) return setInfo(local);
      if (snap && adapter.importSnapshot) return setInfo(await adapter.importSnapshot(snap));
      setInfo(null);
    })();
  }, [token, snap, adapter]);
  useEffect(() => { if (user === null) { sessionStorage.setItem('dong.after', `/join/${token}${snap ? `?s=${snap}` : ''}`); nav('/auth', { replace: true }); } }, [user, token, snap, nav]);
  const join = async () => {
    setBusy(true);
    try {
      const local = await adapter.groupByInvite(token);
      const g = local || !snap || !adapter.joinSnapshot ? await adapter.joinGroup(token) : await adapter.joinSnapshot(snap);
      if (local && snap && adapter.joinSnapshot) await adapter.joinSnapshot(snap); // merge newer data too
      await refresh(); toast(`به «${g.name}» خوش اومدی 🎉`, 'ok'); nav(`/g/${g.id}`, { replace: true });
    } catch (e) { toast((e as Error).message, 'err'); } finally { setBusy(false); }
  };
  const usePasted = () => {
    const code = extractSnapshot(pasted);
    if (!code) return toast('لینک یا کد معتبر نیست', 'err');
    const t = pasted.match(/#\/join\/([^?\s]+)/)?.[1] ?? token ?? 'x';
    nav(`/join/${t}?s=${code}`, { replace: true });
  };
  return (
    <div className="min-h-dvh grid place-items-center px-6 grain" style={{ background: 'var(--grad-hero)' }}>
      <div className="card w-full max-w-sm p-6 flex flex-col items-center text-center gap-3">
        <Mascot mood={info === null ? 'confused' : 'happy'} size={100} />
        {info === undefined ? <p className="text-ink-2">در حال بررسی…</p> : info === null ? (
          <><h2 className="text-xl font-extrabold">لینک دعوت ناقصه</h2><p className="text-sm text-ink-2 leading-7">احتمالاً پیام‌رسان لینک را کوتاه کرده. کل متن لینک را از سازنده گروه کپی کن و اینجا بچسبان:</p>
            <textarea className="input py-3 min-h-24 text-xs" dir="ltr" placeholder="https://…/dong/#/join/…?s=f…" value={pasted} onChange={(e) => setPasted(e.target.value)} />
            <button onClick={usePasted} className="btn-primary w-full">بررسی لینک</button>
            <button onClick={() => nav('/')} className="text-sm text-ink-2 font-semibold">بازگشت</button></>
        ) : (
          <><h2 className="text-xl font-extrabold">می‌خوای به «{info.group.name}» بپیوندی؟</h2><p className="text-sm text-ink-2">{formatAmount(info.memberCount)} نفر عضو هستند</p><p className="text-xs text-ink-2 leading-6">بعد از عضویت، هزینه‌های گروه را می‌بینی، خرج ثبت می‌کنی و سهمت خودکار حساب می‌شود.</p>
            <button onClick={join} disabled={busy} className="btn-primary w-full mt-2">{busy ? 'در حال افزودن…' : 'بله، عضو می‌شم'}</button><button onClick={() => nav('/')} className="text-sm text-ink-2 font-semibold">نه، بعداً</button></>
        )}
      </div>
    </div>
  );
}
