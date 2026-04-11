const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, 'water_testing.db');
const db = new sqlite3.Database(dbPath);

// Approximate centers for all 38 districts to provide a statewide map focus
const districtCenters = {
    "Ariyalur": [11.1401, 79.0786],
    "Chengalpattu": [12.6841, 79.9836],
    "Chennai": [13.0827, 80.2707],
    "Coimbatore": [11.0168, 76.9558],
    "Cuddalore": [11.7480, 79.7714],
    "Dharmapuri": [12.1273, 78.1582],
    "Dindigul": [10.3673, 77.9803],
    "Erode": [11.3410, 77.7172],
    "Kallakurichi": [11.7401, 78.9620],
    "Kancheepuram": [12.8342, 79.7036],
    "Kanyakumari": [8.0883, 77.5385],
    "Karur": [10.9601, 78.0766],
    "Krishnagiri": [12.5186, 78.2137],
    "Madurai": [9.9252, 78.1198],
    "Nagapattinam": [10.7672, 79.8444],
    "Namakkal": [11.2189, 78.1672],
    "Perambalur": [11.2342, 78.8820],
    "Pudukkottai": [10.3833, 78.8167],
    "Ramanathapuram": [9.3639, 78.8394],
    "Ranipet": [12.9272, 79.3333],
    "Salem": [11.6643, 78.1460],
    "Sivagangai": [9.8517, 78.4817],
    "Tenkasi": [8.9595, 77.3100],
    "Thanjavur": [10.7870, 79.1378],
    "The Nilgiris": [11.4100, 76.6900],
    "Theni": [10.0104, 77.4768],
    "Thiruchirappalli": [10.8505, 78.6900],
    "Thiruvarur": [10.7733, 79.6333],
    "Thoothukkudi": [8.7642, 78.1348],
    "Tirunelveli": [8.7139, 77.7567],
    "Tirupathur": [12.4925, 78.5678],
    "Tiruppur": [11.1085, 77.3411],
    "Tiruvallur": [13.1367, 79.9100],
    "Tiruvannamalai": [12.2253, 79.0747],
    "Vellore": [12.9165, 79.1325],
    "Villuppuram": [11.9401, 79.4861],
    "Virudhunagar": [9.5872, 77.9514],
    "Mayiladuthurai": [11.1017, 79.6521]
};

async function seed() {
    console.log('🚀 Seeding Statewide Infrastructure...');
    
    for (const [district, coords] of Object.entries(districtCenters)) {
        const tankName = `${district} Main Resource Tank (${district})`;
        
        // 1. Insert Tank
        await new Promise((resolve, reject) => {
            db.run("INSERT OR IGNORE INTO tanks (name, latitude, longitude) VALUES (?, ?, ?)", 
            [tankName, coords[0], coords[1]], (err) => {
                if (err) console.error(`Error adding tank for ${district}:`, err);
                resolve();
            });
        });

        // 2. Map some villages to this tank
        await new Promise((resolve) => {
            db.get("SELECT id FROM tanks WHERE name = ?", [tankName], (err, tank) => {
                if (tank) {
                    // Find some sample villages for this district to link
                    db.all("SELECT village_en FROM tn_villages WHERE district_en = ? LIMIT 5", [district], (err, villages) => {
                        if (villages && villages.length > 0) {
                            villages.forEach(v => {
                                // Insert into area table (using approximation near tank)
                                const lat = coords[0] + (Math.random() - 0.5) * 0.05;
                                const lon = coords[1] + (Math.random() - 0.5) * 0.05;
                                db.run("INSERT OR IGNORE INTO areas (name, tank_id, latitude, longitude) VALUES (?, ?, ?, ?)",
                                [v.village_en, tank.id, lat, lon]);
                            });
                        }
                        resolve();
                    });
                } else resolve();
            });
        });
    }

    // 3. Add some sample safe/unsafe readings for the new tanks
    db.all("SELECT id FROM tanks", (err, tanks) => {
        const today = new Date().toISOString().split('T')[0];
        tanks.forEach(t => {
            const pred = Math.random() > 0.8 ? 'Unsafe' : 'Safe';
            db.run(`INSERT INTO water_readings (tank_id, ph, hardness, solids, chloramines, sulfate, conductivity, organic_carbon, trihalomethanes, turbidity, prediction, created_at) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [t.id, 7.2, 150, 200, 2.5, 30, 400, 10, 50, 1.2, pred, today]);
        });
        console.log('✅ Statewide Seeding Complete!');
        db.close();
    });
}

seed();
