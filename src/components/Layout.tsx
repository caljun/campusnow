import type { ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { MapProvider, useMapContext } from "../context/MapContext";
import FloatingMap from "./FloatingMap";

function LayoutContent({ children }: { children: ReactNode }) {
  const { setMapOpen } = useMapContext();
  const location = useLocation();
  const navigate = useNavigate();
  const onProfile = location.pathname === "/profile";

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col fixed left-0 top-0 h-full w-56 bg-white border-r border-gray-100 z-30">
        <div className="px-6 py-5 border-b border-gray-100">
          <span className="text-lg font-bold text-indigo-600 tracking-tight">CampusNow</span>
          <p className="text-[11px] text-gray-400 mt-0.5">QUINTBRIDGE</p>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          <button
            onClick={() => setMapOpen(true)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-gray-500 hover:bg-gray-50 hover:text-gray-800"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
              <line x1="9" y1="3" x2="9" y2="18" />
              <line x1="15" y1="6" x2="15" y2="21" />
            </svg>
            マップ
          </button>
          <NavLink
            to="/list"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive ? "bg-indigo-50 text-indigo-600" : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={isActive ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                タイムライン
              </>
            )}
          </NavLink>
        </nav>
        <div className="px-3 py-3 border-t border-gray-100">
          <NavLink
            to="/profile"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive ? "bg-indigo-50 text-indigo-600" : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={isActive ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                プロフィール
              </>
            )}
          </NavLink>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden fixed top-0 left-0 right-0 h-12 bg-white border-b border-gray-100 flex items-center justify-between px-4 z-30">
        {onProfile ? (
          <>
            <button
              onClick={() => navigate(-1)}
              className="w-8 h-8 flex items-center justify-center text-gray-500"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <span className="text-sm font-semibold text-gray-800">プロフィール</span>
            <div className="w-8" />
          </>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-indigo-600">CampusNow</span>
              <span className="text-xs text-gray-400">QUINTBRIDGE</span>
            </div>
            <NavLink
              to="/profile"
              className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </NavLink>
          </>
        )}
      </header>

      {/* Main content */}
      <main className="flex-1 md:ml-56 pt-12 md:pt-0 min-h-screen">
        {children}
      </main>

      <FloatingMap />
    </div>
  );
}

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <MapProvider>
      <LayoutContent>{children}</LayoutContent>
    </MapProvider>
  );
}
