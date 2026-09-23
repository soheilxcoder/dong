import { motion, useReducedMotion } from 'framer-motion';

export type Mood = 'idle' | 'happy' | 'confused' | 'waiting' | 'spin';

/** Dong mascot — a friendly coin split into equal shares. Pure SVG, themable. */
export function Mascot({ mood = 'idle', size = 120, className = '' }: { mood?: Mood; size?: number; className?: string }) {
  const reduce = useReducedMotion();
  const bob = reduce ? {} : { y: [0, -6, 0] };
  const spin = reduce ? {} : { rotate: 360 };
  return (
    <motion.svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      className={className}
      animate={mood === 'spin' ? spin : bob}
      transition={mood === 'spin' ? { repeat: Infinity, duration: 1.2, ease: 'linear' } : { repeat: Infinity, duration: 3, ease: 'easeInOut' }}
      aria-hidden
    >
      <defs>
        <radialGradient id="mg" cx="35%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#FFF7E6" />
          <stop offset="100%" stopColor="#F6D9A3" />
        </radialGradient>
        <linearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#F5B942" />
          <stop offset="100%" stopColor="#E89A2E" />
        </linearGradient>
        <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="4" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <circle cx="60" cy="60" r="50" fill="url(#ring)" opacity="0.35" filter="url(#glow)" />
      <circle cx="60" cy="60" r="46" fill="url(#mg)" stroke="url(#ring)" strokeWidth="4" />
      {/* split lines */}
      <g stroke="#E9B75A" strokeWidth="2.5" strokeLinecap="round" opacity="0.9">
        <line x1="60" y1="16" x2="60" y2="104" />
        <line x1="16" y1="60" x2="104" y2="60" />
      </g>
      <circle cx="60" cy="60" r="4" fill="#F5B942" />
      {/* face */}
      {mood === 'confused' ? (
        <>
          <circle cx="47" cy="46" r="4" fill="#1E1B18" />
          <circle cx="73" cy="44" r="3" fill="#1E1B18" />
          <path d="M50 58 q10 -5 20 2" stroke="#1E1B18" strokeWidth="3" fill="none" strokeLinecap="round" />
          <text x="86" y="34" fontSize="16" fontWeight="900" fill="#1E1B18">?</text>
        </>
      ) : mood === 'happy' ? (
        <>
          <path d="M42 46 q5 -6 10 0" stroke="#1E1B18" strokeWidth="3.5" fill="none" strokeLinecap="round" />
          <path d="M68 46 q5 -6 10 0" stroke="#1E1B18" strokeWidth="3.5" fill="none" strokeLinecap="round" />
          <path d="M48 54 q12 12 24 0" stroke="#1E1B18" strokeWidth="3.5" fill="none" strokeLinecap="round" />
          <circle cx="38" cy="54" r="4" fill="#F97362" opacity="0.5" />
          <circle cx="82" cy="54" r="4" fill="#F97362" opacity="0.5" />
        </>
      ) : mood === 'waiting' ? (
        <>
          <circle cx="47" cy="45" r="4" fill="#1E1B18" />
          <circle cx="73" cy="45" r="4" fill="#1E1B18" />
          <path d="M52 56 q8 4 16 0" stroke="#1E1B18" strokeWidth="3" fill="none" strokeLinecap="round" />
          <motion.g animate={reduce ? {} : { opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 1.6 }}>
            <circle cx="92" cy="30" r="2.5" fill="#1E1B18" /><circle cx="99" cy="26" r="2.5" fill="#1E1B18" /><circle cx="106" cy="22" r="2.5" fill="#1E1B18" />
          </motion.g>
        </>
      ) : (
        <>
          <motion.g animate={reduce ? {} : { scaleY: [1, 1, 0.1, 1, 1] }} transition={{ repeat: Infinity, duration: 4, times: [0, 0.9, 0.93, 0.96, 1] }} style={{ originY: '45px' }}>
            <circle cx="47" cy="45" r="4" fill="#1E1B18" />
            <circle cx="73" cy="45" r="4" fill="#1E1B18" />
          </motion.g>
          <path d="M52 55 q8 7 16 0" stroke="#1E1B18" strokeWidth="3" fill="none" strokeLinecap="round" />
        </>
      )}
    </motion.svg>
  );
}
