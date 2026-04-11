const express = require('express');
const https = require('https');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./database');
const path = require('path');
const ort = require('onnxruntime-node');

const app = express();
const PORT = 5001;
const SECRET_KEY = 'water_testing_secret_key';

app.use(cors());
app.use(bodyParser.json());

// ─── ONNX Model ─────────────────────────────────────────────
const MODEL_PATH = path.join(__dirname, 'model.onnx');
let session = null;
async function initModel() {
    try {
        session = await ort.InferenceSession.create(MODEL_PATH);
        console.log('✅ AI Model Loaded (model.onnx)');
    } catch (err) {
        console.warn('⚠️ model.onnx missing. Using rule-based fallback.');
    }
}
initModel();

// ─── Auth Middleware ─────────────────────────────────────────
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

const checkRole = (role) => (req, res, next) => {
    if (req.user.role !== role && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Access Denied: Insufficient Permissions' });
    }
    next();
};

// ─── METADATA (tanks + areas for dropdowns and mapping) ─────
app.get('/api/metadata', (req, res) => {
    db.all("SELECT * FROM tanks ORDER BY name", (err, tanks) => {
        if (err) return res.status(500).json({ error: err.message });
        db.all("SELECT a.*, t.name as tank_name FROM areas a JOIN tanks t ON a.tank_id = t.id ORDER BY a.name", (err, areas) => {
            if (err) return res.status(500).json({ error: err.message });
            db.all("SELECT DISTINCT district_en FROM tn_villages ORDER BY district_en", (err, districts) => {
                res.json({ tanks, areas, districts: districts.map(d => d.district_en) });
            });
        });
    });
});

// Get all unique districts
app.get('/api/public/districts', (req, res) => {
    db.all("SELECT DISTINCT district_en FROM tn_villages ORDER BY district_en", (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows.map(r => r.district_en));
    });
});

