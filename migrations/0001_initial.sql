PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  price_minor INTEGER NOT NULL CHECK (price_minor >= 0),
  currency TEXT NOT NULL DEFAULT 'GHS' CHECK (currency = 'GHS'),
  sku TEXT UNIQUE,
  category_id TEXT NOT NULL REFERENCES categories(id),
  images_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(images_json)),
  stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  reserved_quantity INTEGER NOT NULL DEFAULT 0 CHECK (
    reserved_quantity >= 0 AND reserved_quantity <= stock_quantity
  ),
  low_stock_threshold INTEGER NOT NULL DEFAULT 2 CHECK (low_stock_threshold >= 0),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  is_featured INTEGER NOT NULL DEFAULT 0 CHECK (is_featured IN (0, 1)),
  archived_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_products_category
  ON products(category_id);

CREATE INDEX IF NOT EXISTS idx_products_catalogue
  ON products(is_active, archived_at, created_at);

CREATE TABLE IF NOT EXISTS administrators (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  password_hash TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
  id_hash TEXT PRIMARY KEY,
  administrator_id TEXT NOT NULL REFERENCES administrators(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sessions_expiry
  ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  order_reference TEXT NOT NULL UNIQUE,
  idempotency_key TEXT NOT NULL UNIQUE,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  fulfillment_method TEXT NOT NULL CHECK (
    fulfillment_method IN ('delivery', 'collection')
  ),
  delivery_address TEXT,
  customer_notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending_confirmation' CHECK (
    status IN (
      'pending_confirmation',
      'confirmed',
      'processing',
      'ready_for_collection',
      'dispatched',
      'completed',
      'cancelled',
      'expired'
    )
  ),
  currency TEXT NOT NULL DEFAULT 'GHS' CHECK (currency = 'GHS'),
  subtotal_minor INTEGER NOT NULL CHECK (subtotal_minor >= 0),
  delivery_fee_minor INTEGER NOT NULL DEFAULT 0 CHECK (delivery_fee_minor >= 0),
  total_minor INTEGER NOT NULL CHECK (
    total_minor = subtotal_minor + delivery_fee_minor
  ),
  reservation_expires_at TEXT,
  cancellation_reason TEXT,
  internal_notes TEXT NOT NULL DEFAULT '',
  payment_confirmed INTEGER NOT NULL DEFAULT 0 CHECK (payment_confirmed IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (
    fulfillment_method != 'delivery'
    OR (delivery_address IS NOT NULL AND length(trim(delivery_address)) > 0)
  )
);

CREATE INDEX IF NOT EXISTS idx_orders_status_date
  ON orders(status, created_at);

CREATE INDEX IF NOT EXISTS idx_orders_customer_phone
  ON orders(customer_phone);

CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id),
  product_name TEXT NOT NULL,
  sku_snapshot TEXT,
  unit_price_minor INTEGER NOT NULL CHECK (unit_price_minor >= 0),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  line_total_minor INTEGER NOT NULL CHECK (
    line_total_minor = unit_price_minor * quantity
  )
);

CREATE INDEX IF NOT EXISTS idx_order_items_order
  ON order_items(order_id);

CREATE TABLE IF NOT EXISTS inventory_movements (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id),
  order_id TEXT REFERENCES orders(id),
  administrator_id TEXT REFERENCES administrators(id),
  movement_type TEXT NOT NULL CHECK (
    movement_type IN (
      'stock_received',
      'stock_adjusted',
      'reserved',
      'reservation_released',
      'sale',
      'return'
    )
  ),
  quantity_change INTEGER NOT NULL DEFAULT 0,
  reserved_change INTEGER NOT NULL DEFAULT 0,
  reason TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_inventory_product_date
  ON inventory_movements(product_id, created_at);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  administrator_id TEXT REFERENCES administrators(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(details_json)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_date
  ON audit_logs(created_at);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  key TEXT PRIMARY KEY,
  request_hash TEXT NOT NULL,
  order_id TEXT NOT NULL REFERENCES orders(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
