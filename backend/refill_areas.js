const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'water_testing.db');
const db = new sqlite3.Database(dbPath);

console.log('🚀 Refining areas for all districts...');

db.serialize(() => {
    // 1. Get Tank IDs first
    db.all("SELECT id, name FROM tanks", (err, tanks) => {
        if (err) return console.error(err);

        const findId = (pattern) => tanks.find(t => t.name.includes(pattern))?.id;

        const chennaiTank = findId('Chennai');
        const maduraiTank = findId('Madurai');
        const trichyTank = findId('Trichy');
        const ariyalurTank = findId('Ariyalur');
        const coimbatoreTank = findId('Coimbatore') || findId('Siruvani');

        const newAreas = [];
        
        if (chennaiTank) {
            newAreas.push({ name: 'Anna Nagar, Chennai', tank_id: chennaiTank, lat: 13.0850, lng: 80.2101 });
            newAreas.push({ name: 'T. Nagar, Chennai', tank_id: chennaiTank, lat: 13.0394, lng: 80.2323 });
        }
        if (maduraiTank) {
            newAreas.push({ name: 'Meenakshi Nagar, Madurai', tank_id: maduraiTank, lat: 9.9195, lng: 78.1193 });
            newAreas.push({ name: 'K.K. Nagar, Madurai', tank_id: maduraiTank, lat: 9.9252, lng: 78.1400 });
        }
        if (trichyTank) {
            newAreas.push({ name: 'Srirangam, Trichy', tank_id: trichyTank, lat: 10.8624, lng: 78.6883 });
            newAreas.push({ name: 'Cantonment, Trichy', tank_id: trichyTank, lat: 10.8050, lng: 78.6856 });
        }
        if (ariyalurTank) {
            newAreas.push({ name: 'Aiyyur, Ariyalur', tank_id: ariyalurTank, lat: 11.2333, lng: 79.2167 });
            newAreas.push({ name: 'Alagapuram, Ariyalur', tank_id: ariyalurTank, lat: 11.1333, lng: 79.0833 });
        }

        newAreas.forEach(a => {
            db.run(
                "INSERT OR IGNORE INTO areas (name, tank_id, latitude, longitude) VALUES (?, ?, ?, ?)",
                [a.name, a.tank_id, a.lat, a.lng],
                function(err) {
                    if (err) console.error(`❌ Error adding ${a.name}:`, err.message);
                    else if (this.changes > 0) console.log(`✅ Added area: ${a.name}`);
                }
            );
        });

        console.log('🔄 All sample areas processed.');
    });
});
