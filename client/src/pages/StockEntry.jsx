import React, { useState, useEffect } from 'react';
import { ArrowDownLeft, ArrowUpRight, HelpCircle, Save, CheckCircle2, AlertCircle } from 'lucide-react';

export default function StockEntry() {
  const [products, setProducts] = useState([]);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [movementType, setMovementType] = useState('inward'); // 'inward' or 'outward'
  const [statusMessage, setStatusMessage] = useState(null);

  // Form states - Inward
  const [inProductId, setInProductId] = useState('');
  const [inBatchNumber, setInBatchNumber] = useState('');
  const [inQuantity, setInQuantity] = useState('');
  const [inExpiryDate, setInExpiryDate] = useState('');
  const [inWarehouseLocation, setInWarehouseLocation] = useState('');
  const [inReference, setInReference] = useState('');

  // Form states - Outward
  const [outProductId, setOutProductId] = useState('');
  const [outQuantity, setOutQuantity] = useState('');
  const [outReference, setOutReference] = useState('');

  // FIFO preview calculation
  const [fifoAllocations, setFifoAllocations] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      setLoading(true);
      const prodRes = await fetch('/api/products');
      const prodData = await prodRes.json();
      
      const batchRes = await fetch('/api/batches');
      const batchData = await batchRes.json();

      setProducts(prodData);
      setBatches(batchData);
    } catch (err) {
      console.error('Error fetching entry lists:', err);
    } finally {
      setLoading(false);
    }
  }

  // Update FIFO allocation preview when product or quantity changes
  useEffect(() => {
    if (movementType !== 'outward' || !outProductId || !outQuantity) {
      setFifoAllocations([]);
      return;
    }

    const qty = parseInt(outQuantity);
    if (isNaN(qty) || qty <= 0) {
      setFifoAllocations([]);
      return;
    }

    // Get active batches of selected product, sorted by received_date ASC (FIFO)
    const prodBatches = batches
      .filter(b => b.product_id === parseInt(outProductId) && b.quantity > 0)
      .sort((a, b) => new Date(a.received_date) - new Date(b.received_date));

    let remaining = qty;
    const allocations = [];

    for (const batch of prodBatches) {
      if (remaining <= 0) break;
      const take = Math.min(batch.quantity, remaining);
      allocations.push({
        batchId: batch.id,
        batchNumber: batch.batch_number,
        available: batch.quantity,
        drawAmount: take,
        receivedDate: batch.received_date
      });
      remaining -= take;
    }

    setFifoAllocations(allocations);
  }, [outProductId, outQuantity, batches, movementType]);

  const showStatus = (type, text) => {
    setStatusMessage({ type, text });
    setTimeout(() => setStatusMessage(null), 5000);
  };

  const handleInwardSubmit = async (e) => {
    e.preventDefault();
    if (!inProductId || !inBatchNumber || !inQuantity || !inExpiryDate || !inWarehouseLocation) {
      showStatus('error', 'Please fill in all required fields.');
      return;
    }

    const qty = parseInt(inQuantity);
    if (isNaN(qty) || qty <= 0) {
      showStatus('error', 'Quantity must be a positive number.');
      return;
    }

    try {
      const response = await fetch('/api/batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: parseInt(inProductId),
          batch_number: inBatchNumber,
          quantity: qty,
          expiry_date: inExpiryDate,
          warehouse_location: inWarehouseLocation,
          received_date: new Date().toISOString().split('T')[0]
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to create batch');
      }

      showStatus('success', `Successfully registered Batch ${inBatchNumber} with ${qty} units.`);
      
      // Reset form
      setInBatchNumber('');
      setInQuantity('');
      setInExpiryDate('');
      setInWarehouseLocation('');
      setInReference('');
      
      // Refresh DB data
      fetchData();
    } catch (err) {
      showStatus('error', err.message);
    }
  };

  const handleOutwardSubmit = async (e) => {
    e.preventDefault();
    if (!outProductId || !outQuantity) {
      showStatus('error', 'Please specify product and quantity.');
      return;
    }

    const totalQty = parseInt(outQuantity);
    if (isNaN(totalQty) || totalQty <= 0) {
      showStatus('error', 'Quantity must be greater than 0.');
      return;
    }

    // Check if total requested exceeds available stock
    const selectedProd = products.find(p => p.id === parseInt(outProductId));
    const totalAvailable = selectedProd ? selectedProd.total_stock : 0;
    if (totalQty > totalAvailable) {
      showStatus('error', `Insufficient stock. Only ${totalAvailable} units available.`);
      return;
    }

    try {
      // Post a movement for each FIFO allocation
      for (const allocation of fifoAllocations) {
        const response = await fetch('/api/stock-movements', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            product_id: parseInt(outProductId),
            batch_id: allocation.batchId,
            type: 'outward',
            quantity: allocation.drawAmount,
            reference_note: outReference || `FIFO dispatch from Batch ${allocation.batchNumber}`
          })
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || 'Error processing stock movement');
        }
      }

      showStatus('success', `Dispatched ${totalQty} units under FIFO protocol.`);
      
      // Reset form
      setOutQuantity('');
      setOutReference('');
      
      // Refresh DB data
      fetchData();
    } catch (err) {
      showStatus('error', err.message);
    }
  };

  const selectedProductInfo = products.find(p => p.id === parseInt(outProductId));

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-page-load">
      {/* Title */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-100">Stock Transaction Ledger</h2>
        <p className="text-sm text-slate-400">Record inventory intake (inward) or order dispatch (outward).</p>
      </div>

      {/* Status Banner */}
      {statusMessage && (
        <div className={`p-4 rounded-xl border flex items-center gap-3 transition-opacity duration-300 ${
          statusMessage.type === 'success' 
            ? 'bg-emerald-950/20 border-emerald-500/20 text-emerald-400' 
            : 'bg-red-950/20 border-red-500/20 text-red-400'
        }`}>
          {statusMessage.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span className="text-sm font-semibold">{statusMessage.text}</span>
        </div>
      )}

      {/* Tab Selectors */}
      <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800">
        <button
          onClick={() => setMovementType('inward')}
          className={`flex-1 py-3 flex items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-all ${
            movementType === 'inward'
              ? 'bg-teal-950 text-teal-400 border border-teal-800/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <ArrowDownLeft size={16} />
          Inward Stock Entry
        </button>
        <button
          onClick={() => setMovementType('outward')}
          className={`flex-1 py-3 flex items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-all ${
            movementType === 'outward'
              ? 'bg-teal-950 text-teal-400 border border-teal-800/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <ArrowUpRight size={16} />
          Outward Dispatch (FIFO)
        </button>
      </div>

      {/* Form Container */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        {loading ? (
          <div className="text-center text-slate-500 py-12">Loading metadata...</div>
        ) : movementType === 'inward' ? (
          /* INWARD FORM */
          <form onSubmit={handleInwardSubmit} className="space-y-4">
            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-2">Record Inbound Batch</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Product Select */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-400">Select Product *</label>
                <select
                  value={inProductId}
                  onChange={(e) => setInProductId(e.target.value)}
                  className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-teal-700"
                  required
                >
                  <option value="">-- Choose Product --</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                  ))}
                </select>
              </div>

              {/* Batch Number */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-400">Batch Number *</label>
                <input
                  type="text"
                  placeholder="e.g. B-FM-101"
                  value={inBatchNumber}
                  onChange={(e) => setInBatchNumber(e.target.value)}
                  className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-teal-700"
                  required
                />
              </div>

              {/* Quantity */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-400">Quantity *</label>
                <input
                  type="number"
                  placeholder="e.g. 50"
                  value={inQuantity}
                  onChange={(e) => setInQuantity(e.target.value)}
                  className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-teal-700"
                  required
                />
              </div>

              {/* Expiry Date */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-400">Expiry Date *</label>
                <input
                  type="date"
                  value={inExpiryDate}
                  onChange={(e) => setInExpiryDate(e.target.value)}
                  className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-teal-700"
                  required
                />
              </div>

              {/* Location */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-400">Warehouse Location *</label>
                <input
                  type="text"
                  placeholder="e.g. WH-SEC-A-5"
                  value={inWarehouseLocation}
                  onChange={(e) => setInWarehouseLocation(e.target.value)}
                  className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-teal-700"
                  required
                />
              </div>

              {/* Notes */}
              <div className="flex flex-col gap-1.5 md:col-span-2">
                <label className="text-xs font-semibold text-slate-400">Reference/Note</label>
                <textarea
                  placeholder="Additional delivery references..."
                  value={inReference}
                  onChange={(e) => setInReference(e.target.value)}
                  className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-teal-700 h-20"
                />
              </div>
            </div>

            <button
              type="submit"
              className="mt-4 flex items-center justify-center gap-2 px-5 py-2.5 bg-teal-800 hover:bg-teal-700 text-white rounded-lg text-sm font-semibold transition-colors w-full md:w-auto"
            >
              <Save size={16} />
              Commit Inbound Batch
            </button>
          </form>
        ) : (
          /* OUTWARD FORM */
          <form onSubmit={handleOutwardSubmit} className="space-y-4">
            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-2">Record Outbound Dispatch</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Product Select */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-400">Select Product *</label>
                <select
                  value={outProductId}
                  onChange={(e) => setOutProductId(e.target.value)}
                  className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-teal-700"
                  required
                >
                  <option value="">-- Choose Product --</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.sku}) - Avail: {p.total_stock}</option>
                  ))}
                </select>
              </div>

              {/* Dispatch Quantity */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-400">Quantity to Dispatch *</label>
                <input
                  type="number"
                  placeholder="Enter dispatch quantity"
                  value={outQuantity}
                  onChange={(e) => setOutQuantity(e.target.value)}
                  className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-teal-700"
                  required
                />
              </div>

              {/* Reference */}
              <div className="flex flex-col gap-1.5 md:col-span-2">
                <label className="text-xs font-semibold text-slate-400">Reference/Note</label>
                <textarea
                  placeholder="Sales order ID or reference..."
                  value={outReference}
                  onChange={(e) => setOutReference(e.target.value)}
                  className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-teal-700 h-20"
                />
              </div>
            </div>

            {/* FIFO Allocation Preview Block */}
            {fifoAllocations.length > 0 && (
              <div className="mt-4 p-4 bg-slate-950 rounded-lg border border-slate-800 space-y-2">
                <h4 className="text-xs font-bold text-teal-400 flex items-center gap-1.5">
                  <HelpCircle size={14} />
                  FIFO Batch Allocation Preview
                </h4>
                <div className="divide-y divide-slate-900 text-xs">
                  {fifoAllocations.map((alloc) => (
                    <div key={alloc.batchId} className="py-2 flex justify-between">
                      <span className="text-slate-400">
                        Batch <span className="font-mono text-slate-200 font-bold">{alloc.batchNumber}</span> (Recv: {new Date(alloc.receivedDate).toLocaleDateString()})
                      </span>
                      <span className="text-slate-300">
                        Drawing <span className="font-bold text-teal-400">{alloc.drawAmount}</span> / {alloc.available} units
                      </span>
                    </div>
                  ))}
                  {fifoAllocations.reduce((sum, item) => sum + item.drawAmount, 0) < parseInt(outQuantity) && (
                    <div className="py-2 text-red-400 font-semibold">
                      Warning: Insufficient stock. {parseInt(outQuantity) - fifoAllocations.reduce((sum, item) => sum + item.drawAmount, 0)} units remain unallocated.
                    </div>
                  )}
                </div>
              </div>
            )}

            <button
              type="submit"
              className="mt-4 flex items-center justify-center gap-2 px-5 py-2.5 bg-teal-800 hover:bg-teal-700 text-white rounded-lg text-sm font-semibold transition-colors w-full md:w-auto"
            >
              <Save size={16} />
              Execute FIFO Dispatch
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
