-- Create suppliers table
CREATE TABLE IF NOT EXISTS suppliers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    contact_email VARCHAR(255) NOT NULL,
    avg_lead_time_days INTEGER NOT NULL
);

-- Create products table
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    sku VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    unit VARCHAR(50) NOT NULL,
    reorder_threshold INTEGER NOT NULL DEFAULT 10,
    unit_price NUMERIC(10, 2) NOT NULL DEFAULT 0.00
);

-- Create batches table
CREATE TABLE IF NOT EXISTS batches (
    id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    batch_number VARCHAR(100) NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity >= 0),
    expiry_date DATE NOT NULL,
    received_date DATE NOT NULL DEFAULT CURRENT_DATE,
    warehouse_location VARCHAR(100) NOT NULL
);

-- Create stock_movements table
CREATE TABLE IF NOT EXISTS stock_movements (
    id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    batch_id INTEGER REFERENCES batches(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('inward', 'outward')),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    reference_note TEXT
);
