const db = require('./db/connection');
const { v4: uuidv4 } = require('uuid');

async function createTestLead() {
  try {
    const siteId = uuidv4();
    
    // 1. Create a dummy HTML preview based on your Premium Soft-UI layout
    const testHtml = `
      <html>
        <head>
          <style>
            body { font-family: sans-serif; background: #F9FBFC; text-align: center; padding: 50px; }
            .hero { background: white; padding: 30px; border-radius: 20px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); display: inline-block; }
            h1 { color: #E0245E; }
            .btn { background: #E0245E; color: white; padding: 10px 20px; border-radius: 10px; text-decoration: none; }
          </style>
        </head>
        <body>
          <div class="hero">
            <h1>Manchester Pet Shop</h1>
            <p>Mockup generated successfully!</p>
            <a href="#" class="btn">Call Us</a>
          </div>
        </body>
      </html>
    `;

    const dummyLead = {
      id: "test-lead-001",
      business_name: "Manchester Pet Shop",
      niche: "pets",
      status: "new",
      sites: [{
        id: siteId,
        template_id: "temp-premium-v1",
        site_html: testHtml,
        preview_url: `/preview/${siteId}`,
        created_at: new Date().toISOString(),
        view_count: 0
      }]
    };

    // 2. Clear old test data and insert fresh
    await db.leads.remove({ id: "test-lead-001" }, { multi: true });
    await db.leads.insert(dummyLead);

    console.log('\n🎉 Test lead created successfully!');
    console.log(`👉 Open your browser and visit: http://localhost:3000/preview/${siteId}\n`);
  } catch (err) {
    console.error('Error creating test lead:', err);
  }
}

createTestLead();
