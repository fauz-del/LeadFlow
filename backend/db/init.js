// backend/db/init.js
// Initialises the SQLite database with all tables.

const Database = require('better-sqlite3');
const path     = require('path');
const fs       = require('fs');

const DB_PATH = path.join(__dirname, '../../data/leadflow.db');

// Ensure data directory exists
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  /* ── LEADS ──
     Core table. One row = one discovered business.
     Status flow: new → enriched → site_generated → outreach_sent → responded → converted | lost
  */
  CREATE TABLE IF NOT EXISTS leads (
    id                TEXT PRIMARY KEY,
    business_name     TEXT NOT NULL,
    category          TEXT,
    phone             TEXT,
    email             TEXT,
    address           TEXT,
    city              TEXT,
    country           TEXT DEFAULT 'Nigeria',
    website           TEXT,                    -- their existing site if any
    google_maps_url   TEXT,
    place_id          TEXT UNIQUE,
    rating            REAL,
    review_count      INTEGER DEFAULT 0,
    has_website       INTEGER DEFAULT 0,       -- 0 = no site = strong lead
    opportunity_score INTEGER DEFAULT 0,       -- 0-100 score based on signals
    niche             TEXT,                    -- resolved niche label
    source            TEXT DEFAULT 'manual',  -- google_maps | manual | import
    status            TEXT DEFAULT 'new',
    notes             TEXT,
    created_at        TEXT DEFAULT (datetime('now')),
    updated_at        TEXT DEFAULT (datetime('now'))
  );

  /* ── GENERATED SITES ──
     Each lead can have a generated one-pager linked to it.
  */
  CREATE TABLE IF NOT EXISTS generated_sites (
    id            TEXT PRIMARY KEY,
    lead_id       TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    template_id   TEXT NOT NULL,
    site_html     TEXT NOT NULL,              -- full rendered HTML stored inline
    preview_url   TEXT,                       -- /preview/:id served by Express
    custom_domain TEXT,
    published     INTEGER DEFAULT 0,
    view_count    INTEGER DEFAULT 0,
    created_at    TEXT DEFAULT (datetime('now')),
    updated_at    TEXT DEFAULT (datetime('now'))
  );

  /* ── OUTREACH MESSAGES ──
     Log of every message prepared or sent for a lead.
  */
  CREATE TABLE IF NOT EXISTS outreach (
    id            TEXT PRIMARY KEY,
    lead_id       TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    channel       TEXT DEFAULT 'whatsapp',    -- whatsapp | email | sms
    message       TEXT NOT NULL,
    status        TEXT DEFAULT 'draft',       -- draft | sent | delivered | replied
    sent_at       TEXT,
    replied_at    TEXT,
    reply_preview TEXT,
    created_at    TEXT DEFAULT (datetime('now'))
  );

  /* ── TEMPLATES ──
     Pre-built website templates per niche.
  */
  CREATE TABLE IF NOT EXISTS templates (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    niche       TEXT NOT NULL,
    description TEXT,
    thumbnail   TEXT,
    html_body   TEXT NOT NULL,               -- Handlebars-style {{variable}} template
    use_count   INTEGER DEFAULT 0,
    convert_rate REAL DEFAULT 0,             -- % of leads that converted using this template
    created_at  TEXT DEFAULT (datetime('now'))
  );

  /* ── SCRAPE JOBS ──
     Tracks background scraping runs.
  */
  CREATE TABLE IF NOT EXISTS scrape_jobs (
    id          TEXT PRIMARY KEY,
    query       TEXT NOT NULL,               -- e.g. "hair salon Lagos"
    city        TEXT,
    category    TEXT,
    status      TEXT DEFAULT 'queued',       -- queued | running | done | failed
    total_found INTEGER DEFAULT 0,
    imported    INTEGER DEFAULT 0,
    error_msg   TEXT,
    started_at  TEXT,
    finished_at TEXT,
    created_at  TEXT DEFAULT (datetime('now'))
  );

  /* ── CRM ACTIVITIES ──
     Timeline of everything that happened to a lead.
  */
  CREATE TABLE IF NOT EXISTS activities (
    id          TEXT PRIMARY KEY,
    lead_id     TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    type        TEXT NOT NULL,              -- note | status_change | site_generated | message_sent | reply_received
    description TEXT,
    meta        TEXT,                       -- JSON blob for extra data
    created_at  TEXT DEFAULT (datetime('now'))
  );

  /* ── APP SETTINGS ──
     Key-value store for user preferences and config.
  */
  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT
  );

  /* ── Indexes for common queries ── */
  CREATE INDEX IF NOT EXISTS idx_leads_status      ON leads(status);
  CREATE INDEX IF NOT EXISTS idx_leads_niche       ON leads(niche);
  CREATE INDEX IF NOT EXISTS idx_leads_has_website ON leads(has_website);
  CREATE INDEX IF NOT EXISTS idx_outreach_lead_id  ON outreach(lead_id);
  CREATE INDEX IF NOT EXISTS idx_activities_lead   ON activities(lead_id);
