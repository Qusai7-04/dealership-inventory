CREATE TABLE favourites (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  vehicle_id uuid NOT NULL REFERENCES vehicles(id) ON DELETE RESTRICT,
  notify_on_restock boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, vehicle_id)
);

CREATE INDEX idx_favourites_restock_subscribers ON favourites(vehicle_id) WHERE notify_on_restock = true;

CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  vehicle_id uuid REFERENCES vehicles(id) ON DELETE RESTRICT,
  type text NOT NULL CHECK (type IN ('low_stock', 'out_of_stock', 'back_in_stock')),
  event_key text NOT NULL CHECK (btrim(event_key) <> ''),
  message text NOT NULL CHECK (btrim(message) <> ''),
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  read_at timestamptz,
  UNIQUE (recipient_id, type, event_key)
);

CREATE INDEX idx_notifications_inbox ON notifications(recipient_id, created_at DESC);
