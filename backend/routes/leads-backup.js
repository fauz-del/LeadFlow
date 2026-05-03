// backend/routes/leads.js
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/connection'); // Points to your NeDB connection
const router = express.Router();

/* ── GET /api/leads ──────────────────────────────────────────────────────── */
router.get('/', async (req, res) => {
  try {
    const { status, niche, search, has_website } = req.query;
    let query = {};

    if (status) query.status = status;
    if (niche) query.niche = niche;
    if (has_website !== undefined && has_website !== '') {
      query.has_website = parseInt(has_website);
    }
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { business_name: searchRegex },
        { phone: searchRegex },
        { address: searchRegex }
      ];
    }

    // Fetch leads and sort by creation date (newest first)
    const rows = await db.leads.find(query).sort({ created_at: -1 });
    res.json({ success: true, total: rows.length, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ── GET /api/leads/:id ──────────────────────────────────────────────────── */
router.get('/:id', async (req, res) => {
  try {
    const lead = await db.leads.findOne({ id: req.params.id });
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });

    // Fetch related history
    const activities = await db.activities.find({ lead_id: req.params.id }).sort({ created_at: -1 });
    const outreach = await db.outreach.find({ lead_id: req.params.id }).sort({ created_at: -1 });

    res.json({ success: true, data: { ...lead, activities, outreach } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ── POST /api/leads (Manual Create) ─────────────────────────────────────── */
router.post('/', async (req, res) => {
  try {
    const { business_name, category, phone, email, address, city, niche, notes, has_website, website } = req.body;
    if (!business_name) return res.status(400).json({ success: false, message: 'business_name required' });

    const id = uuidv4();
    const score = computeScore({ has_website: !!has_website, rating: null, review_count: 0 });

    const newLead = {
      id,
      business_name,
      category: category || '',
      phone: phone || '',
      email: email || '',
      address: address || '',
      city: city || '',
      niche: niche || resolveNiche(category),
      notes: notes || '',
      has_website: has_website ? 1 : 0,
      website: website || '',
      opportunity_score: score,
      status: 'new',
      source: 'manual',
      created_at: new Date().toISOString()
    };

    await db.leads.insert(newLead);
    await logActivity(id, 'note', 'Lead created manually');

    res.status(201).json({ success: true, data: newLead });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ── PATCH /api/leads/:id ────────────────────────────────────────────────── */
router.patch('/:id', async (req, res) => {
  try {
    const lead = await db.leads.findOne({ id: req.params.id });
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });

    const updates = req.body;
    
    if (updates.status && updates.status !== lead.status) {
      await logActivity(req.params.id, 'status_change', `Status changed from "${lead.status}" to "${updates.status}"`);
    }

    updates.updated_at = new Date().toISOString();
    await db.leads.update({ id: req.params.id }, { $set: updates });

    const updatedLead = await db.leads.findOne({ id: req.params.id });
    res.json({ success: true, data: updatedLead });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ── DELETE /api/leads/:id ───────────────────────────────────────────────── */
router.delete('/:id', async (req, res) => {
  try {
    const numRemoved = await db.leads.remove({ id: req.params.id });
    if (numRemoved === 0) return res.status(404).json({ success: false, message: 'Not found' });
    
    // Clean up related data
    await db.activities.remove({ lead_id: req.params.id }, { multi: true });
    await db.outreach.remove({ lead_id: req.params.id }, { multi: true });

    res.json({ success: true, message: 'Lead deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ── POST /api/leads/import (Bulk Scraper Import) ────────────────────────── */
router.post('/import', async (req, res) => {
  try {
    const { businesses = [] } = req.body;
    if (!businesses.length) return res.status(400).json({ success: false, message: 'No businesses provided' });

    let imported = 0;
    for (const b of businesses) {
      const has_website = b.website ? 1 : 0;
      const score = computeScore({ has_website, rating: b.rating, review_count: b.review_count });
      const leadId = uuidv4();

      const row = {
        id: leadId,
        business_name: b.name || 'Unknown',
        category: b.category || '',
        phone: b.phone || '',
        address: b.address || '',
        city: b.city || '',
        website: b.website || '',
        google_maps_url: b.maps_url || '',
        place_id: b.place_id || null,
        rating: b.rating || null,
        review_count: b.review_count || 0,
        has_website,
        opportunity_score: score,
        niche: resolveNiche(b.category),
        status: 'new',
        source: 'google_maps',
        created_at: new Date().toISOString()
      };

      // NeDB doesn't have "INSERT OR IGNORE", so we check place_id
      const existing = b.place_id ? await db.leads.findOne({ place_id: b.place_id }) : null;
      if (!existing) {
        await db.leads.insert(row);
        await logActivity(leadId, 'note', 'Imported from scraper');
        imported++;
      }
    }

    res.json({ success: true, imported, total: businesses.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ── HELPERS ─────────────────────────────────────────────────────────────── */
function computeScore({ has_website, rating, review_count }) {
  let score = 0;
  if (!has_website)           score += 40;
  if (!rating)                score += 20;
  if (review_count < 10)      score += 20;
  if (rating && rating < 3.5) score += 20;
  return Math.min(score, 100);
}

function resolveNiche(category = '') {
  const c = category.toLowerCase();
  if (c.match(/hair|salon|beauty|nail|spa|barb/))   return 'salon';
  if (c.match(/restaurant|food|eat|cafe|bakery|catering/)) return 'restaurant';
  if (c.match(/clinic|hospital|pharmacy|health|doctor|dental/)) return 'clinic';
  if (c.match(/shop|store|boutique|retail|market/)) return 'retail';
  if (c.match(/school|academy|education|tutor/))    return 'education';
  if (c.match(/hotel|lodge|guest|hostel/))          return 'hospitality';
  if (c.match(/gym|fitness|sport/))                 return 'fitness';
  return 'general';
}

async function logActivity(lead_id, type, description) {
  await db.activities.insert({
    id: uuidv4(),
    lead_id,
    type,
    description,
    created_at: new Date().toISOString()
  });
}

module.exports = router;
