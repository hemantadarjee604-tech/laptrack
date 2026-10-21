# LabTrack – Full Project Documentation

## 1. What the system does
LabTrack manages a science laboratory's chemicals, glassware, equipment, tools and safety supplies. It has two sides:

- **Admin dashboard**: manage inventory, stock in/out, locations, suppliers, users and reports, and **review requests**.
- **Requester portal**: a normal user browses the catalogue, requests products or chemicals, and tracks the request until the item is handed over.

This extends the original proposal (backend.docx). All 7 proposed tables are present, plus a `requests` table, and the "laboratory staff" role is replaced by two roles: `admin` and `user` (requester).

## 2. Roles and permissions
| Capability | Admin | User (requester) |
|---|:-:|:-:|
| Dashboard, view/add/edit items, search and filter | ✔ | – |
| Delete items | ✔ | – |
| Stock in / stock out / transaction history | ✔ | – |
| Approve, reject, issue requests | ✔ | – |
| Reports (6 types, CSV, print) | ✔ | – |
| Import items from CSV / Excel | ✔ | – |
| Categories, locations, suppliers | ✔ | – |
| Manage users and roles | ✔ | – |
| Browse catalogue, make and cancel own requests | – | ✔ |

Anyone can self-register, but only as **user**. Admins can create more admin accounts in *Setup → Users*.

## 3. Technology stack
| Layer | Technology | Why |
|---|---|---|
| Pages | EJS + HTML + CSS | Server-rendered, simple, fast |
| Browser behaviour | Vanilla JavaScript (`public/js/app.js`) | Menu, dialogs, confirmations, form helpers |
| Backend | Node.js + Express | Routing and controllers |
| Database | PostgreSQL, managed in **pgAdmin** | Relational data, transactions |
| Security | bcryptjs, express-session | Password hashing, login sessions |
| File import | multer, exceljs | Upload and read .csv / .xlsx files |

## 4. Folder structure: what goes in each file
```
labtrack/
├── server.js                  Starts Express, sessions, EJS, view helpers, mounts routes, 404/500 pages
├── package.json               Dependencies and npm scripts
├── .env.example               Copy to .env: DB login, port, session secret
├── README.md / DOCUMENTATION.md
│
├── config/
│   └── db.js                  PostgreSQL pool, query() and tx() (all-or-nothing transactions)
│
├── database/                  PGADMIN / POSTGRESQL FILES
│   ├── schema.sql             CREATE TABLE statements + reference data. Run in pgAdmin Query Tool
│   ├── init.js                `npm run db:init`: runs schema.sql from the terminal
│   └── seed.js                `npm run seed`: demo users + 12 sample items
│
├── middleware/
│   └── auth.js                Flash messages, requireLogin, requireRole('admin')
│
├── models/                    MODEL: every SQL query lives here
│   ├── userModel.js           Users CRUD
│   ├── itemModel.js           Items + chemical dates; derives stock/expiry status; search and filters
│   ├── lookupModel.js         Categories, suppliers, locations (one generic model)
│   ├── stockModel.js          move() = the stock rule (+ audit row); history()
│   ├── requestModel.js        create / decide / issue / cancel requests
│   └── reportModel.js         Dashboard numbers and the 6 reports
│
├── controllers/               CONTROLLER: validate input, call models, choose a view
│   ├── authController.js      login, register, logout
│   ├── dashboardController.js admin dashboard
│   ├── itemController.js      inventory CRUD
│   ├── stockController.js     stock in/out, history
│   ├── requestController.js   portal requests + admin approvals
│   ├── importController.js    CSV / Excel bulk import of items (upload, validate, insert, report)
│   ├── lookupController.js    categories / locations / suppliers
│   ├── userController.js      user management
│   └── reportController.js    report view + CSV export
│
├── routes/                    URL → controller mapping
│   ├── auth.js                /  /login  /register  /logout
│   ├── portal.js              /portal/*   (users only)
│   └── admin.js               /admin/*    (admin only)
│
├── views/                     VIEW: EJS pages
│   ├── partials/head.ejs      <head>, fonts, CSS link
│   ├── partials/header.ejs    Sidebar (role-based menu), top bar, flash message
│   ├── partials/footer.ejs    Closes layout, loads app.js
│   ├── error.ejs              403 / 404 / 500
│   ├── auth/                  login.ejs, register.ejs
│   ├── admin/                 dashboard, items, item, item-form, stock-form, transactions,
│   │                          requests, lookup, users, report, import
│   └── portal/                home, catalogue, request-form, requests
│
├── public/                    STATIC FILES sent to the browser
│   ├── css/style.css          All styling (tokens, layout, components, responsive, print)
│   └── js/app.js              Client-side JavaScript
│
└── utils/helpers.js           UserError, wrap() for async errors, guard() for POST handlers, nn(), csv()
```

