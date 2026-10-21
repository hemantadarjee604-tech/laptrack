-- LabTrack database schema (PostgreSQL)
-- pgAdmin: create an empty database called "labtrack", open Query Tool, paste this file and press F5.
DROP TABLE IF EXISTS requests, stock_transactions, chemical_details, items, locations, suppliers, categories, users CASCADE;

CREATE TABLE users (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  email       VARCHAR(150) NOT NULL UNIQUE,
  password    VARCHAR(100) NOT NULL,                       -- bcrypt hash, never plain text
  role        VARCHAR(10)  NOT NULL DEFAULT 'user' CHECK (role IN ('admin','user')),
  department  VARCHAR(100),
  created_at  TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE categories (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(80) NOT NULL UNIQUE,
  description TEXT,
  is_chemical BOOLEAN NOT NULL DEFAULT false               -- true = item needs received/opened/expiry dates
);

CREATE TABLE suppliers (
  id SERIAL PRIMARY KEY, name VARCHAR(120) NOT NULL, contact VARCHAR(60), email VARCHAR(150), address TEXT
);

CREATE TABLE locations (
  id SERIAL PRIMARY KEY,
  building VARCHAR(80) NOT NULL, room VARCHAR(80), storage_area VARCHAR(80),
  cabinet VARCHAR(40), shelf VARCHAR(40), position VARCHAR(40)
);

CREATE TABLE items (
  id            SERIAL PRIMARY KEY,
  item_code     VARCHAR(30) NOT NULL UNIQUE,
  name          VARCHAR(150) NOT NULL,
  category_id   INT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  quantity      NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  unit          VARCHAR(30) NOT NULL DEFAULT 'piece',
  minimum_stock NUMERIC(10,2) NOT NULL DEFAULT 0,
  supplier_id   INT REFERENCES suppliers(id) ON DELETE SET NULL,
  location_id   INT REFERENCES locations(id) ON DELETE SET NULL,
  condition     VARCHAR(20) NOT NULL DEFAULT 'Good'
                CHECK (condition IN ('Good','Damaged','Under Maintenance','Lost','Disposed')),
  description   TEXT,
  created_at    TIMESTAMP NOT NULL DEFAULT now(),
  updated_at    TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE chemical_details (
  id            SERIAL PRIMARY KEY,
  item_id       INT NOT NULL UNIQUE REFERENCES items(id) ON DELETE CASCADE,
  date_received DATE, opening_date DATE, expiry_date DATE
);

CREATE TABLE requests (
  id          SERIAL PRIMARY KEY,
  user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id     INT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  quantity    NUMERIC(10,2) NOT NULL CHECK (quantity > 0),
  purpose     TEXT NOT NULL,
  needed_by   DATE,
  status      VARCHAR(10) NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending','approved','rejected','issued','cancelled')),
  admin_note  TEXT,
  handled_by  INT REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT now(),
  updated_at  TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE stock_transactions (
  id               SERIAL PRIMARY KEY,
  item_id          INT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  user_id          INT REFERENCES users(id) ON DELETE SET NULL,
  supplier_id      INT REFERENCES suppliers(id) ON DELETE SET NULL,
  request_id       INT REFERENCES requests(id) ON DELETE SET NULL,
  transaction_type VARCHAR(3) NOT NULL CHECK (transaction_type IN ('IN','OUT')),
  quantity         NUMERIC(10,2) NOT NULL CHECK (quantity > 0),
  reason           VARCHAR(200),
  transaction_date TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_items_name     ON items (name);
CREATE INDEX idx_items_category ON items (category_id);
CREATE INDEX idx_tx_item        ON stock_transactions (item_id, transaction_date DESC);
CREATE INDEX idx_req_user       ON requests (user_id, status);

-- Reference data
INSERT INTO categories (name, description, is_chemical) VALUES
 ('Chemical',  'Acids, bases, solvents, salts and reagents', true),
 ('Glassware', 'Beakers, flasks, test tubes, burettes, pipettes', false),
 ('Equipment', 'Microscopes, balances, hot plates, thermometers', false),
 ('Tool',      'Tongs, forceps, spatulas, tripod stands', false),
 ('Safety',    'Gloves, goggles, lab coats, masks', false);
INSERT INTO suppliers (name, contact, email, address) VALUES
 ('SciSupply Ltd',  '+975 17 000 111', 'sales@scisupply.test', 'Thimphu'),
 ('ChemWorld',      '+975 17 000 222', 'orders@chemworld.test', 'Phuntsholing'),
 ('LabGear Traders','+975 17 000 333', 'hello@labgear.test',    'Paro');
INSERT INTO locations (building, room, storage_area, cabinet, shelf, position) VALUES
 ('Science Block','Chemistry Lab','Chemical Store','C02','B','B-03'),
 ('Science Block','Chemistry Lab','Glassware Store','G01','A','A-01'),
 ('Science Block','Physics Lab','Equipment Store','E01','C','C-02'),
 ('Science Block','Store Room','Safety Cupboard','S01','A','A-05');
