const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db     = require('../db/connection');
const router = express.Router();

// ── POST /api/outreach/compose ───────────────────────────────────────────────
router.post('/compose', async (req, res) => {
  const { lead_id, channel = 'whatsapp' } = req.body;
  const lead = await db.leads.findOne({ id: lead_id });
  if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });

  // Check if lead has any sites generated
  const site = lead.sites && lead.sites.length > 0 ? lead.sites[0] : null;
  const message = generateMessage(lead, site, channel);

  res.json({ success: true, data: { message, whatsapp_url: buildWaUrl(lead.phone, message) } });
});

// ── POST /api/outreach/send ──────────────────────────────────────────────────
router.post('/send', async (req, res) => {
  const { lead_id, channel = 'whatsapp', message } = req.body;
  if (!lead_id || !message) return res.status(400).json({ success: false, message: 'lead_id and message required' });

  const id = uuidv4();
  const record = {
    id,
    lead_id,
    channel,
    message,
    status: 'sent',
    created_at: new Date().toISOString()
  };

  await db.outreach.insert(record);
  await db.leads.update({ id: lead_id }, { $set: { status: 'outreach_sent', updated_at: new Date().toISOString() } });

  res.json({ success: true, data: record });
});

// ── GET /api/outreach — list outreach records ─────────────────────────────────
router.get('/', async (req, res) => {
  const { lead_id, status } = req.query;
  let query = {};
  if (lead_id) query.lead_id = lead_id;
  if (status)  query.status = status;

  const records = await db.outreach.find(query).sort({ created_at: -1 });
  
  // Since NeDB doesn't JOIN, we manually attach business names
  const data = await Promise.all(records.map(async r => {
    const lead = await db.leads.findOne({ id: r.lead_id });
    return { ...r, business_name: lead ? lead.business_name : 'Unknown', phone: lead ? lead.phone : '' };
  }));

  res.json({ success: true, data });
});

// ── Helpers ──────────────────────────────────────────────────────────────────
function generateMessage(lead, site, channel) {
  const name = (lead.business_name || 'your business').replace(/\"/g, ''); 
  const siteLink = site ? `http://localhost:3000/preview/${site.id}` : '';
  const templates = [
    `Hi! I saw ${name} on Google Maps and loved your reviews. I noticed you don't have a mobile site yet, so I made a quick draft for you: ${siteLink} . If you like the vibe, I can have it live on your own domain by Friday for a one-time fee of $150.`,
    
    `Hello! 👋 I noticed you don't have a website listed on Maps. I designed a quick preview of what a modern mobile site would look like for ${name}: ${siteLink} . Would love to know what you think of it!`
  ];
  
  return templates[Math.floor(Math.random() * templates.length)];
}

function buildWaUrl(phone, message, countryCode = '44') {
  if (!phone) return null;

  let clean = phone.replace(/\D/g, ''); 
  if (clean.startsWith('0')) {
    clean = countryCode + clean.slice(1);
  }
  
  // Added the missing / after wa.me
  return `https://wa.me{clean}?text=${encodeURIComponent(message)}`;
}

module.exports = router;

