const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { execFile } = require('child_process');
const path   = require('path');
const db     = require('../db/connection');
const router = express.Router();

// ── GET /api/jobs ─────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  const rows = await db.jobs.find({}).sort({ created_at: -1 }).limit(30);
  res.json({ success: true, data: rows });
});

// ── POST /api/jobs — queue a scrape job ───────────────────────────────────────
router.post('/', async (req, res) => {
  const { query, city, category } = req.body;
  if (!query) return res.status(400).json({ success: false, message: 'query required' });

  const id = uuidv4();
  const newJob = {
    id,
    query,
    city: city || '',
    category: category || '',
    status: 'running',
    created_at: new Date().toISOString(),
    started_at: new Date().toISOString()
  };

  await db.jobs.insert(newJob);

  // Use 'python' for Windows compatibility
  const scriptPath = path.join(__dirname, '../../scraper/scraper.py');
  const apiBase    = `http://localhost:${process.env.PORT || 3000}`;

  execFile('python', [scriptPath, '--query', query, '--city', city || '',
                       '--job-id', id, '--api', apiBase], async (err, stdout, stderr) => {
    if (err) {
      console.error('[Scraper error]', stderr);
      await db.jobs.update({ id }, { $set: { status: 'failed', error_msg: err.message, finished_at: new Date().toISOString() } });
    } else {
      await db.jobs.update({ id }, { $set: { status: 'done', finished_at: new Date().toISOString() } });
    }
  });

  res.status(202).json({ success: true, data: newJob });
});

module.exports = router;
