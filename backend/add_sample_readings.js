const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'water_testing.db');
const db = new sqlite3.Database(dbPath);

const date = new Date().toISOString().split('T')[0];

db.serialize(() => {
    db.all("SELECT id, name FROM tanks", (err, tanks) => {
        if (err) return console.error(err);
        
        tanks.forEach(t => {
            // Check if it's one of the newly added tanks (or all)
            // Just add one reading for today for each tank
            const ph = (6.8 + Math.random() * 1.5).toFixed(2);
            const turbidity = (1.5 + Math.random() * 3).toFixed(2);
            const solids = (200 + Math.random() * 300).toFixed(0);
            const hardness = (150 + Math.random() * 200).toFixed(0);
            const prediction = (ph < 6.5 || ph > 8.5 || turbidity > 4 || solids > 500) ? 'Unsafe' : 'Safe';

            db.run(`INSERT INTO water_readings 
                (tank_id, date, ph, hardness, solids, chloramines, sulfate, conductivity, organic_carbon, trihalomethanes, turbidity, prediction) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [t.id, date, ph, hardness, solids, 4.1, 300, 500, 8, 0.08, turbidity, prediction],
                (err) => {
                    if (err) console.error(`Error inserting reading for ${t.name}:`, err.message);
                    else console.log(`✅ Added sample reading for: ${t.name}`);
                }
            );
        });
    });
});
