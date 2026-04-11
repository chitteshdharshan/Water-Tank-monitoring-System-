const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, 'water_testing.db');
const db = new sqlite3.Database(dbPath);

const adminPass = bcrypt.hashSync('admin123', 10);
const operatorPass = bcrypt.hashSync('op123', 10);

db.serialize(() => {
    db.run("INSERT OR REPLACE INTO users (username, password, role) VALUES (?, ?, ?)", ['admin', adminPass, 'admin'], (err) => {
        if (err) console.error('Error inserting admin:', err);
        else console.log('✅ Admin user ready (admin/admin123)');
    });
    db.run("INSERT OR REPLACE INTO users (username, password, role) VALUES (?, ?, ?)", ['operator', operatorPass, 'operator'], (err) => {
        if (err) console.error('Error inserting operator:', err);
        else console.log('✅ Operator user ready (operator/op123)');
    });
});
