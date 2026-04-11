import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap, Polyline, Marker, Circle } from 'react-leaflet';
import L from 'leaflet';
import Trends from './Trends';
import 'leaflet/dist/leaflet.css';

// Fix default marker icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Professional CSS-based User Pin (No external image dependencies)
const userIcon = L.divIcon({
    className: 'custom-user-icon',
    html: `<div class="pulse-ring"></div><div class="pin-core"></div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
});

// Professional CSS-based Tank Icon (No external image dependencies)
const tankIcon = L.divIcon({
    className: 'custom-tank-icon',
    html: `<div class="tank-core">🏭</div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
});

// Approximate centers for all 38 districts to provide a statewide map focus
const districtCenters = {
    "Ariyalur": [11.1401, 79.0786], "Chengalpattu": [12.6841, 79.9836], "Chennai": [13.0827, 80.2707],
    "Coimbatore": [11.0168, 76.9558], "Cuddalore": [11.7480, 79.7714], "Dharmapuri": [12.1273, 78.1582],
    "Dindigul": [10.3673, 77.9803], "Erode": [11.3410, 77.7172], "Kallakurichi": [11.7401, 78.9620],
    "Kancheepuram": [12.8342, 79.7036], "Kanyakumari": [8.0883, 77.5385], "Karur": [10.9601, 78.0766],
    "Krishnagiri": [12.5186, 78.2137], "Madurai": [9.9252, 78.1198], "Nagapattinam": [10.7672, 79.8444],
    "Namakkal": [11.2189, 78.1672], "Perambalur": [11.2342, 78.8820], "Pudukkottai": [10.3833, 78.8167],
    "Ramanathapuram": [9.3639, 78.8394], "Ranipet": [12.9272, 79.3333], "Salem": [11.6643, 78.1460],
    "Sivagangai": [9.8517, 78.4817], "Tenkasi": [8.9595, 77.3100], "Thanjavur": [10.7870, 79.1378],
    "The Nilgiris": [11.4100, 76.6900], "Theni": [10.0104, 77.4768], "Thiruchirappalli": [10.8505, 78.6900],
    "Thiruvarur": [10.7733, 79.6333], "Thoothukkudi": [8.7642, 78.1348], "Tirunelveli": [8.7139, 77.7567],
    "Tirupathur": [12.4925, 78.5678], "Tiruppur": [11.1085, 77.3411], "Tiruvallur": [13.1367, 79.9100],
    "Tiruvannamalai": [12.2253, 79.0747], "Vellore": [12.9165, 79.1325], "Villuppuram": [11.9401, 79.4861],
    "Virudhunagar": [9.5872, 77.9514], "Mayiladuthurai": [11.1017, 79.6521]
};

// Fly map to center
function FlyToArea({ center, zoom }) {
    const map = useMap();
    useEffect(() => {
        if (center) {
            map.flyTo(center, zoom || 13, { duration: 1.4 });
        }
    }, [center, zoom, map]);
    return null;
}

