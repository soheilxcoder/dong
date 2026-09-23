const PALETTE = ['#0FB88A', '#0891B2', '#F5B942', '#F97362', '#8B5CF6', '#EC4899', '#22C55E', '#3B82F6', '#F59E0B', '#14B8A6'];
export function avatarColor(seed: string) {
  let h = 0; for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}
export const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('');
