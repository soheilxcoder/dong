/** Thin wrappers around Capacitor plugins with web fallbacks. */
const cap = () => (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean; Plugins?: Record<string, any> } }).Capacitor;
export const isNative = () => !!cap()?.isNativePlatform?.();

export async function haptic(kind: 'light' | 'medium' | 'success' | 'error' = 'light') {
  try {
    const H = cap()?.Plugins?.Haptics;
    if (H) {
      if (kind === 'success' || kind === 'error') await H.notification({ type: kind.toUpperCase() });
      else await H.impact({ style: kind === 'light' ? 'LIGHT' : 'MEDIUM' });
      return;
    }
  } catch { /* ignore */ }
  if (navigator.vibrate) navigator.vibrate(kind === 'success' ? [20, 40, 20] : kind === 'error' ? [40, 30, 40] : 12);
}

export async function copyText(text: string) {
  try {
    const C = cap()?.Plugins?.Clipboard;
    if (C) { await C.write({ string: text }); return true; }
    await navigator.clipboard.writeText(text); return true;
  } catch {
    const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
    const ok = document.execCommand('copy'); document.body.removeChild(ta); return ok;
  }
}

export async function shareText(title: string, text: string, url?: string) {
  try {
    const S = cap()?.Plugins?.Share;
    if (S) { await S.share({ title, text, url, dialogTitle: title }); return true; }
    if (navigator.share) { await navigator.share({ title, text, url }); return true; }
  } catch { /* cancelled */ }
  return copyText(url ?? text);
}

let ctx: AudioContext | null = null;
/** Short pleasant "ding" — matches the brand name. */
export function ding(enabled: boolean) {
  if (!enabled) return;
  try {
    ctx ??= new (window.AudioContext || (window as any).webkitAudioContext)();
    const t = ctx.currentTime;
    [880, 1318.5].forEach((f, i) => {
      const o = ctx!.createOscillator(); const g = ctx!.createGain();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0, t + i * 0.08); g.gain.linearRampToValueAtTime(0.18, t + i * 0.08 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.08 + 0.35);
      o.connect(g).connect(ctx!.destination); o.start(t + i * 0.08); o.stop(t + i * 0.08 + 0.4);
    });
  } catch { /* ignore */ }
}

export function errTone(enabled: boolean) {
  if (!enabled) return;
  try {
    ctx ??= new (window.AudioContext || (window as any).webkitAudioContext)();
    const t = ctx.currentTime; const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = 'triangle'; o.frequency.setValueAtTime(220, t); o.frequency.linearRampToValueAtTime(180, t + 0.15);
    g.gain.setValueAtTime(0.08, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + 0.22);
  } catch { /* ignore */ }
}

export type ImageKind = 'receipt' | 'cover' | 'avatar';
/** Per-use targets: longest edge (px) and byte budget. Receipts keep more detail (numbers must stay legible). */
const IMG: Record<ImageKind, { max: number; budget: number; q: number }> = {
  receipt: { max: 1400, budget: 220_000, q: 0.82 },
  cover:   { max: 1200, budget: 140_000, q: 0.80 },
  avatar:  { max: 384,  budget: 30_000,  q: 0.82 },
};

let webpSupported: boolean | null = null;
function canWebp() {
  if (webpSupported === null) { const c = document.createElement('canvas'); c.width = c.height = 1; webpSupported = c.toDataURL('image/webp').startsWith('data:image/webp'); }
  return webpSupported;
}
async function decode(file: File): Promise<{ draw: CanvasImageSource; w: number; h: number; done: () => void }> {
  // createImageBitmap honours EXIF rotation (phone photos), <img> fallback for old browsers
  if ('createImageBitmap' in window) {
    try { const bm = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions); return { draw: bm, w: bm.width, h: bm.height, done: () => bm.close() }; } catch { /* fallthrough */ }
  }
  return new Promise((resolve, reject) => {
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => resolve({ draw: img, w: img.naturalWidth, h: img.naturalHeight, done: () => URL.revokeObjectURL(url) });
    img.onerror = reject; img.src = url;
  });
}
const blobOf = (c: HTMLCanvasElement, type: string, q: number) => new Promise<Blob | null>((r) => c.toBlob(r, type, q));
const toDataUrl = (b: Blob) => new Promise<string>((r) => { const fr = new FileReader(); fr.onload = () => r(String(fr.result)); fr.readAsDataURL(b); });

/**
 * Shrink an image as much as possible while keeping it visually intact:
 *  1. EXIF-corrected decode, high-quality downscale to the kind's max edge
 *  2. WebP (≈30-40% smaller than JPEG at equal quality), JPEG fallback (older iOS)
 *  3. If still over the byte budget, step quality down (never below 0.6), then shrink 15% and retry.
 * Typical phone photo 4-6 MB → receipt ≈150 KB, cover ≈100 KB, avatar ≈20 KB.
 */
export async function compressImage(file: File, kind: ImageKind = 'receipt'): Promise<string> {
  const { max, budget, q } = IMG[kind];
  const src = await decode(file);
  try {
    const type = canWebp() ? 'image/webp' : 'image/jpeg';
    let scale = Math.min(1, max / Math.max(src.w, src.h));
    let best: Blob | null = null;
    for (let round = 0; round < 4; round++) {
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(src.w * scale)); c.height = Math.max(1, Math.round(src.h * scale));
      const x = c.getContext('2d')!; x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
      if (type === 'image/jpeg') { x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); } // no alpha in JPEG
      x.drawImage(src.draw, 0, 0, c.width, c.height);
      for (let quality = q; quality >= 0.6; quality -= 0.08) {
        const b = await blobOf(c, type, quality);
        if (!b) break;
        if (!best || b.size < best.size) best = b;
        if (b.size <= budget) return toDataUrl(b);
      }
      scale *= 0.85;
    }
    if (best) return toDataUrl(best);
  } finally { src.done(); }
  throw new Error('image');
}

/** @deprecated use compressImage(file, kind) */
export function fileToDataUrl(file: File, max = 1280, _quality = 0.82): Promise<string> {
  void _quality; return compressImage(file, max <= 512 ? 'avatar' : max <= 1200 ? 'cover' : 'receipt');
}

export function rotateDataUrl(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = img.height; c.height = img.width;
      const x = c.getContext('2d')!; x.translate(c.width / 2, c.height / 2); x.rotate(Math.PI / 2); x.drawImage(img, -img.width / 2, -img.height / 2);
      resolve(c.toDataURL(canWebp() ? 'image/webp' : 'image/jpeg', 0.85));
    };
    img.src = dataUrl;
  });
}

export async function notify(title: string, body: string) {
  try {
    const LN = cap()?.Plugins?.LocalNotifications;
    if (LN) {
      const p = await LN.requestPermissions(); if (p.display !== 'granted') return;
      await LN.schedule({ notifications: [{ id: Date.now() % 100000, title, body, schedule: { at: new Date(Date.now() + 500) } }] }); return;
    }
    if ('Notification' in window) {
      if (Notification.permission === 'default') await Notification.requestPermission();
      if (Notification.permission === 'granted') new Notification(title, { body, icon: 'icons/icon-192.png' });
    }
  } catch { /* ignore */ }
}
