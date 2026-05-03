const express = require('express');
const db      = require('../db/connection');
const router  = express.Router();

router.get('/', async (req, res) => {
  try {
    // FORCE SEED EVERY TIME FOR TESTING
    await seedTemplates(); 

    const { niche } = req.query;
    let query = {};
    if (niche) query.niche = niche;

    const rows = await db.templates.find(query).sort({ use_count: -1 });
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/templates/:id ──────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const t = await db.templates.findOne({ id: req.params.id });
    if (!t) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: t });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

async function seedTemplates() {
  const defaults = [
    {
  id: 'temp-plumber-v1',
  niche: 'plumber',
  name: 'Premium Corporate Plumber',
  html_body: `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{business_name}} | Master Engineering & Plumbing</title>
    <link href="https://googleapis.com" rel="stylesheet">
    <style>
        :root { 
            --primary: #4A90E2; --primary-dark: #2A5298; --navy: #0A1D37; 
            --slate: #64748B; --white: #FFFFFF; --bg: #F8FAFC;
            --shadow: 0 30px 60px rgba(10, 29, 55, 0.12);
        }
        * { box-sizing: border-box; margin: 0; padding: 0; scroll-behavior: smooth; }
        body { font-family: 'Plus Jakarta Sans', sans-serif; color: var(--slate); background: var(--bg); overflow-x: hidden; }
        .container { width: 100%; max-width: 1200px; margin: 0 auto; padding: 0 24px; }

        /* 1. GLASS NAVBAR WITH HAMBURGER */
        .navbar { position: sticky; top: 0; z-index: 3000; background: rgba(255,255,255,0.8); backdrop-filter: blur(15px); height: 90px; display: flex; align-items: center; border-bottom: 1px solid rgba(0,0,0,0.05); }
        .nav-flex { display: flex; justify-content: space-between; align-items: center; width: 100%; }
        .logo { color: var(--navy); font-weight: 800; font-size: 1.8rem; text-decoration: none; letter-spacing: -1.5px; }
        .nav-links { display: flex; gap: 35px; }
        .nav-links a { text-decoration: none; color: var(--navy); font-weight: 600; font-size: 0.95rem; transition: 0.3s; }
        
        #menu-toggle { display: none; }
        .hamburger { display: none; cursor: pointer; flex-direction: column; gap: 5px; z-index: 4000; }
        .hamburger span { width: 28px; height: 3px; background: var(--navy); border-radius: 5px; }

        /* 2. EQUITY PLUMB STYLE HERO */
        .hero { position: relative; padding: 100px 0 240px; background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%); color: white; }
        .hero-grid { display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 60px; align-items: center; }
        h1 { font-size: clamp(3rem, 6vw, 4.5rem); line-height: 0.95; margin-bottom: 25px; font-weight: 800; letter-spacing: -3px; }
        .hero-img-box { position: relative; z-index: 5; }
        .hero-img { width: 110%; border-radius: 40px; box-shadow: var(--shadow); height: 500px; object-fit: cover; transform: translateY(40px); }

        /* 3. FLOATING SERVICE CARDS (The Overlap) */
        .services-overlap { margin-top: -140px; position: relative; z-index: 100; padding-bottom: 100px; }
        .service-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 30px; }
        .s-card { background: white; padding: 50px; border-radius: 30px; box-shadow: var(--shadow); transition: 0.4s; border: 1px solid rgba(0,0,0,0.02); }
        .s-card:hover { transform: translateY(-15px); }
        .s-card.featured { background: var(--primary); color: white; }
        .icon { font-size: 2.5rem; margin-bottom: 20px; display: block; }

        /* 4. DATA & STATS SECTION */
        .stats { padding: 100px 0; background: white; text-align: center; }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 40px; }
        .stat-item { border-right: 1px solid #E2E8F0; }
        .stat-item:last-child { border: none; }
        .stat-val { font-size: 3.5rem; font-weight: 800; color: var(--navy); display: block; }

        /* 5. MEGA FOOTER & EMERGENCY BAR */
        .cta-footer { background: var(--navy); border-radius: 50px; padding: 80px 40px; color: white; text-align: center; margin-bottom: -100px; position: relative; z-index: 1000; }
        footer { background: #050C16; padding: 220px 0 80px; color: rgba(255,255,255,0.4); }
        .emergency-btn { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); width: 90%; background: #FF4757; color: white; padding: 20px; border-radius: 15px; text-align: center; font-weight: 800; z-index: 5000; display: none; text-decoration: none; box-shadow: 0 10px 30px rgba(255,71,87,0.4); }

        @media (max-width: 992px) {
            .hero-grid { grid-template-columns: 1fr; text-align: center; }
            .hero-img { display: none; }
            .hamburger { display: flex; }
            .nav-links { position: fixed; top: 0; right: -100%; width: 80%; height: 100vh; background: white; flex-direction: column; align-items: center; justify-content: center; transition: 0.4s; }
            #menu-toggle:checked ~ .nav-links { right: 0; }
            .emergency-btn { display: block; }
            .stat-item { border: none; border-bottom: 1px solid #E2E8F0; padding-bottom: 20px; }
        }
    </style>
</head>
<body>

    <nav class="navbar">
        <div class="container nav-flex">
            <a href="#" class="logo">EQUITY<span style="color:var(--primary)">PLUMB</span></a>
            <input type="checkbox" id="menu-toggle">
            <label for="menu-toggle" class="hamburger"><span></span><span></span><span></span></label>
            <div class="nav-links">
                <a href="#home">Home</a>
                <a href="#services">Services</a>
                <a href="#about">About</a>
                <a href="#stats">Trust</a>
                <a href="#contact">Contact</a>
            </div>
            <a href="tel:{{phone}}" class="btn-blue" style="background:var(--navy); color:white; padding:12px 25px; border-radius:12px; text-decoration:none; font-weight:700;">Get Quote</a>
        </div>
    </nav>

    <section id="home" class="hero">
        <div class="container hero-grid">
            <div>
                <h1>Reliable <br>Plumbing <br>Experts</h1>
                <p style="font-size:1.3rem; margin-bottom:40px; opacity: 0.9;">Professional engineering solutions for your home in {{location}}.</p>
                <a href="tel:{{phone}}" style="background:white; color:var(--navy); padding:20px 40px; border-radius:15px; text-decoration:none; font-weight:800; font-size:1.1rem;">Call Today: {{phone}}</a>
            </div>
            <div class="hero-img-box">
                <img src="{{image_url}}" class="hero-img" alt="Technician">
            </div>
        </div>
    </section>

    <section id="services" class="container services-overlap">
        <div class="service-grid">
            <div class="s-card"><span class="icon">💧</span><h3>Pipe Repair</h3><p>Advanced acoustic leak detection and structural pipe relining.</p></div>
            <div class="s-card"><span class="icon">🔥</span><h3>Water Heaters</h3><p>Smart system installation and rapid response emergency repairs.</p></div>
            <div class="s-card featured"><span class="icon">🪠</span><h3>Drain Cleaning</h3><p>Professional jetting and HD CCTV drain surveys in {{location}}.</p></div>
        </div>
    </section>

    <section id="stats" class="stats">
        <div class="container">
            <h2 style="color:var(--navy); font-size:2.5rem; margin-bottom:60px;">Data-Driven Results</h2>
            <div class="stats-grid">
                <div class="stat-item"><span class="stat-val">41%</span><span class="stat-label">Faster Response</span></div>
                <div class="stat-item"><span class="stat-val">35%</span><span class="stat-label">Efficiency Gain</span></div>
                <div class="stat-item"><span class="stat-val">28k</span><span class="stat-label">Happy Clients</span></div>
            </div>
        </div>
    </section>

    <section id="contact" class="container">
        <div class="cta-box footer-cta" style="background:var(--primary); padding: 100px 40px; border-radius:40px; text-align:center; color:white;">
            <h2 style="font-size:3.5rem; margin-bottom:20px;">Secure Your Appointment</h2>
            <p style="font-size:1.2rem; margin-bottom:40px; opacity:0.9;">Available 24/7 for emergency plumbing in {{location}}.</p>
            <a href="tel:{{phone}}" style="background:var(--navy); color:white; padding:20px 45px; border-radius:15px; text-decoration:none; font-weight:800;">Book Now</a>
        </div>
    </section>

    <footer>
        <div class="container" style="text-align:center;">
            <p>&copy; 2026 {{business_name}} | Licensed Specialist in {{location}}</p>
        </div>
    </footer>

    <a href="tel:{{phone}}" class="emergency-btn">⚠️ 24/7 EMERGENCY CALL: {{phone}}</a>

</body>
</html>
 `
}
  ];
  await db.templates.remove({}, { multi: true });
  await db.templates.insert(defaults);
}


module.exports = router;
