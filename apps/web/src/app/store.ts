import { create } from 'zustand';
import type { User } from '@dong/core';
import type { DataAdapter, GroupDetail } from '@/data/adapter';
import { LocalAdapter } from '@/data/local';
import { ApiAdapter } from '@/data/api';

export type Theme = 'dark' | 'light' | 'system';

interface Settings { theme: Theme; sound: boolean; notifications: boolean; onboarded: boolean; apiUrl: string; tours: Record<string, boolean> }
/** Self-hosted builds bake the server URL in (VITE_API_URL, e.g. "/api"); GitHub Pages / store builds default to local mode. */
const DEFAULT_API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? '';
const loadSettings = (): Settings => ({
  theme: 'light', sound: true, notifications: true, onboarded: false, apiUrl: DEFAULT_API_URL, tours: {},
  ...JSON.parse(localStorage.getItem('dong.settings') ?? '{}'),
});

interface Toast { id: number; text: string; kind: 'ok' | 'err' | 'info' }

interface State {
  adapter: DataAdapter;
  user: User | null | undefined; // undefined = loading
  groups: GroupDetail[];
  settings: Settings;
  toasts: Toast[];
  celebrate: number; // increments to trigger confetti
  syncStatus: 'off' | 'connecting' | 'online' | 'error';
  /** server mode only: first load failed because there is no connection */
  offline: boolean;
  init(): Promise<void>;
  refresh(): Promise<void>;
  setUser(u: User | null): void;
  setSettings(p: Partial<Settings>): void;
  toast(text: string, kind?: Toast['kind']): void;
  fireCelebration(): void;
}

const initialSettings = loadSettings();
const makeAdapter = (url: string): DataAdapter => (url ? new ApiAdapter(url) : new LocalAdapter());

export const useStore = create<State>((set, get) => ({
  adapter: makeAdapter(initialSettings.apiUrl),
  user: undefined,
  groups: [],
  settings: initialSettings,
  toasts: [],
  celebrate: 0,
  syncStatus: 'off',
  offline: false,
  async init() {
    const { adapter } = get();
    (adapter as { onSyncStatus?: (cb: (s: State['syncStatus']) => void) => void }).onSyncStatus?.((syncStatus) => set({ syncStatus }));
    applyTheme(get().settings.theme);
    try {
      const u = await adapter.me();
      set({ user: u, offline: false });
      if (u) await get().refresh();
    } catch {
      // no connection on first open (server mode): keep the splash with an "offline" notice and let the user retry
      set({ offline: true });
      const retry = () => { window.removeEventListener('online', retry); if (get().user === undefined) void get().init(); };
      window.addEventListener('online', retry);
      return;
    }
    adapter.subscribe(() => { get().refresh().catch(() => {}); });
  },
  async refresh() {
    const { adapter } = get();
    const u = await adapter.me(); // throws on network error → callers ignore, cached state stays
    if (!u) { set({ user: null, groups: [] }); return; }
    const groups = await adapter.myGroups();
    set({ user: u, groups, offline: false });
  },
  setUser(u) { set({ user: u }); },
  setSettings(p) {
    const settings = { ...get().settings, ...p };
    localStorage.setItem('dong.settings', JSON.stringify(settings));
    set({ settings });
    if (p.theme) applyTheme(p.theme);
    if (p.apiUrl !== undefined) {
      const adapter = makeAdapter(p.apiUrl);
      (adapter as { onSyncStatus?: (cb: (s: State['syncStatus']) => void) => void }).onSyncStatus?.((syncStatus) => set({ syncStatus }));
      set({ adapter, user: undefined, groups: [] });
      adapter.subscribe(() => { get().refresh().catch(() => {}); });
      get().refresh().catch(() => set({ user: null }));
    }
  },
  toast(text, kind = 'info') {
    const id = Date.now() + Math.random();
    set({ toasts: [...get().toasts, { id, text, kind }] });
    setTimeout(() => set({ toasts: get().toasts.filter((t) => t.id !== id) }), 2600);
  },
  fireCelebration() { set({ celebrate: get().celebrate + 1 }); },
}));

export function applyTheme(t: Theme) {
  const dark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', dark ? '#0F1416' : '#0FB88A');
}
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyTheme(useStore.getState().settings.theme));
