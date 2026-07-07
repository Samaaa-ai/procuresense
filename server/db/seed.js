const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const logFile = path.join(__dirname, '..', 'seed.log');
fs.writeFileSync(logFile, 'Starting seed script...\n');

function log(msg) {
  console.log(msg);
  fs.appendFileSync(logFile, msg + '\n');
}

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_DATABASE || 'procuresense',
});

async function seed() {
  log('Starting database seeding...');
  
  // Create a temporary connection to postgres database to ensure procuresense database exists
  const tempPool = new Pool({
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: 'postgres',
  });
  
  try {
    const dbName = process.env.DB_DATABASE || 'procuresense';
    log(`Checking if database "${dbName}" exists...`);
    const res = await tempPool.query(`SELECT 1 FROM pg_database WHERE datname='${dbName}'`);
    if (res.rowCount === 0) {
      log(`Database "${dbName}" does not exist. Creating it...`);
      await tempPool.query(`CREATE DATABASE ${dbName}`);
      log(`Database "${dbName}" created.`);
    } else {
      log(`Database "${dbName}" already exists.`);
    }
  } catch (err) {
    log('Error ensuring database exists: ' + err.message + '\n' + JSON.stringify(err));
  } finally {
    await tempPool.end();
  }

  // Connect to target database
  log('Connecting to target database...');
  let client;
  try {
    client = await pool.connect();
    log('Successfully connected to target database.');
  } catch (err) {
    log('Connection to target database failed: ' + err.message + '\n' + JSON.stringify(err));
    return;
  }

  try {
    await client.query('BEGIN');

    // Clean up existing tables
    log('Dropping existing tables...');
    await client.query(`
      DROP TABLE IF EXISTS stock_movements CASCADE;
      DROP TABLE IF EXISTS batches CASCADE;
      DROP TABLE IF EXISTS products CASCADE;
      DROP TABLE IF EXISTS suppliers CASCADE;
    `);

    // Read and run schema.sql
    log('Creating tables from schema.sql...');
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    await client.query(schemaSql);

    // 1. Seed Suppliers
    log('Seeding suppliers...');
    const suppliers = [
      { name: 'CleanCorp Wholesale', contact_email: 'sales@cleancorp.com', avg_lead_time_days: 5 },
      { name: 'Hygiene Direct Ltd', contact_email: 'orders@hygienedirect.com', avg_lead_time_days: 3 },
      { name: 'EcoSan Supply Co', contact_email: 'support@ecosupply.co', avg_lead_time_days: 7 },
      { name: 'Global Pac & Mop', contact_email: 'logistics@globalpac.com', avg_lead_time_days: 10 }
    ];

    const supplierIds = [];
    for (const sup of suppliers) {
      const res = await client.query(
        'INSERT INTO suppliers (name, contact_email, avg_lead_time_days) VALUES ($1, $2, $3) RETURNING id',
        [sup.name, sup.contact_email, sup.avg_lead_time_days]
      );
      supplierIds.push(res.rows[0].id);
    }

    // 2. Seed 15 Products
    log('Seeding products...');
    const products = [
      { sku: 'FC-001', name: 'Industrial Floor Cleaner', category: 'Chemicals', unit: '5L Bottle', reorder_threshold: 15, unit_price: 24.99 },
      { sku: 'HS-002', name: 'Instant Hand Sanitizer Gel', category: 'Hygiene', unit: '500ml Pump Bottle', reorder_threshold: 40, unit_price: 5.49 },
      { sku: 'LD-003', name: 'Pro Laundry Detergent Liquid', category: 'Chemicals', unit: '10L Tub', reorder_threshold: 10, unit_price: 45.00 },
      { sku: 'NG-004', name: 'Nitrile Gloves (Powder-Free, Box of 100)', category: 'PPE', unit: 'Box', reorder_threshold: 50, unit_price: 12.99 },
      { sku: 'MH-005', name: 'Heavy Duty Cotton Mop Heads', category: 'Equipment', unit: 'Pack of 5', reorder_threshold: 8, unit_price: 18.50 },
      { sku: 'DS-006', name: 'Hospital Grade Disinfectant Spray', category: 'Chemicals', unit: '750ml Spray', reorder_threshold: 30, unit_price: 7.99 },
      { sku: 'TR-007', name: 'Luxury Toilet Tissue Rolls (3-Ply)', category: 'Paper Products', unit: 'Pack of 36', reorder_threshold: 25, unit_price: 21.99 },
      { sku: 'MC-008', name: 'Microfiber Cleaning Cloths (Blue)', category: 'Equipment', unit: 'Pack of 10', reorder_threshold: 20, unit_price: 9.99 },
      { sku: 'BL-009', name: 'Concentrated Bleach', category: 'Chemicals', unit: '5L Jug', reorder_threshold: 15, unit_price: 6.50 },
      { sku: 'GC-010', name: 'Streak-Free Glass Cleaner', category: 'Chemicals', unit: '750ml Trigger', reorder_threshold: 12, unit_price: 4.80 },
      { sku: 'TB-011', name: 'Heavy Duty Black Trash Bags 50L', category: 'Paper & Disposal', unit: 'Roll of 50', reorder_threshold: 30, unit_price: 11.25 },
      { sku: 'PT-012', name: 'Centerfeed Paper Towel Rolls', category: 'Paper Products', unit: 'Pack of 6', reorder_threshold: 20, unit_price: 26.50 },
      { sku: 'DL-013', name: 'Lemon Scented Dishwashing Liquid', category: 'Chemicals', unit: '5L Bottle', reorder_threshold: 15, unit_price: 13.99 },
      { sku: 'HSO-014', name: 'Antibacterial Liquid Hand Soap', category: 'Hygiene', unit: '5L Refill Tub', reorder_threshold: 12, unit_price: 19.99 },
      { sku: 'FM-015', name: '3-Ply Disposable Face Masks', category: 'PPE', unit: 'Box of 50', reorder_threshold: 25, unit_price: 8.50 }
    ];

    const productMap = {};
    for (const prod of products) {
      const res = await client.query(
        'INSERT INTO products (sku, name, category, unit, reorder_threshold, unit_price) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, sku',
        [prod.sku, prod.name, prod.category, prod.unit, prod.reorder_threshold, prod.unit_price]
      );
      productMap[prod.sku] = res.rows[0].id;
    }

    // 3. Seed Batches and Stock Movements
    log('Seeding batches and stock movements with realistic patterns...');
    const now = new Date();
    const skus = Object.keys(productMap);
    
    for (const sku of skus) {
      const productId = productMap[sku];
      const isFastMoving = ['TR-007', 'HS-002', 'NG-004', 'DS-006'].includes(sku);
      const isSlowMoving = ['MH-005', 'LD-003', 'FM-015'].includes(sku);
      const isDemoAlert = ['HS-002', 'DS-006', 'FM-015'].includes(sku);
      
      const numBatches = isDemoAlert ? 1 : (Math.random() < 0.5 ? 2 : 3);
      
      for (let b = 1; b <= numBatches; b++) {
        const batchNum = `B-${sku}-${100 + b}`;
        const loc = `WH-SEC-${String.fromCharCode(65 + Math.floor(Math.random() * 4))}-${Math.floor(Math.random() * 10) + 1}`;
        
        let expiryDays = 90;
        if (isDemoAlert) {
          expiryDays = 3;
        } else if (b === 2) {
          expiryDays = 120 + Math.floor(Math.random() * 100);
        } else {
          expiryDays = 365 + Math.floor(Math.random() * 200);
        }
        
        const expiryDate = new Date();
        expiryDate.setDate(now.getDate() + expiryDays);
        
        const receivedDaysAgo = 30 + Math.floor(Math.random() * 30);
        const receivedDate = new Date();
        receivedDate.setDate(now.getDate() - receivedDaysAgo);
        
        let initialQty;
        if (isDemoAlert) {
          initialQty = sku === 'HS-002' ? 12 : (sku === 'DS-006' ? 8 : 5);
        } else {
          initialQty = isFastMoving ? 150 + Math.floor(Math.random() * 100) : 30 + Math.floor(Math.random() * 20);
        }
        
        const batchRes = await client.query(
          `INSERT INTO batches (product_id, batch_number, quantity, expiry_date, received_date, warehouse_location) 
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
          [productId, batchNum, initialQty, expiryDate, receivedDate, loc]
        );
        const batchId = batchRes.rows[0].id;
        
        await client.query(
          `INSERT INTO stock_movements (product_id, batch_id, type, quantity, timestamp, reference_note)
           VALUES ($1, $2, 'inward', $3, $4, $5)`,
          [productId, batchId, initialQty, receivedDate, `Initial stocking for batch ${batchNum}`]
        );
        
        let remainingQty = initialQty;
        
        if (!isDemoAlert) {
          const numMovements = isFastMoving ? 5 + Math.floor(Math.random() * 5) : (isSlowMoving ? 1 : 2 + Math.floor(Math.random() * 2));
          
          for (let m = 0; m < numMovements; m++) {
            const moveDaysAgo = receivedDaysAgo - Math.floor(Math.random() * receivedDaysAgo);
            const moveDate = new Date();
            moveDate.setDate(now.getDate() - moveDaysAgo);
            
            const maxOutQty = Math.floor(remainingQty * 0.25) || 1;
            const outQty = Math.max(1, Math.floor(Math.random() * maxOutQty));
            
            if (remainingQty - outQty >= 0) {
              await client.query(
                `INSERT INTO stock_movements (product_id, batch_id, type, quantity, timestamp, reference_note)
                 VALUES ($1, $2, 'outward', $3, $4, $5)`,
                [productId, batchId, outQty, moveDate, `Order fulfillment for batch ${batchNum}`]
              );
              remainingQty -= outQty;
            }
          }
        }
        
        await client.query(
          'UPDATE batches SET quantity = $1 WHERE id = $2',
          [remainingQty, batchId]
        );
      }
    }

    await client.query('COMMIT');
    log('Database successfully seeded!');
  } catch (err) {
    if (client) await client.query('ROLLBACK');
    log('Error seeding database: ' + err.message + '\n' + JSON.stringify(err));
  } finally {
    if (client) client.release();
    await pool.end();
    log('Database pool closed.');
  }
}

seed();
