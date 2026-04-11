import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function Login() {
    const [credentials, setCredentials] = useState({ username: '', password: '' });
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch('http://localhost:5001/api/admin/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(credentials)
            });
            const data = await res.json();
            if (res.ok) {
                localStorage.setItem('token', data.token);
                localStorage.setItem('username', data.username);
                localStorage.setItem('role', data.role);
                navigate('/dashboard');
            } else {
                setError(data.error || 'Login failed');
            }
        } catch (err) {
            setError('Server connection error');
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden font-sans">
            {/* Background glowing orbs */}
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/20 rounded-full blur-[120px] pointer-events-none"></div>
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none"></div>

            <div className="bg-slate-800/60 backdrop-blur-xl border border-slate-700/50 p-8 md:p-10 rounded-3xl shadow-2xl w-full max-w-md relative z-10">
                <div className="text-center mb-10">
                    <span className="text-4xl mb-4 block drop-shadow-[0_0_15px_rgba(34,211,238,0.5)]">🔐</span>
                    <h2 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                        Official Control Panel
                    </h2>
                    <p className="text-slate-400 mt-2 text-sm">Sign in to access sensor arrays.</p>
                </div>

                {error && (
                    <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 px-4 py-3 rounded-xl text-center text-sm font-medium mb-6 animate-pulse">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest pl-1">Authorized Username</label>
                        <input 
                            type="text" 
                            className="bg-slate-900/50 border border-slate-700 focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 text-slate-200 rounded-xl px-4 py-3 outline-none transition-all"
                            placeholder="Enter username"
                            value={credentials.username}
                            onChange={(e) => setCredentials({...credentials, username: e.target.value})}
                            required 
                        />
                    </div>
                    
                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest pl-1">Secure Password</label>
                        <input 
                            type="password" 
                            className="bg-slate-900/50 border border-slate-700 focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 text-slate-200 rounded-xl px-4 py-3 outline-none transition-all font-mono"
                            placeholder="••••••••"
                            value={credentials.password}
                            onChange={(e) => setCredentials({...credentials, password: e.target.value})}
                            required 
                        />
                    </div>

                    <button type="submit" className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-900 font-bold px-4 py-3.5 rounded-xl transition-all shadow-lg shadow-cyan-500/20 hover:scale-[1.02] active:scale-[0.98]">
                        Establish Connection
                    </button>
                </form>

                <div className="mt-8 text-center border-t border-slate-700/50 pt-6">
                    <button 
                        className="text-slate-400 hover:text-cyan-400 text-sm font-medium transition-colors border border-transparent hover:border-cyan-500/30 bg-slate-800/50 hover:bg-slate-800 px-4 py-2 rounded-lg"
                        onClick={() => navigate('/')}
                    >
                        ← Return to Public Map
                    </button>
                </div>
            </div>
        </div>
    );
}

export default Login;