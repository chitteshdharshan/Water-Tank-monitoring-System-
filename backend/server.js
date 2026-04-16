const express = require('express');
const https = require('https');
const cors = require('cors');
const bodyParser = require('body-parser');
const db = require('./database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = 5001;
const SECRET_KEY = 'water_testing_secret_key';

app.use(cors());
app.use(bodyParser.json());

// ─── AUTH MIDDLEWARE ──────────────────────────────────────────
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(401);
    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// ─── ADMIN ROUTES ──────────────────────────────────────────────
app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;
    db.get("SELECT * FROM users WHERE username = ?", [username], (err, user) => {
        if (err || !user || !bcrypt.compareSync(password, user.password)) {
            return res.status(401).json({ error: 'Auth Failed' });
        }
        const token = jwt.sign({ 
            id: user.id, 
            username: user.username, 
            role: user.role,
            district_id: user.district_id 
        }, SECRET_KEY, { expiresIn: '8h' });
        res.json({ token, username, role: user.role, district_id: user.district_id });
    });
});

app.get('/api/official/alerts', authenticateToken, (req, res) => {
    const query = `
        SELECT al.*, t.name as tank_name
        FROM alerts al
        JOIN water_tanks t ON t.id = al.tank_id
        ORDER BY al.created_at DESC LIMIT 50
    `;
    db.all(query, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/official/add-water-data', authenticateToken, (req, res) => {
    const { tank_id, date, ph, hardness, solids, chloramines, sulfate, conductivity, organic_carbon, trihalomethanes, turbidity } = req.body;
    
    if (!tank_id) return res.status(400).json({ error: 'Missing tank_id.' });

    // AI DECISION ENGINE logic
    let status = (ph < 6.5 || turbidity > 5) ? 'Unsafe' : 'Safe';
    const testDate = date || new Date().toISOString().split('T')[0];

    const sql = `INSERT INTO water_quality 
        (tank_id, date, ph, hardness, solids, chloramines, sulfate, conductivity, organic_carbon, trihalomethanes, turbidity, status) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    
    const params = [
        tank_id, testDate, ph, hardness, solids, chloramines, sulfate, 
        conductivity, organic_carbon, trihalomethanes, turbidity, status
    ];

    db.run(sql, params, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        
        // Fetch names for frontend display enrichment
        db.get(`
            SELECT t.name as tank_name, a.name as area_name 
            FROM water_tanks t 
            JOIN areas a ON t.area_id = a.id 
            WHERE t.id = ?`, [tank_id], (err, names) => {
            
            res.json({ 
                success: true, 
                status, 
                prediction: status, // mapped for frontend compatibility
                tank_name: names?.tank_name || 'N/A',
                area_name: names?.area_name || 'N/A',
                message: `Data logged successfully. AI Status: ${status}`,
                id: this.lastID 
            });
        });
    });
});

// CSV UPLOAD (Assuming multer is used in production. For now, we take JSON arrays for demo compatibility)
app.post('/api/official/upload-data', authenticateToken, (req, res) => {
    const { data } = req.body; // Expecting an array of objects
    if (!Array.isArray(data)) return res.status(400).json({ error: 'Invalid data format. Expected array.' });

    const stmt = db.prepare(`INSERT INTO water_quality 
        (tank_id, date, ph, hardness, solids, chloramines, sulfate, conductivity, organic_carbon, trihalomethanes, turbidity, status) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

    data.forEach(row => {
        let status = (row.ph < 6.5 || row.turbidity > 5) ? 'Unsafe' : 'Safe';
        stmt.run([
            row.tank_id, row.date || new Date().toISOString().split('T')[0],
            row.ph, row.hardness, row.solids, row.chloramines, row.sulfate,
            row.conductivity, row.organic_carbon, row.trihalomethanes, row.turbidity, status
        ]);
    });

    stmt.finalize();
    res.json({ success: true, message: `Successfully imported ${data.length} records.` });
});

// ─── DROPDOWN UI Endpoints ─────────────────────────────────────
app.get('/api/public/districts', (req, res) => {
    db.all("SELECT id, name FROM districts ORDER BY name", (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.get('/api/public/taluks/:district_id', (req, res) => {
    db.all("SELECT id, name FROM taluks WHERE district_id = ? ORDER BY name", [req.params.district_id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.get('/api/public/areas/:taluk_id', (req, res) => {
    db.all("SELECT id, name, latitude, longitude FROM areas WHERE taluk_id = ? ORDER BY name", [req.params.taluk_id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.get('/api/public/tanks/:area_id', (req, res) => {
    db.all("SELECT id, name, latitude, longitude, type FROM water_tanks WHERE area_id = ? ORDER BY name", [req.params.area_id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// ─── SMART MAPPING & AGENTIC AI ────────────────────────────────
function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function cleanAddress(addr) {
    if (!addr) return '';
    let cleaned = addr.toLowerCase();
    cleaned = cleaned.replace(/[0-9]/g, ''); // Remove numbers
    // Fix spelling mistakes
    const fixes = {
        'coimbtore': 'coimbatore',
        'polachi': 'pollachi',
        'chenai': 'chennai',
        'maduraii': 'madurai',
        'tiruchi': 'tiruchirappalli',
        'trichy': 'tiruchirappalli'
    };
    Object.keys(fixes).forEach(key => {
        cleaned = cleaned.replace(new RegExp(key, 'g'), fixes[key]);
    });
    return cleaned.trim();
}

const geocodeCache = {};
async function geocodeWithFallback(q) {
    if (!q) return null;
    const cleaned = cleanAddress(q);
    
    const wordsRaw = cleaned.split(' ').filter(w => w);
    if (wordsRaw.length > 1 && new Set(wordsRaw).size === 1) {
        return null; // Reject dummy repeats like "hello hello hello"
    }
    
    // Fallback steps
    const parts = cleaned.split(',').map(p => p.trim()).filter(p => p);
    const fallbacks = [
        cleaned, // 1. Full address
        parts.slice(1).join(', '), // 2. Remove first part (street)
        parts.length > 2 ? parts[parts.length - 2] + ', ' + parts[parts.length - 1] : null, // 3. Village + Taluk (approx)
        parts[parts.length - 1] // 4. Last part (District/City)
    ];

    // If the user didn't use commas, add word-level fallbacks to find the broader city
    if (cleaned.includes(' ')) {
        const words = cleaned.split(' ').filter(w => w);
        if (words.length > 2) {
            fallbacks.push(words.slice(1).join(' ')); // Drop first word
            fallbacks.push(words.slice(-2).join(' ')); // Last two words (e.g. area city)
            fallbacks.push(words[words.length - 1]); // Last word (e.g. city)
        }
    }

    const uniqueFallbacks = [...new Set(fallbacks.filter(f => f && f.trim().length > 2))];

    for (let query of uniqueFallbacks) {
        const fullQuery = query.includes('Tamil Nadu') ? query + ', India' : query + ', Tamil Nadu, India';
        if (geocodeCache[fullQuery]) return geocodeCache[fullQuery];

        const result = await new Promise(resolve => {
            const encoded = encodeURIComponent(fullQuery);
            const url = `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=1&countrycodes=in`;
            https.get(url, { headers: { 'User-Agent': 'SmartCityWaterSystem/2.0' } }, (res) => {
                let raw = '';
                res.on('data', c => raw += c);
                res.on('end', () => {
                    try {
                        const data = JSON.parse(raw);
                        if (data && data.length > 0) {
                            const resObj = { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon), display_name: data[0].display_name };
                            geocodeCache[fullQuery] = resObj;
                            return resolve(resObj);
                        }
                    } catch (e) {}
                    resolve(null);
                });
            }).on('error', () => resolve(null));
        });
        if (result) return result;
    }
    return null;
}

app.post('/api/public/validate-location', async (req, res) => {
    const { q } = req.body;
    if (!q) return res.status(400).json({ error: 'Query required.' });
    
    // Try local DB first
    const localMatch = await new Promise(r => {
        db.get(`
            SELECT t.name as tank_name, a.name as area_name 
            FROM water_tanks t 
            JOIN areas a ON t.area_id = a.id 
            WHERE t.name LIKE ? OR a.name LIKE ? LIMIT 1
        `, [`%${q.trim()}%`, `%${q.trim()}%`], (err, row) => r(row));
    });

    if (localMatch) return res.json({ valid: true, resolved: localMatch.tank_name + ', ' + localMatch.area_name });

    const geoResult = await geocodeWithFallback(q);
    if (!geoResult) return res.status(404).json({ error: 'Location not found.' });
    
    res.json({ valid: true, resolved: geoResult.display_name });
});

app.post('/api/public/check-water', async (req, res) => {
    const { q, area_id, date } = req.body;

    let userLat, userLon, displayName;
    let isFallback = false;

    // Handle Geocoding Search OR Direct Area Selection
    if (area_id) {
        const area = await new Promise(r => db.get("SELECT name, latitude, longitude FROM areas WHERE id = ?", [area_id], (err, row) => r(row)));
        if (!area) return res.status(404).json({ error: 'Area not found.' });
        userLat = area.latitude;
        userLon = area.longitude;
        displayName = area.name;
    } else if (q) {
        // Try local DB search first for Tank Name or Area Name
        const localMatch = await new Promise(r => {
            db.get(`
                SELECT t.name as tank_name, a.name as area_name, t.latitude, t.longitude 
                FROM water_tanks t 
                JOIN areas a ON t.area_id = a.id 
                WHERE t.name LIKE ? OR a.name LIKE ? LIMIT 1
            `, [`%${q.trim()}%`, `%${q.trim()}%`], (err, row) => r(row));
        });

        if (localMatch) {
            userLat = localMatch.latitude;
            userLon = localMatch.longitude;
            displayName = localMatch.tank_name + ', ' + localMatch.area_name;
        } else {
            const geoResult = await geocodeWithFallback(q);
            if (!geoResult) return res.status(404).json({ error: 'Location not found in Tamil Nadu.' });
            userLat = geoResult.lat;
            userLon = geoResult.lon;
            displayName = geoResult.display_name;
            // Check if it's a fallback (crude check)
            if (!displayName.toLowerCase().includes(cleanAddress(q).split(',')[0])) {
                isFallback = true;
            }
        }
    } else {
        return res.status(400).json({ error: 'Query or Area ID required.' });
    }

    // Step 2: Spatial Query with Bounding Box (150km approx ~ 1.35 degrees)
    const latOffset = 1.35;
    const lonOffset = 1.35;
    const query = `
        SELECT t.id as tank_id, t.name as tank_name, t.type, t.latitude, t.longitude, t.area_id,
               a.name as area_name, tl.name as taluk_name, d.name as district_name
        FROM water_tanks t
        JOIN areas a ON t.area_id = a.id
        JOIN taluks tl ON a.taluk_id = tl.id
        JOIN districts d ON tl.district_id = d.id
        WHERE t.latitude BETWEEN ? AND ? AND t.longitude BETWEEN ? AND ?
    `;

    db.all(query, [userLat - latOffset, userLat + latOffset, userLon - lonOffset, userLon + lonOffset], async (dbErr, tanks) => {
        if (dbErr) return res.status(500).json({ error: dbErr.message });
        
        let targetTanks = tanks;
        let warningMessage = isFallback ? "Exact address not found, showing nearest known location." : null;

        if (!tanks || tanks.length === 0) {
           // If no tanks in bbox, use the nearest available source from entire DB
           warningMessage = "Using nearest available water source outside search radius.";
           targetTanks = await new Promise(r => db.all("SELECT t.id as tank_id, t.name as tank_name, t.type, t.latitude, t.longitude, t.area_id, a.name as area_name FROM water_tanks t JOIN areas a ON t.area_id = a.id", (e, rows) => r(rows || [])));
        }

        if (!targetTanks || targetTanks.length === 0) {
            return res.status(404).json({ error: 'No water tanks found in system.' });
        }

        // Calculate Haversine Distances & Rank Top 3
        targetTanks.forEach(t => t.distance = haversine(userLat, userLon, t.latitude, t.longitude));
        targetTanks.sort((a, b) => a.distance - b.distance);
        const top3Tanks = targetTanks.slice(0, 3);

        // Fetch Temporal Data
        const targetDate = date || new Date().toISOString().split('T')[0];
        
        for (let tank of top3Tanks) {
            // Find reading for specific date
            const readings = await new Promise(r => {
                const sql = `
                    SELECT * FROM water_quality 
                    WHERE tank_id = ? AND date <= ?
                    ORDER BY date DESC
                    LIMIT 1
                `;
                db.all(sql, [tank.tank_id, targetDate], (e, rows) => r(rows || []));
            });
            
            if (readings.length > 0) {
                tank.latest = readings[0];
                tank.date = tank.latest.date;
                
                // AI DECISION ENGINE
                const ph = tank.latest.ph;
                const turbidity = tank.latest.turbidity;
                if (ph < 6.5) {
                    tank.latest.status = "Unsafe";
                    tank.aiExplanation = "Unsafe due to low pH (acidic).";
                } else if (turbidity > 5) {
                    tank.latest.status = "Unsafe";
                    tank.aiExplanation = "Unsafe due to high turbidity.";
                } else {
                    tank.latest.status = "Safe";
                    tank.aiExplanation = "Water is safe for drinking.";
                }
            } else {
                tank.latest = null;
            }
        }

        const tanksWithData = top3Tanks.filter(t => t.latest !== null);

        // Filter out tanks whose data is older than targetDate, meaning out of date
        const validTanks = tanksWithData.filter(t => t.latest.date === targetDate);

        if (validTanks.length === 0) {
            return res.status(404).json({ error: 'Out of date' });
        }

        const selectedTank = validTanks[0];

        res.json({
            resolved_location: displayName,
            warning: warningMessage,
            user: { lat: userLat, lon: userLon, address: displayName },
            tank: selectedTank.tank_name,
            distance_km: parseFloat(selectedTank.distance.toFixed(2)),
            date: selectedTank.date,
            status: selectedTank.latest.status,
            ph: selectedTank.latest.ph,
            turbidity: selectedTank.latest.turbidity,
            message: selectedTank.aiExplanation,
            selectedTank: {
                id: selectedTank.tank_id,
                name: selectedTank.tank_name,
                type: selectedTank.type,
                area: selectedTank.area_name,
                lat: selectedTank.latitude,
                lon: selectedTank.longitude,
                distance_km: selectedTank.distance.toFixed(2),
                quality: selectedTank.latest,
                explanation: selectedTank.aiExplanation
            },
            alternatives: validTanks.slice(1).map(t => ({
                id: t.tank_id, 
                name: t.tank_name, 
                distance_km: t.distance.toFixed(2), 
                status: t.latest.status, 
                latitude: t.latitude, 
                longitude: t.longitude,
                explanation: t.aiExplanation
            }))
        });
    });
});

app.listen(PORT, () => {
    console.log(`Smart-City Water API running on http://localhost:${PORT}`);
});
