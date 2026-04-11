import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Trends from './Trends';

function OfficialDashboard() {
    const [areas, setAreas] = useState([]);
    const [selectedAreaId, setSelectedAreaId] = useState('');
    const [selectedArea, setSelectedArea] = useState(null);
    const [readings, setReadings] = useState({
        ph: '', hardness: '', solids: '', chloramines: '',
        sulfate: '', conductivity: '', organic_carbon: '', trihalomethanes: '', turbidity: ''
    });
    const [testDate, setTestDate] = useState(new Date().toISOString().split('T')[0]);
    const [alerts, setAlerts] = useState([]);
    
    // Hierarchical state
    const [districts, setDistricts] = useState([]);
    const [selectedDistrict, setSelectedDistrict] = useState('');
    const [villages, setVillages] = useState([]);
    const [selectedVillage, setSelectedVillage] = useState('');
    const [villageSearch, setVillageSearch] = useState('');
    const [villageSuggestionsOpen, setVillageSuggestionsOpen] = useState(false);
    const villageDropdownRef = useRef(null);
    const [mappedTank, setMappedTank] = useState(null);
    const [findingTank, setFindingTank] = useState(false);

    const [role] = useState(localStorage.getItem('role'));
    const [submitting, setSubmitting] = useState(false);
    const [lastResult, setLastResult] = useState(null);
    const navigate = useNavigate();
    const resultRef = useRef(null);

    useEffect(() => {
        if (!localStorage.getItem('token')) {
            navigate('/admin');
        } else {
            fetchMetadata();
            fetchAlerts();
        }
    }, [navigate]);

    // Click outside to close village suggestions
    useEffect(() => {
        function handleClickOutside(event) {
            if (villageDropdownRef.current && !villageDropdownRef.current.contains(event.target)) {
                setVillageSuggestionsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const fetchMetadata = async () => {
        try {
            const res = await fetch('http://localhost:5001/api/public/districts');
            const data = await res.json();
            setDistricts(data);
        } catch (err) {
            console.error('Metadata fetch error:', err);
        }
    };

    const handleDistrictChange = async (d) => {
        setSelectedDistrict(d);
        setSelectedVillage('');
        setVillageSearch('');
        setMappedTank(null);
        setVillages([]);
        if (d) {
            try {
                const res = await fetch(`http://localhost:5001/api/public/villages?district=${encodeURIComponent(d)}`);
                const data = await res.json();
                setVillages(data);
            } catch (err) { console.error('Village fetch error:', err); }
        }
    };

    const handleVillageChange = async (v) => {
        setSelectedVillage(v);
        setMappedTank(null);
        if (v && selectedDistrict) {
            // Logic to find nearest tank for this village
            setFindingTank(true);
            try {
                const query = `${v}, ${selectedDistrict}`;
                const res = await fetch(`http://localhost:5001/api/public/search-address?q=${encodeURIComponent(query)}&date=${testDate}`);
                const data = await res.json();
                if (data.nearest_area) {
                    setMappedTank(data.nearest_area);
                }
            } catch (err) { console.error('Tank mapping error:', err); }
            finally { setFindingTank(false); }
        }
    };

    const fetchAlerts = async () => {
        try {
            const res = await fetch('http://localhost:5001/api/official/alerts', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const data = await res.json();
            setAlerts(data);
        } catch (err) {
            console.error('Alert fetch error:', err);
        }
    };

    const handleAreaChange = (e) => {
        const id = e.target.value;
        setSelectedAreaId(id);
        const found = areas.find(a => String(a.id) === id);
        setSelectedArea(found || null);
        setLastResult(null);
    };

    const handleLogout = () => {
        localStorage.clear();
        navigate('/');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!mappedTank) {
            alert('Cannot find a water tank source for this village. Please try another area.');
            return;
        }
        setSubmitting(true);
        setLastResult(null);
        try {
            const payload = {
                area_id: mappedTank.area_id, // Map selected village to its nearest tank's area entry
                test_date: testDate,
                ...Object.fromEntries(Object.entries(readings).map(([k, v]) => [k, parseFloat(v)]))
            };
            const res = await fetch('http://localhost:5001/api/official/add-reading', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (res.ok) {
                setLastResult(data);
                // Don't reset everything so they can see result, but clear readings
                setReadings({ ph: '', hardness: '', solids: '', chloramines: '', sulfate: '', conductivity: '', organic_carbon: '', trihalomethanes: '', turbidity: '' });
                fetchAlerts();
                setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
            } else {
                alert(`Submission failed: ${data.error || 'Server error'}`);
            }
        } catch (err) {
            alert('A critical server error occurred.');
        } finally {
            setSubmitting(false);
        }
    };

    const predictionColor = (pred) => {
        if (pred === 'Safe') return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
        if (pred === 'Contaminated') return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
        return 'text-rose-400 bg-rose-500/10 border-rose-500/30';
    };

    const predictionEmoji = (pred) => {
        if (pred === 'Safe') return '✅';
        if (pred === 'Contaminated') return '⚠️';
        return '❌';
    };

    return (
        <div className="min-h-screen bg-slate-900 text-slate-100 p-4 md:p-8 font-sans">
            <nav className="flex justify-between items-center mb-8 px-6 py-4 bg-slate-900/90 backdrop-blur-md rounded-[2rem] border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.4)] animate-fade-in-up">
                <div className="flex items-center gap-3">
                    <span className="text-2xl">🔐</span>
                    <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                        Official Control Portal
                    </h1>
                    <span className="px-3 py-1 ml-4 text-xs font-semibold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 rounded-full border border-emerald-500/30">
                        {role}
                    </span>
                </div>
                <div className="flex gap-4">
                    <button onClick={() => navigate('/')} className="px-4 py-2 rounded-xl bg-slate-700/50 hover:bg-slate-700 text-sm font-medium transition-colors border border-slate-600/50 shadow-sm">
                        Public Map
                    </button>
                    <button onClick={handleLogout} className="px-4 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-sm font-medium transition-colors border border-rose-500/30 shadow-sm">
                        Log Out
                    </button>
                </div>
            </nav>

            <main className="max-w-7xl mx-auto space-y-8">

                {/* ALERTS SECTION */}
                <section className="relative bg-slate-800/40 backdrop-blur-xl border border-white/10 rounded-[2rem] p-6 md:p-8 shadow-[0_8px_32px_rgba(0,0,0,0.4)] overflow-hidden animate-fade-in-up-delay-1">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-rose-500/5 rounded-full blur-3xl -z-10"></div>
                    <h2 className="text-2xl font-bold text-rose-400 flex items-center gap-3 mb-6">
                        <span className="animate-pulse">⚠️</span> AI Agent Alerts
                    </h2>
                    <div className="space-y-3">
                        {alerts.length === 0 ? (
                            <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 text-emerald-400 flex items-center justify-center h-24">
                                No active alerts. All water tanks operating securely.
                            </div>
                        ) : (
                            alerts.slice(0, 6).map((a, i) => (
                                <div key={i} className="p-4 rounded-2xl bg-slate-900/50 border border-slate-700/50 hover:border-rose-500/30 transition-colors">
                                    <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-2">
                                        <div className="flex flex-col gap-1">
                                            <div className="flex items-center gap-2">
                                                <span className={`w-2 h-2 rounded-full ${a.severity === 'High' ? 'bg-rose-500 animate-ping' : 'bg-amber-500'}`}></span>
                                                <strong className="text-slate-200">🏭 {a.tank_name}</strong>
                                                <span className={`text-xs px-2 py-0.5 rounded-full ${a.severity === 'High' ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'}`}>
                                                    {a.severity}
                                                </span>
                                            </div>
                                            <span className="text-sm text-slate-400 ml-4">{a.message}</span>
                                            {a.affected_areas && (
                                                <span className="text-xs text-rose-300/70 ml-4 mt-1">
                                                    📍 Affected areas: {a.affected_areas}
                                                </span>
                                            )}
                                        </div>
                                        <span className="text-xs text-slate-500 font-mono whitespace-nowrap">
                                            {new Date(a.created_at).toLocaleString()}
                                        </span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </section>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 animate-fade-in-up-delay-2">
                    {/* FORM SECTION */}
                    <section className="xl:col-span-1 relative bg-slate-800/40 backdrop-blur-xl border border-white/10 rounded-[2rem] p-6 md:p-8 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
                        <h2 className="text-2xl font-bold text-slate-100 mb-6 flex items-center gap-3">
                            🧪 Log Reading
                        </h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* District Selection */}
                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-semibold text-slate-400 ml-1">1. District</label>
                                <select
                                    className="w-full bg-slate-900/50 border border-slate-700/50 hover:bg-slate-900 hover:border-slate-500 focus:border-cyan-400 text-slate-200 rounded-2xl px-5 py-3.5 focus:outline-none focus:ring-4 focus:ring-cyan-500/20 transition-all duration-300 text-sm appearance-none cursor-pointer hover:shadow-lg focus:-translate-y-0.5"
                                    value={selectedDistrict}
                                    onChange={(e) => handleDistrictChange(e.target.value)}
                                    required
                                >
                                    <option value="">Choose District...</option>
                                    {districts.map(d => <option key={d} value={d}>{d}</option>)}
                                </select>
                            </div>

                            {/* Area Selection (Autocomplete style) */}
                            <div className="flex flex-col gap-2 relative" ref={villageDropdownRef}>
                                <label className="text-sm font-semibold text-slate-400 ml-1">2. Select City or Town</label>
                                <input
                                    type="text"
                                    disabled={!selectedDistrict}
                                    className="w-full bg-slate-900/50 border border-slate-700/50 hover:bg-slate-900 hover:border-slate-500 focus:border-cyan-400 text-slate-200 rounded-2xl px-5 py-3.5 focus:outline-none focus:ring-4 focus:ring-cyan-500/20 transition-all duration-300 placeholder-slate-500 text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg focus:-translate-y-0.5"
                                    placeholder={selectedDistrict ? "Search City or Town..." : "Select District First"}
                                    value={selectedVillage ? selectedVillage : villageSearch}
                                    onChange={(e) => {
                                        setVillageSearch(e.target.value);
                                        setSelectedVillage('');
                                        setMappedTank(null);
                                        setVillageSuggestionsOpen(true);
                                    }}
                                    onFocus={() => selectedDistrict && setVillageSuggestionsOpen(true)}
                                    required
                                />
                                {villageSuggestionsOpen && !selectedVillage && selectedDistrict && (
                                    <div className="absolute top-full left-0 w-full mt-2 bg-slate-800 border border-slate-700 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] z-[2000] overflow-hidden backdrop-blur-xl max-h-60 overflow-y-auto animate-pop-in origin-top">
                                        {villages
                                            .filter(v => ((v.name_en || v.village_en || v.area_name || '')).toLowerCase().includes((villageSearch || '').toLowerCase()))
                                            .slice(0, 50)
                                            .map((v, idx) => (
                                                <div 
                                                    key={idx}
                                                    className="px-5 py-3 hover:bg-slate-700/50 cursor-pointer text-sm text-slate-200 border-b border-slate-700/50 last:border-0 transition-colors"
                                                    onClick={() => {
                                                        const name = v.name_en || v.village_en || v.area_name;
                                                        setVillageSearch(name);
                                                        setVillageSuggestionsOpen(false);
                                                        handleVillageChange(name);
                                                    }}
                                                >
                                                    <div className="flex justify-between items-center">
                                                        <div>
                                                            <span className="text-lg mr-2">{v.type === 'City' ? '🏙️' : '🏘️'}</span>
                                                            <span className="font-semibold">{v.name_en || v.village_en || v.area_name}</span>
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

                            {/* Test Date */}
                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-semibold text-slate-400 ml-1">3. Test Date</label>
                                <input
                                    type="date"
                                    className="w-full bg-slate-900/50 border border-slate-700/50 hover:bg-slate-900 hover:border-slate-500 focus:border-cyan-400 text-slate-200 rounded-2xl px-5 py-3.5 focus:outline-none focus:ring-4 focus:ring-cyan-500/20 transition-all duration-300 text-sm hover:shadow-lg focus:-translate-y-0.5"
                                    value={testDate}
                                    onChange={e => setTestDate(e.target.value)}
                                    required
                                />
                            </div>

                            {/* Auto Tank Mapping Display */}
                            {findingTank ? (
                                <div className="px-4 py-2 text-xs text-slate-500 italic animate-pulse">Mapping to nearest water tank...</div>
                            ) : mappedTank ? (
                                <div className="flex flex-col gap-1 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                                    <div className="flex items-center gap-2 text-xs">
                                        <span className="text-emerald-400 font-bold uppercase">Linked Tank:</span>
                                        <span className="text-emerald-200 font-bold">{mappedTank.tank_name}</span>
                                    </div>
                                    <div className="text-[10px] text-slate-500 mt-1">This reading will affect all areas supplied by this source.</div>
                                </div>
                            ) : selectedVillage && (
                                <div className="px-4 py-2 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                                    ⚠️ No tank mapping found.
                                </div>
                            )}

                            {/* Parameter Inputs */}
                            <div className="grid grid-cols-2 gap-4">
                                {Object.keys(readings).map(key => (
                                    <div className="flex flex-col gap-2" key={key}>
                                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider ml-1 truncate">
                                            {key.replace(/_/g, ' ')}
                                        </label>
                                        <input
                                            type="number" step="0.001"
                                            className="w-full bg-slate-900/50 border border-slate-700/50 hover:bg-slate-900 hover:border-slate-500 focus:border-cyan-400 text-slate-200 rounded-2xl px-4 py-3.5 focus:outline-none focus:ring-4 focus:ring-cyan-500/20 transition-all duration-300 font-mono text-sm hover:shadow-lg focus:-translate-y-0.5"
                                            placeholder="0.000"
                                            value={readings[key]}
                                            onChange={(e) => setReadings({ ...readings, [key]: e.target.value })}
                                            required
                                        />
                                    </div>
                                ))}
                            </div>

                            <button
                                type="submit"
                                disabled={submitting}
                                className="w-full mt-6 px-6 py-4 bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500 hover:from-cyan-400 hover:via-blue-400 hover:to-indigo-400 disabled:opacity-60 text-white font-black rounded-2xl shadow-[0_0_20px_rgba(34,211,238,0.3)] hover:shadow-[0_0_30px_rgba(34,211,238,0.5)] transition-all duration-300 hover:-translate-y-1 active:scale-[0.98] cursor-pointer disabled:cursor-not-allowed tracking-wide"
                            >
                                {submitting ? '⏳ Analyzing...' : 'Analyze & Encode'}
                            </button>
                        </form>

                        {/* RESULT CARD */}
                        {lastResult && (
                            <div ref={resultRef} className={`mt-6 p-5 rounded-2xl border ${predictionColor(lastResult.prediction)}`}>
                                <div className="flex justify-between items-center mb-3">
                                    <h3 className="font-bold text-lg">Analysis Result</h3>
                                    <span className="text-2xl">{predictionEmoji(lastResult.prediction)}</span>
                                </div>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Area:</span>
                                        <span className="font-semibold">{lastResult.area_name}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Tank Source:</span>
                                        <span className="font-semibold">{lastResult.tank_name}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">AI Status:</span>
                                        <span className={`font-bold uppercase ${predictionColor(lastResult.prediction).split(' ')[0]}`}>
                                            {lastResult.prediction}
                                        </span>
                                    </div>
                                    {lastResult.prediction !== 'Safe' && lastResult.affected_areas?.length > 0 && (
                                        <div className="mt-3 pt-3 border-t border-rose-500/20">
                                            <p className="text-rose-400 text-xs font-bold uppercase tracking-wider mb-2">⚠️ All Affected Areas:</p>
                                            <div className="flex flex-wrap gap-2">
                                                {lastResult.affected_areas.map(area => (
                                                    <span key={area} className="px-2 py-1 text-xs bg-rose-500/20 text-rose-300 rounded-lg border border-rose-500/30">
                                                        ❌ {area}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </section>

                    {/* ANALYTICS PREVIEW */}
                    <section className="xl:col-span-2 relative bg-slate-800/40 backdrop-blur-xl border border-white/10 rounded-[2rem] p-6 md:p-8 shadow-[0_8px_32px_rgba(0,0,0,0.4)] flex flex-col">
                        <h2 className="text-2xl font-bold text-slate-100 mb-6 flex items-center gap-3">
                            📈 Tank Telemetry
                        </h2>
                        {selectedArea ? (
                            <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-700/50 backdrop-blur w-full flex-1">
                                <p className="text-sm text-slate-400 mb-2">
                                    Showing trend for <span className="text-cyan-400 font-semibold">{selectedArea.tank_name}</span>
                                    <span className="text-slate-500"> (source for {selectedArea.name})</span>
                                </p>
                                <Trends tankId={selectedArea.tank_id} />
                            </div>
                        ) : (
                            <div className="flex items-center justify-center h-48 text-slate-500 italic">
                                Select an area to view tank telemetry.
                            </div>
                        )}
                    </section>
                </div>
            </main>
        </div>
    );
}

export default OfficialDashboard;
