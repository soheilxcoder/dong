import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Smartphone, Share, PlusSquare, Download, X, MonitorSmartphone } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { APK_URL, canPromptInstall, isAndroid, isIOS, isNative, isStandalone, onInstallChange, promptInstall } from '@/lib/install';

/** iOS "Add to Home Screen" instructions */
export function IosSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div dir="rtl" className="glass w-full max-w-lg rounded-t-[28px] p-6 pb-10" style={{ background: 'rgb(var(--c-surface) / 0.95)' }}
            initial={{ y: 200 }} animate={{ y: 0 }} exit={{ y: 200 }} transition={{ type: 'spring', stiffness: 300, damping: 30 }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h3 className="font-black text-lg">نصب دُنگ روی آیفون</h3><button onClick={onClose} className="p-2 text-ink-2"><X size={20} /></button></div>
            <ol className="space-y-3 text-sm leading-7">
              <li className="flex gap-3 items-start"><span className="w-7 h-7 rounded-full bg-brand/15 text-brand font-black grid place-items-center shrink-0">۱</span><span>این صفحه را در <b>Safari</b> باز کن (نه داخل تلگرام/اینستاگرام).</span></li>
              <li className="flex gap-3 items-start"><span className="w-7 h-7 rounded-full bg-brand/15 text-brand font-black grid place-items-center shrink-0">۲</span><span>پایین صفحه روی دکمهٔ <b>اشتراک‌گذاری</b> <Share size={16} className="inline -mt-1" /> بزن.</span></li>
              <li className="flex gap-3 items-start"><span className="w-7 h-7 rounded-full bg-brand/15 text-brand font-black grid place-items-center shrink-0">۳</span><span>گزینهٔ <b>Add to Home Screen</b> <PlusSquare size={16} className="inline -mt-1" /> («افزودن به صفحهٔ اصلی») را انتخاب کن و <b>Add</b> بزن.</span></li>
            </ol>
            <p className="text-xs text-ink-2 mt-4">دُنگ مثل یک اپ واقعی، تمام‌صفحه و آفلاین روی گوشی‌ات نصب می‌شود.</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>, document.body);
}

/** Card shown on the auth page (web only): APK for Android, PWA install, iOS guide */
export function GetAppCard() {
  const [, force] = useState(0);
  const [ios, setIos] = useState(false);
  useEffect(() => onInstallChange(() => force((n) => n + 1)), []);
  if (isNative() || isStandalone()) return null;
  const pwa = canPromptInstall();
  return (
    <div className="card p-4 mt-4">
      <div className="flex items-center gap-2 mb-3"><MonitorSmartphone size={18} className="text-brand" /><h3 className="font-black text-sm">دُنگ را روی گوشی‌ات داشته باش</h3></div>
      <div className="grid gap-2">
        {!isIOS() && (
          <a href={APK_URL} className="btn-primary w-full !min-h-11 text-sm" download><Download size={16} /> دانلود اپ اندروید (APK)</a>
        )}
        {pwa && <button onClick={() => promptInstall()} className="btn-ghost w-full !min-h-11 text-sm"><Smartphone size={16} /> نصب نسخهٔ وب روی {isAndroid() ? 'گوشی' : 'کامپیوتر'}</button>}
        {(isIOS() || !isAndroid()) && (
          <button onClick={() => setIos(true)} className={`${isIOS() ? 'btn-primary' : 'btn-ghost'} w-full !min-h-11 text-sm`}><PlusSquare size={16} /> نصب روی آیفون (وب‌اپ)</button>
        )}
      </div>
      <IosSheet open={ios} onClose={() => setIos(false)} />
    </div>
  );
}

/** Desktop-only side panel next to the phone-sized app frame */
export function DesktopAside() {
  const [ios, setIos] = useState(false);
  if (isNative()) return null;
  const url = (import.meta.env.VITE_PUBLIC_URL as string | undefined) || location.origin + location.pathname;
  return createPortal(
    <aside id="aside" dir="rtl" className="hidden lg:flex">
      <div className="flex flex-col gap-5 max-w-sm">
        <img src={`${import.meta.env.BASE_URL}icons/icon-192.png`} alt="" className="w-20 h-20 rounded-[22px] shadow-2xl" onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')} />
        <div><h2 className="text-4xl font-black text-white">دُنگ</h2><p className="text-white/75 mt-1">حساب‌کتاب دنگی سفر و دورهمی — کی به کی چقدر بدهکاره؟</p></div>
        <div className="bg-white rounded-3xl p-4 self-start shadow-2xl"><QRCodeSVG value={url} size={150} level="M" fgColor="#0e3b52" /></div>
        <p className="text-white/70 text-sm -mt-2">با گوشی اسکن کن تا همین‌جا روی موبایل باز شود.</p>
        <div className="flex flex-col gap-2">
          <a href={APK_URL} className="btn-primary !min-h-11 text-sm justify-center" download><Download size={16} /> دانلود اپ اندروید (APK)</a>
          <button onClick={() => setIos(true)} className="btn-ghost !min-h-11 text-sm justify-center bg-white/10 text-white border-white/20"><PlusSquare size={16} /> نصب روی آیفون (وب‌اپ)</button>
        </div>
      </div>
      <IosSheet open={ios} onClose={() => setIos(false)} />
    </aside>, document.body);
}
