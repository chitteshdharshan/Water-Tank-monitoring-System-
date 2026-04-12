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
            role TEXT DEFAULT 'operator',
            district_id INTEGER,
            FOREIGN KEY (district_id) REFERENCES districts(id)
        )`);

        // Hierarchical Database Design
        db.run(`CREATE TABLE IF NOT EXISTS districts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS taluks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            district_id INTEGER,
            FOREIGN KEY (district_id) REFERENCES districts(id)
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS areas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            taluk_id INTEGER,
            latitude REAL,
            longitude REAL,
            FOREIGN KEY (taluk_id) REFERENCES taluks(id)
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS water_tanks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            type TEXT,
            area_id INTEGER,
            latitude REAL,
            longitude REAL,
            capacity INTEGER,
            FOREIGN KEY (area_id) REFERENCES areas(id)
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS water_quality (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tank_id INTEGER,
            date DATE DEFAULT (DATE('now')),
            ph REAL,
            hardness REAL,
            solids REAL,
            chloramines REAL,
            sulfate REAL,
            conductivity REAL,
            organic_carbon REAL,
            trihalomethanes REAL,
            turbidity REAL,
            status TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (tank_id) REFERENCES water_tanks(id)
        )`);

        // Alerts Table
        db.run(`CREATE TABLE IF NOT EXISTS alerts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tank_id INTEGER NOT NULL,
            message TEXT,
            severity TEXT,
            date DATE DEFAULT (DATE('now')),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (tank_id) REFERENCES water_tanks(id)
        )`);

        // Indexes for performance
        db.run(`CREATE INDEX IF NOT EXISTS idx_tank_area ON water_tanks(area_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_tank_lat ON water_tanks(latitude)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_tank_lon ON water_tanks(longitude)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_area_lat ON areas(latitude)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_area_lon ON areas(longitude)`);

        // Seed users if empty
        db.get("SELECT COUNT(*) as count FROM users", (err, row) => {
            if (row && row.count === 0) {
                const adminPass = bcrypt.hashSync('admin123', 10);
                const operatorPass = bcrypt.hashSync('op123', 10);
                // Admin has no specific district (sees all), operator has district 1
                db.run("INSERT INTO users (username, password, role, district_id) VALUES (?, ?, ?, ?)", ['admin', adminPass, 'admin', null]);
                db.run("INSERT INTO users (username, password, role, district_id) VALUES (?, ?, ?, ?)", ['operator', operatorPass, 'operator', 1]);
                console.log('✅ Seeded initial admin and operator users.');
            }
        });
    });
}

module.exports = db;
