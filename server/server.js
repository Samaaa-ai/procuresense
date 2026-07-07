const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());


// Database connection pool
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_DATABASE || 'procuresense',
  ssl: { rejectUnauthorized: false },
});

// Helper database query function
const query = (text, params) => pool.query(text, params);

// ----------------------------------------------------
// API ENDPOINTS
// ----------------------------------------------------

// GET /products - Get all products (with optional aggregate total stock)
app.get('/api/products', async (req, res) => {
  try {
    const sql = `
      SELECT p.*, COALESCE(SUM(b.quantity), 0)::integer as total_stock
      FROM products p
      LEFT JOIN batches b ON p.id = b.product_id
      GROUP BY p.id
      ORDER BY p.name ASC
    `;
    const result = await query(sql);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching products:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /products - Create new product
app.post('/api/products', async (req, res) => {
  const { sku, name, category, unit, reorder_threshold, unit_price } = req.body;
  if (!sku || !name || !category || !unit) {
    return res.status(400).json({ error: 'sku, name, category, and unit are required fields' });
  }
  try {
    const sql = `
      INSERT INTO products (sku, name, category, unit, reorder_threshold, unit_price)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const params = [
      sku,
      name,
      category,
      unit,
      reorder_threshold !== undefined ? reorder_threshold : 10,
      unit_price !== undefined ? unit_price : 0.00
    ];
    const result = await query(sql, params);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating product:', err);
    if (err.code === '23505') { // Unique constraint violation
      return res.status(400).json({ error: 'Product SKU must be unique' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /batches - Get all batches (including product name and SKU)
app.get('/api/batches', async (req, res) => {
  try {
    const sql = `
      SELECT b.*, p.name as product_name, p.sku as product_sku
      FROM batches b
      JOIN products p ON b.product_id = p.id
      ORDER BY b.expiry_date ASC
    `;
    const result = await query(sql);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching batches:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /batches - Create new batch
app.post('/api/batches', async (req, res) => {
  const { product_id, batch_number, quantity, expiry_date, received_date, warehouse_location } = req.body;
  if (!product_id || !batch_number || quantity === undefined || !expiry_date || !warehouse_location) {
    return res.status(400).json({ error: 'product_id, batch_number, quantity, expiry_date, and warehouse_location are required' });
  }
  try {
    const sql = `
      INSERT INTO batches (product_id, batch_number, quantity, expiry_date, received_date, warehouse_location)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const params = [
      product_id,
      batch_number,
      quantity,
      expiry_date,
      received_date || new Date(),
      warehouse_location
    ];
    const result = await query(sql, params);

    // Auto-create an inward stock movement for reference
    await query(
      `INSERT INTO stock_movements (product_id, batch_id, type, quantity, reference_note)
       VALUES ($1, $2, 'inward', $3, $4)`,
      [product_id, result.rows[0].id, quantity, `Initial Batch Inflow: ${batch_number}`]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating batch:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /stock-movements - Get all movements with product and batch information
app.get('/api/stock-movements', async (req, res) => {
  try {
    const sql = `
      SELECT sm.*, p.name as product_name, p.sku as product_sku, b.batch_number
      FROM stock_movements sm
      JOIN products p ON sm.product_id = p.id
      JOIN batches b ON sm.batch_id = b.id
      ORDER BY sm.timestamp DESC
    `;
    const result = await query(sql);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching stock movements:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /stock-movements - Create new stock movement and update batch stock level
app.post('/api/stock-movements', async (req, res) => {
  const { product_id, batch_id, type, quantity, reference_note } = req.body;
  if (!product_id || !batch_id || !type || !quantity) {
    return res.status(400).json({ error: 'product_id, batch_id, type, and quantity are required' });
  }
  if (!['inward', 'outward'].includes(type)) {
    return res.status(400).json({ error: "type must be either 'inward' or 'outward'" });
  }
  if (quantity <= 0) {
    return res.status(400).json({ error: 'quantity must be greater than 0' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Fetch batch to check current stock if outward
    const batchRes = await client.query('SELECT quantity FROM batches WHERE id = $1', [batch_id]);
    if (batchRes.rowCount === 0) {
      throw new Error('Batch not found');
    }
    const currentQty = batchRes.rows[0].quantity;

    if (type === 'outward' && currentQty - quantity < 0) {
      return res.status(400).json({ error: 'Insufficient stock in this batch for this outward transaction' });
    }

    // Insert stock movement record
    const insertSql = `
      INSERT INTO stock_movements (product_id, batch_id, type, quantity, reference_note)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const movementRes = await client.query(insertSql, [product_id, batch_id, type, quantity, reference_note]);

    // Update batch quantity
    const newQty = type === 'inward' ? currentQty + quantity : currentQty - quantity;
    await client.query('UPDATE batches SET quantity = $1 WHERE id = $2', [newQty, batch_id]);

    await client.query('COMMIT');
    res.status(201).json(movementRes.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error handling stock movement:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  } finally {
    client.release();
  }
});

// GET /dashboard-summary - Aggregate data for dashboard cards
app.get('/api/dashboard-summary', async (req, res) => {
  try {
    // 1. Total SKUs
    const totalSkusRes = await query('SELECT COUNT(*)::integer FROM products');
    const totalSkus = totalSkusRes.rows[0].count;

    // 2. Low Stock Count
    // Number of products where the sum of batch quantities is less than the reorder_threshold
    const lowStockRes = await query(`
      SELECT COUNT(*)::integer FROM (
        SELECT p.id
        FROM products p
        LEFT JOIN batches b ON p.id = b.product_id
        GROUP BY p.id, p.reorder_threshold
        HAVING COALESCE(SUM(b.quantity), 0) < p.reorder_threshold
      ) as low_stock_products
    `);
    const lowStockCount = lowStockRes.rows[0].count;

    // 3. Expiring Soon Count (batches expiring within 30 days)
    const expiringSoonRes = await query(`
      SELECT COUNT(*)::integer FROM batches
      WHERE expiry_date <= CURRENT_DATE + INTERVAL '30 days' AND quantity > 0
    `);
    const expiringSoonCount = expiringSoonRes.rows[0].count;

    // 4. Total Stock Value
    const totalValueRes = await query(`
      SELECT COALESCE(SUM(b.quantity * p.unit_price), 0)::numeric(12,2) as total_value
      FROM batches b
      JOIN products p ON b.product_id = p.id
    `);
    const totalStockValue = parseFloat(totalValueRes.rows[0].total_value);

    res.json({
      totalSKUs: totalSkus,
      lowStockCount: lowStockCount,
      expiringSoonCount: expiringSoonCount,
      totalStockValue: totalStockValue,
    });
  } catch (err) {
    console.error('Error fetching dashboard summary:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ----------------------------------------------------
// AI COPILOT ENDPOINTS
// ----------------------------------------------------

// Initialize Gemini API
const getGenAI = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is missing.');
  }
  return new GoogleGenerativeAI(apiKey);
};

// GET /ai/reorder-suggestions
app.get('/api/ai/reorder-suggestions', async (req, res) => {
  try {
    // 1. Fetch live stock status, reorder thresholds, and active batches
    const productsRes = await query(`
      SELECT p.*, COALESCE(SUM(b.quantity), 0)::integer as total_stock
      FROM products p
      LEFT JOIN batches b ON p.id = b.product_id
      GROUP BY p.id
    `);

    const batchesRes = await query(`
      SELECT b.*, p.name as product_name
      FROM batches b
      JOIN products p ON b.product_id = p.id
      WHERE b.quantity > 0
    `);

    // Fetch movements in last 30 days to calculate daily sales velocity
    const movementsRes = await query(`
      SELECT product_id, type, quantity, timestamp
      FROM stock_movements
      WHERE timestamp >= NOW() - INTERVAL '30 days'
    `);

    const products = productsRes.rows;
    const batches = batchesRes.rows;
    const movements = movementsRes.rows;

    // Calculate daily dispatch velocity per product (total outward / 30)
    const velocityMap = {};
    products.forEach(p => {
      velocityMap[p.id] = 0;
    });

    movements.forEach(m => {
      if (m.type === 'outward') {
        velocityMap[m.product_id] = (velocityMap[m.product_id] || 0) + m.quantity;
      }
    });

    const productsContext = products.map(p => {
      const thirtyDayOutward = velocityMap[p.id] || 0;
      const dailyVelocity = parseFloat((thirtyDayOutward / 30).toFixed(2));
      const prodBatches = batches.filter(b => b.product_id === p.id).map(b => ({
        batch_number: b.batch_number,
        quantity: b.quantity,
        expiry_date: b.expiry_date
      }));

      return {
        id: p.id,
        name: p.name,
        sku: p.sku,
        category: p.category,
        current_stock: p.total_stock,
        reorder_threshold: p.reorder_threshold,
        unit: p.unit,
        daily_sales_velocity: dailyVelocity,
        active_batches: prodBatches
      };
    });

    // 2. Call Gemini
    const genAI = getGenAI();
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: { responseMimeType: 'application/json' }
    });

    const prompt = `
      You are an expert Inventory Analyst.
      Analyze the current stock levels, thresholds, daily sales velocity (based on last 30 days), and batch expiry info for this SME hygiene distributor.
      Identify products at risk of stockout, estimate days until stockout based on daily velocity, and recommend reorder quantities.
      
      Live Warehouse Data:
      ${JSON.stringify(productsContext, null, 2)}
      
      Respond with a strict JSON array of suggestions. Provide recommendations for products that are either:
      1. Below or close to their reorder_threshold.
      2. Have a positive daily sales velocity and might run out soon.
      3. Have batches expiring soon.
      
      JSON format must be:
      [{
        "product_name": "Product Name",
        "current_stock": 45,
        "days_until_stockout": 12, // estimate or null if velocity is 0
        "recommended_reorder_qty": 100, // recommend a logical reorder size (e.g. 50, 100, 150)
        "urgency": "high", // "high" (days_until_stockout < 7 or stock < threshold/2), "medium" (days_until_stockout < 20 or stock < threshold), or "low"
        "reasoning": "Reason explaining the velocity, threshold breach, or batch expiry risk."
      }]
    `;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    res.json(JSON.parse(text));

  } catch (err) {
    console.error('Error generating reorder suggestions:', err);
    res.status(500).json({ error: err.message || 'Failed to generate reorder suggestions' });
  }
});

// POST /ai/query
app.post('/api/ai/query', async (req, res) => {
  const { question } = req.body;
  if (!question) {
    return res.status(400).json({ error: 'Question is required' });
  }

  try {
    // Fetch live state to feed Gemini as context
    const productsRes = await query(`
      SELECT p.*, COALESCE(SUM(b.quantity), 0)::integer as total_stock
      FROM products p
      LEFT JOIN batches b ON p.id = b.product_id
      GROUP BY p.id
    `);

    const batchesRes = await query(`
      SELECT b.*, p.name as product_name, p.sku as product_sku
      FROM batches b
      JOIN products p ON b.product_id = p.id
      WHERE b.quantity > 0
    `);

    const movementsRes = await query(`
      SELECT sm.*, p.name as product_name
      FROM stock_movements sm
      JOIN products p ON sm.product_id = p.id
      ORDER BY sm.timestamp DESC
      LIMIT 30
    `);

    const context = {
      products: productsRes.rows,
      batches: batchesRes.rows,
      recent_stock_movements: movementsRes.rows,
      current_date: new Date().toISOString().split('T')[0]
    };

    const genAI = getGenAI();
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const systemPrompt = `
      You are the ProcureSense AI Copilot, an intelligent warehouse assistant for an SME cleaning/hygiene distributor.
      You have real-time read-only access to the warehouse database.
      
      Live Database State:
      ${JSON.stringify(context, null, 2)}
      
      User Question: "${question}"
      
      Answer the question accurately based on the live database state.
      Follow these rules:
      - Answer directly, factually, and concisely (max 3-4 sentences unless requested otherwise).
      - Reference specific SKUs, batch numbers, locations, or quantities where appropriate.
      - If the user asks about low stock, compare total_stock against reorder_threshold.
      - If the user asks about expiry, check batches expiry_date against current_date (${context.current_date}).
      - Do not make up any data. If it is not in the context, say you do not have that data.
    `;

    const result = await model.generateContent(systemPrompt);
    const answer = result.response.text();
    res.json({ answer });

  } catch (err) {
    console.error('Error handling AI query:', err);
    res.status(500).json({ error: err.message || 'Failed to process natural language query' });
  }
});

app.listen(port, () => {
  console.log(`ProcureSense Server running on port ${port}`);
});
