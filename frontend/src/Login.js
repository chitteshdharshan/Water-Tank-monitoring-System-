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
        <div className="min-h-screen bg-white flex items-center justify-center p-4 relative overflow-hidden font-sans">
            {/* Background subtle gradients */}
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_20%_20%,rgba(37,99,235,0.05),transparent_50%)]"></div>
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-400/10 rounded-full blur-[120px] pointer-events-none"></div>
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-400/5 rounded-full blur-[120px] pointer-events-none"></div>

            <div className="bg-white/70 backdrop-blur-2xl border border-slate-200 p-8 md:p-10 rounded-[3rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] w-full max-w-md relative z-10">
                <div className="text-center mb-10">
                    <span className="text-5xl mb-6 block">🔐</span>
                    <h2 className="text-3xl font-black text-slate-800 tracking-tight leading-tight">
                        Official Access
                    </h2>
                    <p className="text-slate-500 mt-2 text-sm font-medium">Authorized Personnel Entry Only</p>
                </div>

                {error && (
                    <div className="bg-rose-50 border border-rose-100 text-rose-600 px-4 py-3 rounded-2xl text-center text-sm font-bold mb-6">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="flex flex-col gap-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] pl-1">Authorized Username</label>
                        <input 
                            type="text" 
                            className="bg-slate-50 border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 text-slate-800 rounded-2xl px-5 py-4 outline-none transition-all font-bold placeholder:font-normal placeholder:text-slate-300"
                            placeholder="e.g. admin_hq"
                            value={credentials.username}
                            onChange={(e) => setCredentials({...credentials, username: e.target.value})}
                            required 
                        />
                    </div>
                    
                    <div className="flex flex-col gap-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] pl-1">Secure Password</label>
                        <input 
                            type="password" 
                            className="bg-slate-50 border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 text-slate-800 rounded-2xl px-5 py-4 outline-none transition-all font-mono tracking-widest"
                            placeholder="••••••••"
                            value={credentials.password}
                            onChange={(e) => setCredentials({...credentials, password: e.target.value})}
                            required 
                        />
                    </div>

                    <button type="submit" className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black px-4 py-4.5 rounded-2xl transition-all shadow-xl shadow-slate-900/10 hover:scale-[1.02] active:scale-[0.98] mt-4">
                        Establish Connection
                    </button>
                </form>

                <div className="mt-12 text-center">
                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-300 mb-6">Secured Environment v4.2.0</p>
                    <div className="flex justify-center gap-2">
                        {[1,2,3].map(i => <div key={i} className="w-1 h-1 rounded-full bg-slate-200"></div>)}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Login;