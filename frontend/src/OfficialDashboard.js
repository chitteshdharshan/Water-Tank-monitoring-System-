import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
    LayoutDashboard, Database, UploadCloud, PieChart, LogOut, 
    AlertTriangle, Droplets, Calendar, ChevronRight, CheckCircle2,
    ShieldAlert, Activity, FileText, Settings, Search, Loader2,
    X, Clock, MapPin
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Trends from './Trends';

// Fix for Leaflet marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

function MapRecenter({ center }) {
    const map = useMap();
    useEffect(() => {
        if (center) {
            map.flyTo(center, 14, { animate: true, duration: 1.5 });
        }
    }, [center, map]);
    return null;
}

function OfficialDashboard() {
    const [activeTab, setActiveTab] = useState('dashboard');
    const [districts, setDistricts] = useState([]);
    const [selectedDistrict, setSelectedDistrict] = useState('');
    const [taluks, setTaluks] = useState([]);
    const [selectedTaluk, setSelectedTaluk] = useState('');
    const [areas, setAreas] = useState([]);
    const [selectedAreaId, setSelectedAreaId] = useState('');
    const [tanks, setTanks] = useState([]);
    const [selectedTankId, setSelectedTankId] = useState('');
    const [selectedAlert, setSelectedAlert] = useState(null);

    const [readings, setReadings] = useState({
        ph: '', hardness: '', solids: '', chloramines: '',
        sulfate: '', conductivity: '', organic_carbon: '', trihalomethanes: '', turbidity: ''
    });
    const [testDate, setTestDate] = useState(new Date().toISOString().split('T')[0]);
    const [alerts, setAlerts] = useState([]);
    
    const [role] = useState(localStorage.getItem('role'));
    const [userDistrictId] = useState(localStorage.getItem('district_id'));
    const [submitting, setSubmitting] = useState(false);
    const [lastResult, setLastResult] = useState(null);
    const navigate = useNavigate();
    const resultRef = useRef(null);
    const fileInputRef = useRef(null);

    useEffect(() => {
        if (!localStorage.getItem('token')) {
            navigate('/admin');
        } else {
            fetchDistricts();
            fetchAlerts();
        }
    }, [navigate]);

    const fetchDistricts = async () => {
        try {
            const res = await fetch('http://localhost:5001/api/public/districts');
            const data = await res.json();
            setDistricts(data);
            if (userDistrictId && userDistrictId !== 'null') setSelectedDistrict(userDistrictId);
        } catch (err) { console.error('Districts fetch error:', err); }
    };

    useEffect(() => {
        if (!selectedDistrict) { setTaluks([]); return; }
        fetch(`http://localhost:5001/api/public/taluks/${selectedDistrict}`)
            .then(res => res.json()).then(data => setTaluks(data));
    }, [selectedDistrict]);

    useEffect(() => {
        if (!selectedTaluk) { setAreas([]); return; }
        fetch(`http://localhost:5001/api/public/areas/${selectedTaluk}`)
            .then(res => res.json()).then(data => setAreas(data));
    }, [selectedTaluk]);

    useEffect(() => {
        if (!selectedAreaId) { setTanks([]); return; }
        fetch(`http://localhost:5001/api/public/tanks/${selectedAreaId}`)
            .then(res => res.json()).then(data => setTanks(data));
    }, [selectedAreaId]);

    const fetchAlerts = async () => {
        try {
            const res = await fetch('http://localhost:5001/api/official/alerts', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const data = await res.json();
            setAlerts(data);
        } catch (err) { console.error('Alert fetch error:', err); }
    };

    const handleLogout = () => {
        localStorage.clear();
        navigate('/');
    };

    const handleCsvUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (event) => {
            const json = event.target.result.split('\n').filter(r => r.trim()).slice(1).map(row => {
                const values = row.split(',').map(v => v.trim());
                return { ph: values[0], hardness: values[1], solids: values[2], chloramines: values[3], sulfate: values[4], conductivity: values[5], organic_carbon: values[6], trihalomethanes: values[7], turbidity: values[8], date: values[9], tank_id: values[10] };
            });
            try {
                const res = await fetch('http://localhost:5001/api/official/upload-data', {
                    method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                    body: JSON.stringify({ data: json })
                });
                const result = await res.json();
                alert(res.ok ? result.message : 'Upload failed: ' + result.error);
            } catch (err) { alert('Critical upload error.'); }
        };
        reader.readAsText(file);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedTankId) return alert('Select a tank.');
        setSubmitting(true); setLastResult(null);
        try {
            const payload = { tank_id: selectedTankId, date: testDate, ...Object.fromEntries(Object.entries(readings).map(([k, v]) => [k, parseFloat(v) || 0])) };
            const res = await fetch('http://localhost:5001/api/official/add-water-data', {
                method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (res.ok) { setLastResult(data); setReadings({ ph: '', hardness: '', solids: '', chloramines: '', sulfate: '', conductivity: '', organic_carbon: '', trihalomethanes: '', turbidity: '' }); fetchAlerts(); }
            else alert(`Submission failed: ${data.error}`);
        } catch (err) { alert('Critical server error.'); }
        finally { setSubmitting(false); }
    };

    const NavItem = ({ id, icon: Icon, label }) => (
        <button onClick={() => setActiveTab(id)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === id ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'}`}>
            <Icon className="w-5 h-5" /> <span className="text-sm font-bold">{label}</span>
        </button>
    );

    const getMapCenter = () => {
        const area = areas.find(a => String(a.id) === String(selectedAreaId));
        if (area) return [area.latitude, area.longitude];
        return [11.1271, 78.6569]; // Center of Tamil Nadu
    };

    const getSelectedTank = () => tanks.find(t => String(t.id) === String(selectedTankId));

    const AlertDetailsModal = ({ alert, onClose }) => (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} className="bg-white rounded-[2.5rem] shadow-2xl max-w-lg w-full overflow-hidden">
                <div className={`p-8 ${alert.severity === 'High' ? 'bg-rose-50' : 'bg-amber-50'}`}>
                    <div className="flex justify-between items-start mb-6">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${alert.severity === 'High' ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'}`}>
                            <ShieldAlert className="w-6 h-6" />
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-white/50 rounded-xl transition-colors text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ${alert.severity === 'High' ? 'bg-rose-200 text-rose-700' : 'bg-amber-200 text-amber-700'}`}>{alert.severity} Severity</span>
                        <span className="text-[10px] font-black text-slate-400 bg-white/50 px-2 py-0.5 rounded-full flex items-center gap-1 uppercase tracking-widest"><Clock className="w-3 h-3" /> {new Date(alert.created_at).toLocaleTimeString()}</span>
                    </div>
                    <h3 className="text-2xl font-black text-slate-800 tracking-tight">{alert.tank_name}</h3>
                </div>
                <div className="p-8 space-y-6">
                    <div className="space-y-2">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Diagnostic Message</p>
                        <p className="text-slate-700 font-medium leading-relaxed">{alert.message}</p>
                    </div>
                    <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center"><MapPin className="w-5 h-5" /></div>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase">{alert.tank_name}</p>
                            <p className="text-xs font-bold text-slate-600 italic">Global Distribution Node</p>
                        </div>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );

    return (
        <div className="flex h-[calc(100vh-80px)] overflow-hidden bg-slate-50">
            
            <AnimatePresence>
                {selectedAlert && <AlertDetailsModal alert={selectedAlert} onClose={() => setSelectedAlert(null)} />}
            </AnimatePresence>

            {/* Sidebar Navigation */}
            <aside className="w-72 bg-white border-r border-slate-200 p-6 flex flex-col gap-6">
                <div className="flex flex-col gap-1 mb-4">
                    <NavItem id="dashboard" icon={LayoutDashboard} label="Dashboard Overview" />
                    <NavItem id="entry" icon={Activity} label="Water Telemetry Log" />
                    <NavItem id="upload" icon={UploadCloud} label="Bulk Data Import" />
                </div>
                <div className="mt-auto border-t border-slate-100 pt-6 space-y-2">
                    <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-rose-500 hover:bg-rose-50 transition-all text-sm font-bold"><LogOut className="w-5 h-5" /> Sign Out</button>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 overflow-y-auto p-8">
                <header className="flex justify-between items-center mb-10">
                    <div>
                        <h2 className="text-3xl font-black text-slate-800 tracking-tight capitalize">{activeTab.replace('-', ' ')}</h2>
                        <p className="text-slate-500 font-medium text-sm mt-1 flex items-center gap-2 italic">
                            Official Control Access &middot; <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full not-italic font-bold text-[10px] uppercase">{role}</span>
                        </p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center font-bold text-slate-500 shadow-sm">U</div>
                    </div>
                </header>

                <AnimatePresence mode="wait">
                    {activeTab === 'dashboard' && (
                        <motion.div key="dashboard" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-8">
                            
                            {/* Stats Summary */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                {[
                                    { label: 'Active Alerts', val: alerts.length, icon: ShieldAlert, color: 'rose' },
                                    { label: 'Total Districts', val: districts.length, icon: Database, color: 'blue' },
                                    { label: 'Active Tanks', val: '42', icon: Droplets, color: 'blue' },
                                    { label: 'Uptime', val: '99.9%', icon: Activity, color: 'emerald' },
                                ].map((stat, i) => (
                                    <div key={i} className="glass-card p-6 rounded-[2rem] shadow-sm">
                                        <div className={`w-10 h-10 rounded-xl bg-${stat.color}-100 text-${stat.color}-600 flex items-center justify-center mb-4`}><stat.icon className="w-5 h-5" /></div>
                                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">{stat.label}</p>
                                        <h4 className="text-2xl font-black text-slate-800 mt-1">{stat.val}</h4>
                                    </div>
                                ))}
                            </div>

                            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                                {/* ALERTS FEED */}
                                <section className="xl:col-span-1 glass-card p-6 rounded-[2.5rem]">
                                    <div className="flex items-center justify-between mb-6">
                                        <h3 className="text-lg font-black text-slate-800 flex items-center gap-2"><ShieldAlert className="w-5 h-5 text-rose-500" /> System Alerts</h3>
                                        <span className="text-[10px] font-black bg-rose-100 text-rose-600 px-2 py-0.5 rounded-full">{alerts.length} NEW</span>
                                    </div>
                                    <div className="space-y-3 overflow-y-auto max-h-[450px] pr-2 custom-scrollbar">
                                        {alerts.length === 0 ? (
                                            <div className="h-40 flex flex-col items-center justify-center text-slate-400 italic text-sm">No active alerts. All systems safe.</div>
                                        ) : (
                                            alerts.map((a, i) => (
                                                <div key={i} onClick={() => setSelectedAlert(a)} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl hover:border-blue-200 transition-all cursor-pointer group">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <div className={`w-2 h-2 rounded-full ${a.severity === 'High' ? 'bg-rose-500 shadow-lg shadow-rose-500/50 pulse' : 'bg-amber-500'}`}></div>
                                                        <span className="text-sm font-black text-slate-800 truncate">{a.tank_name}</span>
                                                    </div>
                                                    <p className="text-xs text-slate-500 font-medium leading-relaxed mb-2 line-clamp-2">{a.message}</p>
                                                    <div className="flex justify-between items-center text-[9px] font-bold text-slate-400 uppercase">
                                                        <span>{new Date(a.created_at).toLocaleDateString()}</span>
                                                        <span className="group-hover:text-blue-600 flex items-center gap-1">View Details <ChevronRight className="w-3 h-3" /></span>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </section>

                            </div>
                        </motion.div>
                    )}

                    {activeTab === 'entry' && (
                        <motion.div key="entry" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-start">
                            
                            <div className="space-y-8">
                                {/* FORM CARD */}
                                <div className="glass-card p-8 rounded-[2.5rem] shadow-xl border-white/60">
                                    <h3 className="text-xl font-black text-slate-800 mb-8 flex items-center gap-3"><CheckCircle2 className="w-6 h-6 text-blue-600" /> Log Quality Reading</h3>
                                    <form onSubmit={handleSubmit} className="space-y-6">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">1. District</label>
                                                <select className="input-field py-3 text-sm" disabled={!!userDistrictId && userDistrictId !== 'null'} value={selectedDistrict} onChange={e => { setSelectedDistrict(e.target.value); setSelectedTaluk(''); setSelectedAreaId(''); setSelectedTankId(''); }} required>
                                                    <option value="">Choose District...</option>
                                                    {districts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                                </select>
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">2. Taluk</label>
                                                <select className="input-field py-3 text-sm" disabled={!selectedDistrict} value={selectedTaluk} onChange={e => { setSelectedTaluk(e.target.value); setSelectedAreaId(''); setSelectedTankId(''); }} required>
                                                    <option value="">Choose Taluk...</option>
                                                    {taluks.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                                </select>
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">3. Area/Village</label>
                                                <select className="input-field py-3 text-sm" disabled={!selectedTaluk} value={selectedAreaId} onChange={e => { setSelectedAreaId(e.target.value); setSelectedTankId(''); }} required>
                                                    <option value="">Choose Village...</option>
                                                    {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                                </select>
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">4. Water Tank</label>
                                                <select className="input-field py-3 text-sm" disabled={!selectedAreaId} value={selectedTankId} onChange={e => setSelectedTankId(e.target.value)} required>
                                                    <option value="">Choose Tank...</option>
                                                    {tanks.map(t => <option key={t.id} value={t.id}>{t.name} ({t.type})</option>)}
                                                </select>
                                            </div>
                                        </div>

                                        <div className="pt-4 border-t border-slate-100">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 mb-4 block">6. Quality Indices</label>
                                            <div className="grid grid-cols-3 gap-4">
                                                {Object.keys(readings).map(key => (
                                                    <div key={key} className="space-y-1.5 group">
                                                        <label className="text-[9px] font-black uppercase tracking-tighter text-slate-400 group-focus-within:text-blue-500 transition-colors ml-1 truncate">{key.replace(/_/g, ' ')}</label>
                                                        <input type="number" step="0.001" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:bg-white focus:border-blue-500 focus:shadow-sm outline-none transition-all placeholder:text-slate-300 placeholder:font-normal" placeholder="0.000" value={readings[key]} onChange={e => setReadings({ ...readings, [key]: e.target.value })} required />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <button type="submit" disabled={submitting} className="btn-primary w-full py-4 text-lg bg-slate-900 shadow-slate-900/20 hover:bg-slate-800">
                                            {submitting ? <span className="flex items-center gap-3"><Loader2 className="w-5 h-5 animate-spin" /> Performing Analysis...</span> : 'Analyze & Sync Data'}
                                        </button>
                                    </form>
                                </div>
                            </div>

                            {/* MAP & RESULTS VIEW */}
                            <div className="space-y-8">
                                {/* INTERACTIVE MAP */}
                                <div className="glass-card overflow-hidden rounded-[2.5rem] shadow-xl border-white/60 h-[400px] relative z-0">
                                    <MapContainer center={getMapCenter()} zoom={14} className="h-full w-full">
                                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' />
                                        <MapRecenter center={getMapCenter()} />
                                        
                                        {/* Village Marker */}
                                        {selectedAreaId && (
                                            <Marker position={getMapCenter()}>
                                                <Popup>Selected Village: {areas.find(a => String(a.id) === String(selectedAreaId))?.name}</Popup>
                                            </Marker>
                                        )}

                                        {/* Tank Marker */}
                                        {selectedTankId && getSelectedTank() && (
                                            <Marker position={[getSelectedTank().latitude, getSelectedTank().longitude]}>
                                                <Popup>Water Source: {getSelectedTank().name}</Popup>
                                            </Marker>
                                        )}
                                    </MapContainer>
                                    <div className="absolute top-4 right-4 z-[1000] bg-white/90 backdrop-blur px-3 py-1.5 rounded-xl border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-500 shadow-lg">Live Area Context</div>
                                </div>

                                {/* AI STATUS PANELS */}
                                {lastResult ? (
                                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className={`glass-card p-8 rounded-[2.5rem] border-2 transition-all duration-700 shadow-2xl ${lastResult.prediction === 'Safe' ? 'border-emerald-500 bg-emerald-50/30' : 'border-rose-500 bg-rose-50/30'}`}>
                                        <div className="flex justify-between items-start mb-6 pb-6 border-b border-slate-200/50">
                                            <div>
                                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">AI Classification Engine</p>
                                                <h4 className={`text-4xl font-black ${lastResult.prediction === 'Safe' ? 'text-emerald-600' : 'text-rose-600'}`}>{lastResult.prediction}</h4>
                                            </div>
                                            <div className="w-16 h-16 rounded-2xl bg-white shadow-lg flex items-center justify-center text-3xl">{lastResult.prediction === 'Safe' ? '✅' : '⚠️'}</div>
                                        </div>
                                        <div className="space-y-4">
                                            {[
                                                { k: 'Location Source', v: lastResult.tank_name },
                                                { k: 'Regional Area', v: lastResult.area_name },
                                            ].map((row, i) => (
                                                <div key={i} className="flex justify-between items-center text-sm">
                                                    <span className="text-slate-500 font-bold">{row.k}</span>
                                                    <span className="text-slate-800 font-black">{row.v}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </motion.div>
                                ) : (
                                    <div className="h-[200px] border-4 border-dashed border-slate-200 rounded-[2.5rem] flex flex-col items-center justify-center text-slate-300 gap-4 p-8 text-center bg-white/50">
                                        <p className="font-bold text-sm opacity-50 italic">Select an area to visualize coordinates on the map.</p>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}

                    {activeTab === 'upload' && (
                        <motion.div key="upload" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-2xl mx-auto py-12">
                            <div className="glass-card p-12 rounded-[3rem] text-center shadow-2xl border-white/60">
                                <div className="w-20 h-20 bg-blue-100 text-blue-600 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-inner shadow-blue-500/10"><UploadCloud className="w-10 h-10" /></div>
                                <h3 className="text-2xl font-black text-slate-800 mb-3">Bulk System Ingestion</h3>
                                <p className="text-slate-500 font-medium mb-10 max-w-sm mx-auto">Upload regional water data in CSV format. Our AI Engine will automatically parse and classify each entry for safety status.</p>
                                <input type="file" ref={fileInputRef} onChange={handleCsvUpload} className="hidden" accept=".csv" />
                                <button onClick={() => fileInputRef.current.click()} className="btn-primary w-full max-w-xs py-5 bg-blue-600 shadow-blue-600/30">Select Master CSV</button>
                                <div className="mt-8 pt-8 border-t border-slate-100 flex justify-center gap-8">
                                    {['Automatic parsing', 'Real-time sync', 'Multi-area impact'].map((f, i) => (
                                        <div key={i} className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest"><CheckCircle2 className="w-3 h-3 text-emerald-500" /> {f}</div>
                                    ))}
                                </div>
                            </div>
                        </motion.div>
                    )}

                </AnimatePresence>
            </main>

            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
                .pulse { animation: pulse 2s infinite; }
                @keyframes pulse { 0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(244, 63, 94, 0.7); } 70% { transform: scale(1); box-shadow: 0 0 0 10px rgba(244, 63, 94, 0); } 100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(244, 63, 94, 0); } }
                .leaflet-container { z-index: 0 !important; }
            `}</style>
        </div>
    );
}

export default OfficialDashboard;
