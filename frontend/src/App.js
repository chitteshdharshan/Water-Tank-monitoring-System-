import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import PublicView from './PublicView';
import Login from './Login';
import OfficialDashboard from './OfficialDashboard';
import './App.css';

const ProtectedRoute = ({ children }) => {
    const token = localStorage.getItem('token');
    if (!token) return <Navigate to="/admin" replace />;
    return children;
};

function App() {
    return (
        <Router>
            <div className="min-h-screen bg-slate-50">
                <Routes>
                    <Route path="/" element={<PublicView />} />
                    <Route path="/admin" element={<Login />} />
                    <Route path="/dashboard" element={<ProtectedRoute><OfficialDashboard /></ProtectedRoute>} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </div>
        </Router>
    );
}

export default App;