function PublicView() {
    const [allAreas, setAllAreas] = useState([]);
    const [allTanks, setAllTanks] = useState([]);
    const [selectedArea, setSelectedArea] = useState(null);
    const [flyTarget, setFlyTarget] = useState(null);
    const [flyZoom, setFlyZoom] = useState(13);
    const [loading, setLoading] = useState(true);

    // Hierarchical Selection state
    const [districts, setDistricts] = useState([]);
    const [selectedDistrict, setSelectedDistrict] = useState('');
    const [villages, setVillages] = useState([]);
    const [selectedVillage, setSelectedVillage] = useState(null);
    const [villageSearch, setVillageSearch] = useState('');
    const [houseAddress, setHouseAddress] = useState('');

    const [addressQuery, setAddressQuery] = useState('');
    const [searchDate, setSearchDate] = useState(new Date().toISOString().split('T')[0]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [searchResult, setSearchResult] = useState(null);
    const [searchError, setSearchError] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [suggestLoading, setSuggestLoading] = useState(false);
    const suggestTimer = React.useRef(null);
    const villageDropdownRef = React.useRef(null);
    const [villageSuggestionsOpen, setVillageSuggestionsOpen] = useState(false);

    const navigate = useNavigate();

    useEffect(() => { 
        fetchAreas(); 
        fetchDistricts();
    }, []);

    useEffect(() => {
        function handleClickOutside(event) {
            if (villageDropdownRef.current && !villageDropdownRef.current.contains(event.target)) {
                setVillageSuggestionsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const fetchDistricts = async () => {
        try {
            const res = await fetch('http://localhost:5001/api/public/districts');
            const data = await res.json();
            setDistricts(data);
        } catch (err) { console.error('District fetch error:', err); }
    };

    const handleDistrictChange = async (d) => {
        setSelectedDistrict(d);
        setSelectedVillage(null);
        setVillageSearch('');
        setVillages([]);
        
        // Fly map to district center
        if (d && districtCenters[d]) {
            setFlyTarget(districtCenters[d]);
            setFlyZoom(10);
        }

        if (d) {
            try {
                const res = await fetch(`http://localhost:5001/api/public/villages?district=${encodeURIComponent(d)}`);
                const data = await res.json();
                setVillages(data);
            } catch (err) { console.error('Village fetch error:', err); }
        }
    };

    const fetchAreas = async () => {
        setLoading(true);
        try {
            // Fetch areas with latest prediction
            const areaRes = await fetch('http://localhost:5001/api/public/all-areas');
            const areaData = await areaRes.json();
            setAllAreas(areaData);

            // Fetch tanks for map markers
            const metaRes = await fetch('http://localhost:5001/api/metadata');
            const metaData = await metaRes.json();
            setAllTanks(metaData.tanks || []);
        } catch (err) { 
            console.error('Fetch error:', err); 
        } finally { 
            setLoading(false); 
        }
    };

    // Clean address: remove extra commas/spaces, normalize
    const cleanAddress = (raw) => {
        return raw
            .replace(/,+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    };

    // Debounced autocomplete
    const handleAddressChange = (val) => {
        setAddressQuery(val);
        setShowSuggestions(true);
        setSuggestions([]);
        if (suggestTimer.current) clearTimeout(suggestTimer.current);
        if (val.trim().length < 3) { setShowSuggestions(false); return; }
        setSuggestLoading(true);
        suggestTimer.current = setTimeout(async () => {
            try {
                const res = await fetch(`http://localhost:5001/api/public/autocomplete?q=${encodeURIComponent(cleanAddress(val))}`);
                const data = await res.json();
                setSuggestions(data || []);
                setShowSuggestions(true);
            } catch { setSuggestions([]); }
            finally { setSuggestLoading(false); }
        }, 500); // 500ms debounce
    };

    const selectSuggestion = (s) => {
        setAddressQuery(s.display);
        setShowSuggestions(false);
        setSuggestions([]);
    };

    const handleAddressSearch = async (e) => {
        if (e) e.preventDefault();
        
        let queryStr = "";
        if (selectedVillage && selectedDistrict) {
            queryStr = `${houseAddress ? houseAddress + ', ' : ''}${selectedVillage.name_en}, ${selectedDistrict}, Tamil Nadu`;
        } else {
            queryStr = cleanAddress(addressQuery);
        }

        if (!queryStr || !searchDate) return;
        
        setSearchLoading(true);
        setSearchResult(null);
        setSearchError('');
        setShowSuggestions(false);
        setVillageSuggestionsOpen(false);

        try {
            const res = await fetch(
                `http://localhost:5001/api/public/search-address?q=${encodeURIComponent(queryStr)}&date=${searchDate}`
            );
            const data = await res.json();
            if (!res.ok) {
                setSearchError(data.error || 'Location details not found.');
            } else {
                setSearchResult(data);
                const midLat = (data.user_lat + data.nearest_area.latitude) / 2;
                const midLon = (data.user_lon + data.nearest_area.longitude) / 2;
                setFlyTarget([midLat, midLon]);
                setFlyZoom(11);
                setSelectedArea({ ...data.nearest_area });
            }
        } catch (err) {
            setSearchError('Network error. Please check your connection.');
        } finally {
            setSearchLoading(false);
        }
    };

    const getStatusColor = (status) => {
        if (status === 'Safe') return '#10b981';
        if (status === 'Contaminated') return '#f59e0b';
        if (status === 'Unsafe') return '#f43f5e';
        return '#64748b';
    };

    const getStatusLabel = (status) => {
        if (status === 'Safe') return { emoji: '✅', text: 'Safe', cls: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30' };
        if (status === 'Contaminated') return { emoji: '⚠️', text: 'Contaminated', cls: 'text-amber-400 bg-amber-500/15 border-amber-500/30' };
        if (status === 'Unsafe') return { emoji: '❌', text: 'Unsafe', cls: 'text-rose-400 bg-rose-500/15 border-rose-500/30' };
        return { emoji: '❓', text: 'No Data', cls: 'text-slate-400 bg-slate-500/15 border-slate-500/30' };
    };

    const getReason = (area) => {
        if (!area || (!area.ph && !area.prediction)) return 'No testing parameters recorded for this period.';
        if (!area.prediction && !area.ph) return 'Pending laboratory analysis.';
        
        const reasons = [];
        if (area.ph && (area.ph < 6.5 || area.ph > 8.5)) reasons.push(`Critical pH (${parseFloat(area.ph).toFixed(2)})`);
        if (area.turbidity && area.turbidity > 4) reasons.push(`High Turbidity (${parseFloat(area.turbidity).toFixed(2)} NTU)`);
        if (area.solids && area.solids > 400) reasons.push(`High Solids (${parseFloat(area.solids).toFixed(0)} mg/L)`);
        
        if (reasons.length > 0) return reasons.join(', ');
        if (area.prediction === 'Safe') return 'Within normal safety parameters.';
        if (area.prediction === 'Contaminated') return 'Potential contamination detected — use with caution.';
        return 'Data analysis in progress.';
    };

    const handleAreaClick = (area) => {
        setSelectedArea(area);
        setSearchResult(null);
        setFlyTarget([area.latitude, area.longitude]);
        setFlyZoom(14);
    };

    const safeCount = allAreas.filter(a => a.prediction === 'Safe').length;
    const unsafeCount = allAreas.filter(a => a.prediction === 'Unsafe').length;
    const contaminatedCount = allAreas.filter(a => a.prediction === 'Contaminated').length;
    const noDataCount = allAreas.filter(a => !a.prediction).length;
    const mapCenter = [11.1271, 78.6569]; // Central Tamil Nadu focus

    return (
        <div className="min-h-screen bg-slate-900 text-slate-100 font-sans">
            {/* NAV */}
            <nav className="flex justify-between items-center px-4 md:px-8 py-4 bg-slate-900/90 backdrop-blur-md sticky top-0 z-[1000] border-b border-slate-800 animate-fade-in-up">
                <div className="flex items-center gap-3">
                    <span className="text-2xl drop-shadow-[0_0_10px_rgba(34,211,238,0.5)] inline-block animate-float">🌍</span>
                    <h1 className="text-lg md:text-xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                        Smart Water Monitor
                    </h1>
                </div>
                <div className="flex items-center gap-3">
                    <div className="hidden md:flex items-center gap-2 text-xs font-semibold">
                        <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">✅ {safeCount} Safe</span>
                        <span className="px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">⚠️ {contaminatedCount} Contaminated</span>
                        <span className="px-2.5 py-1 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30">❌ {unsafeCount} Unsafe</span>
                        {noDataCount > 0 && <span className="px-2.5 py-1 rounded-full bg-slate-500/15 text-slate-400 border border-slate-500/30">❓ {noDataCount} No Data</span>}
                    </div>
                </div>
            </nav>

            {/* HERO */}
            <header className="relative py-10 px-4 overflow-hidden flex flex-col items-center text-center animate-fade-in-up">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl h-40 bg-cyan-500/15 rounded-[100%] blur-[80px] pointer-events-none"></div>
                <h2 className="text-4xl md:text-5xl font-bold bg-gradient-to-br from-cyan-300 to-blue-500 bg-clip-text text-transparent mb-3">
                    Water Safety Map
                </h2>
                <p className="text-slate-400 max-w-xl text-base">
                    Enter your home address to find your water source, or click any area on the map.
                </p>
            </header>

            <div className="max-w-7xl mx-auto px-4 pb-20 space-y-6">

                {/* ── ADDRESS SEARCH BAR ─────────────────────────────────── */}
                <div className="relative z-[900] bg-slate-800/40 backdrop-blur-xl border border-white/10 rounded-[2rem] p-6 md:p-8 shadow-[0_8px_32px_rgba(0,0,0,0.4)] animate-fade-in-up-delay-1">
                    <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
                        <span className="text-2xl">🏠</span> Check Water Quality by Location
                    </h2>
                    <form onSubmit={handleAddressSearch} className="flex flex-col gap-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                            {/* District Select */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase px-1">1. Select District</label>
                                <select 
                                    className="w-full bg-slate-900/50 border border-slate-700/50 hover:bg-slate-900 hover:border-slate-500 focus:border-cyan-400 text-slate-200 rounded-2xl px-5 py-3.5 focus:outline-none focus:ring-4 focus:ring-cyan-500/20 transition-all duration-300 text-sm appearance-none cursor-pointer hover:shadow-lg focus:-translate-y-0.5"
                                    value={selectedDistrict}
                                    onChange={(e) => handleDistrictChange(e.target.value)}
                                >
                                    <option value="">Choose District...</option>
                                    {districts.map(d => <option key={d} value={d}>{d}</option>)}
                                </select>
                            </div>

                            {/* Area Select (Autocomplete style) */}
                            <div className="space-y-2 relative" ref={villageDropdownRef}>
                                <label className="text-xs font-bold text-slate-500 uppercase px-1">2. Select City or Town</label>
                                <input
                                    type="text"
                                    disabled={!selectedDistrict}
                                    className="w-full bg-slate-900/50 border border-slate-700/50 hover:bg-slate-900 hover:border-slate-500 focus:border-cyan-400 text-slate-200 rounded-2xl px-5 py-3.5 focus:outline-none focus:ring-4 focus:ring-cyan-500/20 transition-all duration-300 placeholder-slate-500 text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg focus:-translate-y-0.5"
                                    placeholder={selectedDistrict ? "Search City or Town (e.g. Pollachi)..." : "Select district first"}
                                    value={selectedVillage ? (selectedVillage.name_en || selectedVillage.village_en || selectedVillage.area_name) : villageSearch}
                                    onChange={(e) => {
                                        setVillageSearch(e.target.value);
                                        setSelectedVillage(null);
                                        setVillageSuggestionsOpen(true);
                                    }}
                                    onFocus={() => selectedDistrict && setVillageSuggestionsOpen(true)}
                                />
                                {villageSuggestionsOpen && !selectedVillage && selectedDistrict && (
                                    <div className="absolute top-full left-0 w-full mt-2 bg-slate-800 border border-slate-700 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] z-[2000] overflow-hidden backdrop-blur-xl max-h-60 overflow-y-auto animate-pop-in origin-top">
                                        {villages
                                            .filter(v => ((v.name_en || v.village_en || v.area_name || '')).toLowerCase().includes(villageSearch.toLowerCase()))
                                            .slice(0, 50)
                                            .map((v, idx) => (
                                                <div 
                                                    key={idx}
                                                    className="px-5 py-3 hover:bg-slate-700/50 cursor-pointer text-sm text-slate-200 border-b border-slate-700/50 last:border-0 transition-colors"
                                                    onClick={() => {
                                                        setSelectedVillage(v);
                                                        const name = v.name_en || v.village_en || v.area_name;
                                                        const ta = v.name_ta || v.village_ta || '';
                                                        setVillageSearch(`${name} ${ta ? '(' + ta + ')' : ''}`);
                                                        setVillageSuggestionsOpen(false);
                                                    }}
                                                >
                                                    <div className="flex justify-between items-center">
                                                        <div>
                                                            <span className="text-lg mr-2">{v.type === 'City' ? '🏙️' : '🏘️'}</span>
                                                            <span className="font-semibold">{v.name_en || v.village_en || v.area_name}</span>
                                                            <span className="text-cyan-400 font-bold ml-2">({v.name_ta || v.village_ta || ''})</span>
                                                        </div>
                                                        <div className="flex flex-col items-end">
                                                            <span className="text-[9px] uppercase font-black px-2 py-0.5 rounded-md mb-1 bg-cyan-500/20 text-cyan-400">
                                                                CITY / TOWN
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                    </div>
                                )}
                            </div>

                            {/* Date Select */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase px-1">3. Test Date</label>
                                <input
                                    type="date"
                                    className="w-full bg-slate-900/50 border border-slate-700/50 hover:bg-slate-900 hover:border-slate-500 focus:border-cyan-400 text-slate-200 rounded-2xl px-5 py-3.5 focus:outline-none focus:ring-4 focus:ring-cyan-500/20 transition-all duration-300 text-sm hover:shadow-lg focus:-translate-y-0.5"
                                    value={searchDate}
                                    onChange={e => setSearchDate(e.target.value)}
                                    required
                                />
                            </div>

                            {/* House Address Input */}
                            <div className="space-y-2 lg:col-span-3">
                                <label className="text-xs font-bold text-slate-500 uppercase px-1">4. Specific House Address / Street (Optional)</label>
                                <input
                                    type="text"
                                    className="w-full bg-slate-900/50 border border-slate-700/50 hover:bg-slate-900 hover:border-slate-500 focus:border-cyan-400 text-slate-200 rounded-2xl px-5 py-3.5 focus:outline-none focus:ring-4 focus:ring-cyan-500/20 transition-all duration-300 placeholder-slate-500 text-sm hover:shadow-lg focus:-translate-y-0.5"
                                    placeholder='e.g. "No 42, Pillaiyar Koil Street"'
                                    value={houseAddress}
                                    onChange={e => setHouseAddress(e.target.value)}
                                />
                            </div>

                            {/* Submit */}
                            <div className="lg:col-span-1">
                                <button
                                    type="submit"
                                    disabled={searchLoading || !selectedDistrict || (!selectedVillage && !villageSearch)}
                                    className="w-full px-6 py-3.5 bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500 hover:from-cyan-400 hover:via-blue-400 hover:to-indigo-400 disabled:opacity-60 text-white font-black rounded-2xl shadow-[0_0_20px_rgba(34,211,238,0.3)] hover:shadow-[0_0_30px_rgba(34,211,238,0.5)] transition-all duration-300 hover:-translate-y-1 active:scale-[0.98] whitespace-nowrap text-sm tracking-wide"
                                >
                                    {searchLoading ? '🔍 Fetching Data...' : '🔍 Check Water Status'}
                                </button>
                            </div>
                        </div>

                        {/* Optional Manual Fallback Toggle */}
                        <div className="text-center mt-2">
                            <button 
                                type="button"
                                onClick={() => {
                                    setSelectedDistrict('');
                                    setSelectedVillage(null);
                                    setVillageSearch('');
                                    setHouseAddress('');
                                    setAddressQuery('');
                                    setShowSuggestions(false);
                                }}
                                className="text-[10px] text-slate-500 hover:text-cyan-400 transition-colors uppercase tracking-widest font-bold"
                            >
                                — Reset Selection —
                            </button>
                        </div>
                    </form>

                    {/* Fallback Warning Banner */}
                    {searchResult && searchResult.used_fallback && (
                        <div className="mt-4 px-4 py-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                            <span className="text-lg">⚠️</span>
                            <div>
                                <strong>Approximate Location:</strong> We couldn't find the exact address, so we are showing the nearest matched area for 
                                <span className="text-cyan-300 mx-1 italic">"{searchResult.used_query}"</span>
                            </div>
                        </div>
                    )}

                    {/* Search Error */}
                    {searchError && (
                        <div className="mt-4 px-4 py-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
                            ⚠️ {searchError}
                        </div>
                    )}

                    {/* No Data for that date */}
                    {searchResult && !searchResult.has_data && (
                        <div className="mt-4 px-4 py-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm">
                            📅 No water test data found for <strong>{searchResult.nearest_area.area_name}</strong> ({searchResult.nearest_area.tank_name}) on <strong>{searchResult.reading_date}</strong>.
                            <span className="text-slate-400 ml-2">Please ask the water authority to test this area.</span>
                        </div>
                    )}

                    {/* Search Result Banner - GLASSHMORPHISM */}
                    {searchResult && searchResult.has_data && (
                        <div className={`mt-4 p-6 rounded-3xl border glass-card animate-in zoom-in duration-500 ${getStatusLabel(searchResult.nearest_area.prediction).cls.replace('bg-', 'bg-opacity-10 bg-')}`}>
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-slate-400 font-bold">
                                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
                                        Live Status Verified
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <h3 className="text-2xl font-black text-white">{searchResult.nearest_area.area_name}</h3>
                                        <span className="text-slate-500 text-sm font-medium">({searchResult.distance_km} km away)</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-slate-300">
                                        <span className="px-2 py-0.5 bg-slate-800 rounded text-[10px] text-cyan-400 font-bold italic">SOURCE 🏭</span>
                                        {searchResult.nearest_area.tank_name}
                                    </div>
                                </div>
                                <div className="flex flex-col items-start md:items-end gap-2">
                                    <div className={`text-3xl font-black px-6 py-2.5 rounded-2xl border shadow-xl ${getStatusLabel(searchResult.nearest_area.prediction).cls}`}>
                                        {getStatusLabel(searchResult.nearest_area.prediction).emoji} {getStatusLabel(searchResult.nearest_area.prediction).text}
                                    </div>
                                    {searchResult.nearest_area.prediction && searchResult.nearest_area.prediction !== 'Safe' && (
                                        <div className="text-sm font-semibold text-rose-300/90 italic flex items-center gap-2">
                                            <span>⚠️</span> {getReason(searchResult.nearest_area)}
                                        </div>
                                    )}
                                </div>
                            </div>
                            
                            {/* Detailed Parameters with Mini Graphs feel */}
                            {searchResult.nearest_area.ph && (
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-white/5">
                                    {[
                                        { label: 'pH BALANCE', value: parseFloat(searchResult.nearest_area.ph).toFixed(2), safe: searchResult.nearest_area.ph >= 6.5 && searchResult.nearest_area.ph <= 8.5, unit: 'pH' },
                                        { label: 'TURBIDITY', value: parseFloat(searchResult.nearest_area.turbidity).toFixed(2), safe: searchResult.nearest_area.turbidity <= 4, unit: 'NTU' },
                                        { label: 'DISSOLVED SOLIDS', value: parseFloat(searchResult.nearest_area.solids).toFixed(0), safe: searchResult.nearest_area.solids <= 400, unit: 'mg/L' },
                                        { label: 'TOTAL HARDNESS', value: parseFloat(searchResult.nearest_area.hardness).toFixed(0), safe: true, unit: 'mg/L' },
                                    ].map(p => (
                                        <div key={p.label} className={`p-4 rounded-2xl bg-black/20 border ${p.safe ? 'border-white/5' : 'border-rose-500/20 bg-rose-500/5'}`}>
                                            <span className="block text-[9px] font-black tracking-widest text-slate-500 mb-2">{p.label}</span>
                                            <div className="flex items-baseline gap-1">
                                                <span className={`text-xl font-bold ${p.safe ? 'text-white' : 'text-rose-400'}`}>{p.value}</span>
                                                <span className="text-[10px] text-slate-500 font-medium">{p.unit}</span>
                                            </div>
                                            <div className="mt-2 w-full bg-slate-800 h-1 rounded-full overflow-hidden">
                                                <div className={`h-full ${p.safe ? 'bg-cyan-500/50' : 'bg-rose-500/50'}`} style={{ width: p.safe ? '70%' : '95%' }}></div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* ── MAP + SIDEBAR ──────────────────────────────────────── */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in-up-delay-2">

                    {/* MAP - 8 cols */}
                    <div className="lg:col-span-8">
                        <div className="rounded-3xl overflow-hidden border border-slate-700/50 shadow-2xl" style={{ height: '520px' }}>
                            {loading ? (
                                <div className="flex items-center justify-center h-full bg-slate-800 text-slate-400 animate-pulse text-lg">
                                    🗺️ Loading Map...
                                </div>
                            ) : (
                                <MapContainer 
                                    center={mapCenter} 
                                    zoom={7} 
                                    style={{ height: '100%', width: '100%' }} 
                                    zoomControl={true}
                                    minZoom={6}
                                    maxBounds={[[8.0, 76.0], [13.6, 80.4]]}
                                    maxBoundsViscosity={1.0}
                                >
                                    <TileLayer
                                        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                                        attribution='&copy; <a href="https://carto.com/">CARTO</a>'
                                    />
                                    {flyTarget && <FlyToArea center={flyTarget} zoom={flyZoom} />}

                                    {/* User location pin from address search */}
                                    {searchResult && (
                                        <>
                                            <Marker
                                                position={[searchResult.user_lat, searchResult.user_lon]}
                                                icon={userIcon}
                                            >
                                                <Popup closeButton={false}>
                                                    <div style={{ background: 'rgba(15,23,42,0.95)', borderRadius: '10px', padding: '10px 14px', color: '#f1f5f9', fontFamily: 'sans-serif', fontSize: '13px', border: '1px solid #0ea5e955' }}>
                                                        <strong>📍 Your Location</strong><br />
                                                        <span style={{ color: '#94a3b8', fontSize: '11px' }}>{searchResult.display_name.split(',').slice(0, 2).join(',')}</span>
                                                    </div>
                                                </Popup>
                                            </Marker>

                                            {/* Dotted line: user → nearest area */}
                                            <Polyline
                                                positions={[
                                                    [searchResult.user_lat, searchResult.user_lon],
                                                    [searchResult.nearest_area.latitude, searchResult.nearest_area.longitude]
                                                ]}
                                                pathOptions={{ color: '#22d3ee', weight: 2.5, dashArray: '8 6', opacity: 0.8 }}
                                            />
                                        </>
                                    )}

                                    {/* Tank (Water Source) Markers & Supply Zones */}
                                    {allTanks.map(tank => {
                                        const isSupplyingActive = searchResult?.nearest_area?.tank_id === tank.id || selectedArea?.tank_id === tank.id;
                                        
                                        return (
                                            <React.Fragment key={`tank-group-${tank.id}`}>
                                                {/* Translucent Supply Zone */}
                                                <Circle
                                                    center={[tank.latitude, tank.longitude]}
                                                    radius={isSupplyingActive ? 3000 : 2500} // Expand slightly if active
                                                    pathOptions={{
                                                        color: isSupplyingActive ? '#fff' : '#22d3ee',
                                                        fillColor: isSupplyingActive ? '#fff' : '#22d3ee',
                                                        fillOpacity: isSupplyingActive ? 0.15 : 0.04,
                                                        weight: isSupplyingActive ? 2 : 1,
                                                        dashArray: isSupplyingActive ? '0' : '10, 10'
                                                    }}
                                                />
                                                <Marker 
                                                    position={[tank.latitude, tank.longitude]} 
                                                    icon={L.divIcon({
                                                        className: `custom-tank-icon ${isSupplyingActive ? 'pulse-active' : ''}`,
                                                        html: `<div class="tank-core ${isSupplyingActive ? 'bg-cyan-400 text-slate-900 border-white border-2 scale-125' : ''}">🏭</div>`,
                                                        iconSize: [40, 40],
                                                        iconAnchor: [20, 20],
                                                    })}
                                                >
                                                    <Popup closeButton={false}>
                                                        <div style={{ background: 'rgba(15,23,42,0.95)', borderRadius: '12px', padding: '12px 16px', color: '#f1f5f9', border: isSupplyingActive ? '2px solid #fff' : '1px solid #22d3ee' }}>
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <span className="text-xl">🏭</span>
                                                                <strong>{tank.name}</strong>
                                                            </div>
                                                            <div className="text-xs text-cyan-400 font-bold uppercase tracking-wider">
                                                                {isSupplyingActive ? '⭐ Active Supply Source' : 'Main Water Source'}
                                                            </div>
                                                            <div className="text-[10px] text-slate-500 mt-2 italic">Supplies nearby consumption areas within 3km radius</div>
                                                        </div>
                                                    </Popup>
                                                </Marker>
                                            </React.Fragment>
                                        );
                                    })}

                                    {/* Area markers — Neutral slate by default, reveals color on search */}
                                    {allAreas.map((area) => {
                                        const isSearched = searchResult?.has_data && searchResult.nearest_area?.area_id === area.area_id;
                                        const isSelected = !isSearched && selectedArea?.area_id === area.area_id;
                                        
                                        // Privacy Mode: Only show status color for searched/selected areas
                                        const color = (isSearched || isSelected)
                                            ? getStatusColor(isSearched ? searchResult.nearest_area.prediction : area.prediction)
                                            : '#475569'; // slate neutral
                                        
                                        return (
                                            <CircleMarker
                                                key={area.area_id}
                                                center={[area.latitude, area.longitude]}
                                                radius={isSearched ? 22 : isSelected ? 20 : 16}
                                                className={isSearched ? 'searched-marker' : ''}
                                                pathOptions={{
                                                    color: isSearched ? '#fff' : color,
                                                    fillColor: color,
                                                    fillOpacity: isSearched ? 0.95 : isSelected ? 0.35 : 0.25,
                                                    weight: isSearched ? 4 : 2,
                                                }}
                                                eventHandlers={{ click: () => handleAreaClick(area) }}
                                            >
                                                <Popup closeButton={false} className="water-popup">
                                                    <div style={{
                                                        background: 'rgba(15,23,42,0.96)', borderRadius: '14px', padding: '14px 18px',
                                                        border: `1.5px solid ${color}55`, minWidth: '210px', color: '#f1f5f9',
                                                        fontFamily: 'sans-serif', fontSize: '13px'
                                                    }}>
                                                        <div style={{ fontWeight: 'bold', fontSize: '15px', marginBottom: '8px' }}>📍 {area.area_name}</div>
                                                        <div style={{ color: '#94a3b8', marginBottom: '4px' }}>
                                                            🏭 Supplied by: <span style={{ color: '#67e8f9', fontWeight: '600' }}>{area.tank_name}</span>
                                                        </div>
                                                        <div style={{ marginTop: '6px' }}>
                                                            Status: <span style={{ color, fontWeight: 'bold' }}>
                                                                {area.prediction ? `${getStatusLabel(area.prediction).emoji} ${area.prediction}` : '❓ No Data Yet'}
                                                            </span>
                                                        </div>
                                                        {area.prediction && area.prediction !== 'Safe' && (
                                                            <div style={{ color: '#fca5a5', marginTop: '4px', fontSize: '12px' }}>
                                                                Reason: {getReason(area)}
                                                            </div>
                                                        )}
                                                        <div style={{ color: '#475569', marginTop: '8px', fontSize: '11px' }}>
                                                            {area.created_at ? new Date(area.created_at).toLocaleString() : 'No readings yet'}
                                                        </div>
                                                    </div>
                                                </Popup>
                                            </CircleMarker>
                                        );
                                    })}
                                </MapContainer>
                            )}
                        </div>
                        {/* Legend */}
                        <div className="flex items-center gap-6 mt-3 px-2 text-sm text-slate-400">
                            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-emerald-500 block"></span>Safe</div>
                            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-amber-500 block"></span>Contaminated</div>
                            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-rose-500 block"></span>Unsafe</div>
                            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-slate-500 block"></span>No Data</div>
                            <div className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full bg-cyan-400 block border border-cyan-400"></span>
                                <span className="text-cyan-300 font-bold">Tanks (Source)</span>
                            </div>
                            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full border-2 border-white block"></span>Searched</div>
                        </div>
                    </div>

                    {/* AREA LIST - 4 cols */}
                    <div className="lg:col-span-4 flex flex-col gap-4">
                        <div className="bg-slate-800/40 backdrop-blur border border-slate-700/50 rounded-3xl p-5 shadow-2xl overflow-y-auto" style={{ maxHeight: '520px' }}>
                            <h3 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
                                <span className="text-cyan-400">📡</span> All Areas
                            </h3>
                            <div className="space-y-6">
                                {Object.entries(
                                    allAreas
                                        .filter(a => !selectedDistrict || a.tank_name.includes(`(${selectedDistrict})`))
                                        .reduce((acc, area) => {
                                            const district = area.tank_name.match(/\((.*?)\)/)?.[1] || 'Other';
                                            if (!acc[district]) acc[district] = [];
                                            acc[district].push(area);
                                            return acc;
                                        }, {})
                                ).map(([district, areas]) => (
                                    <div key={district} className="space-y-2">
                                        <h4 className="text-[10px] uppercase tracking-widest text-slate-500 font-black px-2 mb-2 flex items-center gap-2">
                                            <span className="w-1 h-1 rounded-full bg-cyan-500/50"></span>
                                            {district} District
                                        </h4>
                                        {areas.map((area) => {
                                            const isSelected = selectedArea?.area_id === area.area_id;
                                            const isSearched = searchResult?.has_data && searchResult?.nearest_area?.area_id === area.area_id;
                                            const showStatus = isSearched || isSelected;
                                            const statusToUse = isSearched ? searchResult.nearest_area.prediction : area.prediction;
                                            const sl = (showStatus && statusToUse)
                                                ? getStatusLabel(statusToUse)
                                                : { emoji: '○', text: 'Encrypted', cls: 'text-slate-500 bg-slate-800/40 border-slate-700/50' };
                                            
                                            return (
                                                <button
                                                    key={area.area_id}
                                                    onClick={() => handleAreaClick(area)}
                                                    className={`w-full text-left p-3.5 rounded-2xl border transition-all hover:-translate-y-0.5 ${
                                                        isSearched
                                                            ? 'bg-cyan-500/10 border-cyan-500/50 shadow-[0_0_20px_rgba(34,211,238,0.1)]'
                                                            : isSelected
                                                                ? 'bg-slate-700/30 border-cyan-500/30'
                                                                : 'bg-slate-900/10 border-slate-800/50 opacity-60 hover:opacity-100 hover:border-slate-700'
                                                    }`}
                                                >
                                                    <div className="flex justify-between items-center">
                                                        <div>
                                                            <p className={`font-semibold text-sm ${isSearched ? 'text-cyan-300' : isSelected ? 'text-cyan-200' : 'text-slate-300'}`}>
                                                                {isSearched && '🏠 '}{area.area_name}
                                                            </p>
                                                            <p className="text-[10px] text-slate-500 mt-0.5 italic">Source: {area.tank_name.split(' (')[0]}</p>
                                                        </div>
                                                        <span className={`text-[9px] px-2 py-0.5 rounded-full border font-bold uppercase tracking-tight ${sl.cls}`}>
                                                            {sl.emoji} {sl.text}
                                                        </span>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── SELECTED AREA DETAIL PANEL ─────────────────────────── */}
                {selectedArea && (
                    <div className="bg-slate-800/40 backdrop-blur border border-slate-700/50 rounded-3xl p-6 md:p-8 shadow-2xl space-y-6">
                        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                            <div>
                                <h2 className="text-2xl font-bold text-slate-100">📍 {selectedArea.area_name}</h2>
                                <p className="text-slate-400 mt-1">
                                    Supplied by: <span className="text-cyan-400 font-semibold">🏭 {selectedArea.tank_name}</span>
                                </p>
                            </div>
                            {(() => {
                                const sl = getStatusLabel(selectedArea.prediction);
                                return (
                                    <span className={`px-6 py-2.5 rounded-2xl text-lg font-bold border ${sl.cls}`}>
                                        {sl.emoji} Water Status: {sl.text}
                                    </span>
                                );
                            })()}
                        </div>

                        {!selectedArea.prediction && (
                            <div className="bg-slate-900/60 border border-slate-700 rounded-3xl p-10 text-center space-y-4">
                                <div className="text-5xl">📡</div>
                                <h3 className="text-xl font-bold text-slate-300">No Sample Record Available</h3>
                                <p className="text-slate-500 max-w-md mx-auto text-sm">
                                    There are no water quality testing results recorded for <span className="text-cyan-400 font-bold">{selectedArea.area_name}</span> on the selected date. 
                                    Testing might be scheduled for a later date or records are being digitized.
                                </p>
                                <div className="inline-block px-4 py-2 bg-slate-800 rounded-full text-[10px] text-slate-400 uppercase tracking-widest font-black">
                                    Check another date or location
                                </div>
                            </div>
                        )}

                        {selectedArea.prediction && selectedArea.prediction !== 'Safe' && (
                            <div className="px-5 py-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm">
                                <strong>⚠️ Reason:</strong> {getReason(selectedArea)}
                            </div>
                        )}

                        {selectedArea.ph && (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {[
                                    { label: 'pH Level', value: parseFloat(selectedArea.ph).toFixed(2), safe: selectedArea.ph >= 6.5 && selectedArea.ph <= 8.5 },
                                    { label: 'Turbidity', value: `${parseFloat(selectedArea.turbidity).toFixed(2)} NTU`, safe: selectedArea.turbidity <= 4 },
                                    { label: 'Solids', value: `${parseFloat(selectedArea.solids).toFixed(1)} mg/L`, safe: selectedArea.solids <= 400 },
                                    { label: 'Hardness', value: `${parseFloat(selectedArea.hardness).toFixed(1)} mg/L`, safe: true },
                                ].map(param => (
                                    <div key={param.label} className={`bg-slate-900/60 p-4 rounded-2xl border ${param.safe ? 'border-slate-700/50' : 'border-rose-500/30 bg-rose-500/5'}`}>
                                        <span className="block text-xs text-slate-400 mb-1">{param.label}</span>
                                        <span className={`font-mono text-xl font-bold ${param.safe ? 'text-slate-200' : 'text-rose-400'}`}>{param.value}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="bg-slate-900/50 p-5 rounded-2xl border border-slate-700/50">
                            <h3 className="text-slate-300 font-semibold mb-4 flex items-center gap-2">
                                <span className="text-cyan-400">📊</span> 7-Day Tank Trend ({selectedArea.tank_name})
                            </h3>
                            <Trends tankId={selectedArea.tank_id} />
                        </div>

                        <div className="text-xs text-slate-600 text-right font-mono">
                            Last updated: {selectedArea.created_at ? new Date(selectedArea.created_at).toLocaleString() : 'N/A'}
                        </div>
                    </div>
                )}
            </div>

            {/* Style Injections for Professional Polish */}
            <style>{`
                .leaflet-popup-content-wrapper, .leaflet-popup-tip { background: transparent !important; box-shadow: none !important; padding: 0 !important; }
                .leaflet-popup-content { margin: 0 !important; }
                .leaflet-container { background: #0f172a !important; }
                
                /* Professional CSS Icons */
                .custom-user-icon { position: relative; }
                .pin-core {
                    width: 14px; height: 14px; background: #0ea5e9; 
                    border: 2px solid white; border-radius: 50%;
                    box-shadow: 0 0 10px #0ea5e9;
                }
                .pulse-ring {
                    position: absolute; top: -13px; left: -13px;
                    width: 40px; height: 40px; border: 3px solid #0ea5e9;
                    border-radius: 50%; animation: marker-pulse 2s infinite;
                    opacity: 0;
                }
                
                .custom-tank-icon {
                    display: flex; align-items: center; justify-content: center;
                    background: rgba(34, 211, 238, 0.2);
                    border: 2px solid #22d3ee; border-radius: 12px;
                    box-shadow: 0 0 15px rgba(34, 211, 238, 0.3);
                    font-size: 20px; backdrop-filter: blur(4px);
                }

                @keyframes marker-pulse {
                    0% { transform: scale(0.5); opacity: 0; }
                    50% { opacity: 0.5; }
                    100% { transform: scale(1.5); opacity: 0; }
                }
                
                .searched-marker {
                    filter: drop-shadow(0 0 12px currentColor);
                }
                
                .glass-card {
                    background: rgba(30, 41, 59, 0.4);
                    backdrop-filter: blur(16px);
                    -webkit-backdrop-filter: blur(16px);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                }
            `}</style>
        </div>
    );
}

export default PublicView;
