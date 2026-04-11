const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, 'water_testing.db');
const db = new sqlite3.Database(dbPath);

const urbanCenters = {
    "Ariyalur": ["Ariyalur", "Jayankondam"],
    "Chengalpattu": ["Chengalpattu", "Madhuranthakam", "Maraimalai Nagar", "Nandivaram-Guduvancheri", "Pammal", "Anakaputhur"],
    "Chennai": ["Chennai (Greater)", "Adyar", "Ambattur", "Anna Nagar", "T. Nagar", "Velachery", "Mylapore", "Kodambakkam", "Tambaram", "Avadi"],
    "Coimbatore": ["Coimbatore (Corporation)", "Pollachi", "Mettupalayam", "Valparai", "Karumathampatti", "Madukkarai", "Gudalur (CBE)", "Annur", "Sulur", "Kinathukadavu"],
    "Cuddalore": ["Cuddalore", "Chidambaram", "Panruti", "Virudhachalam", "Nellikuppam", "Tittakudi"],
    "Dharmapuri": ["Dharmapuri", "Palacode", "Pennagaram", "Harur"],
    "Dindigul": ["Dindigul", "Palani", "Oddanchatram", "Kodaikanal", "Vedasandur", "Natham"],
    "Erode": ["Erode", "Bhavani", "Gobichettipalayam", "Sathyamangalam", "Dharapuram", "Perundurai"],
    "Kallakurichi": ["Kallakurichi", "Ulundurpet", "Sankarapuram"],
    "Kancheepuram": ["Kancheepuram", "Sriperumbudur", "Walajabad"],
    "Kanyakumari": ["Nagercoil", "Padmanabhapuram", "Colachel", "Kuzhithurai"],
    "Karur": ["Karur", "Kulithalai", "Pallapatti", "Pugalur"],
    "Krishnagiri": ["Krishnagiri", "Hosur", "Denkanikottai", "Bargur"],
    "Madurai": ["Madurai (Corporation)", "Melur", "Thirumangalam", "Usilampatti", "Vadipatti"],
    "Nagapattinam": ["Nagapattinam", "Vedaranyam"],
    "Namakkal": ["Namakkal", "Rasipuram", "Tiruchengode", "Kumarapalayam", "Pallipalayam"],
    "Nilgiris": ["Ooty (Udhagamandalam)", "Coonoor", "Gudalur (NLG)", "Kotagiri", "Wellington"],
    "Perambalur": ["Perambalur"],
    "Pudukkottai": ["Pudukkottai", "Aranthangi"],
    "Ramanathapuram": ["Ramanathapuram", "Paramakudi", "Rameswaram", "Keelakarai"],
    "Salem": ["Salem (Corporation)", "Mettur", "Edappadi", "Attur", "Naramalaikottai"],
    "Sivaganga": ["Sivaganga", "Karaikudi", "Devakottai", "Manamadurai"],
    "Thanjavur": ["Thanjavur", "Kumbakonam", "Pattukkottai", "Adirampattinam"],
    "Theni": ["Theni", "Periyakulam", "Bodinayakanur", "Cumbum", "Uthamapalayam"],
    "Thoothukudi": ["Thoothukudi", "Kovilpatti", "Tiruchendur", "Kayalpattinam"],
    "Thiruchirappalli": ["Trichy (Corporation)", "Thuvakudi", "Manapparai", "Lalgudi", "Musiri"],
    "Tirunelveli": ["Tirunelveli", "Ambasamudram", "Vickramasingapuram"],
    "Tiruppur": ["Tiruppur", "Udumalaipettai", "Dharapuram (TPR)", "Kangeyam", "Palladam"],
    "Vellore": ["Vellore", "Gudiyatham", "Pernambut"],
    "Virudhunagar": ["Virudhunagar", "Sivakasi", "Rajapalayam", "Aruppukkottai", "Satur"],
    "Tenkasi": ["Tenkasi", "Sankarankovil", "Kadayanallur", "Puliyangudi"],
    "Ranipet": ["Ranipet", "Arcot", "Walajapet", "Arakkonam"],
    "Tirupathur": ["Tirupathur", "Vaniyambadi", "Ambur"],
    "Mayiladuthurai": ["Mayiladuthurai", "Sirkazhi"]
};

