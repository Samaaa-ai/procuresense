import React, { useState, useEffect } from 'react';
import { API_URL } from '../config';
import { Search, ChevronDown, ChevronUp, AlertCircle, AlertTriangle, CheckCircle, PackageOpen, HelpCircle } from 'lucide-react';

export default function Inventory() {
  const [products, setProducts] = useState([]);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [expandedRows, setExpandedRows] = useState({});
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);
        const prodRes = await fetch('${API_URL}/api/products');
        const prodData = await prodRes.json();

        const batchRes = await fetch('${API_URL}/api/batches');
        const batchData = await batchRes.json();

        if (prodData.error || batchData.error) {
          setError(prodData.error || batchData.error);
          return;
        }

        setProducts(prodData);
        setBatches(batchData);
      } catch (err) {
        console.error('Error fetching inventory:', err);
        setError('Failed to fetch inventory from server.');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const toggleRow = (id) => {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Get categories for filter dropdown
  const categories = Array.from(new Set(products.map(p => p.category)));

  // Filter products
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase()) ||
      p.category.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === '' || p.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const getStatus = (p) => {
    const stock = parseInt(p.total_stock) || 0;
    const prodBatches = batches.filter(b => b.product_id === p.id && b.quantity > 0);

    // Check if any batch is expiring within 7 days
    const now = new Date();
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(now.getDate() + 7);

    const hasExpiringBatch = prodBatches.some(b => {
      const expDate = new Date(b.expiry_date);
      return expDate <= sevenDaysFromNow;
    });

    if (hasExpiringBatch) {
      return {
        type: 'critical',
        label: 'Expiring Soon',
        color: 'border-red-500/30 bg-red-950/20 text-red-400',
        badge: 'bg-red-500/20 text-red-400 border-red-500/30'
      };
    }
    if (stock < p.reorder_threshold) {
      return {
        type: 'warning',
        label: 'Low Stock',
        color: 'border-amber-500/30 bg-amber-950/20 text-amber-400',
        badge: 'bg-amber-500/20 text-amber-400 border-amber-500/30'
      };
    }
    return {
      type: 'good',
      label: 'Optimal',
      color: 'border-emerald-500/30 bg-emerald-950/10 text-emerald-400',
      badge: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
    };
  };

  return (
    <div className="space-y-6 animate-page-load">
      {/* Title */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-100">Inventory Status Repository</h2>
        <p className="text-sm text-slate-400">View real-time batch allocation and warehouse levels.</p>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
          Database Connection Error: {error}. Please ensure the database has been seeded.
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 bg-slate-900 p-4 rounded-xl border border-slate-800">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4.5 w-4.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search by SKU, Product Name, Category..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-teal-700"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-teal-700"
        >
          <option value="">All Categories</option>
          {categories.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      {/* Main Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400">Loading inventory data...</div>
        ) : filteredProducts.length === 0 ? (
          <div className="p-16 text-center">
            <PackageOpen className="mx-auto text-slate-600 w-12 h-12 mb-3" />
            <p className="text-slate-400 text-sm font-semibold">No items match filters.</p>
            <p className="text-xs text-slate-500 mt-1">Try refining search parameters or clear filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4 w-12"></th>
                  <th className="py-3 px-4">SKU</th>
                  <th className="py-3 px-4">Product Name</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4 text-right">Total Stock</th>
                  <th className="py-3 px-4">Unit</th>
                  <th className="py-3 px-4 text-right">Unit Price</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredProducts.map((p) => {
                  const status = getStatus(p);
                  const isExpanded = !!expandedRows[p.id];
                  const prodBatches = batches.filter(b => b.product_id === p.id);
                  const totalStock = parseInt(p.total_stock) || 0;

                  return (
                    <React.Fragment key={p.id}>
                      {/* Product Row */}
                      <tr
                        onClick={() => toggleRow(p.id)}
                        className={`hover:bg-slate-800/40 cursor-pointer transition-colors border-l-2 ${status.type === 'critical' ? 'border-l-red-500' :
                          status.type === 'warning' ? 'border-l-amber-500' : 'border-l-emerald-500'
                          }`}
                      >
                        <td className="py-3 px-4">
                          {isExpanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                        </td>
                        <td className="py-3 px-4 font-mono text-xs font-bold text-slate-300">{p.sku}</td>
                        <td className="py-3 px-4 font-semibold text-slate-200 text-sm">{p.name}</td>
                        <td className="py-3 px-4 text-xs text-slate-400">{p.category}</td>
                        <td className="py-3 px-4 text-right font-bold text-slate-200">{totalStock}</td>
                        <td className="py-3 px-4 text-xs text-slate-400">{p.unit}</td>
                        <td className="py-3 px-4 text-right font-mono text-xs text-slate-300">${parseFloat(p.unit_price).toFixed(2)}</td>
                        <td className="py-3 px-4 text-center">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${status.badge}`}>
                            {status.type === 'critical' && <AlertCircle size={10} />}
                            {status.type === 'warning' && <AlertTriangle size={10} />}
                            {status.type === 'good' && <CheckCircle size={10} />}
                            {status.label}
                          </span>
                        </td>
                      </tr>

                      {/* Expanded Batches Sub-Table */}
                      {isExpanded && (
                        <tr className="bg-slate-950/40">
                          <td colSpan={8} className="py-3 px-6 border-b border-slate-800/60">
                            <div className="rounded-lg border border-slate-800 overflow-hidden bg-slate-950/80">
                              <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 flex justify-between items-center">
                                <h4 className="text-xs font-bold text-slate-300">Active Batches for {p.name}</h4>
                                <span className="text-[10px] text-slate-500 font-medium">Reorder Threshold: {p.reorder_threshold} units</span>
                              </div>
                              {prodBatches.length === 0 ? (
                                <div className="p-4 text-center text-xs text-slate-600">No active batches for this product. Record stock entry to register a batch.</div>
                              ) : (
                                <table className="w-full text-left text-xs">
                                  <thead>
                                    <tr className="bg-slate-900/30 text-slate-500 border-b border-slate-800 font-semibold">
                                      <th className="py-2 px-4">Batch Number</th>
                                      <th className="py-2 px-4 text-right">Quantity</th>
                                      <th className="py-2 px-4">Warehouse Location</th>
                                      <th className="py-2 px-4">Received Date</th>
                                      <th className="py-2 px-4">Expiry Date</th>
                                      <th className="py-2 px-4 text-center">Status</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-800/40 text-slate-300">
                                    {prodBatches.map(b => {
                                      const expDate = new Date(b.expiry_date);
                                      const now = new Date();
                                      const diffDays = Math.ceil((expDate - now) / (1000 * 60 * 60 * 24));

                                      let batchExpStatus = 'Safe';
                                      let expClass = 'text-slate-300';
                                      if (diffDays <= 7) {
                                        batchExpStatus = `Expires in ${diffDays} day${diffDays !== 1 ? 's' : ''}`;
                                        expClass = 'text-red-400 font-bold';
                                      } else if (diffDays <= 90) {
                                        batchExpStatus = `Expires in ${Math.round(diffDays / 30)}mo`;
                                        expClass = 'text-amber-400 font-medium';
                                      }

                                      return (
                                        <tr key={b.id} className="hover:bg-slate-900/60">
                                          <td className="py-2 px-4 font-mono font-semibold text-slate-400">{b.batch_number}</td>
                                          <td className="py-2 px-4 text-right font-bold text-slate-200">{b.quantity}</td>
                                          <td className="py-2 px-4 font-mono text-[11px]">{b.warehouse_location}</td>
                                          <td className="py-2 px-4 text-slate-400">{new Date(b.received_date).toLocaleDateString()}</td>
                                          <td className={`py-2 px-4 ${expClass}`}>{expDate.toLocaleDateString()}</td>
                                          <td className="py-2 px-4 text-center">
                                            <span className={`text-[10px] font-bold ${diffDays <= 7 ? 'text-red-400 bg-red-950/30 px-2 py-0.5 rounded border border-red-900/40' : 'text-slate-500'}`}>
                                              {batchExpStatus}
                                            </span>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