### MVC flow
`Browser → route → controller → model → PostgreSQL → model → controller → EJS view → Browser`

## 5. Database design
```
users ──< stock_transactions >── items >── categories
  │                                │ ╲
  └──< requests >──────────────────┘  ├── suppliers
                                      ├── locations
                                      └── chemical_details (1 : 0..1)
```
| Table | Purpose and key columns |
|---|---|
| `users` | name, email (unique), bcrypt `password`, `role` (admin/user), department |
| `categories` | name, description, **`is_chemical`** (chemical categories show received/opened/expiry fields) |
| `suppliers` | name, contact, email, address |
| `locations` | building, room, storage_area, cabinet, shelf, position |
| `items` | item_code (unique), name, category_id, quantity (≥ 0), unit, minimum_stock, supplier_id, location_id, condition, description |
| `chemical_details` | item_id (unique), date_received, opening_date, expiry_date |
| `stock_transactions` | item_id, user_id, supplier_id, request_id, type `IN`/`OUT`, quantity, reason, transaction_date |
| `requests` | user_id, item_id, quantity, purpose, needed_by, status, admin_note, handled_by |

**Differences from the proposal**
- `items.status` is not stored. Stock status and expiry status are calculated on every query, so they can never be out of date.
- `categories.is_chemical` was added so the form knows when to ask for chemical dates.
- `stock_transactions` got `supplier_id` and `request_id` for a fuller audit trail.
- Deleting an item also deletes its transactions and requests (`ON DELETE CASCADE`).

## 6. Business rules
**Stock status:** quantity 0 → *Out of stock*; quantity ≤ minimum → *Low stock*; otherwise *Available*.
**Expiry status (chemicals):** before today → *Expired*; within 30 days → *Expiring soon*; otherwise *Safe*.
**Quantity** changes only through Stock in, Stock out, or an issued request. `stockModel.move` locks the item row, refuses to go below zero, and writes the transaction in the same database transaction.

**Request lifecycle**
```
User sends request ─► pending ─┬─► approved ─► issued   (stock reduced automatically + transaction logged)
                               ├─► rejected  (reason required, shown to the user)
                               └─► cancelled (by the user, only while pending)
```
Users can only request items that are in stock, not expired, not lost/disposed, and never more than is available.

### Importing items from CSV or Excel
Open **Inventory → Import CSV / Excel** (or the *Import* button on All items).
1. Click **Download template** and fill it in Excel (keep row 1 as the headings), or prepare your own file with the same headings.
2. Choose the file and press **Import items**. Limits: `.csv` or `.xlsx`, 5 MB, 2,000 rows.
3. A result report shows rows **added**, **skipped** and **failed**, with the row number and reason.

| Column | Required | Notes |
|---|:-:|---|
| item_code, name, category | ✔ | Category must already exist (spelling is not case-sensitive) |
| quantity, unit, minimum_stock | – | Defaults: 0, piece, 0 |
| supplier | – | Created automatically when new |
| location | – | Must match an existing location's full text, e.g. `Science Block › Chemistry Lab › Chemical Store › C02 › B › B-03` (`>` also works) |
| condition | – | Good, Damaged, Under Maintenance, Lost, Disposed (default Good) |
| date_received, opening_date, expiry_date | – | `YYYY-MM-DD` or `DD/MM/YYYY`; stored only for chemical categories |

Rules: valid rows are saved even when others fail; an existing item code is **skipped, never overwritten**; every new item with quantity above 0 gets an "Opening stock" transaction. Common heading variants (`qty`, `code`, `expiry`, `Item Name`…) are understood. Old `.xls` files must be re-saved as `.xlsx`.

