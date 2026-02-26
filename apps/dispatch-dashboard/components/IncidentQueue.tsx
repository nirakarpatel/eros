'use client';

import React, { useEffect, useState } from 'react';
import { socket } from '@/lib/socket';
import { AlertCircle, Clock, MapPin, Ambulance, User } from 'lucide-react';

interface Emergency {
    id: string;
    citizenId: string;
    userProfile?: {
        name: string;
        phone: string;
        bloodType?: string;
        allergies?: string;
    };
    location: { lat: number; lng: number; address?: string };
    type: string;
    timestamp: string;
    status: 'pending' | 'dispatched' | 'enroute' | 'enroute_patient' | 'pickup' | 'enroute_hospital' | 'dropoff' | 'resolved';
}

export default function IncidentQueue() {
    const [emergencies, setEmergencies] = useState<Emergency[]>([]);

    useEffect(() => {
        const handleConnect = () => {
            console.log("IncidentQueue: Socket connected, requesting state");
            socket.emit('request_initial_state');
        };

        const handleNewEmergency = (data: Emergency) => {
            console.log("IncidentQueue: Received new_emergency", data.id);
            setEmergencies((prev) => [data, ...prev]);
        };

        const handleAmbulanceAssigned = (data: { ambId: string, incidentId: string, status: string }) => {
            setEmergencies((prev) => prev.map(e =>
                e.id === data.incidentId ? { ...e, status: data.status as any, assigned_ambulance_id: data.ambId } : e
            ));
        };

        const handlePendingIncidents = (data: Emergency[]) => {
            console.log("IncidentQueue: Received pending_incidents_update", data.length);
            setEmergencies(data);
        };

        const handleAmbulanceStatus = (data: { ambId: string, status: string, incidentId?: string }) => {
            setEmergencies((prev) => prev.map(e =>
                (e.id === data.incidentId || (e as any).assigned_ambulance_id === data.ambId)
                    ? { ...e, status: data.status as any }
                    : e
            ));
        };

        if (socket.connected) {
            socket.emit('request_initial_state');
        }

        socket.on('connect', handleConnect);
        socket.on('new_emergency', handleNewEmergency);
        socket.on('ambulance_assigned', handleAmbulanceAssigned);
        socket.on('pending_incidents_update', handlePendingIncidents);
        socket.on('ambulance_status_update', handleAmbulanceStatus);

        const retryInterval = setInterval(() => {
            setEmergencies(prev => {
                if (prev.length === 0) {
                    console.log("IncidentQueue: No incidents yet, retrying request...");
                    socket.emit('request_initial_state');
                }
                return prev;
            });
        }, 4000);

        return () => {
            socket.off('connect', handleConnect);
            socket.off('new_emergency', handleNewEmergency);
            socket.off('ambulance_assigned', handleAmbulanceAssigned);
            socket.off('pending_incidents_update', handlePendingIncidents);
            socket.off('ambulance_status_update', handleAmbulanceStatus);
            clearInterval(retryInterval);
        };
    }, []);

    const handleAssign = async (incidentId: string) => {
        try {
            // In a real system, we'd have an ambulance picker. 
            // For now, we'll let the backend pick the first available one via the manualAssign endpoint,
            // or we can fetch available ambulances here.

            const response = await fetch('http://127.0.0.1:4000/api/simulator/assign', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    incidentId
                })
            });
            const result = await response.json();
            if (!result.success) {
                alert(`Assignment failed: ${result.message}`);
            }
        } catch (e) {
            console.error('Manual assignment failed', e);
        }
    };

    return (
        <div className="bg-slate-900 text-white p-4 rounded-xl border border-slate-700 h-[600px] flex flex-col">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold flex items-center gap-2">
                    <AlertCircle className="text-red-500" />
                    Live Incident Queue
                </h2>
                <span className="bg-red-500/20 text-red-400 px-2 py-1 rounded text-xs font-mono">
                    {emergencies.length} ACTIVE
                </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                {emergencies.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-500 opacity-50">
                        <Clock size={48} className="mb-2" />
                        <p>Waiting for incoming SOS signals...</p>
                    </div>
                ) : (
                    emergencies.map((incident) => (
                        <div
                            key={incident.id}
                            className={`p-4 rounded-lg border bg-slate-800 transition-all cursor-pointer hover:border-slate-500 ${incident.status === 'pending'
                                ? 'border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.1)] animate-alert-blink'
                                : 'border-slate-700'
                                }`}
                        >
                            <div className="flex justify-between items-start mb-1">
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-sm uppercase tracking-wider text-red-500">{incident.type}</span>
                                    {incident.citizenId && !incident.citizenId.startsWith('DUMMY-') && (
                                        <span className="bg-green-500 text-white text-[8px] px-1.5 py-0.5 rounded-full font-black animate-pulse uppercase">Verified Citizen</span>
                                    )}
                                </div>
                                <span className="text-[10px] text-slate-400 font-mono tracking-tighter bg-slate-900 px-1.5 py-0.5 rounded">
                                    {new Date(incident.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                </span>
                            </div>

                            {incident.userProfile && (
                                <div className="mb-3 p-2 bg-slate-900/50 rounded border border-slate-700/50">
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className="w-6 h-6 rounded bg-red-600/20 flex items-center justify-center">
                                            <User size={12} className="text-red-500" />
                                        </div>
                                        <span className="font-bold text-xs">{incident.userProfile.name}</span>
                                        <span className="text-[10px] text-slate-500">{incident.userProfile.phone}</span>
                                    </div>
                                    <div className="flex gap-2 text-[10px]">
                                        <span className="bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded border border-red-500/20 font-bold">BLOOD: {incident.userProfile.bloodType}</span>
                                        {incident.userProfile.allergies && (
                                            <span className="bg-orange-500/10 text-orange-400 px-1.5 py-0.5 rounded border border-orange-500/20 font-bold">ALLERGY: {incident.userProfile.allergies}</span>
                                        )}
                                    </div>
                                </div>
                            )}

                            <div className="space-y-1 text-xs text-slate-300">
                                <div className="flex items-center gap-2">
                                    <MapPin size={12} className="text-slate-500" />
                                    <span className="truncate">{incident.location.address || `Lat: ${incident.location.lat.toFixed(4)}, Lng: ${incident.location.lng.toFixed(4)}`}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Ambulance size={12} className="text-slate-500" />
                                    <div className="flex items-center gap-2">
                                        <span className={`capitalize px-2 py-0.5 rounded-full text-[10px] font-black tracking-widest ${incident.status === 'pending' ? 'bg-red-500 text-white animate-pulse' : 'bg-blue-500/20 text-blue-400'
                                            }`}>
                                            {incident.status === 'pending' ? 'NEW EMERGENCY' : incident.status.replace('_', ' ')}
                                        </span>
                                        {(incident as any).assigned_ambulance_id && (
                                            <span className="text-slate-500 font-mono text-[10px]">
                                                ID: {(incident as any).assigned_ambulance_id}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {incident.status === 'pending' && (
                                <div className="mt-4 flex gap-2">
                                    <button
                                        onClick={() => handleAssign(incident.id)}
                                        className="flex-1 bg-red-600 hover:bg-red-700 text-white text-[10px] py-2 rounded font-black transition-all active:scale-95 uppercase tracking-widest shadow-lg shadow-red-900/20"
                                    >
                                        DISPATCH AMBULANCE
                                    </button>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
