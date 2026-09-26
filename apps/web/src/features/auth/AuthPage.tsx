import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { formatCardNumber, isValidCardNumber } from '@dong/core';
import { useStore } from '@/app/store';
import { Field, Segmented } from '@/design-system/ui';
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
  const go = () => { const to = sessionStorage.getItem('dong.after') ?? loc.state?.from ?? '/'; sessionStorage.removeItem('dong.after'); nav(to, { replace: true }); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(null); setBusy(true);
    try {
      if (mode === 'login') { await adapter.login(f.username, f.password); await refresh(); go(); }
      else if (mode === 'register') {
        if (f.fullName.trim().length < 2) throw new Error('نام کامل را وارد کنید');
        if (f.card && !isValidCardNumber(f.card)) throw new Error('شماره کارت باید ۱۶ رقم باشد');
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
      <div className="curve-bottom grain relative px-6 pb-10 flex flex-col items-center gap-2" style={{ background: 'var(--grad-hero)', paddingTop: 'calc(var(--safe-top) + 32px)' }}>
        <Mascot mood={err ? 'confused' : 'idle'} size={96} />
        <h1 className="text-4xl font-black text-white">دُنگ</h1>
        <p className="text-white/70 text-sm">حساب‌کتاب دنگی، بدون دعوا</p>
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
                <input className="input" dir="ltr" type="password" value={f.password} onChange={set('password')} placeholder="••••••" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
              </Field>
            )}
            {mode === 'register' && (
              <>
                <Field label="سؤال امنیتی (برای بازیابی رمز — اختیاری)"><input className="input" value={f.q} onChange={set('q')} placeholder="مثلاً: اسم اولین معلمم؟" /></Field>
                {f.q && <Field label="پاسخ"><input className="input" value={f.a} onChange={set('a')} /></Field>}
                <Field label="شماره کارت بانکی (اختیاری)"><input className="input mono" inputMode="numeric" value={formatCardNumber(f.card)} onChange={set('card')} placeholder="6037 9917 •••• ••••" /></Field>
              </>
            )}
            {mode === 'reset' && (
              <>
                {question && (
                  <>
                    <Field label={question}><input className="input" value={f.a} onChange={set('a')} /></Field>
                    <Field label="رمز جدید"><input className="input" dir="ltr" type="password" value={f.newPw} onChange={set('newPw')} /></Field>
                  </>
                )}
                {err && <p className="text-neg text-xs font-semibold mb-3">{err}</p>}
              </>
            )}
            <button className="btn-primary w-full text-base mt-1" disabled={busy}>
              {busy ? <span className="h-5 w-5 rounded-full border-2 border-white/40 border-t-white animate-spin" /> : mode === 'login' ? 'ورود' : mode === 'register' ? 'ساخت حساب' : question ? 'تغییر رمز' : 'ادامه'}
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
