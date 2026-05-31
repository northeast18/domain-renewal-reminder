import type { ReactNode } from 'react';

export type EmptyStateVariant = 'domains' | 'search' | 'mail' | 'logs' | 'history' | 'users';

type EmptyStatePanelProps = {
  title: string;
  description: string;
  variant?: EmptyStateVariant;
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
  className?: string;
};

const variantMeta: Record<EmptyStateVariant, { accent: string; halo: string; icon: ReactNode }> = {
  domains: {
    accent: '#0eb3f0',
    halo: '#dff7ff',
    icon: (
      <>
        <rect x="43" y="44" width="74" height="48" rx="12" fill="#ffffff" stroke="#0eb3f0" strokeWidth="3" />
        <path d="M54 59h32M54 73h50" stroke="#0a668f" strokeWidth="4" strokeLinecap="round" />
        <path d="M103 44l10 10" stroke="#0eb3f0" strokeWidth="3" strokeLinecap="round" />
        <circle cx="112" cy="45" r="12" fill="#ecfeff" stroke="#0eb3f0" strokeWidth="3" />
        <path d="M112 38v7l5 4" stroke="#0a668f" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
  search: {
    accent: '#6366f1',
    halo: '#eef2ff',
    icon: (
      <>
        <rect x="39" y="42" width="60" height="50" rx="12" fill="#ffffff" stroke="#6366f1" strokeWidth="3" />
        <path d="M51 56h31M51 70h22" stroke="#475569" strokeWidth="4" strokeLinecap="round" />
        <circle cx="101" cy="78" r="17" fill="#f8fafc" stroke="#6366f1" strokeWidth="4" />
        <path d="M113 90l12 12" stroke="#6366f1" strokeWidth="5" strokeLinecap="round" />
      </>
    ),
  },
  mail: {
    accent: '#0891b2',
    halo: '#cffafe',
    icon: (
      <>
        <rect x="39" y="48" width="82" height="54" rx="14" fill="#ffffff" stroke="#0891b2" strokeWidth="3" />
        <path d="M43 58l31 25a10 10 0 0012 0l31-25" stroke="#0e7490" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M57 39h46" stroke="#22d3ee" strokeWidth="7" strokeLinecap="round" />
        <circle cx="113" cy="44" r="10" fill="#ecfeff" stroke="#0891b2" strokeWidth="3" />
      </>
    ),
  },
  logs: {
    accent: '#8b5cf6',
    halo: '#f3e8ff',
    icon: (
      <>
        <rect x="45" y="35" width="70" height="78" rx="14" fill="#ffffff" stroke="#8b5cf6" strokeWidth="3" />
        <rect x="63" y="28" width="34" height="16" rx="8" fill="#f5f3ff" stroke="#8b5cf6" strokeWidth="3" />
        <path d="M60 60h40M60 76h36M60 92h24" stroke="#475569" strokeWidth="4" strokeLinecap="round" />
      </>
    ),
  },
  history: {
    accent: '#14b8a6',
    halo: '#ccfbf1',
    icon: (
      <>
        <path d="M54 82a31 31 0 106-34" fill="none" stroke="#14b8a6" strokeWidth="5" strokeLinecap="round" />
        <path d="M57 48h-18v-18" fill="none" stroke="#14b8a6" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M80 55v28l19 11" stroke="#0f766e" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
  users: {
    accent: '#f59e0b',
    halo: '#fef3c7',
    icon: (
      <>
        <circle cx="70" cy="58" r="17" fill="#ffffff" stroke="#f59e0b" strokeWidth="3" />
        <circle cx="100" cy="64" r="13" fill="#fffbeb" stroke="#f59e0b" strokeWidth="3" />
        <path d="M40 105c4-18 17-28 31-28s27 10 31 28" fill="#ffffff" stroke="#d97706" strokeWidth="4" strokeLinecap="round" />
        <path d="M88 104c4-12 13-19 24-19 9 0 17 5 22 14" fill="none" stroke="#f59e0b" strokeWidth="4" strokeLinecap="round" />
      </>
    ),
  },
};

export function EmptyStateIllustration({ variant = 'domains', compact = false }: { variant?: EmptyStateVariant; compact?: boolean }) {
  const meta = variantMeta[variant];

  return (
    <div className={`relative mx-auto ${compact ? 'mb-4 h-24 w-36' : 'mb-7 h-32 w-48 sm:h-40 sm:w-60'}`} aria-hidden="true">
      <div
        className="absolute inset-x-6 bottom-1 h-10 rounded-full blur-2xl"
        style={{ backgroundColor: meta.halo }}
      />
      <svg className="relative h-full w-full drop-shadow-sm" viewBox="0 0 160 126" fill="none">
        <path
          d="M22 86c-13-26 5-62 36-72 31-11 72 3 84 32 12 28-9 62-41 69-32 8-66-3-79-29z"
          fill={meta.halo}
        />
        <path
          d="M27 95c24 16 76 17 106 2"
          stroke={meta.accent}
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.22"
        />
        <circle cx="35" cy="36" r="5" fill={meta.accent} opacity="0.2" />
        <circle cx="126" cy="29" r="7" fill={meta.accent} opacity="0.16" />
        <circle cx="130" cy="86" r="4" fill={meta.accent} opacity="0.24" />
        {meta.icon}
      </svg>
    </div>
  );
}

export function EmptyStatePanel({
  title,
  description,
  variant = 'domains',
  actionLabel,
  onAction,
  compact = false,
  className = '',
}: EmptyStatePanelProps) {
  return (
    <div
      className={`rounded-2xl border border-white/60 bg-white/80 px-5 py-9 text-center shadow-lg backdrop-blur-sm dark:border-gray-700/70 dark:bg-gray-800/80 sm:px-8 ${compact ? 'sm:py-10' : 'sm:py-14'} ${className}`}
    >
      <EmptyStateIllustration variant={variant} compact={compact} />
      <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 sm:text-xl">{title}</h3>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-gray-600 dark:text-gray-400 sm:text-base">{description}</p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-6 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-500 px-6 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:from-indigo-700 hover:to-cyan-600"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
