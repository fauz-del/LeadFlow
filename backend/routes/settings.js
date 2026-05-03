const express = require('express');
const db      = require('../db/connection');
const router  = express.Router();

// ── GET /api/settings ────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    // NeDB: Get the first settings document found
    const settings = await db.settings.findOne({});
    res.json({ success: true, data: settings || {} });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── PATCH /api/settings ──────────────────────────────────────────────────────
router.patch('/', async (req, res) => {
  try {
    const updates = req.body;
    // Update the single settings document, or create it if it doesn't exist (upsert)
    await db.settings.update({}, { $set: updates }, { upsert: true });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

