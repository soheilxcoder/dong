import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Camera, ImageIcon } from 'lucide-react';
import { Sheet } from '@/design-system/ui';
import { haptic } from '@/lib/native';

/** Turn whatever a Dong QR / link contains into an in-app route (never leaves the app). */
export function joinRouteFromText(text: string): string | null {
  const t = text.trim();
  const m = t.match(/#\/join\/([^?\s#]+)(\?s=[^\s#]+)?/) || t.match(/dong:\/\/join\/([^?\s#]+)(\?s=[^\s#]+)?/);
  if (m) return `/join/${m[1]}${m[2] ?? ''}`;
  if (/^[a-z0-9]{8,40}$/i.test(t)) return `/join/${t}`; // bare invite code
  return null;
}

/** In-app QR scanner: live camera (getUserMedia + jsQR) with a "pick from gallery" fallback. */
export function QrScanSheet({ open, onClose, onResult }: { open: boolean; onClose: () => void; onResult: (route: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [err, setErr] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    let stream: MediaStream | null = null; let raf = 0; let stopped = false;
    const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const tick = () => {
      if (stopped) return;
      const v = videoRef.current;
      if (v && v.readyState >= 2 && ctx) {
        const w = Math.min(640, v.videoWidth), h = Math.round((v.videoHeight / v.videoWidth) * w) || 480;
        canvas.width = w; canvas.height = h; ctx.drawImage(v, 0, 0, w, h);
        const code = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'dontInvert' });
        if (code?.data) {
          const route = joinRouteFromText(code.data);
          if (route) { stopped = true; haptic('success'); onResult(route); return; }
          setErr('این QR مربوط به دُنگ نیست');
        }
      }
      raf = requestAnimationFrame(tick);
    };
    (async () => {
      setErr(null); setScanning(false);
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('دوربین در دسترس نیست');
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
        if (stopped) { stream.getTracks().forEach((t) => t.stop()); return; }
        const v = videoRef.current!; v.srcObject = stream; await v.play();
        setScanning(true); raf = requestAnimationFrame(tick);
      } catch (e) {
        const name = (e as { name?: string }).name;
        setErr(name === 'NotAllowedError' ? 'اجازهٔ دوربین داده نشد. از تنظیمات گوشی اجازه بده یا عکس QR را انتخاب کن.' : 'دوربین باز نشد؛ عکس QR را انتخاب کن.');
      }
    })();
    return () => { stopped = true; cancelAnimationFrame(raf); stream?.getTracks().forEach((t) => t.stop()); const v = videoRef.current; if (v) v.srcObject = null; };
  }, [open, onResult]);

  const fromFile = async (f: File) => {
    try {
      const bmp = await createImageBitmap(f);
      const w = Math.min(1200, bmp.width), h = Math.round((bmp.height / bmp.width) * w);
      const c = document.createElement('canvas'); c.width = w; c.height = h; const cx = c.getContext('2d')!; cx.drawImage(bmp, 0, 0, w, h);
      const code = jsQR(cx.getImageData(0, 0, w, h).data, w, h);
      const route = code?.data ? joinRouteFromText(code.data) : null;
      if (route) { haptic('success'); onResult(route); } else setErr('QR در این عکس پیدا نشد');
    } catch { setErr('عکس خوانده نشد'); }
  };

  return (
    <Sheet open={open} onClose={onClose} title="اسکن QR دعوت">
      <div className="flex flex-col gap-3 pb-2">
        <div className="relative rounded-3xl overflow-hidden bg-black aspect-[3/4] max-h-[52dvh] mx-auto w-full">
          <video ref={videoRef} playsInline muted className="absolute inset-0 w-full h-full object-cover" />
          {/* viewfinder */}
          <div className="absolute inset-0 grid place-items-center pointer-events-none">
            <div className="w-[62%] aspect-square rounded-3xl border-2 border-white/90 shadow-[0_0_0_999px_rgba(0,0,0,0.35)]" />
          </div>
          {!scanning && !err && <div className="absolute inset-0 grid place-items-center text-white/90 text-sm font-bold"><span className="flex items-center gap-2"><Camera size={18} /> در حال باز کردن دوربین…</span></div>}
        </div>
        <p className="text-center text-xs text-ink-2 leading-6">{err ?? 'QR دعوت دوستت را داخل کادر بگیر؛ خودکار عضو گروه می‌شوی.'}</p>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void fromFile(f); e.target.value = ''; }} />
        <button type="button" className="btn-ghost w-full" onClick={() => fileRef.current?.click()}><ImageIcon size={18} /> انتخاب عکس QR از گالری</button>
      </div>
    </Sheet>
  );
}
