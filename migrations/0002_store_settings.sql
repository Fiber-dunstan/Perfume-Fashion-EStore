CREATE TABLE IF NOT EXISTS store_settings (
  id TEXT PRIMARY KEY CHECK (id = 'default'),
  shop_name TEXT NOT NULL DEFAULT 'YOUR STORE',
  tagline TEXT NOT NULL DEFAULT 'STYLE · SCENT · EVERYDAY',
  description TEXT NOT NULL DEFAULT 'Explore fragrances, fashion, accessories and everyday essentials.',
  phone TEXT NOT NULL DEFAULT '',
  whatsapp TEXT NOT NULL DEFAULT '',
  delivery_info TEXT NOT NULL DEFAULT '',
  logo_url TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO store_settings (id) VALUES ('default');
