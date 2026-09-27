import { useEffect, useState } from 'react';
import { Busy } from '@/design-system/ui';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { Group } from '@dong/core';
import { useStore } from '@/app/store';
import { Mascot } from '@/design-system/Mascot';
import { formatAmount } from '@dong/core';
import { extractSnapshot } from '@/data/snapshot';
import { QrScanSheet, joinRouteFromText } from './QrScanSheet';
import { ScanLine, Smartphone } from 'lucide-react';
import { isAndroid, isNative } from '@/lib/install';

export function JoinPage() {
  const { token = '' } = useParams();
  const [sp] = useSearchParams();
  const snap = sp.get('s') ?? '';
  const { adapter, user, refresh, toast } = useStore();
  const nav = useNavigate();
  const [info, setInfo] = useState<{ group: Group; memberCount: number } | null | undefined>(undefined);
  const [pasted, setPasted] = useState('');
  const [busy, setBusy] = useState(false);
  const [scan, setScan] = useState(false);
  // Opened in a browser on Android (link from Telegram/camera): hand over to the installed app; keeps the browser as fallback.
  const intentUrl = `intent://join/${token}${snap ? `?s=${snap}` : ''}#Intent;scheme=dong;package=ir.dong.app;S.browser_fallback_url=${encodeURIComponent(location.href)};end`;
  const canHandOff = isAndroid() && !isNative() && token !== 'paste';
  useEffect(() => { if (canHandOff && !sessionStorage.getItem('dong.handoff')) { sessionStorage.setItem('dong.handoff', '1'); location.href = intentUrl; } }, [canHandOff, intentUrl]);
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
    const route = joinRouteFromText(pasted);
    if (code) { const t = pasted.match(/#\/join\/([^?\s]+)/)?.[1] ?? token ?? 'x'; return nav(`/join/${t}?s=${code}`, { replace: true }); }
    if (route) return nav(route, { replace: true });
    toast('لینک یا کد معتبر نیست', 'err');
  };
  return (
    <div className="min-h-dvh grid place-items-center px-6 grain" style={{ background: 'var(--grad-hero)' }}>
      <div className="card w-full max-w-sm p-6 flex flex-col items-center text-center gap-3">
        <Mascot mood={info === null ? 'confused' : 'happy'} size={100} />
        {info === undefined ? <p className="text-ink-2">در حال بررسی…</p> : info === null ? (
          <><h2 className="text-xl font-extrabold">{token === 'paste' ? 'عضویت در گروه' : 'لینک دعوت ناقصه'}</h2>
            <button onClick={() => setScan(true)} className="btn-primary w-full"><ScanLine size={18} /> اسکن QR دعوت</button>
            <p className="text-sm text-ink-2 leading-7">{token === 'paste' ? 'یا لینک/کد دعوت را این‌جا بچسبان:' : 'احتمالاً پیام‌رسان لینک را کوتاه کرده. کل متن لینک را از سازنده گروه کپی کن و اینجا بچسبان:'}</p>
            <textarea className="input py-3 min-h-24 text-xs" dir="ltr" placeholder="https://…/dong/#/join/…?s=f…" value={pasted} onChange={(e) => setPasted(e.target.value)} />
            <button onClick={usePasted} className="btn-ghost w-full">بررسی لینک</button>
            <button onClick={() => nav('/')} className="text-sm text-ink-2 font-semibold">بازگشت</button></>
        ) : (
          <><h2 className="text-xl font-extrabold">می‌خوای به «{info.group.name}» بپیوندی؟</h2><p className="text-sm text-ink-2">{formatAmount(info.memberCount)} نفر عضو هستند</p><p className="text-xs text-ink-2 leading-6">بعد از عضویت، هزینه‌های گروه را می‌بینی، خرج ثبت می‌کنی و سهمت خودکار حساب می‌شود.</p>
            {canHandOff && <a href={intentUrl} className="btn-ghost w-full mt-1"><Smartphone size={18} /> باز کردن در اپ دُنگ</a>}
            <button onClick={join} disabled={busy} className="btn-primary w-full mt-2"><Busy busy={busy} label="در حال عضویت…">بله، عضو می‌شم</Busy></button><button onClick={() => nav('/')} className="text-sm text-ink-2 font-semibold">نه، بعداً</button></>
        )}
      </div>
      <QrScanSheet open={scan} onClose={() => setScan(false)} onResult={(route) => { setScan(false); nav(route, { replace: true }); }} />
    </div>
  );
}
