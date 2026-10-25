-- Migration 006: Create vehicle_images table
-- Implements vehicle image storage support described in docs/database-design.md

CREATE TABLE IF NOT EXISTS vehicle_images (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id uuid NOT NULL REFERENCES vehicles(id) ON DELETE RESTRICT,
    url text NOT NULL CHECK (btrim(url) <> ''),
    alt_text text NOT NULL CHECK (btrim(alt_text) <> ''),
    display_order integer NOT NULL CHECK (display_order >= 0),
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT vehicle_images_vehicle_id_display_order_key UNIQUE (vehicle_id, display_order)
);

CREATE INDEX IF NOT EXISTS idx_vehicle_images_vehicle_id ON vehicle_images (vehicle_id);
