import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import PublicView from './PublicView';
import Login from './Login';
import OfficialDashboard from './OfficialDashboard';
import './App.css';

// Protected Route Component
const ProtectedRoute = ({ children }) => {
    const token = localStorage.getItem('token');
    if (!token) {
        return <Navigate to="/admin" replace />;
    }
    return children;
};

function App() {
    return (
        <Router>
            <div className="App">
                <Routes>
                    {/* Public Portal */}
                    <Route path="/" element={<PublicView />} />
                    
                    {/* Official Portal Login */}
                    <Route path="/admin" element={<Login />} />
                    
                    {/* Protected Dashboard */}
                    <Route 
                        path="/dashboard" 
                        element={
                            <ProtectedRoute>
                                <OfficialDashboard />
                            </ProtectedRoute>
                        } 
                    />

                    {/* Fallback */}
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </div>
        </Router>
    );
}

export default App;