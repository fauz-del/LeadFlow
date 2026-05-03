require('dotenv').config();
const express     = require('express');
const cors        = require('cors');
const helmet      = require('helmet');
const morgan      = require('morgan');
const path        = require('path');
const rateLimit   = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(morgan('dev'));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/assets', express.static(path.join(__dirname, '../frontend/assets')));

// API Routes
app.use('/api/leads',     require('./routes/leads'));
app.use('/api/sites',     require('./routes/sites'));
app.use('/api/outreach',  require('./routes/outreach'));
app.use('/api/templates', require('./routes/templates'));
app.use('/api/jobs',      require('./routes/jobs'));
app.use('/api/stats',     require('./routes/stats'));
app.use('/api/settings',  require('./routes/settings'));

// ── Preview route ──────────────────────────────────────────────────────────
app.get('/preview/:siteId', async (req, res) => {
  try {
    const db = require('./db/connection');
    
    // 1. Find the lead that owns this site ID
    const matchingLead = await db.leads.findOne({ "sites.id": req.params.siteId });
    if (!matchingLead) return res.status(404).send('<h2>Lead or Site not found</h2>');

    // 2. Get the site data from the lead's sites array
    const siteData = matchingLead.sites.find(s => s.id === req.params.siteId);

    // 3. DYNAMIC LOOKUP: Find the template by the ID saved in the siteData
    let template = await db.templates.findOne({ id: siteData.template_id });
    
    // FALLBACK: If that ID isn't found, grab the first available template so it doesn't crash
    if (!template) {
        template = await db.templates.findOne({});
    }

    if (!template) {
        return res.status(500).send('<h2>No templates found. Run /api/templates first!</h2>');
    }

    // 4. Resolve Niche-Specific Data
    const bizName = matchingLead.business_name || 'Professional Services';
    const nicheFolder = (matchingLead.niche || 'plumber').toLowerCase();
    
    // 5. Setup dynamic assets (1.jpg for hero, 2.jpg for service section)
    const imageUrl = `/assets/${nicheFolder}/1.jpg`; 
    const serviceImg = `/assets/${nicheFolder}/2.jpg`;

    // 6. Dynamic Text content based on niche
    const contentMap = {
      plumber: { h: "Expert Plumbing Repairs", s: "On-site in 20 mins" },
      locksmith: { h: "Fast Emergency Lockout", s: "Non-destructive entry" },
      petshop: { h: "Premium Pet Supplies", s: "Your best friend's favorite shop" }
    };
    const nicheContent = contentMap[nicheFolder] || contentMap.plumber;

    // 7. Inject Data into Template
    const areasList = matchingLead.areas || ['Local Area', 'Surrounding Neighborhoods'];
    const areasHtml = areasList.map(area => `<div class="chip">${area}</div>`).join('');

    const html = template.html_body
      .replace(/\{\{business_name\}\}/g, bizName)
      .replace(/\{\{initial\}\}/g, bizName.charAt(0).toUpperCase())
      .replace(/\{\{color\}\}/g, matchingLead.color_scheme || '#1A2E44')
      .replace(/\{\{headline\}\}/g, nicheContent.h)
      .replace(/\{\{subheadline\}\}/g, nicheContent.s)
      .replace(/\{\{image_url\}\}/g, imageUrl) 
      .replace(/\{\{service_image\}\}/g, serviceImg)
      .replace(/\{\{phone\}\}/g, matchingLead.phone || 'Contact Now')
      .replace(/\{\{location\}\}/g, matchingLead.city || 'Your Area')
      .replace(/\{\{areas_html\}\}/g, areasHtml);

    res.setHeader('Content-Type', 'text/html');
    res.send(html);

  } catch (err) {
    console.error('Preview Error:', err);
    res.status(500).send('<h2>Error rendering preview</h2>');
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.listen(PORT, () => {
  console.log(`\n🚀 LeadFlow running at http://localhost:${PORT}\n`);
});
