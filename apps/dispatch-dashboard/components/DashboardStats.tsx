'use client';

import React, { useEffect, useState } from 'react';
import { Ambulance, Activity, Home, Users } from 'lucide-react';
import { socket } from '@/lib/socket';

export default function DashboardStats() {
    const [statsData, setStatsData] = useState({
        activeUnits: 0,
        incidents: 0,
        beds: 0,
        staff: 64
    });

    useEffect(() => {
        const handleConnect = () => {
            console.log("DashboardStats: Socket connected, requesting state");
            socket.emit('request_initial_state');
        };

        const handleHospitals = (data: any[]) => {
            console.log("DashboardStats: Received hospitals_update", data.length);
            const totalBeds = data.reduce((acc, h) => acc + h.beds, 0);
            setStatsData(prev => ({ ...prev, beds: totalBeds }));
        };

        const handleAmbulances = (data: any[]) => {
            console.log("DashboardStats: Received all_ambulances_update", data.length);
            const busyCount = data.filter(a => a.status === 'busy').length;
            setStatsData(prev => ({ ...prev, activeUnits: busyCount }));
        };

        const handlePending = (data: any[]) => {
            console.log("DashboardStats: Received pending_incidents_update", data.length);
            setStatsData(prev => ({ ...prev, incidents: data.length }));
        };

        if (socket.connected) {
            socket.emit('request_initial_state');
        }

        socket.on('connect', handleConnect);
        socket.on('hospitals_update', handleHospitals);
        socket.on('all_ambulances_update', handleAmbulances);
        socket.on('pending_incidents_update', handlePending);

        const retryInterval = setInterval(() => {
            setStatsData(prev => {
                if (prev.beds === 0) {
                    console.log("DashboardStats: No data yet, retrying request...");
                    socket.emit('request_initial_state');
                }
                return prev;
            });
        }, 3000);

        return () => {
            socket.off('connect', handleConnect);
            socket.off('hospitals_update', handleHospitals);
            socket.off('all_ambulances_update', handleAmbulances);
            socket.off('pending_incidents_update', handlePending);
            clearInterval(retryInterval);
        };
    }, []);

    const stats = [
        { label: 'Active Units', value: statsData.activeUnits.toString().padStart(2, '0'), icon: Ambulance, color: 'text-blue-400', bg: 'bg-blue-400/10' },
        { label: 'Queue Depth', value: statsData.incidents.toString().padStart(2, '0'), icon: Activity, color: 'text-red-400', bg: 'bg-red-400/10' },
        { label: 'Available Beds', value: statsData.beds.toString().padStart(3, '0'), icon: Home, color: 'text-green-400', bg: 'bg-green-400/10' },
        { label: 'Staff On-Duty', value: statsData.staff.toString(), icon: Users, color: 'text-purple-400', bg: 'bg-purple-400/10' },
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {stats.map((stat) => (
                <div key={stat.label} className="bg-slate-900/50 backdrop-blur-md border border-slate-800 p-6 rounded-2xl hover:border-slate-700 transition-colors shadow-lg">
                    <div className="flex items-center justify-between mb-4">
                        <div className={`p-3 rounded-xl ${stat.bg}`}>
                            <stat.icon size={24} className={stat.color} />
                        </div>
                        <div className="h-1 w-12 bg-slate-800 rounded-full"></div>
                    </div>
                    <div>
                        <p className="text-sm text-slate-400 font-bold uppercase tracking-wider">{stat.label}</p>
                        <h3 className="text-3xl font-black mt-1">{stat.value}</h3>
                    </div>
                </div>
            ))}
        </div>
    );
}