`);

// ── Seed default templates ──────────────────────────────────────────────────
const { v4: uuidv4 } = require('uuid');

const TEMPLATES = [
  {
    id:    'tpl-salon',
    name:  'Salon & Beauty Studio',
    niche: 'salon',
    description: 'Warm, elegant one-pager for hair salons, nail studios, and beauty parlours.',
    html_body: `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{{business_name}}</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Georgia',serif;background:#FAF7F5;color:#2D2D2D}header{background:linear-gradient(135deg,#C4836A,#E8B4A0);padding:60px 24px;text-align:center;color:#fff}header h1{font-size:clamp(2rem,5vw,3rem);letter-spacing:2px;margin-bottom:10px}header p{font-size:1.1rem;opacity:.9}.section{padding:48px 24px;max-width:700px;margin:0 auto;text-align:center}.section h2{font-size:1.6rem;margin-bottom:16px;color:#C4836A}.section p{line-height:1.8;color:#555;margin-bottom:12px}.services{display:flex;flex-wrap:wrap;justify-content:center;gap:14px;margin-top:20px}.service-item{background:#fff;border:1px solid #F0D8CE;border-radius:12px;padding:16px 22px;font-size:.9rem;box-shadow:0 2px 10px rgba(0,0,0,.05)}.cta{background:#C4836A;color:#fff;padding:40px 24px;text-align:center}.cta h2{font-size:1.5rem;margin-bottom:12px}.cta a{display:inline-block;margin-top:14px;padding:14px 32px;background:#fff;color:#C4836A;border-radius:30px;font-weight:700;text-decoration:none;font-size:.95rem}footer{text-align:center;padding:20px;font-size:.78rem;color:#999;border-top:1px solid #F0D8CE}</style></head><body><header><h1>{{business_name}}</h1><p>{{tagline}}</p></header><div class="section"><h2>About Us</h2><p>{{description}}</p></div><div class="section"><h2>Our Services</h2><div class="services">{{services_html}}</div></div><div class="cta"><h2>Book Your Appointment</h2><p>{{address}}</p><a href="https://wa.me/{{phone_clean}}?text=Hi!%20I%27d%20like%20to%20book%20an%20appointment%20at%20{{business_name_encoded}}">📲 WhatsApp Us</a></div><footer>© {{year}} {{business_name}} · {{phone}}</footer></body></html>`,
  },
  {
    id:    'tpl-restaurant',
    name:  'Restaurant & Food Business',
    niche: 'restaurant',
    description: 'Appetising, bold design for restaurants, canteens, and food vendors.',
    html_body: `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{{business_name}}</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Helvetica Neue',sans-serif;background:#FFFBF5;color:#1A1A1A}header{background:linear-gradient(135deg,#E65C00,#F9A825);padding:70px 24px;text-align:center;color:#fff}header h1{font-size:clamp(2rem,5vw,3.2rem);font-weight:900;margin-bottom:8px}header p{font-size:1.05rem;opacity:.92}.badge{display:inline-block;background:rgba(255,255,255,.22);padding:6px 16px;border-radius:20px;font-size:.82rem;margin-top:10px}.section{padding:48px 24px;max-width:720px;margin:0 auto;text-align:center}.section h2{font-size:1.55rem;margin-bottom:16px;color:#E65C00}.menu-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:14px;margin-top:20px}.menu-item{background:#fff;border-radius:12px;padding:20px;box-shadow:0 3px 14px rgba(0,0,0,.07);font-size:.88rem;line-height:1.5}.cta{background:#1A1A1A;color:#fff;padding:48px 24px;text-align:center}.cta h2{font-size:1.5rem;margin-bottom:10px}.cta a{display:inline-block;margin-top:14px;padding:14px 34px;background:#E65C00;color:#fff;border-radius:30px;font-weight:700;text-decoration:none}footer{text-align:center;padding:18px;font-size:.76rem;color:#999;border-top:1px solid #F5E8D5}</style></head><body><header><h1>{{business_name}}</h1><p>{{tagline}}</p><span class="badge">📍 {{address}}</span></header><div class="section"><h2>What We Serve</h2><p>{{description}}</p><div class="menu-grid">{{services_html}}</div></div><div class="cta"><h2>Order Now or Reserve a Table</h2><a href="https://wa.me/{{phone_clean}}?text=Hi!%20I%27d%20like%20to%20order%20from%20{{business_name_encoded}}">📲 Chat on WhatsApp</a></div><footer>© {{year}} {{business_name}} · {{phone}}</footer></body></html>`,
  },
  {
    id:    'tpl-shop',
    name:  'Retail Shop & Store',
    niche: 'retail',
    description: 'Clean, trustworthy layout for retail stores, boutiques, and product sellers.',
    html_body: `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{{business_name}}</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Inter',sans-serif;background:#F8FAFC;color:#0F172A}header{background:linear-gradient(135deg,#2563EB,#1E40AF);padding:64px 24px;text-align:center;color:#fff}header h1{font-size:clamp(1.8rem,5vw,3rem);font-weight:800;margin-bottom:10px}header p{font-size:1rem;opacity:.88}.section{padding:48px 24px;max-width:700px;margin:0 auto;text-align:center}.section h2{font-size:1.5rem;margin-bottom:14px;color:#2563EB}.products{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-top:20px}.product-item{background:#fff;border:1px solid #E2E8F0;border-radius:12px;padding:18px;font-size:.87rem;box-shadow:0 2px 8px rgba(0,0,0,.04)}.cta{background:#0F172A;padding:48px 24px;text-align:center;color:#fff}.cta h2{font-size:1.4rem;margin-bottom:12px}.cta a{display:inline-block;margin-top:12px;padding:14px 32px;background:#2563EB;color:#fff;border-radius:8px;font-weight:700;text-decoration:none}footer{text-align:center;padding:18px;font-size:.76rem;color:#94A3B8;border-top:1px solid #E2E8F0}</style></head><body><header><h1>{{business_name}}</h1><p>{{tagline}}</p></header><div class="section"><h2>About Our Store</h2><p>{{description}}</p><div class="products">{{services_html}}</div></div><div class="cta"><h2>Shop With Us Today</h2><p>📍 {{address}}</p><a href="https://wa.me/{{phone_clean}}?text=Hi!%20I%20want%20to%20buy%20from%20{{business_name_encoded}}">📲 Message on WhatsApp</a></div><footer>© {{year}} {{business_name}} · {{phone}}</footer></body></html>`,
  },
  {
    id:    'tpl-clinic',
    name:  'Clinic & Healthcare',
    niche: 'clinic',
    description: 'Clean, trustworthy layout for clinics, pharmacies, and health services.',
    html_body: `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{{business_name}}</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',sans-serif;background:#F0FDF4;color:#14532D}header{background:linear-gradient(135deg,#16A34A,#15803D);padding:64px 24px;text-align:center;color:#fff}header h1{font-size:clamp(1.8rem,5vw,2.8rem);font-weight:700;margin-bottom:10px}.section{padding:48px 24px;max-width:700px;margin:0 auto;text-align:center}.section h2{font-size:1.5rem;margin-bottom:14px;color:#16A34A}.services{display:flex;flex-wrap:wrap;justify-content:center;gap:12px;margin-top:18px}.service-item{background:#fff;border:1px solid #BBF7D0;border-radius:10px;padding:14px 20px;font-size:.88rem}.cta{background:#14532D;padding:48px 24px;text-align:center;color:#fff}.cta a{display:inline-block;margin-top:14px;padding:14px 32px;background:#16A34A;color:#fff;border-radius:8px;font-weight:700;text-decoration:none}footer{text-align:center;padding:18px;font-size:.76rem;color:#6B7280;border-top:1px solid #D1FAE5}</style></head><body><header><h1>{{business_name}}</h1><p>{{tagline}}</p></header><div class="section"><h2>Our Services</h2><p>{{description}}</p><div class="services">{{services_html}}</div></div><div class="cta"><h2>Book a Consultation</h2><p>📍 {{address}}</p><a href="https://wa.me/{{phone_clean}}?text=Hello%20{{business_name_encoded}}%2C%20I%20would%20like%20to%20book%20an%20appointment.">📲 WhatsApp Us</a></div><footer>© {{year}} {{business_name}} · {{phone}}</footer></body></html>`,
  },
];

const insertTemplate = db.prepare(`
  INSERT OR IGNORE INTO templates (id, name, niche, description, html_body)
  VALUES (@id, @name, @niche, @description, @html_body)
`);

const insertMany = db.transaction((templates) => {
  for (const t of templates) insertTemplate.run(t);
});

insertMany(TEMPLATES);

// ── Seed default settings ────────────────────────────────────────────────────
const insertSetting = db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`);
const defaultSettings = [
  ['whatsapp_number', ''],
  ['business_name',   'LeadFlow User'],
  ['default_city',    'Lagos'],
  ['daily_limit',     '20'],
  ['message_delay',   '45'],
];
defaultSettings.forEach(([k, v]) => insertSetting.run(k, v));

console.log('✅  Database initialised at', DB_PATH);
db.close();
