const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, 'water_testing.db');
const db = new sqlite3.Database(dbPath);

// Major Municipal Corporations and Town Headquarters of TN
const cityData = [
    { name: "Chennai", lat: 13.0827, lon: 80.2707, district: "Chennai" },
    { name: "Coimbatore", lat: 11.0168, lon: 76.9558, district: "Coimbatore" },
    { name: "Madurai", lat: 9.9252, lon: 78.1198, district: "Madurai" },
    { name: "Tiruchirappalli", lat: 10.8505, lon: 78.6900, district: "Thiruchirappalli" },
    { name: "Salem", lat: 11.6643, lon: 78.1460, district: "Salem" },
    { name: "Tiruppur", lat: 11.1085, lon: 77.3411, district: "Tiruppur" },
    { name: "Erode", lat: 11.3410, lon: 77.7172, district: "Erode" },
    { name: "Vellore", lat: 12.9165, lon: 79.1325, district: "Vellore" },
    { name: "Thoothukkudi", lat: 8.7642, lon: 78.1348, district: "Thoothukkudi" },
    { name: "Tirunelveli", lat: 8.7139, lon: 77.7567, district: "Tirunelveli" },
    { name: "Thanjavur", lat: 10.7870, lon: 79.1378, district: "Thanjavur" },
    { name: "Nagercoil", lat: 8.1833, lon: 77.4119, district: "Kanyakumari" },
    { name: "Hosur", lat: 12.7409, lon: 77.8253, district: "Krishnagiri" },
    { name: "Dindigul", lat: 10.3673, lon: 77.9803, district: "Dindigul" },
    { name: "Avadi", lat: 13.1168, lon: 80.1018, district: "Tiruvallur" },
    { name: "Tambaram", lat: 12.9249, lon: 80.1012, district: "Chengalpattu" },
    { name: "Kancheepuram", lat: 12.8342, r79: 79.7036, district: "Kancheepuram" },
    { name: "Karur", lat: 10.9601, lon: 78.0766, district: "Karur" },
    { name: "Kumbakonam", lat: 10.9602, lon: 79.3845, district: "Thanjavur" },
    { name: "Sivakasi", lat: 9.4533, lon: 77.8105, district: "Virudhunagar" },
    { name: "Cuddalore", lat: 11.7480, lon: 79.7714, district: "Cuddalore" },
    { name: "Pollachi", lat: 10.6620, lon: 77.0065, district: "Coimbatore" },
    { name: "Kinathukadavu", lat: 10.8225, lon: 77.0195, district: "Coimbatore" }
];

async function seedCities() {
    console.log('🏙️ Seeding Major Cities and Corporations...');
    
    for (const city of cityData) {
        const tankName = `${city.name} Urban Reservoir (${city.district})`;
        
        // 1. Insert Tank for the City
        await new Promise((resolve) => {
            db.run("INSERT OR IGNORE INTO tanks (name, latitude, longitude) VALUES (?, ?, ?)", 
            [tankName, city.lat, city.lon], (err) => {
                if (err) console.error(`Error adding city tank for ${city.name}:`, err);
                resolve();
            });
        });

        // 2. Map this "City" into the areas table so it appears in "All Areas"
        await new Promise((resolve) => {
            db.get("SELECT id FROM tanks WHERE name = ?", [tankName], (err, tank) => {
                if (tank) {
                    db.run("INSERT OR IGNORE INTO areas (name, tank_id, latitude, longitude) VALUES (?, ?, ?, ?)",
                    [city.name.toUpperCase(), tank.id, city.lat, city.lon], (err) => {
                        resolve();
                    });
                } else resolve();
            });
        });

        // 3. Add a sample reading
        await new Promise(resolve => {
            db.get("SELECT id FROM tanks WHERE name = ?", [tankName], (err, tank) => {
                if(tank) {
                    db.run(`INSERT INTO water_readings (tank_id, ph, hardness, solids, chloramines, sulfate, conductivity, organic_carbon, trihalomethanes, turbidity, prediction, date) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [tank.id, 7.4, 160, 250, 2.8, 35, 420, 8, 45, 1.1, 'Safe', new Date().toISOString().split('T')[0]], resolve);
                } else resolve();
            });
        });
    }

    console.log('✅ City Seeding Complete!');
    db.close();
}

seedCities();
