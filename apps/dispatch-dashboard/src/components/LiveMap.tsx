import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { socket } from '../lib/socket';

// Custom Ambulance Icon
const createAmbulanceIcon = (heading: number, status: string) => {
    const color = status === 'available' ? '#3b82f6' : '#eab308';
    return L.divIcon({
        className: 'custom-div-icon',
        html: `
      <div style="transform: rotate(${heading}deg); transition: transform 0.5s linear;">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" class="${status !== 'available' ? 'animate-pulse' : ''}">
          <rect x="6" y="4" width="12" height="16" rx="2" stroke="${color}" stroke-width="2" fill="rgba(15, 23, 42, 0.8)"/>
          <path d="M6 8H18" stroke="${color}" stroke-width="1" />
          <rect x="9" y="5" width="6" height="3" fill="${color}" opacity="0.4" />
          <circle cx="12" cy="10" r="1.5" fill="${status === 'available' ? 'transparent' : 'red'}">
            <animate attributeName="opacity" values="0;1;0" dur="0.5s" repeatCount="indefinite" />
          </circle>
        </svg>
      </div>
    `,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
    });
};

// Custom Hospital Icon
const hospitalIcon = L.divIcon({
    className: 'hospital-icon',
    html: `
    <div class="bg-red-600 w-8 h-8 rounded-lg flex items-center justify-center border-2 border-white shadow-lg">
      <span class="text-white font-black text-xs">H</span>
    </div>
  `,
    iconSize: [32, 32],
    iconAnchor: [16, 16]
});

// SOS Icon with Name Label
const createSOSIcon = (name: string, status: string = 'pending') => {
    const isBlinking = status === 'pending' || status === 'dispatched';
    return L.divIcon({
        className: 'sos-icon',
        html: `
            <div class="relative flex flex-col items-center">
                <div class="absolute -top-8 bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-lg whitespace-nowrap ${isBlinking ? 'animate-bounce' : ''}">
                    ${isBlinking ? name.split(' ')[0] + ' NEEDED' : 'PATIENT ON BOARD'}
                </div>
                <div class="relative">
                    ${isBlinking ? '<div class="absolute -inset-4 bg-red-500/20 rounded-full animate-ping"></div>' : ''}
                    <div class="w-4 h-4 bg-red-600 rounded-full border-2 border-white shadow-xl"></div>
                </div>
            </div>
        `,
        iconSize: [16, 16],
        iconAnchor: [8, 8]
    });
};

// Map auto-focus helper
const MapFlyTo = ({ coords }: { coords: [number, number] | null }) => {
    const map = useMap();
    useEffect(() => {
        if (coords) {
            map.flyTo(coords, 13, { duration: 2 });
        }
    }, [coords, map]);
    return null;
};

export default function LiveMap() {
    const [ambulances, setAmbulances] = useState<any[]>([]);
    const [hospitals, setHospitals] = useState<any[]>([]);
    const [activeSOS, setActiveSOS] = useState<any[]>([]);
    const [latestIncidentLoc, setLatestIncidentLoc] = useState<[number, number] | null>(null);
    const [prevLocs, setPrevLocs] = useState<Record<string, any>>({});

    useEffect(() => {
        const handleAmbulances = (data: any[]) => {
            setAmbulances(currData => {
                const updated = currData.map(c => {
                    const matched = data.find(d => d.id === c.id);
                    return matched || c;
                });

                // Add new ones if they don't exist
                data.forEach(d => {
                    if (!updated.find(u => u.id === d.id)) {
                        updated.push(d);
                    }
                });

                return updated.map(curr => {
                    const prev = prevLocs[curr.id];
                    let heading = curr.heading || 0;
                    if (prev && curr.location) {
                        heading = Math.atan2(curr.location.lat - prev.lat, curr.location.lng - prev.lng) * (180 / Math.PI);
                    }
                    return { ...curr, heading };
                });
            });

            const newPrev: Record<string, any> = {};
            data.forEach(a => newPrev[a.id] = a.location);
            setPrevLocs(newPrev);
        };

        const handleHospitals = (data: any[]) => {
            setHospitals(data);
        };

        const handleNewEmergency = (data: any) => {
            setLatestIncidentLoc([data.location.lat, data.location.lng]);
        };

        const handlePending = (data: any[]) => {
            setActiveSOS(data);
        };

        const handleConnect = () => {
            socket.emit('request_initial_state');
        };

        if (socket.connected) {
            socket.emit('request_initial_state');
        }

        socket.on('connect', handleConnect);
        socket.on('all_ambulances_update', handleAmbulances);
        socket.on('hospitals_update', handleHospitals);
        socket.on('new_emergency', handleNewEmergency);
        socket.on('pending_incidents_update', handlePending);

        const retryInterval = setInterval(() => {
            setAmbulances(prev => {
                if (prev.length === 0) {
                    socket.emit('request_initial_state');
                }
                return prev;
            });
        }, 5000);

        return () => {
            socket.off('connect', handleConnect);
            socket.off('all_ambulances_update', handleAmbulances);
            socket.off('hospitals_update', handleHospitals);
            socket.off('new_emergency', handleNewEmergency);
            socket.off('pending_incidents_update', handlePending);
            clearInterval(retryInterval);
        };
    }, [prevLocs]);

    return (
        <div className="w-full h-full rounded-xl overflow-hidden bg-slate-900 border border-slate-800">
            <MapContainer
                center={[20.5937, 78.9629]}
                zoom={5}
                style={{ height: '100%', width: '100%' }}
                zoomControl={false}
            >
                <MapFlyTo coords={latestIncidentLoc} />
                <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                    attribution='&copy; OpenStreetMap &copy; CARTO'
                />

                {/* Hospitals */}
                {hospitals.map(hosp => (
                    <Marker
                        key={hosp.id}
                        position={[hosp.location.lat, hosp.location.lng]}
                        icon={hospitalIcon}
                    />
                ))}

                {/* SOS Alerts */}
                {activeSOS.map(sos => (
                    <Marker
                        key={sos.id}
                        position={[sos.location.lat, sos.location.lng]}
                        icon={createSOSIcon(sos.userProfile?.name || 'Emergency', sos.status)}
                    />
                ))}

                {/* Ambulances */}
                {ambulances.map(amb => (
                    <Marker
                        key={amb.id}
                        position={[amb.location.lat, amb.location.lng]}
                        icon={createAmbulanceIcon(amb.heading || 0, amb.status)}
                    >
                        <Popup>
                            <div className="p-1">
                                <p className="font-bold">{amb.id}</p>
                                <p className="text-[10px] uppercase">{amb.status.replace('_', ' ')}</p>
                            </div>
                        </Popup>
                    </Marker>
                ))}
            </MapContainer>

            {/* Legend Overlay */}
            <div className="absolute bottom-6 right-6 z-10 bg-slate-900/90 backdrop-blur-md border border-slate-700 p-4 rounded-2xl shadow-2xl flex flex-col gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-blue-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
                    <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Available Units</span>
                </div>
                <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(234,179,8,0.5)]"></div>
                    <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Active Dispatch</span>
                </div>
                <div className="flex items-center gap-3">
                    <div className="w-4 h-4 bg-red-600 rounded flex items-center justify-center text-[8px] font-black text-white">H</div>
                    <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Mapped Hospitals</span>
                </div>
            </div>
        </div>
    );
}
