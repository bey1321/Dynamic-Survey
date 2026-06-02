import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../state/AuthContext';

function getInitials(user) {
  const raw = user?.username || user?.email || '?';
  return raw
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0].toUpperCase())
    .join('');
}

export default function ProfileDropdown() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const containerRef    = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const initials = getInitials(user);

  return (
    <div className="relative" ref={containerRef}>
      {/* Trigger */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 group focus:outline-none"
        aria-haspopup="true"
        aria-expanded={open}
      >
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow transition-opacity group-hover:opacity-80"
          style={{ backgroundColor: '#1B6B8A' }}
        >
          {initials}
        </div>
        <span className="text-xs font-medium" style={{ color: '#5a8a8a' }}>
          {user?.username || user?.email}
        </span>
        <svg
          className={`w-3 h-3 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          style={{ color: '#5a8a8a' }}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-64 rounded-xl shadow-2xl z-50 overflow-hidden border"
          style={{ backgroundColor: '#ffffff', borderColor: '#d0eaea' }}
        >
          {/* Profile header */}
          <div
            className="p-4 flex items-center gap-3"
            style={{ backgroundColor: '#f0f8f8', borderBottom: '1px solid #d0eaea' }}
          >
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-bold flex-shrink-0 shadow"
              style={{ backgroundColor: '#1B6B8A' }}
            >
              {initials}
            </div>
            <div className="min-w-0">
              {user?.username && (
                <div className="font-bold text-sm truncate" style={{ color: '#1B6B8A' }}>
                  {user.username}
                </div>
              )}
              <div className="text-xs truncate" style={{ color: '#5a8a8a' }}>
                {user?.email}
              </div>
            </div>
          </div>

          {/* Menu items */}
          <div className="py-2 px-2">
            <button
              onClick={() => { setOpen(false); navigate('/my-surveys'); }}
              className="w-full text-left flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150"
              style={{ color: '#1B6B8A' }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f0f8f8')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              My Surveys
            </button>
          </div>

          {/* Sign Out */}
          <div className="py-2 px-2" style={{ borderTop: '1px solid #d0eaea' }}>
            <button
              onClick={() => { logout(); setOpen(false); }}
              className="w-full text-left flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150"
              style={{ color: '#e05555' }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#fff0f0')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
