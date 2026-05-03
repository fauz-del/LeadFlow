# LeadFlow — Business Discovery & Outreach CRM

A self-hosted system that finds small businesses without websites, generates
one-page sites for them instantly, and guides your WhatsApp outreach — all in
one dashboard.

---

## Stack

| Layer     | Tech                          |
|-----------|-------------------------------|
| Frontend  | HTML + CSS + Vanilla JS (SPA) |
| Backend   | Node.js + Express             |
| Database  | SQLite (via better-sqlite3)   |
| Scraper   | Python 3                      |

---

## Setup

### 1. Install Node.js dependencies

```bash
npm install
```

### 2. Initialise the database

This creates `data/leadflow.db` and seeds 4 default templates.

```bash
npm run init-db
```

### 3. Start the server

```bash
npm start
# or for development with auto-reload:
npm run dev
```

Open **http://localhost:3000** in your browser.

---

## Using the Scraper

The Python scraper runs automatically when you use the Discover page.
It requires Python 3 with no extra packages (uses stdlib only).

For real Google Maps data, the scraper will attempt an HTML fetch.
Due to Google's anti-scraping, it falls back to realistic demo data.

**For production scraping**, replace the `scrape_google_maps()` function in
`scraper/scraper.py` with a call to one of these APIs:
- **SerpAPI** — https://serpapi.com (Google Maps results)
- **Outscraper** — https://outscraper.com (Maps data API)
- **Google Places API** — https://developers.google.com/maps/documentation/places

---

## Workflow

```
1. Discover  →  Search by category + city
2. Leads     →  Review imported leads, filter by "No Website"
3. Sites     →  Click a lead → Generate Site → pick a template
4. Outreach  →  Click "Let's Chat" → message is composed → opens WhatsApp
5. CRM       →  Update status as you get replies
6. Dashboard →  Track pipeline, conversion rates, niche performance
```

---

## Folder Structure

```
leadflow/
├── backend/
│   ├── server.js          # Express app + routes
│   ├── db/
│   │   ├── init.js        # Schema + seed data
│   │   └── connection.js  # SQLite singleton
│   └── routes/
│       ├── leads.js       # CRUD + import + scoring
│       ├── sites.js       # Site generation + rendering
│       ├── outreach.js    # Message compose + send tracking
│       ├── templates.js   # Template CRUD
│       ├── jobs.js        # Scrape job management
│       ├── stats.js       # Dashboard analytics
│       └── settings.js    # App settings
├── frontend/
│   ├── index.html         # SPA shell
│   ├── css/app.css        # Full design system
│   └── js/app.js          # All page controllers
├── scraper/
│   └── scraper.py         # Python business scraper
├── data/                  # SQLite DB lives here (auto-created)
├── .env
└── package.json
```

---

## Key Design Decisions

**No website = high opportunity score.** The scoring algorithm gives 40/100
points for missing a website, making those leads immediately visible.

**Semi-manual outreach.** Messages are composed automatically but you must
manually confirm sending via WhatsApp. This keeps communication human and
avoids spam patterns.

**Template rendering is server-side.** The full HTML is stored in SQLite so
every generated site can be served instantly at `/preview/:id` without a
rebuild step.

**SQLite for simplicity.** For a personal/small-team CRM, SQLite handles
thousands of leads effortlessly. Upgrade to PostgreSQL by swapping
`better-sqlite3` for `pg` and rewriting queries.

---

## Outreach Best Practices

- Keep daily messages under 30 to avoid WhatsApp flagging
- Personalise the message (the template includes `[Your Name]` as a placeholder)
- Wait at least 24h before following up
- Never send identical messages — the system generates slight variations
- Track replies and update lead status promptly

---

## Adding More Templates

Edit `backend/db/init.js` and add a new entry to the `TEMPLATES` array.
Re-run `npm run init-db` to seed it. The `html_body` field supports these
variables:

| Variable              | Value                        |
|-----------------------|------------------------------|
| `{{business_name}}`   | Business name                |
| `{{tagline}}`         | Auto-generated tagline       |
| `{{description}}`     | Auto-generated description   |
| `{{address}}`         | Business address             |
| `{{phone}}`           | Phone number (formatted)     |
| `{{phone_clean}}`     | Phone digits only (for wa.me)|
| `{{services_html}}`   | Rendered service grid        |
| `{{year}}`            | Current year                 |
| `{{city}}`            | City                         |
