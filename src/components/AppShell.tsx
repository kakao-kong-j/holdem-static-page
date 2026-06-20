import { useState, type ReactNode } from 'react';
import { StackTabs } from './StackTabs';
import type { SessionUser } from '../hooks/useAuth';
import type { StackSize } from '../types';
import { SB_OPEN_DISABLED_STACKS, VIEWS, type View, type ViewMeta } from '../app/viewRegistry';

interface AppShellProps {
  user: SessionUser | null;
  view: View;
  viewMeta: ViewMeta;
  stack: StackSize;
  onStackChange: (stack: StackSize) => void;
  onViewChange: (view: View) => void;
  onLogout: () => void;
  children: ReactNode;
}

export function AppShell({
  user,
  view,
  viewMeta,
  stack,
  onStackChange,
  onViewChange,
  onLogout,
  children,
}: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const maxWidthClass = viewMeta.maxWidth === 'wide' ? 'max-w-7xl' : 'max-w-4xl';

  return (
    <div className={`min-h-screen ${maxWidthClass} mx-auto`}>
      {drawerOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-gray-900 z-50 flex flex-col shadow-2xl transform transition-transform duration-300 ${
          drawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
          <span className="text-white font-bold text-base">GTO Preflop</span>
          <button
            onClick={() => setDrawerOpen(false)}
            className="text-gray-400 hover:text-white transition-colors p-1"
            aria-label="닫기"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          {VIEWS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => { onViewChange(value); setDrawerOpen(false); }}
              className={`w-full text-left px-4 py-3 rounded-lg font-medium text-sm mb-1 transition-colors ${
                view === value
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="px-5 py-4 border-t border-gray-700">
          {user?.name && (
            <p className="text-xs text-gray-400 mb-2 truncate">{user.name}</p>
          )}
          <button
            onClick={onLogout}
            className="w-full px-3 py-2 text-xs bg-gray-800 text-gray-400 rounded-lg hover:bg-gray-700 hover:text-gray-200 transition-colors"
          >
            로그아웃
          </button>
        </div>
      </aside>

      <div className="sticky top-0 z-30 bg-gray-950/95 backdrop-blur px-4 py-3 flex items-center gap-3 border-b border-gray-800">
        <button
          onClick={() => setDrawerOpen(true)}
          className="text-gray-400 hover:text-white transition-colors p-1 shrink-0"
          aria-label="메뉴 열기"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <h1 className="text-sm font-bold text-white truncate">
          GTO Preflop Charts
        </h1>
        <span className="text-xs text-indigo-400 font-medium truncate">
          {viewMeta.label}
        </span>
      </div>

      <div className="p-4">
        {viewMeta.showStackTabs && (
          <div className="flex justify-center mb-4">
            <StackTabs
              selected={stack}
              onChange={onStackChange}
              disabledStacks={view === 'sb-open' ? SB_OPEN_DISABLED_STACKS : undefined}
            />
          </div>
        )}

        {children}
      </div>
    </div>
  );
}
