import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { formatCardNumber, cardNumberError, normalizeCardNumber } from '@dong/core';
import { useStore } from '@/app/store';
import { Field, Segmented, Busy, PasswordInput } from '@/design-system/ui';
import { Mascot } from '@/design-system/Mascot';
import { errTone, haptic } from '@/lib/native';
import { GetAppCard } from '@/features/install/GetApp';

type Mode = 'login' | 'register' | 'reset';

export function AuthPage() {
  const [mode, setMode] = useState<Mode>('login');
  const { adapter, refresh, toast, settings } = useStore();
  const nav = useNavigate();
  const loc = useLocation() as { state?: { from?: string } };
  const [f, setF] = useState({ fullName: '', username: '', password: '', q: '', a: '', card: '', newPw: '' });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [question, setQuestion] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  const fail = (m: string) => { setErr(m); haptic('error'); errTone(settings.sound); };
  // after login only follow "safe" targets (invite links); a stale /g/<id> from another account/device would land on an empty page
  const go = () => { const raw = sessionStorage.getItem('dong.after') ?? loc.state?.from ?? '/'; sessionStorage.removeItem('dong.after'); const to = typeof raw === 'string' && raw.startsWith('/join/') ? raw : '/'; nav(to, { replace: true }); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(null); setBusy(true);
    try {
      if (mode === 'login') { await adapter.login(f.username, f.password); await refresh(); go(); }
      else if (mode === 'register') {
        if (f.fullName.trim().length < 2) throw new Error('نام کامل را وارد کنید');
        { const ce = cardNumberError(f.card); if (ce) throw new Error(ce); }
        await adapter.register({ fullName: f.fullName, username: f.username, password: f.password, securityQuestion: f.q || undefined, securityAnswer: f.a || undefined, cardNumber: f.card || undefined });
        await refresh(); toast('حساب ساخته شد', 'ok'); go();
      } else {
        if (question === null) {
          const q = await adapter.getSecurityQuestion(f.username);
          if (!q) throw new Error('برای این حساب سؤال امنیتی ثبت نشده');
          setQuestion(q);
        } else {
          await adapter.resetPassword(f.username, f.a, f.newPw);
          toast('رمز عبور تغییر کرد؛ حالا وارد شو', 'ok'); setMode('login'); setQuestion(null);
        }
      }
    } catch (ex) { fail((ex as Error).message); } finally { setBusy(false); }
  };

  return (
    <div className="min-h-dvh flex flex-col">
      <div className="hero relative px-6 pb-9 flex flex-col items-center gap-1 overflow-hidden" style={{ paddingTop: 'calc(var(--safe-top) + 24px)' }}>
        <div className="hero-blob hero-blob-a" /><div className="hero-blob hero-blob-b" />
        <div className="relative flex items-center gap-3">
          <Mascot mood={err ? 'confused' : 'idle'} size={64} />
          <div><h1 className="text-3xl font-black text-white leading-none">دُنگ</h1><p className="text-white/70 text-xs mt-1.5">حساب‌کتاب مشترک، ساده و شفاف</p></div>
        </div>
      </div>
      <div className="px-5 -mt-6">
        <div className="card p-5">
          <Segmented value={mode === 'reset' ? 'login' : mode} onChange={(m) => { setMode(m); setErr(null); }} options={[{ value: 'login', label: 'ورود' }, { value: 'register', label: 'ثبت‌نام' }]} />
          <form onSubmit={submit} className="mt-5">
            <AnimatePresence mode="popLayout" initial={false}>
              {mode === 'register' && (
                <motion.div key="name" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                  <Field label="نام کامل"><input className="input" value={f.fullName} onChange={set('fullName')} placeholder="مثلاً علی رضایی" autoComplete="name" /></Field>
                </motion.div>
              )}
            </AnimatePresence>
            <Field label="نام کاربری" error={err && mode === 'login' ? err : null}>
              <input className="input" dir="ltr" value={f.username} onChange={set('username')} placeholder="ali_r" autoCapitalize="none" autoComplete="username" />
            </Field>
            {mode !== 'reset' && (
              <Field label="رمز عبور" error={err && mode === 'register' ? err : null}>
                <PasswordInput value={f.password} onChange={set('password')} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
              </Field>
            )}
            {mode === 'register' && (
              <>
                <Field label="سؤال امنیتی (برای بازیابی رمز — اختیاری)"><input className="input" value={f.q} onChange={set('q')} placeholder="مثلاً: اسم اولین معلمم؟" /></Field>
                {f.q && <Field label="پاسخ"><input className="input" value={f.a} onChange={set('a')} /></Field>}
                <Field label="شماره کارت بانکی (اختیاری)"><input className="input mono" inputMode="numeric" maxLength={19} value={formatCardNumber(f.card)} onChange={(e) => setF({ ...f, card: normalizeCardNumber(e.target.value).slice(0, 16) })} placeholder="6037 9917 •••• ••••" /></Field>
              </>
            )}
            {mode === 'reset' && (
              <>
                {question && (
                  <>
                    <Field label={question}><input className="input" value={f.a} onChange={set('a')} /></Field>
                    <Field label="رمز جدید"><PasswordInput value={f.newPw} onChange={set('newPw')} autoComplete="new-password" /></Field>
                  </>
                )}
                {err && <p className="text-neg text-xs font-semibold mb-3">{err}</p>}
              </>
            )}
            <button className="btn-primary w-full text-base mt-1" disabled={busy}>
              <Busy busy={busy} label={mode === 'login' ? 'در حال ورود…' : mode === 'register' ? 'در حال ساخت حساب…' : 'چند لحظه…'}>{mode === 'login' ? 'ورود' : mode === 'register' ? 'ساخت حساب' : question ? 'تغییر رمز' : 'ادامه'}</Busy>
            </button>
          </form>
          {mode === 'login' && <button onClick={() => { setMode('reset'); setErr(null); }} className="block mx-auto mt-4 text-sm text-ink-2 font-semibold">رمز رو فراموش کردی؟</button>}
          {mode === 'reset' && <button onClick={() => { setMode('login'); setQuestion(null); setErr(null); }} className="block mx-auto mt-4 text-sm text-ink-2 font-semibold">بازگشت به ورود</button>}
        </div>
        <GetAppCard />
        <p className="text-center text-xs text-ink-2 mt-6 leading-6 px-4">داده‌های شما روی همین دستگاه ذخیره می‌شود. هیچ تراکنش بانکی داخل دُنگ انجام نمی‌شود.</p>
      </div>
    </div>
  );
}
