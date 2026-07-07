import React, { useState, useEffect } from 'react';
import { API_URL } from '../config';
import { FileText, Download, Calendar, ArrowDownLeft, ArrowUpRight } from 'lucide-react';

export default function Reports() {
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    async function fetchMovements() {
      try {
        setLoading(true);
        const res = await fetch(`${API_URL}/api/stock-movements`);
        const data = await res.json();
        setMovements(data);
      } catch (err) {
        console.error('Error fetching movements:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchMovements();
  }, []);

  // Filter movements by date range
  const filteredMovements = movements.filter(m => {
    const moveDate = new Date(m.timestamp);

    // Normalize date strings
    const start = startDate ? new Date(startDate + 'T00:00:00') : null;
    const end = endDate ? new Date(endDate + 'T23:59:59') : null;

    if (start && moveDate < start) return false;
    if (end && moveDate > end) return false;
    return true;
  });

  // Client-side CSV export function
  const handleExportCSV = () => {
    if (filteredMovements.length === 0) return;

    const headers = ['Timestamp', 'Product SKU', 'Product Name', 'Batch Number', 'Movement Type', 'Quantity', 'Reference/Note'];
    const rows = filteredMovements.map(m => [
      new Date(m.timestamp).toLocaleString(),
      m.product_sku,
      `"${m.product_name.replace(/"/g, '""')}"`,
      m.batch_number,
      m.type.toUpperCase(),
      m.quantity,
      `"${(m.reference_note || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `procuresense_stock_movements_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-page-load">
      {/* Title */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-100">Stock Flow Audits & Reports</h2>
          <p className="text-sm text-slate-400">Review stock movement records and export audit trails.</p>
        </div>
        <button
          onClick={handleExportCSV}
          disabled={filteredMovements.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-teal-800 hover:bg-teal-700 disabled:opacity-40 disabled:hover:bg-teal-800 text-white rounded-lg text-sm font-semibold transition-colors shadow-md shadow-teal-950/20"
        >
          <Download size={16} />
          Export to CSV
        </button>
      </div>

      {/* Date Filters */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row items-center gap-4">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 self-start md:self-auto py-1">
          <Calendar size={14} className="text-teal-400" />
          Filter Date Range:
        </span>
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">From</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-teal-700"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">To</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-teal-700"
            />
          </div>
          {(startDate || endDate) && (
            <button
              onClick={() => { setStartDate(''); setEndDate(''); }}
              className="text-xs text-teal-400 hover:text-teal-300 font-semibold"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Audit Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400">Loading audit history...</div>
        ) : filteredMovements.length === 0 ? (
          <div className="p-16 text-center">
            <FileText className="mx-auto text-slate-600 w-12 h-12 mb-3" />
            <p className="text-slate-400 text-sm font-semibold">No stock movements recorded.</p>
            <p className="text-xs text-slate-500 mt-1">Movement logs will appear here when entries are saved.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Product Info</th>
                  <th className="py-3 px-4 font-mono">Batch</th>
                  <th className="py-3 px-4 text-center">Type</th>
                  <th className="py-3 px-4 text-right">Quantity</th>
                  <th className="py-3 px-4">Reference Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs">
                {filteredMovements.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-800/40">
                    <td className="py-3 px-4 text-slate-400 font-medium">{new Date(m.timestamp).toLocaleString()}</td>
                    <td className="py-3 px-4">
                      <p className="font-semibold text-slate-200">{m.product_name}</p>
                      <p className="text-[10px] font-mono text-slate-500">{m.product_sku}</p>
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold text-slate-400">{m.batch_number}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-bold ${m.type === 'inward'
                        ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-900/30'
                        : 'bg-red-950/60 text-red-400 border border-red-900/30'
                        }`}>
                        {m.type === 'inward' ? <ArrowDownLeft size={10} /> : <ArrowUpRight size={10} />}
                        {m.type.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-200">{m.quantity}</td>
                    <td className="py-3 px-4 text-slate-400 italic max-w-xs truncate">{m.reference_note || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
