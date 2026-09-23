import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { Group } from '@dong/core';
import { useStore } from '@/app/store';
import { Mascot } from '@/design-system/Mascot';
import { formatAmount } from '@dong/core';

export function JoinPage() {
  const { token = '' } = useParams();
  const [sp] = useSearchParams();
  const snap = sp.get('s') ?? '';
  const { adapter, user, refresh, toast } = useStore();
  const nav = useNavigate();
  const [info, setInfo] = useState<{ group: Group; memberCount: number } | null | undefined>(undefined);
  useEffect(() => {
    (async () => {
      const local = await adapter.groupByInvite(token);
      if (local) return setInfo(local);
      if (snap && adapter.importSnapshot) return setInfo(await adapter.importSnapshot(snap));
      setInfo(null);
    })();
  }, [token, snap, adapter]);
  useEffect(() => { if (user === null) { sessionStorage.setItem('dong.after', `/join/${token}${snap ? `?s=${snap}` : ''}`); nav('/auth', { replace: true }); } }, [user, token, snap, nav]);
  const join = async () => {
    try {
      const local = await adapter.groupByInvite(token);
      const g = local || !snap || !adapter.joinSnapshot ? await adapter.joinGroup(token) : await adapter.joinSnapshot(snap);
      if (local && snap && adapter.joinSnapshot) await adapter.joinSnapshot(snap); // merge newer data too
      await refresh(); toast(`به «${g.name}» خوش اومدی 🎉`, 'ok'); nav(`/g/${g.id}`, { replace: true });
    } catch (e) { toast((e as Error).message, 'err'); }
  };
  return (
    <div className="min-h-dvh grid place-items-center px-6 grain" style={{ background: 'var(--grad-hero)' }}>
      <div className="card w-full max-w-sm p-6 flex flex-col items-center text-center gap-3">
        <Mascot mood={info === null ? 'confused' : 'happy'} size={100} />
        {info === undefined ? <p className="text-ink-2">در حال بررسی…</p> : info === null ? (
          <><h2 className="text-xl font-extrabold">لینک دعوت نامعتبره</h2><p className="text-sm text-ink-2 leading-7">این لینک ناقص یا خراب است. از سازنده گروه بخواه از صفحه «دعوت» لینک را دوباره برایت بفرستد.</p><button onClick={() => nav('/')} className="btn-ghost w-full mt-2">بازگشت</button></>
        ) : (
          <><h2 className="text-xl font-extrabold">می‌خوای به «{info.group.name}» بپیوندی؟</h2><p className="text-sm text-ink-2">{formatAmount(info.memberCount)} نفر عضو هستند</p>
            <button onClick={join} className="btn-primary w-full mt-2">بله، عضو می‌شم</button><button onClick={() => nav('/')} className="text-sm text-ink-2 font-semibold">نه، بعداً</button></>
        )}
      </div>
    </div>
  );
}
