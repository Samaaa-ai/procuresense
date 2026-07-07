import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import StockEntry from './pages/StockEntry';
import Reports from './pages/Reports';
import AICopilot from './pages/AICopilot';

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <Router>
      <div className="min-h-screen bg-slate-950 text-slate-100 flex font-sans">
        {/* Navigation Sidebar */}
        <Sidebar isOpen={sidebarOpen} toggleOpen={() => setSidebarOpen(!sidebarOpen)} />

        {/* Main Content Area */}
        <main className="flex-1 lg:pl-64 min-h-screen flex flex-col">
          {/* Top Navbar */}
          <header className="h-16 border-b border-slate-800 bg-slate-900/40 backdrop-blur-md sticky top-0 z-30 flex items-center justify-between px-6 lg:px-8">
            <div className="flex items-center gap-4">
              {/* Spacer for mobile menu button */}
              <div className="w-8 lg:hidden" />
              <span className="text-sm font-bold tracking-tight bg-gradient-to-r from-teal-400 to-emerald-400 bg-clip-text text-transparent">
                ProcureSense — AI Inventory Copilot
              </span>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="text-slate-400 hidden sm:inline">Warehouse: <span className="font-semibold text-teal-400">Central Hygiene Bay A</span></span>
              <span className="text-slate-500 hidden sm:inline">|</span>
              <span className="font-mono text-teal-400 bg-slate-950/80 px-2.5 py-1 rounded border border-slate-800">
                {currentTime.toLocaleString()}
              </span>
            </div>
          </header>

          {/* Page Container */}
          <div className="flex-1 p-6 lg:p-8 max-w-7xl w-full mx-auto">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/inventory" element={<Inventory />} />
              <Route path="/stock-entry" element={<StockEntry />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/ai-copilot" element={<AICopilot />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </div>
        </main>
      </div>
    </Router>
  );
}
