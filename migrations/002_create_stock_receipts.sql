CREATE TABLE stock_receipts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id uuid NOT NULL REFERENCES vehicles(id) ON DELETE RESTRICT,
    actor_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    kind text NOT NULL CHECK (kind IN ('opening', 'restock')),
    quantity_added integer NOT NULL CHECK (quantity_added > 0),
    request_id uuid NULL,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK ((kind = 'opening' AND request_id IS NULL) OR (kind = 'restock' AND request_id IS NOT NULL))
);

CREATE UNIQUE INDEX idx_stock_receipts_opening ON stock_receipts (vehicle_id) WHERE kind = 'opening';
CREATE UNIQUE INDEX idx_stock_receipts_restock_request ON stock_receipts (actor_id, request_id) WHERE kind = 'restock';
CREATE INDEX idx_stock_receipts_vehicle ON stock_receipts (vehicle_id);
