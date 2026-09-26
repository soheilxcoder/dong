import { useEffect, useState } from 'react';
import { useStore } from '@/app/store';
import { PageHeader } from '@/design-system/ui';

declare const __BUILD_ID__: string;

export function DebugPage() {
  const { adapter, user, settings, refresh } = useStore();
  const [log, setLog] = useState<string[]>([]);
  const add = (s: string) => setLog((l) => [...l, s]);
  const [sw, setSw] = useState('?');
  useEffect(() => { navigator.serviceWorker?.getRegistrations?.().then((rs) => setSw(rs.length ? rs.map((r) => (r.active?.scriptURL ?? '').split('/').slice(-2).join('/')).join(', ') : 'none')).catch(() => setSw('n/a')); }, []);
  const testSave = async () => {
    setLog([]);
    try {
      add('شروع…');
      const before = await adapter.me(); add('کارت فعلی: ' + (before?.cardNumber ?? '—'));
      const r = await adapter.updateMe({ cardNumber: '6037991712349876' }); add('updateMe برگشت: ' + (r?.cardNumber ?? '—'));
      await refresh(); const after = await adapter.me(); add('بعد از refresh: ' + (after?.cardNumber ?? '—'));
      add(after?.cardNumber === '6037991712349876' ? '✅ ذخیره درست کار می‌کند' : '❌ ذخیره نشد');
    } catch (e) { add('❌ خطا: ' + ((e as Error).message || String(e)) + '\n' + ((e as Error).stack ?? '').slice(0, 300)); }
  };
  const info = {
    build: typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'dev',
    url: location.href,
    ua: navigator.userAgent,
    adapter: adapter.kind,
    apiUrl: settings.apiUrl || '(خالی)',
    user: user ? `${user.fullName} @${user.username} (${user.id.slice(0, 8)}) card=${user.cardNumber ?? '—'}` : String(user),
    session: localStorage.getItem('dong.session') ?? '—',
    token: localStorage.getItem('dong.token') ? 'yes' : 'no',
    sw,
    storage: typeof indexedDB !== 'undefined' ? 'indexedDB ok' : 'NO indexedDB',
  };
  return (
    <div className="safe-b">
      <PageHeader title="عیب‌یابی" />
      <div className="px-5 flex flex-col gap-3">
        <div className="card p-4 text-xs leading-6 break-all" dir="ltr">
          {Object.entries(info).map(([k, v]) => <div key={k}><b>{k}:</b> {v}</div>)}
        </div>
        <button className="btn-primary w-full" onClick={testSave}>تست ذخیرهٔ شماره کارت</button>
        {log.length > 0 && <pre className="card p-4 text-xs whitespace-pre-wrap leading-6">{log.join('\n')}</pre>}
        <button className="btn-ghost w-full" onClick={async () => { const rs = await navigator.serviceWorker?.getRegistrations?.(); for (const r of rs ?? []) await r.unregister(); const ks = await caches?.keys?.(); for (const k of ks ?? []) await caches.delete(k); location.reload(); }}>پاک کردن کش و بارگذاری مجدد</button>
      </div>
    </div>
  );
}
