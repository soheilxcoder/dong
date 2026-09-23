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

/** Compress an image File to a JPEG data URL (max 1280px) for local storage. */
export function fileToDataUrl(file: File, max = 1280, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url); resolve(c.toDataURL('image/jpeg', quality));
    };
    img.onerror = reject; img.src = url;
  });
}

export function rotateDataUrl(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = img.height; c.height = img.width;
      const x = c.getContext('2d')!; x.translate(c.width / 2, c.height / 2); x.rotate(Math.PI / 2); x.drawImage(img, -img.width / 2, -img.height / 2);
      resolve(c.toDataURL('image/jpeg', 0.85));
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