// Get villages for a district
app.get('/api/public/villages', (req, res) => {
    const { district, q } = req.query;
    if (!district) return res.status(400).json({ error: 'District is required' });

    // We fetch only major urban areas from the manual 'areas' table
    const query = `
        SELECT TRIM(name) as name_en, '' as name_ta, 'City' as type, '' as taluk_en 
        FROM areas 
        WHERE district = ? ${q ? 'AND name LIKE ?' : ''}
        ORDER BY name_en ASC LIMIT 50
    `;

    const params = q ? [district, `%${q}%`] : [district];

    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// ─── PUBLIC ROUTES ────────────────────────────────────────────

// All areas — returned WITH latest prediction for on-load map visualization
app.get('/api/public/all-areas', (req, res) => {
    const query = `
        SELECT 
            a.id as area_id,
            a.name as area_name,
            a.latitude,
            a.longitude,
            t.id as tank_id,
            t.name as tank_name,
            (SELECT prediction FROM water_readings wr WHERE wr.tank_id = t.id ORDER BY wr.created_at DESC LIMIT 1) as prediction,
            (SELECT created_at FROM water_readings wr WHERE wr.tank_id = t.id ORDER BY wr.created_at DESC LIMIT 1) as created_at
        FROM areas a
        JOIN tanks t ON a.tank_id = t.id
        ORDER BY a.name
    `;
    db.all(query, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// History for a specific area (via its tank)
app.get('/api/public/area/:area_id', (req, res) => {
    const query = `
        SELECT wr.*, t.name as tank_name, a.name as area_name
        FROM water_readings wr
        JOIN areas a ON a.id = ?
        JOIN tanks t ON t.id = a.tank_id
        WHERE wr.tank_id = a.tank_id
        ORDER BY wr.created_at DESC LIMIT 10
    `;
    db.all(query, [req.params.area_id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// City-level stats for chart
app.get('/api/public/city-stats', (req, res) => {
    const query = `
        SELECT t.name as location,
        COUNT(*) as total,
        SUM(CASE WHEN wr.prediction='Unsafe' THEN 1 ELSE 0 END) as unsafe
        FROM water_readings wr
        JOIN tanks t ON t.id = wr.tank_id
        GROUP BY t.id
    `;
    db.all(query, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const stats = rows.map(r => ({
            ...r,
            status: r.unsafe / r.total >= 0.3 ? 'Risky' : 'Safe'
        }));
        res.json(stats);
    });
});

// ─── OFFICIAL ROUTES ──────────────────────────────────────────

app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;
    db.get("SELECT * FROM users WHERE username = ?", [username], (err, user) => {
        if (err || !user || !bcrypt.compareSync(password, user.password)) {
            return res.status(401).json({ error: 'Auth Failed' });
        }
        const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, SECRET_KEY, { expiresIn: '8h' });
        res.json({ token, username, role: user.role });
    });
});

// Add reading — official selects AREA + TEST DATE, backend finds TANK
app.post('/api/official/add-reading', authenticateToken, checkRole('operator'), async (req, res) => {
    const { area_id, test_date, ph, hardness, solids, chloramines, sulfate, conductivity, organic_carbon, trihalomethanes, turbidity } = req.body;

    if (!area_id || [ph, hardness, solids, chloramines, sulfate, conductivity, organic_carbon, trihalomethanes, turbidity].some(v => v === undefined || v === null)) {
        return res.status(400).json({ error: 'Missing required fields.' });
    }
    // Use provided date or today
    const readingDate = test_date || new Date().toISOString().split('T')[0];

    // Step 1: Resolve area → tank
    db.get("SELECT a.*, t.name as tank_name FROM areas a JOIN tanks t ON t.id = a.tank_id WHERE a.id = ?", [area_id], async (err, area) => {
        if (err || !area) return res.status(400).json({ error: 'Invalid area_id.' });

        const tank_id = area.tank_id;

        // Step 2: Run ONNX AI on tank parameters
        let prediction = 'Safe';
        if (session) {
            try {
                const inputData = new Float32Array([ph, hardness, solids, chloramines, sulfate, conductivity, organic_carbon, trihalomethanes, turbidity]);
                const tensor = new ort.Tensor('float32', inputData, [1, 9]);
                const results = await session.run({ float_input: tensor });
                prediction = results.label.data[0] === 1 ? 'Safe' : 'Unsafe';
            } catch (err) {
                console.error('AI Prediction Error:', err);
                if (ph < 6.5 || ph > 8.5 || solids > 500) prediction = 'Unsafe';
            }
        } else {
            if (ph < 6.5 || ph > 8.5 || solids > 500) prediction = 'Unsafe';
        }

        // Borderline "Contaminated" check
        if (prediction === 'Safe' && (ph < 6.8 || ph > 8.2 || solids > 400 || turbidity > 4)) {
            prediction = 'Contaminated';
        }

        // Step 3: Store reading for TANK (with test_date)
        const insertQuery = `INSERT INTO water_readings 
            (tank_id, date, ph, hardness, solids, chloramines, sulfate, conductivity, organic_carbon, trihalomethanes, turbidity, prediction) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

        db.run(insertQuery, [tank_id, readingDate, ph, hardness, solids, chloramines, sulfate, conductivity, organic_carbon, trihalomethanes, turbidity, prediction], function(err) {
            if (err) return res.status(500).json({ error: err.message });

            const readingId = this.lastID;

            // Step 4: Agent alert logic on TANK history
            db.all(`SELECT * FROM water_readings WHERE tank_id = ? ORDER BY created_at DESC LIMIT 3`, [tank_id], (err, last3) => {
                if (err) return console.error('Agent Logic Error:', err);

                const unsafeCount = last3.filter(r => r.prediction === 'Unsafe').length;
                if (unsafeCount >= 2) {
                    db.run(`INSERT INTO alerts (tank_id, message, severity) VALUES (?, ?, ?)`,
                        [tank_id, `Unsafe trend detected for ${area.tank_name} (2 out of 3 recent tests failed).`, 'High']);
                }

                if (ph < 6.5 || ph > 8.5) {
                    db.run(`INSERT INTO alerts (tank_id, message, severity) VALUES (?, ?, ?)`,
                        [tank_id, `Critical pH level detected at ${area.tank_name}: ${ph}. Safe range is 6.5–8.5.`, 'High']);
                }

                if (last3.length > 1) {
                    const prevTurbidity = last3[1].turbidity;
                    if (prevTurbidity > 0) {
                        const increase = (turbidity - prevTurbidity) / prevTurbidity;
                        if (increase > 0.5) {
                            db.run(`INSERT INTO alerts (tank_id, message, severity) VALUES (?, ?, ?)`,
                                [tank_id, `Sudden turbidity spike at ${area.tank_name}! Increase of ${Math.round(increase * 100)}% observed.`, 'Medium']);
                        }
                    }
                }
            });

            // Step 5: Find all areas that share this tank (for affected areas display)
            db.all("SELECT name FROM areas WHERE tank_id = ?", [tank_id], (err, affectedAreas) => {
                const affectedNames = (affectedAreas || []).map(a => a.name);
                res.status(201).json({
                    id: readingId,
                    prediction,
                    tank_name: area.tank_name,
                    area_name: area.name,
                    affected_areas: affectedNames
                });
            });
        });
    });
});

// Alerts — enriched with tank name and affected areas
app.get('/api/official/alerts', authenticateToken, (req, res) => {
    const query = `
        SELECT al.*, t.name as tank_name,
            GROUP_CONCAT(a.name, ', ') as affected_areas
        FROM alerts al
        JOIN tanks t ON t.id = al.tank_id
        LEFT JOIN areas a ON a.tank_id = al.tank_id
        GROUP BY al.id
        ORDER BY al.created_at DESC LIMIT 50
    `;
    db.all(query, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Trend data per tank (for charts)
app.get('/api/public/trends/:tank_id', (req, res) => {
    const query = `SELECT * FROM water_readings WHERE tank_id = ? ORDER BY created_at DESC LIMIT 7`;
    db.all(query, [req.params.tank_id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows.reverse());
    });
});

// ─── HAVERSINE DISTANCE (km) ─────────────────────────────────
function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── GEOCODE HELPER WITH 3-LEVEL FALLBACK ────────────────────
function geocodeWithFallback(queries, optHeaders, callback, initialCount = null) {
    if (initialCount === null) initialCount = queries.length;
    const [current, ...rest] = queries;
    if (!current) return callback(null, null, null, initialCount); // all exhausted

    // Force appending Tamil Nadu if it's not present
    const qWithState = current.toLowerCase().includes('tamil nadu') ? current : current + ' Tamil Nadu';
    const encoded = encodeURIComponent(qWithState);
    const url = `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=1&countrycodes=in`;
    https.get(url, optHeaders, (geoRes) => {
        let raw = '';
        geoRes.on('data', c => raw += c);
        geoRes.on('end', () => {
            let data;
            try { data = JSON.parse(raw); } catch (e) { data = []; }
            
            // Check if it's in TN (if data exists)
            let validResult = null;
            if (data && data.length > 0) {
                 if (data[0].display_name.toLowerCase().includes('tamil nadu')) {
                     validResult = data[0];
                 }
            }

            if (validResult) {
                // Success — level is calculated against the total number of starting queries
                const fallbackLevel = initialCount - rest.length - 1;
                callback(null, validResult, current, fallbackLevel);
            } else if (rest.length > 0) {
                // Try next fallback
                geocodeWithFallback(rest, optHeaders, callback, initialCount);
            } else {
                callback(null, null, null, initialCount);
            }
        });
    }).on('error', err => callback(err));
}

// ─── AUTOCOMPLETE SUGGESTIONS endpoint ───────────────────────
app.get('/api/public/autocomplete', (req, res) => {
    const { q } = req.query;
    if (!q || q.length < 2) return res.json([]);

    // Step 1: Search local TN Villages dataset
    const localQuery = `
        SELECT village_en, taluk_en, district_en 
        FROM tn_villages 
        WHERE village_en LIKE ? OR district_en LIKE ? 
        LIMIT 10
    `;
    const searchTerm = `%${q}%`;

    db.all(localQuery, [searchTerm, searchTerm], (err, localRows) => {
        const localSuggestions = (localRows || []).map(r => ({
            display: `${r.village_en}, ${r.taluk_en}, ${r.district_en}`,
            full: `${r.village_en}, ${r.taluk_en}, ${r.district_en}, Tamil Nadu`,
            type: 'local'
        }));

        // Step 2: Fallback to Nominatim if local results are few
        if (localSuggestions.length >= 5) {
            return res.json(localSuggestions);
        }

        const encoded = encodeURIComponent(q + ' Tamil Nadu');
        const url = `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=5&countrycodes=in`;
        const opts = { headers: { 'User-Agent': 'WaterMonitorApp/1.0' } };

        https.get(url, opts, (geoRes) => {
            let raw = '';
            geoRes.on('data', c => raw += c);
            geoRes.on('end', () => {
                let data;
                try { data = JSON.parse(raw); } catch (e) { return res.json(localSuggestions); }
                const remoteSuggestions = (data || [])
                    .filter(r => r.display_name.toLowerCase().includes('tamil nadu'))
                    .map(r => ({
                        display: r.display_name.split(',').slice(0, 3).join(',').trim(),
                        full: r.display_name,
                        type: 'remote'
                    }));
                // Combine and deduplicate if necessary (for now just combine)
                res.json([...localSuggestions, ...remoteSuggestions].slice(0, 10));
            });
        }).on('error', () => res.json(localSuggestions));
    });
});

// ─── ADDRESS + DATE SEARCH → NEAREST AREA → TANK QUALITY ────
app.get('/api/public/search-address', (req, res) => {
    const { q, date } = req.query;
    if (!q) return res.status(400).json({ error: 'Query parameter q is required.' });
    if (!date) return res.status(400).json({ error: 'Query parameter date is required.' });

    // Build fallback query chain from the cleaned address
    const parts = q.split(' ').filter(Boolean);
    const fallbackQueries = [
        q,                                                    // Full: "27 Chellammal Nagar Bharathi Street Coimbatore"
        parts.slice(-3).join(' '),                           // Last 3 words: "Bharathi Street Coimbatore"
        parts.slice(-2).join(' '),                           // Last 2 words: "Street Coimbatore"
        'Coimbatore Tamil Nadu'                              // City fallback
    ].filter((v, i, arr) => arr.indexOf(v) === i);          // deduplicate

    const opts = { headers: { 'User-Agent': 'WaterMonitorApp/1.0' } };

    geocodeWithFallback(fallbackQueries, opts, (err, geoResult, usedQuery, fallbackLevel) => {
        if (err) return res.status(500).json({ error: 'Geocoding network error: ' + err.message });
        if (!geoResult) return res.status(404).json({ error: 'Address not found even after fallback. Try: "RS Puram Coimbatore".' });

        const userLat = parseFloat(geoResult.lat);
        const userLon = parseFloat(geoResult.lon);
        const displayName = geoResult.display_name;
        const usedFallback = fallbackLevel > 0;

        db.all(`
            SELECT a.id as area_id, a.name as area_name, a.latitude, a.longitude, a.tank_id,
                   t.name as tank_name
            FROM areas a JOIN tanks t ON t.id = a.tank_id ORDER BY a.name
        `, (dbErr, areas) => {
            if (dbErr) return res.status(500).json({ error: dbErr.message });

            const withDist = areas.map(area => ({
                ...area,
                distance_km: haversine(userLat, userLon, area.latitude, area.longitude)
            }));
            withDist.sort((a, b) => a.distance_km - b.distance_km);
            const nearest = withDist[0];

            db.get(`
                SELECT * FROM water_readings
                WHERE tank_id = ? AND date = ?
                ORDER BY created_at DESC LIMIT 1
            `, [nearest.tank_id, date], (err, reading) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({
                    user_lat: userLat,
                    user_lon: userLon,
                    display_name: displayName,
                    used_query: usedQuery,
                    used_fallback: usedFallback,
                    fallback_level: fallbackLevel,
                    nearest_area: {
                        ...nearest,
                        ...(reading || {}),
                        prediction: reading ? reading.prediction : null
                    },
                    distance_km: nearest.distance_km.toFixed(2),
                    reading_date: date,
                    has_data: !!reading
                });
            });
        });
    });
});

app.listen(PORT, () => {
    console.log(`Dual-Portal Server running on http://localhost:${PORT}`);
});
