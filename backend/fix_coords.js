const sqlite3 = require('sqlite3').verbose();
const https = require('https');
const db = new sqlite3.Database('water_testing.db');

const delay = ms => new Promise(res => setTimeout(res, ms));

async function geocode(city, district) {
    const query = `${city}, ${district}, Tamil Nadu`;
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=in`;
    const opts = { headers: { 'User-Agent': 'WaterMonitorApp/1.0 (Contact: user@example.com)' } };
    
    return new Promise((resolve, reject) => {
        https.get(url, opts, res => {
            let body = '';
            res.on('data', c => body += c);
            res.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    if (data && data.length > 0) resolve([parseFloat(data[0].lat), parseFloat(data[0].lon)]);
                    else resolve(null);
                } catch(e) { resolve(null); }
            });
        }).on('error', () => resolve(null));
    });
}

async function fix() {
    db.all("SELECT id, name, tank_id, district FROM areas", async (err, areas) => {
        if(err) return console.error(err);
        let updated = 0;
        for (let i = 0; i < areas.length; i++) {
            const a = areas[i];
            if (!a.district || a.name === "RS Puram" || a.name === "OMR" || a.name === "Adyar") continue; // Skip custom test areas
            
            console.log(`[${i+1}/${areas.length}] Geocoding ${a.name}...`);
            const coords = await geocode(a.name, a.district);
            if (coords) {
                const [lat, lon] = coords;
                await new Promise(res => db.run("UPDATE areas SET latitude=?, longitude=? WHERE id=?", [lat, lon, a.id], res));
                await new Promise(res => db.run("UPDATE tanks SET latitude=?, longitude=? WHERE id=?", [lat, lon, a.tank_id], res));
                console.log(` ✅ Setup ${a.name} to ${lat}, ${lon}`);
                updated++;
            } else {
                console.log(` ❌ Failed ${a.name}`);
            }
            await delay(1100); // Respect 1 request/sec policy of OSM
        }
        console.log(`Finished updating ${updated} records!`);
    });
}

fix();
