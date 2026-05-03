const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Connect strictly to your database folder
const db = require(path.join(__dirname, 'backend', 'db', 'connection')); 

function resolveNiche(category = '', name = '') {
  const combinedText = (category + ' ' + name).toLowerCase();
  if (combinedText.match(/locksmith|locks|locksmiths|door|doors|lock smith|security|key/)) return 'locksmith';
  if (combinedText.match(/plumber|pipe|drain|heating engineer|boiler/)) return 'plumber';
  if (combinedText.match(/roof|construct|contractor|builder|paving/)) return 'contractor';
  if (combinedText.match(/hair|salon|beauty|nail|spa|barb/)) return 'salon';
  if (combinedText.match(/restaurant|food|eat|cafe|bakery|catering/)) return 'restaurant';
  if (combinedText.match(/clinic|hospital|pharmacy|health|doctor|dental/)) return 'clinic';
  if (combinedText.match(/shop|store|boutique|retail|market/)) return 'retail';
  if (combinedText.match(/gym|fitness|sport/)) return 'fitness';
  return 'general'; 
}

async function processImport() {
  try {
    const tempPath = path.join(__dirname, 'temp_leads.csv');

    if (!fs.existsSync(tempPath)) {
      console.error(`❌ Error: 'temp_leads.csv' was not found in ${__dirname}`);
      process.exit(1);
    }

    const fileContent = fs.readFileSync(tempPath, 'utf8'); 
    
    // Split the file by line breaks safely
    const lines = fileContent.split(/\r?\n/);
    
    let importedCount = 0;
    let skippedCount = 0;

    // Grab headers to ignore the first line
    const headers = lines[0].split(',');
    
    // Find the index of the columns we need based on header row
    const nameIdx = headers.findIndex(h => h.includes('qBF1Pd') || h.toLowerCase().includes('name'));
    const catIdx = headers.findIndex(h => h.includes('W4Efsd') || h.toLowerCase().includes('category'));
    const phoneIdx = headers.findIndex(h => h.includes('UsdlK') || h.toLowerCase().includes('phone'));
    const webIdx = headers.findIndex(h => h.includes('lcr4fd href') || h.toLowerCase().includes('website'));

    console.log("Reading leads line by line...");

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Split line by comma
    const row = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || [];


      const name = row[nameIdx] || '';
      const category = row[catIdx] || 'General Business';
      const website = row[webIdx] || '';
      const phone = row[phoneIdx] || '';
      
      // Stop execution if there is no business name
      if (!name || name.trim() === "" || name.includes("qBF1Pd")) continue;

      // Duplicate Check
      const existingLead = await db.leads.findOne({ business_name: name });
      if (existingLead) {
        skippedCount++;
        continue;
      }

      const determinedNiche = resolveNiche(category, name);

      // Skip businesses with legitimate websites (allow empty or Google redirects)
      if (website && website.startsWith('http') && !website.includes('://google.com')) {
          continue; 
      }

      const newLead = {
        id: uuidv4(),
        business_name: name,
        category: category,
        phone: phone,
        has_website: 0,
        opportunity_score: 70,
        niche: determinedNiche, 
        status: 'new',
        source: 'google_maps_import',
        created_at: new Date().toISOString()
      };

      await db.leads.insert(newLead);
      importedCount++;
      console.log(`✓ Added [${determinedNiche}]: ${name}`);
    }

    console.log(`\n🎉 Success! Imported ${importedCount} leads. Skipped ${skippedCount} duplicates.`);
    process.exit(0);
  } catch (err) {
    console.error('Import error:', err.message);
    process.exit(1);
  }
}

processImport();