// Simplified coordinate mapping for regional approximation if specific ones not available
const districtCoords = {
    "Ariyalur": [11.1378, 79.0728], "Chengalpattu": [12.6841, 79.9836], "Chennai": [13.0827, 80.2707],
    "Coimbatore": [11.0168, 76.9558], "Cuddalore": [11.7480, 79.7714], "Dharmapuri": [12.1277, 78.1582],
    "Dindigul": [10.3673, 77.9803], "Erode": [11.3410, 77.7172], "Kallakurichi": [11.7384, 78.9639],
    "Kancheepuram": [12.8342, 79.7036], "Kanyakumari": [8.1833, 77.4119], "Karur": [10.9601, 78.0766],
    "Krishnagiri": [12.5266, 78.2148], "Madurai": [9.9252, 78.1198], "Nagapattinam": [10.7672, 79.8444],
    "Namakkal": [11.2189, 78.1672], "Nilgiris": [11.4102, 76.6950], "Perambalur": [11.2342, 78.8820],
    "Pudukkottai": [10.3797, 78.8202], "Ramanathapuram": [9.3639, 78.8395], "Ranipet": [12.9272, 79.3333],
    "Salem": [11.6643, 78.1460], "Sivaganga": [9.8433, 78.4809], "Tenkasi": [8.9591, 77.3150],
    "Thanjavur": [10.7870, 79.1378], "Theni": [10.0104, 77.4768], "Thoothukudi": [8.7642, 78.1348],
    "Thiruchirappalli": [10.8505, 78.6900], "Tirunelveli": [8.7139, 77.7567], "Tirupathur": [12.4939, 78.5678],
    "Tiruppur": [11.1085, 77.3411], "Tiruvallur": [13.1394, 79.9079], "Tiruvannamalai": [12.2274, 79.0707],
    "Tiruvarur": [10.7733, 79.6382], "Vellore": [12.9165, 79.1325], "Viluppuram": [11.9391, 79.4859],
    "Virudhunagar": [9.5854, 77.9515], "Mayiladuthurai": [11.1017, 79.6521]
};

async function seedAllUrban() {
    console.log('🏗️ Starting Comprehensive Urban Seeding...');
    
    for (const [district, cities] of Object.entries(urbanCenters)) {
        const center = districtCoords[district] || [11.1271, 78.6569];
        
        for (const city of cities) {
            const tankName = `${city} Urban Grid (${district})`;
            // Jitter coordinates slightly so they don't overlap perfectly
            const lat = center[0] + (Math.random() - 0.5) * 0.1;
            const lon = center[1] + (Math.random() - 0.5) * 0.1;

            // 1. Add Tank
            await new Promise(resolve => {
                db.run("INSERT OR IGNORE INTO tanks (name, latitude, longitude) VALUES (?, ?, ?)",
                [tankName, lat, lon], resolve);
            });

            // 2. Add Area (Mapped as City and District)
            await new Promise(resolve => {
                db.get("SELECT id FROM tanks WHERE name = ?", [tankName], (err, tank) => {
                    if (tank) {
                        db.run("INSERT OR REPLACE INTO areas (name, tank_id, latitude, longitude, district) VALUES (?, ?, ?, ?, ?)",
                        [city.toUpperCase(), tank.id, lat, lon, district], resolve);
                    } else resolve();
                });
            });

            // 3. Add Reading
            await new Promise(resolve => {
                db.get("SELECT id FROM tanks WHERE name = ?", [tankName], (err, tank) => {
                    if(tank) {
                        db.run(`INSERT INTO water_readings (tank_id, ph, hardness, solids, chloramines, sulfate, conductivity, organic_carbon, trihalomethanes, turbidity, prediction, date) 
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [tank.id, 7.2, 150, 240, 3.1, 30, 410, 7, 42, 0.9, 'Safe', new Date().toISOString().split('T')[0]], resolve);
                    } else resolve();
                });
            });
        }
    }

    console.log('✅ Comprehensive Urban Seeding Complete!');
    db.close();
}

seedAllUrban();
