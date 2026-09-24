import { useEffect } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useStore } from './store';
import { BottomNav } from './BottomNav';
import { Confetti, Toasts } from '@/design-system/ui';
import { Splash } from '@/features/auth/Splash';
import { Onboarding } from '@/features/auth/Onboarding';
import { AuthPage } from '@/features/auth/AuthPage';
import { HomePage } from '@/features/home/HomePage';
import { GroupPage } from '@/features/groups/GroupPage';
import { NewGroupPage } from '@/features/groups/NewGroupPage';
import { InvitePage } from '@/features/groups/InvitePage';
import { JoinPage } from '@/features/groups/JoinPage';
import { ExpenseFormPage } from '@/features/expenses/ExpenseFormPage';
import { ProfilePage } from '@/features/profile/ProfilePage';
import { ActivityAllPage } from '@/features/home/ActivityAllPage';
import { initNative } from '@/lib/capacitor';
import { enablePush, disablePush } from '@/lib/push';
import { ApiAdapter } from '@/data/api';

function Protected() {
  const user = useStore((s) => s.user);
  const onboarded = useStore((s) => s.settings.onboarded);
  const loc = useLocation();
  if (user === undefined) return <Splash />;
  if (!user) return <Navigate to={onboarded ? '/auth' : '/onboarding'} replace state={{ from: loc.pathname }} />;
  return <Outlet />;
}

function Shell() {
  return (
    <div className="mx-auto max-w-lg min-h-dvh relative">
      <Outlet />
      <BottomNav />
    </div>
  );
}

export function App() {
  const init = useStore((s) => s.init);
  const loc = useLocation();
  const nav = useNavigate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { init(); initNative(nav); }, []);
  // Server mode: other members may have changed things — refetch on every screen change so forms never use stale data.
  const { adapter, refresh, user } = useStore();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (adapter.kind === 'api' && user) refresh().catch(() => {}); }, [loc.pathname]);
  useEffect(() => { window.scrollTo(0, 0); }, [loc.pathname]);
  // Server mode: register this phone/browser for push (new expense, payment to confirm, confirmed/rejected, manual reminders).
  const toast = useStore((s) => s.toast);
  const notifOn = useStore((s) => s.settings.notifications);
  useEffect(() => {
    if (!user || !(adapter instanceof ApiAdapter)) return;
    if (!notifOn) { disablePush(adapter.pushApi).catch(() => {}); return; }
    enablePush(adapter.pushApi, {
      onOpen: (url) => nav(url),
      onForeground: (title, body) => { toast(`${title} — ${body}`, 'info'); refresh().catch(() => {}); },
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, adapter, notifOn]);

  return (
    <>
      <Routes location={loc}>
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/join/:token" element={<JoinPage />} />
            <Route element={<Protected />}>
              <Route element={<Shell />}>
                <Route path="/" element={<HomePage />} />
                <Route path="/activity" element={<ActivityAllPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/g/:id" element={<GroupPage />} />
              </Route>
              <Route path="/new-group" element={<NewGroupPage />} />
              <Route path="/g/:id/invite" element={<InvitePage />} />
              <Route path="/g/:id/expense/new" element={<ExpenseFormPage />} />
              <Route path="/g/:id/expense/:expenseId" element={<ExpenseFormPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toasts />
      <Confetti />
    </>
  );
}
