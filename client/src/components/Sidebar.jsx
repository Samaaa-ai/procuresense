import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Boxes, RefreshCw, FileText, Menu, X, ShieldAlert, Sparkles } from 'lucide-react';

export default function Sidebar({ isOpen, toggleOpen }) {
  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Inventory', path: '/inventory', icon: Boxes },
    { name: 'Stock Entry', path: '/stock-entry', icon: RefreshCw },
    { name: 'Reports', path: '/reports', icon: FileText },
    { name: 'AI Copilot', path: '/ai-copilot', icon: Sparkles }
  ];

  return (
    <>
      {/* Mobile Toggle Button */}
      <button
        onClick={toggleOpen}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-teal-950 text-teal-400 border border-teal-800 hover:bg-teal-900 focus:outline-none"
      >
        {isOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Sidebar Overlay for Mobile */}
      {isOpen && (
        <div
          onClick={toggleOpen}
          className="lg:hidden fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-sm"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed inset-y-0 left-0 z-45 w-64 transform bg-slate-950 border-r border-slate-800 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="h-16 flex items-center px-6 border-b border-slate-800 bg-slate-950 gap-2">
          <ShieldAlert className="text-teal-400 w-8 h-8" />
          <div>
            <h1 className="text-lg font-bold text-slate-100 tracking-wide font-sans">ProcureSense</h1>
            <p className="text-xs text-teal-500 font-medium">SME Inventory Intelligence</p>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 py-6 px-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.name}
                to={item.path}
                onClick={() => {
                  if (window.innerWidth < 1024) toggleOpen();
                }}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-150 ${
                    isActive
                      ? 'bg-teal-950/60 border border-teal-800 text-teal-400 shadow-md shadow-teal-950/20'
                      : 'text-slate-400 hover:bg-slate-900 hover:text-slate-100 border border-transparent'
                  }`
                }
              >
                <Icon size={18} />
                <span>{item.name}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-teal-900/50 border border-teal-800 flex items-center justify-center font-bold text-teal-400 text-sm">
              PS
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-300">Hygiene Dist. WH</p>
              <p className="text-[10px] text-slate-500">Operator Session</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
