import React, { useState, useEffect } from 'react';
import { API_URL } from '../config';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Package, AlertTriangle, Clock, CircleDollarSign, ShieldAlert, ArrowUpRight, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [products, setProducts] = useState([]);
  const [batches, setBatches] = useState([]);
  const [error, setError] = useState(null);

  // AI Copilot Chat State
  const [queryInput, setQueryInput] = useState('');
  const [queryHistory, setQueryHistory] = useState([]);
  const [queryLoading, setQueryLoading] = useState(false);
  const [queryError, setQueryError] = useState(null);

  const handleQuerySubmit = async (e) => {
    e.preventDefault();
    if (!queryInput.trim()) return;

    setQueryLoading(true);
    setQueryError(null);
    const q = queryInput;

    // Add temporary message placeholder for loading state
    setQueryHistory(prev => [{ question: q, answer: 'Typing response...' }, ...prev].slice(0, 5));
    setQueryInput('');

    try {
      const res = await fetch('${API_URL}/api/ai/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q })
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to fetch answer.');
      }
      const data = await res.json();
      setQueryHistory(prev => {
        const updated = [...prev];
        if (updated[0] && updated[0].question === q) {
          updated[0].answer = data.answer;
        } else {
          updated.unshift({ question: q, answer: data.answer });
        }
        return updated.slice(0, 5);
      });
    } catch (err) {
      console.error(err);
      setQueryError(err.message || 'Error processing query.');
      setQueryHistory(prev => {
        const updated = [...prev];
        if (updated[0] && updated[0].question === q) {
          updated[0].answer = `Error: ${err.message || 'Unable to consult Gemini. Check console for details.'}`;
        }
        return updated;
      });
    } finally {
      setQueryLoading(false);
    }
  };

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        // Fetch dashboard summary
        const summaryRes = await fetch('${API_URL}/api/dashboard-summary');
        const summaryData = await summaryRes.json();

        // Fetch products and batches for charts and critical alerts computation
        const prodRes = await fetch('${API_URL}/api/products');
        const prodData = await prodRes.json();

        const batchRes = await fetch('${API_URL}/api/batches');
        const batchData = await batchRes.json();

        if (summaryData.error || prodData.error || batchData.error) {
          setError(summaryData.error || prodData.error || batchData.error);
          return;
        }

        setSummary(summaryData);
        setProducts(prodData);
        setBatches(batchData);
        setError(null);
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
        setError('Failed to fetch real-time dashboard data. Ensure server is running.');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 rounded-full border-4 border-slate-800"></div>
          <div className="absolute inset-0 rounded-full border-4 border-teal-500 border-t-transparent animate-spin"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-xl max-w-xl mx-auto mt-12 text-center">
        <AlertTriangle className="text-red-500 w-12 h-12 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-slate-100 mb-2">Connection Error</h3>
        <p className="text-sm text-slate-400 mb-4">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-500 transition-colors"
        >
          Try Reconnecting
        </button>
      </div>
    );
  }

  // 1. Calculate category stock levels for Recharts
  const categoryDataMap = {};
  products.forEach(p => {
    const stock = parseInt(p.total_stock) || 0;
    if (categoryDataMap[p.category]) {
      categoryDataMap[p.category] += stock;
    } else {
      categoryDataMap[p.category] = stock;
    }
  });

  const chartData = Object.keys(categoryDataMap).map(cat => ({
    name: cat,
    Stock: categoryDataMap[cat]
  }));

  // 2. Compute "Critical Alerts"
  // Products that are low-stock AND have batches expiring in <= 7 days (or soon)
  const now = new Date();
  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(now.getDate() + 7);

  const criticalAlerts = [];
  products.forEach(p => {
    const stock = parseInt(p.total_stock) || 0;
    const isLowStock = stock < p.reorder_threshold;

    // Find if this product has any batches expiring in <= 7 days
    const prodBatches = batches.filter(b => b.product_id === p.id);
    const hasExpiringBatch = prodBatches.some(b => {
      const expDate = new Date(b.expiry_date);
      return expDate <= sevenDaysFromNow && b.quantity > 0;
    });

    if (isLowStock && hasExpiringBatch) {
      const expiringBatchInfo = prodBatches.find(b => {
        const expDate = new Date(b.expiry_date);
        return expDate <= sevenDaysFromNow && b.quantity > 0;
      });
      criticalAlerts.push({
        id: p.id,
        sku: p.sku,
        name: p.name,
        category: p.category,
        currentStock: stock,
        threshold: p.reorder_threshold,
        expiringBatch: expiringBatchInfo ? expiringBatchInfo.batch_number : 'N/A',
        expiryDate: expiringBatchInfo ? new Date(expiringBatchInfo.expiry_date).toLocaleDateString() : 'N/A'
      });
    }
  });

  // Calculate expiring soon in 7 days count specifically for the card
  const expiring7DaysCount = batches.filter(b => {
    const expDate = new Date(b.expiry_date);
    return expDate <= sevenDaysFromNow && b.quantity > 0;
  }).length;

  return (
    <div className="space-y-6 animate-page-load">
      {/* Top Title Bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-100">Operations Control Center</h2>
          <p className="text-sm text-slate-400">Real-time status overview and system diagnostics.</p>
        </div>
        <div className="text-xs px-3 py-1.5 rounded-md bg-teal-950/40 text-teal-400 border border-teal-900 font-medium">
          System Status: Online
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total SKUs */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl flex items-center gap-4 relative overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:border-slate-700 hover:shadow-lg hover:shadow-teal-950/10">
          <div className="p-3 bg-teal-950 text-teal-400 rounded-lg">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total SKUs</p>
            <h3 className="text-2xl font-bold text-slate-100 mt-1">{summary?.totalSKUs || 0}</h3>
          </div>
        </div>

        {/* Low Stock Items */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl flex items-center gap-4 relative overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:border-slate-700 hover:shadow-lg hover:shadow-teal-950/10">
          <div className={`p-3 rounded-lg ${summary?.lowStockCount > 0 ? 'bg-amber-950 text-amber-500' : 'bg-teal-950 text-teal-400'}`}>
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Low Stock Items</p>
            <h3 className="text-2xl font-bold text-slate-100 mt-1">{summary?.lowStockCount || 0}</h3>
          </div>
        </div>

        {/* Expiring Soon */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl flex items-center gap-4 relative overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:border-slate-700 hover:shadow-lg hover:shadow-teal-950/10">
          <div className={`p-3 rounded-lg ${expiring7DaysCount > 0 ? 'bg-red-950 text-red-500' : 'bg-teal-950 text-teal-400'}`}>
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Expiring (7 Days)</p>
            <h3 className="text-2xl font-bold text-slate-100 mt-1">{expiring7DaysCount}</h3>
          </div>
        </div>

        {/* Total Stock Value */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl flex items-center gap-4 relative overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:border-slate-700 hover:shadow-lg hover:shadow-teal-950/10">
          <div className="p-3 bg-teal-950 text-teal-400 rounded-lg">
            <CircleDollarSign className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Stock Valuation</p>
            <h3 className="text-2xl font-bold text-slate-100 mt-1">
              ${summary?.totalStockValue ? parseFloat(summary.totalStockValue).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
            </h3>
          </div>
        </div>
      </div>

      {/* Main Content Grid (Chart + Critical Alerts) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Category stock level Bar Chart */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between transition-all duration-300 hover:border-slate-700 hover:shadow-lg hover:shadow-teal-950/5">
          <div className="mb-4">
            <h3 className="text-base font-bold text-slate-100">Stock Levels by Product Category</h3>
            <p className="text-xs text-slate-400">Total units stored in warehouse across categories.</p>
          </div>
          <div className="h-64 w-full">
            {chartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-slate-500">No stock data available.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#020617', border: '1px solid #1e293b', borderRadius: '8px' }}
                    labelStyle={{ color: '#94a3b8', fontWeight: 'bold' }}
                    itemStyle={{ color: '#2dd4bf' }}
                  />
                  <Bar dataKey="Stock" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill="#0f766e" />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Critical Alerts Block */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col transition-all duration-300 hover:border-slate-700 hover:shadow-lg hover:shadow-teal-950/5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-1.5">
                <ShieldAlert className="text-red-500 w-4 h-4" />
                Critical Alerts
              </h3>
              <p className="text-xs text-slate-400">Items low in stock AND expiring within 7 days.</p>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-red-950 text-red-400 border border-red-900">
              {criticalAlerts.length} Action Needed
            </span>
          </div>

          <div className="flex-1 overflow-y-auto max-h-64 space-y-3 pr-1">
            {criticalAlerts.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-4 border border-dashed border-slate-800 rounded-lg">
                <p className="text-xs text-slate-500 font-medium">No critical alerts detected.</p>
                <p className="text-[10px] text-slate-600 mt-0.5">All low-stock items have safe batch expiry dates.</p>
              </div>
            ) : (
              criticalAlerts.map(alert => (
                <div key={alert.id} className="p-3 bg-red-950/20 border border-red-900/40 rounded-lg space-y-1.5">
                  <div className="flex justify-between items-start">
                    <h4 className="text-xs font-bold text-slate-200 truncate max-w-[150px]">{alert.name}</h4>
                    <span className="text-[10px] font-mono bg-red-950 text-red-400 px-1.5 py-0.5 rounded">
                      {alert.sku}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-400">
                    <div>
                      Stock: <span className="font-semibold text-red-400">{alert.currentStock}</span> / {alert.threshold} (Min)
                    </div>
                    <div>
                      Expiry Batch: <span className="font-semibold text-slate-200">{alert.expiringBatch}</span>
                    </div>
                    <div className="col-span-2">
                      Expiry Date: <span className="font-semibold text-red-400">{alert.expiryDate}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <Link
            to="/inventory"
            className="mt-4 flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-800 text-slate-200 rounded-lg text-xs font-semibold hover:bg-slate-700 transition-colors"
          >
            <span>Resolve in Inventory</span>
            <ArrowUpRight size={14} />
          </Link>
        </div>
      </div>

      {/* AI Copilot NL Query Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 transition-all duration-300 hover:border-slate-700 hover:shadow-lg hover:shadow-teal-950/5">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-teal-950 text-teal-400 rounded-lg">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-100">AI Copilot Natural Language Query</h3>
            <p className="text-xs text-slate-400">Ask plain-English questions about products, stock levels, or batches (e.g. "which products are low on stock?").</p>
          </div>
        </div>

        {/* Input Form */}
        <form onSubmit={handleQuerySubmit} className="flex gap-2">
          <input
            type="text"
            placeholder="Type your question about inventory levels, batch status or movements..."
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            disabled={queryLoading}
            className="flex-1 px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-teal-700 disabled:opacity-55"
          />
          <button
            type="submit"
            disabled={queryLoading || !queryInput.trim()}
            className="px-5 py-2.5 bg-teal-800 hover:bg-teal-700 disabled:opacity-40 disabled:hover:bg-teal-800 text-white rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5 shrink-0"
          >
            {queryLoading && (
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            )}
            <span>Ask Copilot</span>
          </button>
        </form>

        {/* Q&A History List */}
        {queryHistory.length > 0 && (
          <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-3 max-h-72 overflow-y-auto pr-1">
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Copilot Interaction History</h4>
            <div className="space-y-3">
              {queryHistory.map((item, index) => (
                <div key={index} className="p-3 bg-slate-950/60 rounded-lg border border-slate-800/60 space-y-2">
                  <div className="flex gap-2 items-start">
                    <span className="text-[10px] font-bold text-teal-500 bg-teal-950 px-1.5 py-0.5 rounded font-mono shrink-0">Q</span>
                    <p className="text-xs font-semibold text-slate-300">{item.question}</p>
                  </div>
                  <div className="flex gap-2 items-start pt-1.5 border-t border-slate-900/60">
                    <span className="text-[10px] font-bold text-purple-400 bg-purple-950/40 px-1.5 py-0.5 rounded font-mono shrink-0">A</span>
                    <p className="text-xs text-slate-400 leading-relaxed font-sans whitespace-pre-line">{item.answer}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
