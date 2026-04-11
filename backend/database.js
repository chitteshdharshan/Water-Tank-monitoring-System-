const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, 'water_testing.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        initializeTables();
    }
});

function initializeTables() {
    db.serialize(() => {
        // Users Table
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            password TEXT,
            role TEXT DEFAULT 'operator'
        )`);

        // Tanks Table (water sources)
        db.run(`CREATE TABLE IF NOT EXISTS tanks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            latitude REAL,
            longitude REAL
        )`);

        // Areas Table (areas supplied by tanks)
        db.run(`CREATE TABLE IF NOT EXISTS areas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            tank_id INTEGER NOT NULL,
            latitude REAL NOT NULL,
            longitude REAL NOT NULL,
            FOREIGN KEY (tank_id) REFERENCES tanks(id)
        )`);

        // TN Villages Reference Table (from CSV)
        db.run(`CREATE TABLE IF NOT EXISTS tn_villages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            district_en TEXT,
            district_ta TEXT,
            taluk_en TEXT,
            taluk_ta TEXT,
            village_en TEXT,
            village_ta TEXT
        )`);

        // Water Readings Table — keyed by tank_id
        db.run(`CREATE TABLE IF NOT EXISTS water_readings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tank_id INTEGER NOT NULL,
            ph REAL,
            hardness REAL,
            solids REAL,
            chloramines REAL,
            sulfate REAL,
            conductivity REAL,
            organic_carbon REAL,
            trihalomethanes REAL,
            turbidity REAL,
            prediction TEXT,
            date DATE DEFAULT (DATE('now')),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (tank_id) REFERENCES tanks(id)
        )`);

        // Alerts Table — keyed by tank_id
        db.run(`CREATE TABLE IF NOT EXISTS alerts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tank_id INTEGER NOT NULL,
            message TEXT,
            severity TEXT,
            date DATE DEFAULT (DATE('now')),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (tank_id) REFERENCES tanks(id)
        )`);

        // Indexes
        db.run(`CREATE INDEX IF NOT EXISTS idx_tank_date ON water_readings(tank_id, date)`);

        // Seed initial data
        db.get("SELECT COUNT(*) as count FROM tanks", (err, row) => {
            if (row && row.count === 0) {
                seedData();
            }
        });

        // Seed users if empty
        db.get("SELECT COUNT(*) as count FROM users", (err, row) => {
            if (row && row.count === 0) {
                const adminPass = bcrypt.hashSync('admin123', 10);
                const operatorPass = bcrypt.hashSync('op123', 10);
                db.run("INSERT INTO users (username, password, role) VALUES (?, ?, ?)", ['admin', adminPass, 'admin']);
                db.run("INSERT INTO users (username, password, role) VALUES (?, ?, ?)", ['operator', operatorPass, 'operator']);
                console.log('✅ Seeded initial admin and operator users.');
            }
        });
    });
}

function seedData() {
    // Seed Tanks with approximate Coimbatore coordinates
    const tanks = [
        { name: 'Siruvani Tank (Coimbatore)', lat: 11.015, lng: 76.910 },
        { name: 'Pillur Tank (Coimbatore)',   lat: 11.150, lng: 76.900 },
        { name: 'Bhavani Tank (Coimbatore)',  lat: 11.100, lng: 77.050 },
        { name: 'Red Hills Tank (Chennai)',   lat: 13.181, lng: 80.174 },
        { name: 'Vaigai Reservoir (Madurai)',  lat: 10.053, lng: 77.601 },
        { name: 'Kaveri River Tank (Trichy)',  lat: 10.850, lng: 78.690 },
        { name: 'Ariyalur Local Tank',        lat: 11.140, lng: 79.078 }
    ];
    tanks.forEach(t => {
        db.run("INSERT OR IGNORE INTO tanks (name, latitude, longitude) VALUES (?, ?, ?)", [t.name, t.lat, t.lng]);
    });

    // Seed Areas (with approximate Coimbatore lat/lng coords)
    // tank_id 1 = Siruvani, 2 = Pillur, 3 = Bhavani
    db.get("SELECT id FROM tanks WHERE name = 'Siruvani Tank'", (err, t1) => {
        db.get("SELECT id FROM tanks WHERE name = 'Pillur Tank'", (err, t2) => {
            db.get("SELECT id FROM tanks WHERE name = 'Bhavani Tank'", (err, t3) => {
                const areas = [
                    { name: 'RS Puram',        tank_id: t1.id, lat: 11.0030, lng: 76.9562 },
                    { name: 'Gandhipuram',     tank_id: t1.id, lat: 11.0168, lng: 76.9558 },
                    { name: 'Vadavalli',       tank_id: t2.id, lat: 11.0130, lng: 76.8868 },
                    { name: 'Peelamedu',       tank_id: t2.id, lat: 11.0276, lng: 77.0079 },
                    { name: 'Saibaba Colony',  tank_id: t1.id, lat: 11.0233, lng: 76.9455 },
                    { name: 'Singanallur',     tank_id: t3.id, lat: 10.9831, lng: 77.0132 },
                    { name: 'Ukkadam',         tank_id: t3.id, lat: 10.9847, lng: 76.9780 },
                ];
                areas.forEach(a => {
                    db.run(
                        "INSERT OR IGNORE INTO areas (name, tank_id, latitude, longitude) VALUES (?, ?, ?, ?)",
                        [a.name, a.tank_id, a.lat, a.lng]
                    );
                });
                console.log('✅ Seeded tanks and areas (Coimbatore).');
            });
        });
    });
}

module.exports = db;
