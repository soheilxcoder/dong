import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, LogOut, Moon, Sun, Monitor, Volume2, VolumeX, KeyRound, CreditCard, Info, Server, Smartphone, Bell, BookOpen } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { formatCardNumber, isValidCardNumber, detectBank, normalizeCardNumber, formatAmount } from '@dong/core';
import { useStore, type Theme } from '@/app/store';
import { Avatar, CopyCardNumber, Field, PageHeader, Sheet } from '@/design-system/ui';
import { Mascot } from '@/design-system/Mascot';
import { compressImage, haptic } from '@/lib/native';
import { Tour } from '@/design-system/Tour';
import { HelpSheet } from '@/features/profile/HelpSheet';

declare const __BUILD_ID__: string;

export function ProfilePage() {
  const { user, adapter, refresh, toast, settings, setSettings } = useStore();
  const nav = useNavigate();
  const me = user!;
  const [cardOpen, setCardOpen] = useState(false); const [card, setCard] = useState(me.cardNumber ?? ''); const [holder, setHolder] = useState(me.cardHolderName ?? '');
  const [nameOpen, setNameOpen] = useState(false); const [name, setName] = useState(me.fullName);
  const [pwOpen, setPwOpen] = useState(false); const [pw, setPw] = useState({ old: '', new: '' });
  const [apiOpen, setApiOpen] = useState(false); const [api, setApi] = useState(settings.apiUrl);
  const bank = me.cardNumber ? detectBank(me.cardNumber) : null;
  const [helpOpen, setHelpOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dev, setDev] = useState(localStorage.getItem('dong.dev') === '1');
  const tapRef = useRef(0);
  useEffect(() => { if (!cardOpen) { setCard(me.cardNumber ?? ''); setHolder(me.cardHolderName ?? ''); } }, [me.cardNumber, me.cardHolderName, cardOpen]);

  const saveCard = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (card && !isValidCardNumber(card)) return toast(`شماره کارت باید ۱۶ رقم باشد (الان ${formatAmount(normalizeCardNumber(card).length)} رقم)`, 'err');
    setSaving(true);
    try {
      await adapter.updateMe({ cardNumber: card ? normalizeCardNumber(card) : null, cardHolderName: holder.trim() || null });
      await refresh(); setCardOpen(false); toast('شماره کارت ذخیره شد', 'ok'); haptic('success');
    } catch (ex) { toast(`ذخیره نشد: ${(ex as Error).message || 'خطای نامشخص'}`, 'err'); haptic('error'); }
    finally { setSaving(false); }
  };
  const themes: { v: Theme; I: typeof Sun; l: string }[] = [{ v: 'system', I: Monitor, l: 'سیستم' }, { v: 'light', I: Sun, l: 'روشن' }, { v: 'dark', I: Moon, l: 'تاریک' }];

  return (
    <div className="safe-b">
      <PageHeader title="پروفایل" back={false} />
      <Tour id="profile" delay={600} steps={[
        { target: 'card', title: 'شماره کارتت رو ثبت کن', text: 'وقتی کسی به تو بدهکار باشه، شماره کارتت با یک ضربه براش کپی می‌شه. بانک هم خودکار تشخیص داده می‌شه.' },
        { target: 'theme', title: 'ظاهر دلخواه', text: 'روشن، تاریک یا هماهنگ با گوشی. صدای «دینگ» تأیید پرداخت رو هم می‌تونی خاموش کنی.' },
        { target: 'help', title: 'راهنمای کامل', text: 'هر وقت سؤالی داشتی، «راهنمای استفاده» رو باز کن؛ قدم‌به‌قدم همه بخش‌ها توضیح داده شده. راهنماهای کوتاه هم از همین‌جا دوباره فعال می‌شن.', mood: 'happy' },
      ]} />
      <div className="px-5 flex flex-col gap-4">
        <div className="card p-5 flex items-center gap-4">
          <label className="relative cursor-pointer">
            <Avatar name={me.fullName} src={me.avatarUrl} size={72} />
            <span className="absolute -bottom-1 -left-1 h-7 w-7 rounded-full grid place-items-center text-white ring-2 ring-surface" style={{ background: 'var(--grad-brand)' }}><Camera size={14} /></span>
            <input type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) { await adapter.updateMe({ avatarUrl: await compressImage(f, 'avatar') }); await refresh(); } }} />
          </label>
          <div className="flex-1 min-w-0">
            <button onClick={() => setNameOpen(true)} className="font-extrabold text-lg truncate block text-right">{me.fullName}</button>
            <p className="text-ink-2 text-sm" dir="ltr">@{me.username}</p>
          </div>
        </div>

        {/* Bank card */}
        <button data-tour="card" onClick={() => setCardOpen(true)} className="relative overflow-hidden rounded-card p-5 text-right text-white grain aspect-[1.7] flex flex-col justify-between shadow-xl"
          style={{ background: bank ? `linear-gradient(135deg, ${bank.color} 0%, #0e3b52 100%)` : 'var(--grad-brand)' }}>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 font-bold text-sm"><CreditCard size={18} /> {bank?.name ?? 'کارت بانکی'}</span>
            <span className="text-xs opacity-80 font-black">دُنگ</span>
          </div>
          {me.cardNumber ? (
            <div>
              <p className="mono text-xl sm:text-2xl font-bold tracking-[0.18em] text-center drop-shadow" dir="ltr">{formatCardNumber(me.cardNumber)}</p>
            </div>
          ) : <p className="text-center font-bold opacity-90">شماره کارتت رو ثبت کن تا بقیه راحت‌تر بهت واریز کنن</p>}
          <div className="flex items-end justify-between">
            <span className="font-bold text-sm">{me.cardHolderName || me.fullName}</span>
            {me.cardNumber && <span onClick={(e) => e.stopPropagation()}><CopyCardNumber number={me.cardNumber} /></span>}
          </div>
          <span className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" /><span className="absolute -left-6 -bottom-12 h-32 w-32 rounded-full bg-black/10" />
        </button>

        {/* Settings */}
        <div className="card divide-y divide-line/10">
          <div className="p-4">
            <p data-tour="theme" className="text-sm font-bold mb-2">ظاهر</p>
            <div className="grid grid-cols-3 gap-2">
              {themes.map(({ v, I, l }) => <button key={v} onClick={() => setSettings({ theme: v })} className={`rounded-2xl py-2.5 text-sm font-bold flex items-center justify-center gap-1.5 ${settings.theme === v ? 'text-white' : 'bg-surface-2 text-ink-2'}`} style={settings.theme === v ? { background: 'var(--grad-brand)' } : undefined}><I size={16} /> {l}</button>)}
            </div>
          </div>
          {adapter.kind === 'api' && <Row icon={<Bell size={18} />} label="نوتیفیکیشن (هزینه، پرداخت، یادآوری)" right={<Toggle on={settings.notifications} onChange={(v) => setSettings({ notifications: v })} />} />}
          <Row icon={settings.sound ? <Volume2 size={18} /> : <VolumeX size={18} />} label="صدای «دینگ» تأیید" right={<Toggle on={settings.sound} onChange={(v) => setSettings({ sound: v })} />} />
          <Row icon={<KeyRound size={18} />} label="تغییر رمز عبور" onClick={() => setPwOpen(true)} />
          <Row data-tour="help" icon={<BookOpen size={18} />} label="راهنمای استفاده" sub="قدم‌به‌قدم، همه بخش‌ها" onClick={() => setHelpOpen(true)} />
          <Row icon={<Info size={18} />} label="نمایش دوباره راهنماهای کوتاه" onClick={() => { setSettings({ tours: {} }); toast('راهنماها دوباره نمایش داده می‌شوند', 'ok'); }} />
          {dev && <Row icon={<Server size={18} />} label="حالت توسعه‌دهنده: سرور" sub={settings.apiUrl ? `سرور: ${settings.apiUrl}` : 'بدون سرور (همگام‌سازی رمزنگاری‌شده)'} onClick={() => setApiOpen(true)} />}
          {!Capacitor.isNativePlatform() && <Row icon={<Smartphone size={18} />} label="دانلود اپ اندروید (APK)" sub="نصب مستقیم — سریع‌تر و با اعلان" onClick={() => window.open('https://github.com/soheilxcoder/dong/releases/tag/apk-latest', '_blank')} />}
          <Row icon={<Info size={18} />} label="درباره دُنگ" sub={`نسخه ${import.meta.env.VITE_APP_VERSION ?? "1.0.0"} · build ${typeof __BUILD_ID__ !== "undefined" ? __BUILD_ID__ : "dev"}`} onClick={() => { const n = (tapRef.current += 1); if (n >= 7) { tapRef.current = 0; const on = localStorage.getItem('dong.dev') !== '1'; localStorage.setItem('dong.dev', on ? '1' : '0'); setDev(on); toast(on ? 'حالت توسعه‌دهنده فعال شد' : 'حالت توسعه‌دهنده خاموش شد', 'info'); } }} />
        </div>

        <button onClick={async () => { await adapter.logout(); nav('/auth', { replace: true }); }} className="btn-ghost text-neg w-full"><LogOut size={18} /> خروج از حساب</button>
        <div className="flex justify-center opacity-60 pt-2"><Mascot mood="idle" size={64} /></div>
      </div>

      <Sheet open={cardOpen} onClose={() => setCardOpen(false)} title="شماره کارت بانکی">
        <p className="text-xs text-ink-2 leading-6 mb-4">فقط برای نمایش به اعضای گروه جهت واریز دستی. هیچ تراکنشی داخل اپ انجام نمی‌شود.</p>
        <form onSubmit={saveCard}>
        <Field label="شماره کارت (۱۶ رقم)"><input className="input mono text-lg" inputMode="numeric" autoComplete="cc-number" dir="ltr" value={formatCardNumber(card)} onChange={(e) => setCard(e.target.value)} placeholder="6037 9917 0000 0000" /></Field>
        {card && detectBank(card) && <p className="text-xs font-bold mb-3" style={{ color: detectBank(card)!.color }}>● {detectBank(card)!.name}</p>}
        <Field label="نام صاحب کارت (اگر متفاوت است)"><input className="input" value={holder} onChange={(e) => setHolder(e.target.value)} placeholder={me.fullName} /></Field>
        <button type="submit" disabled={saving} className="btn-primary w-full">{saving ? 'در حال ذخیره…' : 'ذخیره'}</button>
        </form>
      </Sheet>
      <Sheet open={nameOpen} onClose={() => setNameOpen(false)} title="ویرایش نام">
        <input className="input mb-4" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn-primary w-full" onClick={async () => { if (name.trim().length < 2) return; await adapter.updateMe({ fullName: name.trim() }); await refresh(); setNameOpen(false); toast('ذخیره شد', 'ok'); }}>ذخیره</button>
      </Sheet>
      <Sheet open={pwOpen} onClose={() => setPwOpen(false)} title="تغییر رمز عبور">
        <Field label="رمز فعلی"><input className="input" type="password" dir="ltr" value={pw.old} onChange={(e) => setPw({ ...pw, old: e.target.value })} /></Field>
        <Field label="رمز جدید"><input className="input" type="password" dir="ltr" value={pw.new} onChange={(e) => setPw({ ...pw, new: e.target.value })} /></Field>
        <button className="btn-primary w-full" onClick={async () => { try { if (pw.new.length < 4) throw new Error('رمز جدید حداقل ۴ کاراکتر'); await adapter.changePassword(pw.old, pw.new); setPwOpen(false); setPw({ old: '', new: '' }); toast('رمز تغییر کرد', 'ok'); } catch (e) { toast((e as Error).message, 'err'); } }}>تغییر رمز</button>
      </Sheet>
      <HelpSheet open={helpOpen} onClose={() => setHelpOpen(false)} />
      <Sheet open={apiOpen} onClose={() => setApiOpen(false)} title="اتصال به سرور">
        <p className="text-xs text-ink-2 leading-6 mb-4">فقط برای توسعه‌دهنده: آدرس سرور API دُنگ. خالی = حالت عادی.</p>
        <Field label="آدرس سرور"><input className="input" dir="ltr" value={api} onChange={(e) => setApi(e.target.value)} placeholder="https://api.example.com" /></Field>
        <button className="btn-primary w-full" onClick={() => { setSettings({ apiUrl: api.trim() }); setApiOpen(false); toast(api.trim() ? 'به سرور متصل شد — وارد حساب سرور شوید' : 'حالت محلی فعال شد', 'ok'); }}>ذخیره</button>
      </Sheet>
    </div>
  );
}

function Row({ icon, label, sub, right, onClick, 'data-tour': tour }: { icon: React.ReactNode; label: string; sub?: string; right?: React.ReactNode; onClick?: () => void; 'data-tour'?: string }) {
  const C = onClick ? 'button' : 'div';
  return (
    <C onClick={onClick} data-tour={tour} className="w-full p-4 flex items-center gap-3 text-right">
      <span className="h-9 w-9 rounded-xl bg-surface-2 grid place-items-center text-ink-2">{icon}</span>
      <div className="flex-1 min-w-0"><p className="text-sm font-bold">{label}</p>{sub && <p className="text-xs text-ink-2 truncate mt-0.5" dir="auto">{sub}</p>}</div>
      {right}
    </C>
  );
}
function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button role="switch" aria-checked={on} onClick={() => onChange(!on)} className={`relative h-7 w-12 rounded-full transition ${on ? '' : 'bg-surface-2'}`} style={on ? { background: 'var(--grad-brand)' } : undefined}>
      <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? 'right-1' : 'right-6'}`} />
    </button>
  );
}
