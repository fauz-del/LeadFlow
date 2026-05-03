const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db      = require('../db/connection');
const router  = express.Router();

// Helper to inject data into your templates
function renderTemplate(html, lead) {
  const bizName = lead.business_name || 'Service Pro';
  const niche = (lead.niche || 'plumber').toLowerCase();
  
  // 1. Map Numbered Images (Hero = 1, Sub = 2)
  const heroImg = `/assets/${niche}/1.jpg`;
  const serviceImg = `/assets/${niche}/2.jpg`;

  // 2. Niche-Specific Headlines to avoid repetition
  const contentMap = {
    plumber: { headline: "Expert Plumbing Repairs", sub: "On-site in 20 mins" },
    locksmith: { headline: "24/7 Emergency Lockout", sub: "Non-destructive entry" },
    petshop: { headline: "Premium Pet Supplies", sub: "Your best friend's favorite shop" }
  };
  const nicheContent = contentMap[niche] || contentMap.plumber;
  
  const dividers = [
    `<path d="M0,160L48,144C96,128,192,96,288,106.7C384,117,480,171,576,165.3C672,160,768,96,864,101.3C960,107,1056,181,1152,197.3C1248,213,1344,171,1392,149.3L1440,128L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path>`, // Wave
    `<path d="M0,64L1440,192L1440,320L0,320Z"></path>` // Slant
  ];
  
  // 3. Format Neighborhoods
  const areasHtml = (lead.areas || ['Local Area', 'Surrounding Towns'])
    .map(a => `<div class="chip">${a}</div>`).join('');

  const randomDivider = dividers[Math.floor(Math.random() * dividers.length)];
  const randomTilt = Math.floor(Math.random() * 6) - 3;

  return html
    .replace(/\{\{shape_divider\}\}/g, randomDivider)
    .replace(/\{\{tilt\}\}/g, `${randomTilt}deg`)
    .replace(/\{\{business_name\}\}/g, bizName)
    .replace(/\{\{initial\}\}/g, bizName.charAt(0).toUpperCase())
    .replace(/\{\{location\}\}/g, lead.city || 'Your Area')
    .replace(/\{\{phone\}\}/g, lead.phone || 'Contact for Quote')
    .replace(/\{\{color\}\}/g, lead.color_scheme || '#1A2E44')
    .replace(/\{\{headline\}\}/g, nicheContent.headline)
    .replace(/\{\{subheadline\}\}/g, nicheContent.sub)
    .replace(/\{\{image_url\}\}/g, heroImg) // Points to 1.jpg
    .replace(/\{\{service_image\}\}/g, serviceImg) // Points to 2.jpg
    .replace(/\{\{areas_html\}\}/g, areasHtml);
}

router.post('/generate', async (req, res) => {
  try {
    const { lead_id, template_id } = req.body;
    const lead = await db.leads.findOne({ id: lead_id });
    const template = await db.templates.findOne({ id: template_id });

    if (!lead || !template) return res.status(404).json({ success: false, message: 'Data not found' });

    const siteId = uuidv4();
    const siteData = {
      id: siteId,
      template_id,
      preview_url: `/preview/${siteId}`,
      created_at: new Date().toISOString()
    };

    // Update lead with the new site reference
    await db.leads.update({ id: lead_id }, { $set: { sites: [siteData], status: 'enriched' } });
    res.json({ success: true, data: siteData });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// THE FIX: Clean Preview Route
router.get('/preview/:siteId', async (req, res) => {
  try {
    const siteId = req.params.siteId;
    
    // Find the lead containing this specific site
    const lead = await db.leads.findOne({ "sites.id": siteId });
    if (!lead) return res.status(404).send('<h2>Site not found in Leads DB</h2>');

    const siteData = lead.sites.find(s => s.id === siteId);
    
    // CRITICAL: Ensure we are looking for the EXACT template_id saved in siteData
    const template = await db.templates.findOne({ id: siteData.template_id });

    if (!template) {
      // Temporary fallback for testing: if specific template missing, use ANY available
      const fallback = await db.templates.findOne({}); 
      if (!fallback) return res.status(404).send('<h2>No templates found in DB at all</h2>');
      
      const html = renderTemplate(fallback.html_body, lead);
      return res.send(html);
    }

    const html = renderTemplate(template.html_body, lead);
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (err) {
    res.status(500).send('<h2>Preview Error: ' + err.message + '</h2>');
  }
});

module.exports = router;