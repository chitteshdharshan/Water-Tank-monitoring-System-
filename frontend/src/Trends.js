import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

function Trends({ tankId }) {
    const [data, setData] = useState([]);

    useEffect(() => {
        if (tankId) {
            fetchTrends();
        }
    }, [tankId]);

    const fetchTrends = async () => {
        try {
            const res = await fetch(`http://localhost:5001/api/public/trends/${tankId}`);
            const result = await res.json();
            const formatted = result.map(r => ({
                date: new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                pH: r.ph,
                Turbidity: r.turbidity
            }));
            setData(formatted);
        } catch (err) {
            console.error('Trend fetch error:', err);
        }
    };

    if (data.length === 0) return (
        <div className="text-center py-10 animate-pulse text-cyan-500/70 font-medium tracking-widest text-sm uppercase">
            Acquiring Sensor Data...
        </div>
    );

    return (
        <div className="w-full h-[350px] mt-4 filter drop-shadow-lg">
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 15, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                    <XAxis
                        dataKey="date"
                        stroke="#94a3b8"
                        tick={{ fill: '#94a3b8', fontSize: 12 }}
                        tickLine={{ stroke: '#475569' }}
                    />
                    <YAxis
                        yAxisId="left"
                        orientation="left"
                        stroke="#22d3ee"
                        domain={[0, 14]}
                        tick={{ fill: '#22d3ee', fontSize: 12 }}
                        tickLine={{ stroke: '#22d3ee' }}
                        axisLine={{ stroke: '#475569' }}
                    />
                    <YAxis
                        yAxisId="right"
                        orientation="right"
                        stroke="#fbbf24"
                        domain={[0, 'auto']}
                        tick={{ fill: '#fbbf24', fontSize: 12 }}
                        tickLine={{ stroke: '#fbbf24' }}
                        axisLine={{ stroke: '#475569' }}
                    />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: 'rgba(15, 23, 42, 0.8)',
                            backdropFilter: 'blur(12px)',
                            borderRadius: '12px',
                            border: '1px solid rgba(51, 65, 85, 0.8)',
                            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
                            color: '#f8fafc'
                        }}
                        itemStyle={{ color: '#e2e8f0', fontWeight: '500' }}
                        labelStyle={{ color: '#94a3b8', marginBottom: '4px', fontWeight: 'bold' }}
                    />
                    <Legend verticalAlign="top" height={40} wrapperStyle={{ paddingBottom: '10px' }} />
                    <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="pH"
                        stroke="#22d3ee"
                        strokeWidth={4}
                        dot={{ r: 5, strokeWidth: 0, fill: '#22d3ee' }}
                        activeDot={{ r: 8, strokeWidth: 2, stroke: '#fff' }}
                        name="pH Level"
                    />
                    <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="Turbidity"
                        stroke="#fbbf24"
                        strokeWidth={4}
                        dot={{ r: 5, strokeWidth: 0, fill: '#fbbf24' }}
                        activeDot={{ r: 8, strokeWidth: 2, stroke: '#fff' }}
                        name="Turbidity (NTU)"
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}

export default Trends;
