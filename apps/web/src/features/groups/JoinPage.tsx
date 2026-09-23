import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { Group } from '@dong/core';
import { useStore } from '@/app/store';
import { Mascot } from '@/design-system/Mascot';
import { formatAmount } from '@dong/core';

export function JoinPage() {
  const { token = '' } = useParams();
  const { adapter, user, refresh, toast } = useStore();
  const nav = useNavigate();
  const [info, setInfo] = useState<{ group: Group; memberCount: number } | null | undefined>(undefined);
  useEffect(() => { adapter.groupByInvite(token).then(setInfo); }, [token, adapter]);
  useEffect(() => { if (user === null) { sessionStorage.setItem('dong.after', `/join/${token}`); nav('/auth', { replace: true }); } }, [user, token, nav]);
  const join = async () => { try { const g = await adapter.joinGroup(token); await refresh(); toast(`به «${g.name}» خوش اومدی 🎉`, 'ok'); nav(`/g/${g.id}`, { replace: true }); } catch (e) { toast((e as Error).message, 'err'); } };
  return (
    <div className="min-h-dvh grid place-items-center px-6 grain" style={{ background: 'var(--grad-hero)' }}>
      <div className="card w-full max-w-sm p-6 flex flex-col items-center text-center gap-3">
        <Mascot mood={info === null ? 'confused' : 'happy'} size={100} />
        {info === undefined ? <p className="text-ink-2">در حال بررسی…</p> : info === null ? (
          <><h2 className="text-xl font-extrabold">لینک دعوت نامعتبره</h2><p className="text-sm text-ink-2 leading-7">در نسخه محلی، فقط لینک‌هایی که روی همین دستگاه ساخته شدن کار می‌کنن. برای گروه‌های چنددستگاهی، سرور دُنگ را در تنظیمات متصل کنید.</p><button onClick={() => nav('/')} className="btn-ghost w-full mt-2">بازگشت</button></>
        ) : (
          <><h2 className="text-xl font-extrabold">می‌خوای به «{info.group.name}» بپیوندی؟</h2><p className="text-sm text-ink-2">{formatAmount(info.memberCount)} نفر عضو هستند</p>
            <button onClick={join} className="btn-primary w-full mt-2">بله، عضو می‌شم</button><button onClick={() => nav('/')} className="text-sm text-ink-2 font-semibold">نه، بعداً</button></>
        )}
      </div>
    </div>
  );
}
