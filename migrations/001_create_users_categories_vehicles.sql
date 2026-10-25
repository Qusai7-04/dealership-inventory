-- Migration 001: Create users, vehicle_categories, and vehicles tables
-- Implements initial schema from docs/database-design.md

-- 1. Users table
CREATE TABLE IF NOT EXISTS users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name text NOT NULL CHECK (btrim(full_name) <> ''),
    email text NOT NULL CHECK (btrim(email) <> ''),
    password_hash text NOT NULL CHECK (btrim(password_hash) <> ''),
    role text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    is_verified boolean NOT NULL DEFAULT false,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower ON users (lower(email));

-- 2. Vehicle categories table
CREATE TABLE IF NOT EXISTS vehicle_categories (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name text NOT NULL CHECK (btrim(name) <> '')
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_vehicle_categories_name_lower ON vehicle_categories (lower(name));

-- 3. Vehicles table
CREATE TABLE IF NOT EXISTS vehicles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    make text NOT NULL CHECK (btrim(make) <> ''),
    model text NOT NULL CHECK (btrim(model) <> ''),
    category_id integer NOT NULL REFERENCES vehicle_categories(id) ON DELETE RESTRICT,
    price numeric(12,2) NOT NULL CHECK (price >= 0),
    quantity integer NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    low_stock_threshold integer NOT NULL DEFAULT 3 CHECK (low_stock_threshold >= 0),
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at timestamptz NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_vehicles_active_identity ON vehicles (lower(make), lower(model)) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_vehicles_category_price ON vehicles (category_id, price) WHERE deleted_at IS NULL;