## 7. Routes
| Method and URL | Who | Action |
|---|---|---|
| GET `/login`, POST `/login`, GET/POST `/register`, POST `/logout` | all | Authentication |
| GET `/portal`, `/portal/catalogue`, `/portal/request/new`, `/portal/requests` | user | Portal pages |
| POST `/portal/requests`, POST `/portal/requests/:id/cancel` | user | Create / cancel request |
| GET `/admin` | admin | Dashboard |
| `/admin/items`, `/new`, `/:id`, `/:id/edit` (+ POST create/update) | admin | Inventory |
| POST `/admin/items/:id/delete` | admin | Delete item |
| GET/POST `/admin/stock/in`, `/admin/stock/out`; GET `/admin/transactions` | admin | Stock |
| GET `/admin/requests?status=`; POST `/:id/approve`, `/:id/reject`, `/:id/issue` | admin | Request handling |
| GET `/admin/reports/:type` (`inventory`, `low`, `expiry`, `movement`, `location`, `requests`), `?format=csv` | admin | Reports |
| GET `/admin/import`, GET `/admin/import/template`, POST `/admin/import` | admin | Bulk import from .csv / .xlsx |
| `/admin/categories`, `/locations`, `/suppliers`, `/users` | admin | Setup |

## 8. Installation step by step
1. **Install** Node.js 18+ and PostgreSQL (pgAdmin comes with the Windows and Mac installers).
2. **pgAdmin:** connect to your server, right-click *Databases* → *Create → Database…*, name it `labtrack`.
3. **Create tables:** right-click `labtrack` → *Query Tool* → open `database/schema.sql` → *Execute* (F5). Refresh *Schemas → public → Tables*; you should see 8 tables.
4. **Configure:** copy `.env.example` to `.env`. Set `DB_PASSWORD` to your PostgreSQL password and `SESSION_SECRET` to a long random string.
5. **Install packages:** `npm install`
6. **Demo data:** `npm run seed` (safe to run twice).
7. **Run:** `npm start` (or `npm run dev` to restart on changes), then open http://localhost:3000

Default accounts are in README.md. **Change or delete them before real use** (Setup → Users).

## 9. Using the system
**Requester:** register → *Catalogue* → *Request this* → fill quantity, date and purpose → follow the status in *My requests*. A rejected request shows the lab's reason.
**Admin:** open *Requests* (the red number is pending count) → Approve or Reject → when the item is handed over press **Issue item**. Stock drops and a transaction is recorded. Use *Stock in* when deliveries arrive and *Reports* for low-stock and expiry lists.

## 10. Testing checklist
| Test | Expected |
|---|---|
| Wrong password | Error message, stays on login |
| User opens `/admin` | 403 page |
| Not logged in opens `/admin` | Redirect to login |
| Add item with a duplicate code | "already in use" message |
| Stock out more than available | Error, quantity unchanged |
| Request more than available | Error, nothing created |
| Approve → Issue | Quantity reduced, OUT transaction "Issued for request #n" |
| Issue the same request twice | Second attempt refused |
| Delete a category that has items | Refused with item count |
| Chemical expiring in 20 days | "Expiring soon" badge, listed in Expiry report |
| Reports → Download CSV | File downloads |

All pages, the role guards, the request flow, the stock rule and CSV export were smoke-tested against a real PostgreSQL 16 database.

## 11. Security notes
Passwords are hashed with bcrypt. All SQL uses parameters, EJS escapes output, sessions are HTTP-only and regenerated at login, and role checks run on the server for every route. Before production, add HTTPS, CSRF tokens (for example `csrf-csrf`), `helmet`, login rate limiting, and a persistent session store (`connect-pg-simple`), because the default memory store resets on restart.

## 12. Team allocation (from the proposal)
| Member | Files |
|---|---|
| 1 Database and Backend | `database/*`, `config/db.js`, `server.js`, `models/*` |
| 2 Inventory | `itemController`, `itemModel`, `lookup*`, `views/admin/items`, `item`, `item-form`, `lookup` |
| 3 Stock and Location | `stock*`, `requestModel`, `requestController`, `views/admin/stock-form`, `transactions`, `requests` |
| 4 Frontend and UI | `public/*`, `views/partials/*`, `views/auth/*`, `views/portal/*`, `views/admin/dashboard` |
| 5 Auth, Reports, Testing | `middleware/auth.js`, `authController`, `userController`, `reportModel`, `reportController`, `views/admin/report`, `users` |

## 13. Troubleshooting
| Problem | Fix |
|---|---|
| `password authentication failed` | `DB_PASSWORD` in `.env` must match your PostgreSQL password |
| `database "labtrack" does not exist` | Create it in pgAdmin first (step 2) |
| `relation "users" does not exist` | Run `schema.sql` (step 3) |
| Port already in use | Change `PORT` in `.env` |
| Logged out after restart | Normal with the memory session store (see section 11) |

## 14. Future enhancements
QR/barcode labels, PDF/Excel export, charts, e-mail alerts for expiry and low stock, multi-item requests, return tracking for equipment, maintenance scheduling, automated backups, PWA support.
