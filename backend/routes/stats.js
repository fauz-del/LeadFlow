// backend/routes/stats.js
const express = require('express');
const db      = require('../db/connection');
const router  = express.Router();

router.get('/', async (req, res) => {
  try {
    // 1. Basic Counts
    const total_leads     = await db.leads.count({});
    const no_website      = await db.leads.count({ has_website: 0 });
    const sites_generated = await db.leads.count({ site_url: { $exists: true } });
    const outreach_sent   = await db.outreach.count({ status: { $in: ['sent', 'delivered', 'replied'] } });
    const replied         = await db.outreach.count({ status: 'replied' });
    const converted       = await db.leads.count({ status: 'converted' });

    // 2. Breakdown Logic (Simulating Group By)
    const allLeads = await db.leads.find({});
    
    const statusMap = {};
    const nicheMap = {};
    
    allLeads.forEach(l => {
      statusMap[l.status] = (statusMap[l.status] || 0) + 1;
      nicheMap[l.niche] = (nicheMap[l.niche] || 0) + 1;
    });

    const status_breakdown = Object.keys(statusMap).map(k => ({ status: k, count: statusMap[k] }));
    const niche_breakdown  = Object.keys(nicheMap).map(k => ({ niche: k, count: nicheMap[k] }))
                                   .sort((a, b) => b.count - a.count);

    // 3. Top Opportunities
    const top_opportunities = await db.leads.find({ has_website: 0 })
                                      .sort({ opportunity_score: -1 })
                                      .limit(5);

    // 4. Recent Activity
    // Note: Since NeDB doesn't do "JOINs", we get activities then map the names
    const activities = await db.activities.find({}).sort({ created_at: -1 }).limit(10);
    const recent_activity = await Promise.all(activities.map(async a => {
      const lead = await db.leads.findOne({ id: a.lead_id });
      return { ...a, business_name: lead ? lead.business_name : 'Unknown' };
    }));

    // 5. Rates
    const reply_rate = outreach_sent > 0 ? ((replied / outreach_sent) * 100).toFixed(1) : 0;
    const conv_rate  = replied > 0       ? ((converted / replied) * 100).toFixed(1)     : 0;

    res.json({
      success: true,
      data: {
        total_leads, no_website, sites_generated, outreach_sent,
        replied, converted, reply_rate, conv_rate,
        status_breakdown, niche_breakdown, top_opportunities, recent_activity,
      }
    });
  } catch (err) {
    console.error('Stats Error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

