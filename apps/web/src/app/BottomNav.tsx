import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home, Activity, UserRound } from 'lucide-react';

const items = [
  { to: '/', label: 'خانه', Icon: Home },
  { to: '/activity', label: 'فعالیت', Icon: Activity },
  { to: '/profile', label: 'پروفایل', Icon: UserRound },
];

export function BottomNav() {
  const { pathname } = useLocation();
  if (pathname.startsWith('/g/')) return null;
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 flex justify-center pointer-events-none" style={{ paddingBottom: 'calc(var(--safe-bottom) + 14px)' }}>
      <div className="glass pointer-events-auto flex items-center gap-1 rounded-full px-2.5 py-2 shadow-2xl" style={{ background: 'rgb(var(--c-surface) / 0.7)' }}>
        {items.map(({ to, label, Icon }) => (
          <NavLink key={to} to={to} end className="relative flex items-center gap-2 px-5 py-3 rounded-full text-[15px] font-bold">
            {({ isActive }) => (
              <>
                {isActive && <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-full" style={{ background: 'var(--grad-brand)' }} transition={{ type: 'spring', stiffness: 400, damping: 30 }} />}
                <Icon size={22} className={`relative ${isActive ? 'text-white' : 'text-ink-2'}`} />
                {isActive && <span className="relative text-white">{label}</span>}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
