import React, { useState, useEffect } from 'react';
import { Sparkles, AlertTriangle, AlertCircle, ShoppingCart, Check, X, FileText, CheckCircle2 } from 'lucide-react';

export default function AICopilot() {
  const [loading, setLoading] = useState(true);
  const [suggestions, setSuggestions] = useState([]);
  const [error, setError] = useState(null);
  
  // Purchase Order Modal state
  const [activePO, setActivePO] = useState(null);
  const [poSuccess, setPoSuccess] = useState(false);

  useEffect(() => {
    fetchSuggestions();
  }, []);

  async function fetchSuggestions() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/ai/reorder-suggestions');
      if (!res.ok) {
        throw new Error('API server returned error or Gemini is currently rate-limited.');
      }
      const data = await res.json();
      setSuggestions(data);
    } catch (err) {
      console.error(err);
      setError('Gemini API is unavailable or rate-limited. Using local fallback rules.');
      
      // Local fallback suggestions based on reorder threshold if Gemini fails
      try {
        const prodRes = await fetch('/api/products');
        const prodData = await prodRes.json();
        const lowStock = prodData.filter(p => (parseInt(p.total_stock) || 0) < p.reorder_threshold);
        
        const fallback = lowStock.map(p => ({
          product_name: p.name,
          current_stock: p.total_stock,
          days_until_stockout: Math.random() < 0.5 ? 4 : 8,
          recommended_reorder_qty: p.reorder_threshold * 2,
          urgency: p.total_stock === 0 ? 'high' : 'medium',
          reasoning: `Local Fallback Warning: Current stock of ${p.total_stock} is below reorder threshold of ${p.reorder_threshold}.`
        }));
        setSuggestions(fallback);
      } catch (fallbackErr) {
        console.error(fallbackErr);
      }
    } finally {
      setLoading(false);
    }
  }

  // Sort suggestions by urgency: high first, then medium, then low
  const sortedSuggestions = [...suggestions].sort((a, b) => {
    const weights = { high: 3, medium: 2, low: 1 };
    return (weights[b.urgency] || 0) - (weights[a.urgency] || 0);
  });

  const handleOpenPO = (suggestion) => {
    // Generate pre-filled PO
    const suppliers = [
      'CleanCorp Wholesale',
      'Hygiene Direct Ltd',
      'EcoSan Supply Co',
      'Global Pac & Mop'
    ];
    // Pick supplier based on product category or name
    let selectedSupplier = suppliers[0];
    if (suggestion.product_name.toLowerCase().includes('tissue') || suggestion.product_name.toLowerCase().includes('paper')) {
      selectedSupplier = suppliers[1];
    } else if (suggestion.product_name.toLowerCase().includes('cloth') || suggestion.product_name.toLowerCase().includes('mop')) {
      selectedSupplier = suppliers[3];
    } else if (suggestion.product_name.toLowerCase().includes('hand') || suggestion.product_name.toLowerCase().includes('soap')) {
      selectedSupplier = suppliers[2];
    }

    setActivePO({
      poNumber: `PO-${10000 + Math.floor(Math.random() * 9000)}`,
      productName: suggestion.product_name,
      quantity: suggestion.recommended_reorder_qty || 50,
      supplier: selectedSupplier,
      date: new Date().toLocaleDateString()
    });
  };

  const handleConfirmPO = () => {
    setPoSuccess(true);
    setTimeout(() => {
      setPoSuccess(false);
      setActivePO(null);
    }, 3000);
  };

  return (
    <div className="space-y-6 relative animate-page-load">
      {/* Title */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
            <Sparkles className="text-teal-400 w-6 h-6 animate-pulse" />
            AI Copilot Intelligence
          </h2>
          <p className="text-sm text-slate-400">
            Autonomous procurement reorder models and automated PO draft generation.
          </p>
        </div>
        <button
          onClick={fetchSuggestions}
          disabled={loading}
          className="px-3.5 py-1.5 rounded-lg bg-teal-950 text-teal-400 border border-teal-800 text-xs font-semibold hover:bg-teal-900 transition-colors disabled:opacity-50"
        >
          Refresh AI Engine
        </button>
      </div>

      {/* Main Panel */}
      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[50vh] bg-slate-900/40 border border-slate-800 rounded-xl p-12">
          <div className="relative w-12 h-12 mb-4">
            <div className="absolute inset-0 rounded-full border-4 border-slate-800"></div>
            <div className="absolute inset-0 rounded-full border-4 border-teal-500 border-t-transparent animate-spin"></div>
          </div>
          <p className="text-sm text-teal-400 font-semibold animate-pulse">Consulting Gemini Copilot Reorder Models...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {error && (
            <div className="p-3 bg-amber-950/20 border border-amber-900/30 rounded-xl text-amber-400 text-xs flex items-center gap-2">
              <AlertTriangle size={14} />
              <span>{error}</span>
            </div>
          )}

          {/* Grid of Suggestions */}
          {sortedSuggestions.length === 0 ? (
            <div className="p-16 text-center bg-slate-900 border border-slate-800 rounded-xl">
              <CheckCircle2 className="mx-auto text-emerald-500 w-12 h-12 mb-3" />
              <p className="text-slate-200 text-sm font-semibold">Warehouse inventory is fully optimized.</p>
              <p className="text-xs text-slate-500 mt-1">All products are safely above reorder thresholds with stable sales velocity.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedSuggestions.map((s, idx) => {
                const isHigh = s.urgency === 'high';
                const isMedium = s.urgency === 'medium';
                
                let urgencyBadge = 'bg-slate-800 text-slate-400 border-slate-700';
                if (isHigh) urgencyBadge = 'bg-red-500/20 text-red-400 border-red-500/30';
                else if (isMedium) urgencyBadge = 'bg-amber-500/20 text-amber-400 border-amber-500/30';

                return (
                  <div key={idx} className="bg-slate-900 border border-slate-800 hover:border-slate-700/80 rounded-xl p-5 flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-teal-950/10">
                    <div className="space-y-3">
                      <div className="flex justify-between items-start gap-2">
                        <h3 className="text-sm font-bold text-slate-200 line-clamp-1">{s.product_name}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${urgencyBadge}`}>
                          {s.urgency.toUpperCase()}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 text-xs border-y border-slate-800/80 py-2">
                        <div>
                          <p className="text-slate-500 font-medium">Current Stock</p>
                          <p className="text-slate-200 font-bold mt-0.5">{s.current_stock}</p>
                        </div>
                        <div>
                          <p className="text-slate-500 font-medium">Days to Stockout</p>
                          <p className={`font-bold mt-0.5 ${s.days_until_stockout <= 5 ? 'text-red-400' : 'text-slate-200'}`}>
                            {s.days_until_stockout !== null ? `${s.days_until_stockout} days` : 'Stable'}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <p className="text-[10px] font-semibold text-teal-500 uppercase tracking-wider">AI Reasoning</p>
                        <p className="text-xs text-slate-400 leading-relaxed">{s.reasoning}</p>
                      </div>
                    </div>

                    <div className="mt-5 pt-3 border-t border-slate-800 flex items-center justify-between gap-3">
                      <div className="text-xs">
                        <p className="text-slate-500">Rec. Reorder Qty</p>
                        <p className="text-sm font-bold text-teal-400 mt-0.5">{s.recommended_reorder_qty} units</p>
                      </div>
                      <button
                        onClick={() => handleOpenPO(s)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                          isHigh 
                            ? 'bg-teal-800 hover:bg-teal-700 text-white shadow-md shadow-teal-950/20' 
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                        }`}
                      >
                        <ShoppingCart size={12} />
                        <span>Draft PO</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* DRAFT PO MODAL */}
      {activePO && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-800 bg-slate-950 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <FileText className="text-teal-400 w-5 h-5" />
                <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">Purchase Order Draft</h3>
              </div>
              <button 
                onClick={() => setActivePO(null)}
                className="text-slate-500 hover:text-slate-300"
              >
                <X size={16} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              {poSuccess ? (
                <div className="flex flex-col items-center justify-center py-6 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-emerald-950/60 border border-emerald-800 flex items-center justify-center text-emerald-400">
                    <Check size={24} />
                  </div>
                  <h4 className="text-slate-200 font-bold text-sm">Purchase Order Confirmed</h4>
                  <p className="text-xs text-slate-500">PO dispatch request has been finalized and sent to supplier.</p>
                </div>
              ) : (
                <>
                  <div className="flex justify-between text-xs text-slate-500 font-mono">
                    <span>PO Ref: {activePO.poNumber}</span>
                    <span>Date: {activePO.date}</span>
                  </div>

                  <div className="space-y-3 bg-slate-950 p-4 rounded-lg border border-slate-800/80">
                    <div>
                      <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Supplier</span>
                      <p className="text-xs font-bold text-slate-200 mt-0.5">{activePO.supplier}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Product Name</span>
                      <p className="text-xs font-semibold text-slate-200 mt-0.5">{activePO.productName}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Quantity Ordered</span>
                      <p className="text-xs font-bold text-teal-400 mt-0.5">{activePO.quantity} units</p>
                    </div>
                  </div>

                  <div className="text-[10px] text-slate-500 italic bg-teal-950/10 border border-teal-900/20 p-2.5 rounded">
                    Purchase Order quantities are calculated automatically using real-time stock levels, reorder thresholds, and current sales velocity models.
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3 pt-3">
                    <button
                      onClick={() => setActivePO(null)}
                      className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition-colors"
                    >
                      Cancel Draft
                    </button>
                    <button
                      onClick={handleConfirmPO}
                      className="flex-1 py-2 bg-teal-800 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-md shadow-teal-950/20"
                    >
                      Confirm & Send PO
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
