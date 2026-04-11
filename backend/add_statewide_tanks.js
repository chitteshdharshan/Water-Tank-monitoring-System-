const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'water_testing.db');
const db = new sqlite3.Database(dbPath);

const tanks = [
    { name: 'Red Hills Tank (Chennai)',   lat: 13.181, lng: 80.174 },
    { name: 'Vaigai Reservoir (Madurai)',  lat: 10.053, lng: 77.601 },
    { name: 'Kaveri River Tank (Trichy)',  lat: 10.850, lng: 78.690 },
    { name: 'Ariyalur Local Tank',        lat: 11.140, lng: 79.078 }
];

db.serialize(() => {
    tanks.forEach(t => {
        db.run("INSERT OR IGNORE INTO tanks (name, latitude, longitude) VALUES (?, ?, ?)", [t.name, t.lat, t.lng], (err) => {
            if (err) console.error(`Error inserting ${t.name}:`, err.message);
            else console.log(`✅ Added tank: ${t.name}`);
        });
    });
});

db.close();
