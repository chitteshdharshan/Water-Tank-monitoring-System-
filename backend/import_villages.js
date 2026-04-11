const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const csvPath = path.join(__dirname, '..', 'TamilNadu village - Village.csv');
const dbPath = path.join(__dirname, 'water_testing.db');

const db = new sqlite3.Database(dbPath);

async function importVillages() {
    console.log('🚀 Starting village import...');
    
    // Ensure table exists
    await new Promise((resolve) => {
        db.run(`CREATE TABLE IF NOT EXISTS tn_villages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            district_en TEXT,
            district_ta TEXT,
            taluk_en TEXT,
            taluk_ta TEXT,
            village_en TEXT,
            village_ta TEXT
        )`, resolve);
    });

    // Check if table is already populated
    const count = await new Promise((resolve) => {
        db.get('SELECT COUNT(*) as count FROM tn_villages', (err, row) => {
            resolve(row ? row.count : 0);
        });
    });

    if (count > 0) {
        console.log(`✅ Table tn_villages already has ${count} records. Skipping import.`);
        db.close();
        return;
    }

    const data = fs.readFileSync(csvPath, 'utf8');
    const lines = data.split('\n');
    const headers = lines[0].split(',');
    
    console.log(`📊 Total lines to process: ${lines.length - 1}`);

    db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        const stmt = db.prepare(`
            INSERT INTO tn_villages (district_en, district_ta, taluk_en, taluk_ta, village_en, village_ta)
            VALUES (?, ?, ?, ?, ?, ?)
        `);

        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;
            
            // Simple comma split (assuming no commas in values based on preview)
            const cols = lines[i].split(',');
            if (cols.length >= 9) {
                stmt.run(
                    cols[1], // District En
                    cols[2], // District Ta
                    cols[4], // Taluk En
                    cols[5], // Taluk Ta
                    cols[7], // Village En
                    cols[8]  // Village Ta
                );
            }
            
            if (i % 1000 === 0) {
                console.log(`⏳ Processed ${i} villages...`);
            }
        }

        stmt.finalize();
        db.run('COMMIT', (err) => {
            if (err) {
                console.error('❌ Error committing transaction:', err.message);
            } else {
                console.log('✅ Village import complete!');
            }
            db.close();
        });
    });
}

importVillages().catch(err => console.error(err));
