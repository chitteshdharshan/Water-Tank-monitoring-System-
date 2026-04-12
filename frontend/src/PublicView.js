import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import { Search, Loader2, MapPin, Navigation, Volume2, ListTree, Zap, AlertCircle, Calendar, Mic, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
    iconUrl: require('leaflet/dist/images/marker-icon.png'),
    shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

const createUserIcon = () => new L.DivIcon({
    html: `<div class="w-10 h-10 bg-blue-600 rounded-full border-4 border-white shadow-2xl flex items-center justify-center animate-bounce">
              <div class="w-3 h-3 bg-white rounded-full"></div>
           </div>`,
    className: 'custom-icon',
    iconSize: [40, 40],
    iconAnchor: [20, 40],
});

const createTankIcon = (status, isAlternative = false) => new L.DivIcon({
    html: `<div class="${isAlternative ? 'w-8 h-8 opacity-70' : 'w-12 h-12'} rounded-full border-4 shadow-xl flex items-center justify-center transition-transform duration-500
              ${status === 'Safe' ? 'bg-emerald-500 border-white' : 'bg-rose-500 border-white'}">
              <svg width="${isAlternative ? '12' : '20'}" height="${isAlternative ? '12' : '20'}" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
                 <path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"></path>
              </svg>
           </div>
           ${status === 'Safe' && !isAlternative ? `<div class="absolute -inset-3 bg-emerald-500 opacity-20 rounded-full animate-ping"></div>` : ''}
           ${status === 'Unsafe' && !isAlternative ? `<div class="absolute -inset-3 bg-rose-500 opacity-20 rounded-full animate-pulse"></div>` : ''}`,
    className: 'custom-icon relative',
    iconSize: [48, 48],
    iconAnchor: [24, 24],
});

const MapUpdater = ({ result }) => {
    const map = useMap();
    useEffect(() => {
        if (!result) return;
        const coords = [];
        if (result.user) coords.push([result.user.lat, result.user.lon]);
        if (result.selectedTank) coords.push([result.selectedTank.lat, result.selectedTank.lon]);
        result.alternatives?.forEach(a => {
           if (a.latitude && a.longitude) coords.push([a.latitude, a.longitude]);
        });
        
        if (coords.length > 1) {
            const bounds = L.latLngBounds(coords);
            map.fitBounds(bounds, { padding: [100, 100], animate: true, duration: 2 });
        } else if (coords.length === 1) {
            map.flyTo(coords[0], 14, { animate: true, duration: 2 });
        }
    }, [result, map]);
    return null;
};

export default function PublicView() {
    const [searchMode, setSearchMode] = useState('text');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchDate, setSearchDate] = useState(new Date().toISOString().split('T')[0]);
    
    const [districts, setDistricts] = useState([]);
    const [taluks, setTaluks] = useState([]);
    const [areas, setAreas] = useState([]);
    const [selectedDistrict, setSelectedDistrict] = useState('');
    const [selectedTaluk, setSelectedTaluk] = useState('');
    const [selectedArea, setSelectedArea] = useState('');

    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [isListening, setIsListening] = useState(false);

    useEffect(() => {
        fetch('http://localhost:5001/api/public/districts')
            .then(res => res.json())
            .then(data => setDistricts(data));
    }, []);

    useEffect(() => {
        if (!selectedDistrict) { setTaluks([]); setAreas([]); return; }
        fetch(`http://localhost:5001/api/public/taluks/${selectedDistrict}`)
            .then(res => res.json())
            .then(data => setTaluks(data));
    }, [selectedDistrict]);

    useEffect(() => {
        if (!selectedTaluk) { setAreas([]); return; }
        fetch(`http://localhost:5001/api/public/areas/${selectedTaluk}`)
            .then(res => res.json())
            .then(data => setAreas(data));
    }, [selectedTaluk]);

    const playSpeech = (text) => {
        window.speechSynthesis.cancel();
        if (!text) return;
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.onend = () => setIsSpeaking(false);
        utterance.onstart = () => setIsSpeaking(true);
        window.speechSynthesis.speak(utterance);
    };

    const startListening = () => {
        if (!('webkitSpeechRecognition' in window)) return;
        const recognition = new window.webkitSpeechRecognition();
        recognition.onstart = () => setIsListening(true);
        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            setSearchQuery(transcript);
            runEngine({ q: transcript });
        };
        recognition.onend = () => setIsListening(false);
        recognition.start();
    };

    const runEngine = async (payload) => {
        setLoading(true); setError(null);
        try {
            const res = await fetch(`http://localhost:5001/api/public/check-water`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...payload, date: searchDate })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setResult(data);
            if (data.message) playSpeech(data.message);
        } catch (err) { setError(err.message); }
        finally { setLoading(false); }
    };

    return (
        <div className="relative h-[calc(100vh-80px)] overflow-hidden font-sans">
            
            {/* Main Interactive Layer */}
            <div className="absolute inset-0 z-10 pointer-events-none flex flex-col md:flex-row p-4 md:p-8 gap-6 h-full overflow-y-auto">
                <div className="w-full md:w-[420px] pointer-events-auto flex flex-col gap-6">
                    
                    {/* Search Hero Card */}
                    <motion.div initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="glass-card rounded-[2.5rem] p-8 shadow-2xl border-white/40">
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-xl font-black text-slate-800 tracking-tight">Search Location</h2>
                            <div className="flex p-1 bg-slate-100 rounded-xl">
                                <button onClick={() => setSearchMode('text')} className={`p-2 rounded-lg transition-all ${searchMode === 'text' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400'}`}><Search className="w-4 h-4" /></button>
                                <button onClick={() => setSearchMode('dropdown')} className={`p-2 rounded-lg transition-all ${searchMode === 'dropdown' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400'}`}><ListTree className="w-4 h-4" /></button>
                            </div>
                        </div>

                        {searchMode === 'text' ? (
                            <form onSubmit={(e) => { e.preventDefault(); runEngine({ q: searchQuery }); }} className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Address Match</label>
                                    <div className="relative group">
                                        <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Type village or street..." className="input-field pr-16" />
                                        <button type="button" onClick={startListening} className={`absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-colors ${isListening ? 'bg-rose-500 text-white animate-pulse' : 'text-slate-400 hover:bg-slate-50'}`}>
                                            <Mic className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Analysis Date</label>
                                    <div className="relative rounded-xl overflow-hidden border-2 border-slate-100 hover:border-blue-500 transition-colors">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-blue-500"><Calendar className="w-4 h-4" /></div>
                                        <input type="date" value={searchDate} onChange={e => setSearchDate(e.target.value)} className="w-full pl-12 pr-4 py-3 bg-white outline-none font-bold text-slate-700" />
                                    </div>
                                </div>
                                <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-3">
                                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Zap className="w-5 h-5 fill-white" /> Analyze Supply</>}
                                </button>
                            </form>
                        ) : (
                            <form onSubmit={e => { e.preventDefault(); runEngine({ area_id: selectedArea }); }} className="space-y-4">
                                <select className="input-field py-3 text-sm" value={selectedDistrict} onChange={e => setSelectedDistrict(e.target.value)}><option value="">District</option>{districts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
                                <select className="input-field py-3 text-sm" disabled={!selectedDistrict} value={selectedTaluk} onChange={e => setSelectedTaluk(e.target.value)}><option value="">Taluk</option>{taluks.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
                                <select className="input-field py-3 text-sm" disabled={!selectedTaluk} value={selectedArea} onChange={e => setSelectedArea(e.target.value)}><option value="">Area/Village</option>{areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
                                <div className="space-y-2 pt-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Analysis Date</label>
                                    <input type="date" value={searchDate} onChange={e => setSearchDate(e.target.value)} className="input-field py-3" />
                                </div>
                                <button type="submit" disabled={loading || !selectedArea} className="btn-primary w-full flex items-center justify-center gap-3">
                                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Navigation className="w-5 h-5 fill-white" /> Map Directory</>}
                                </button>
                            </form>
                        )}
                    </motion.div>

                    {/* Results Layer */}
                    <AnimatePresence>
                        {error && (
                            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-rose-50 border-2 border-rose-100 p-4 rounded-[1.5rem] flex gap-4 text-rose-700 shadow-xl">
                                <AlertCircle className="w-6 h-6 shrink-0" /> <p className="text-sm font-bold">{error}</p>
                            </motion.div>
                        )}

                        {result && (
                            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="space-y-6">
                                
                                <div className={`glass-card rounded-[2rem] p-6 border-2 transition-colors duration-700 ${result.selectedTank.quality.status === 'Safe' ? 'border-emerald-500' : 'border-rose-500'}`}>
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2.5 rounded-xl ${result.selectedTank.quality.status === 'Safe' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                                                <Zap className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Agentic Assessment</p>
                                                <h3 className={`text-2xl font-black ${result.selectedTank.quality.status === 'Safe' ? 'text-emerald-600' : 'text-rose-600'}`}>{result.selectedTank.quality.status}</h3>
                                            </div>
                                        </div>
                                        <button onClick={() => playSpeech(result.speech_text)} className="w-10 h-10 glass-card rounded-full flex items-center justify-center text-slate-500 hover:text-blue-600 hover:border-blue-500 transition-all border-slate-100">
                                            <Volume2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <p className="text-sm text-slate-700 font-bold bg-slate-50 p-4 rounded-2xl border border-slate-100 italic leading-relaxed mb-4">
                                        "{result.selectedTank.explanation}"
                                    </p>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">pH Factor</p>
                                            <p className="text-xl font-black text-slate-800 leading-none">{Number(result.selectedTank.quality.ph).toFixed(1)}</p>
                                        </div>
                                        <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Turbidity</p>
                                            <p className="text-xl font-black text-slate-800 leading-none">{Number(result.selectedTank.quality.turbidity).toFixed(1)} <span className="text-[8px]">NTU</span></p>
                                        </div>
                                    </div>
                                    <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase">Data as of: {result.selectedTank.quality.date || result.date}</p>
                                        <div className="bg-blue-50 text-blue-600 text-[10px] font-black px-2 py-0.5 rounded uppercase">{result.distance_km} km away</div>
                                    </div>
                                </div>

                                <div className="glass-card rounded-[2rem] p-6">
                                    <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
                                        <MapPin className="w-4 h-4 text-slate-400" />
                                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Source Detail</h4>
                                    </div>
                                    <div className="bg-blue-600 p-4 rounded-2xl text-white mb-4 shadow-lg shadow-blue-500/20">
                                        <p className="text-[9px] font-bold uppercase tracking-widest opacity-70 mb-1">Primary Water Source</p>
                                        <h5 className="font-black text-lg truncate leading-tight">{result.selectedTank.name}</h5>
                                        <div className="flex items-center gap-4 mt-2">
                                            <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-bold">{result.selectedTank.type}</span>
                                            <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-bold">📍 {result.selectedTank.area}</span>
                                        </div>
                                    </div>

                                    {result.alternatives && result.alternatives.length > 0 && (
                                        <div className="space-y-3">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase ml-1">Alternative Sources</p>
                                            {result.alternatives.map((alt, idx) => (
                                                <div key={idx} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition-all cursor-pointer group">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-2 h-2 rounded-full ${alt.status === 'Safe' ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                                                        <span className="text-xs font-bold text-slate-700 group-hover:text-blue-600 transition-colors">{alt.name}</span>
                                                    </div>
                                                    <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* Full-bleed Map Area */}
            <div className="flex-1 h-full relative">
                <MapContainer center={[10.8, 78.5]} zoom={7} className="w-full h-full z-0 pointer-events-auto" zoomControl={false}>
                    <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" attribution='&copy; CARTO' />
                    {result && (
                        <>
                            <MapUpdater result={result} />
                            <Marker position={[result.user.lat, result.user.lon]} icon={createUserIcon()} />
                            <Marker position={[result.selectedTank.lat, result.selectedTank.lon]} icon={createTankIcon(result.selectedTank.quality.status, false)}>
                                <Popup><div className="font-sans px-2 py-1"><p className="text-[10px] font-black uppercase text-slate-400 mb-1">{result.selectedTank.type}</p><p className="text-sm font-black text-slate-800">{result.selectedTank.name}</p></div></Popup>
                            </Marker>
                            {result.alternatives?.map((alt, i) => alt.latitude && (
                                <Marker key={i} position={[alt.latitude, alt.longitude]} icon={createTankIcon(alt.status, true)} />
                            ))}
                            <Polyline positions={[[result.user.lat, result.user.lon], [result.selectedTank.lat, result.selectedTank.lon]]} 
                                pathOptions={{ color: result.selectedTank.quality.status === 'Safe' ? '#10b981' : '#f43f5e', weight: 4, opacity: 0.6, dashArray: '10, 15', lineCap: 'round' }} />
                        </>
                    )}
                </MapContainer>
            </div>
        </div>
    );
}
