const axios = require('axios');
const { generateIndiaHospitals, INDIA_CITIES } = require('./hospitals_india');

class EROSSimulator {
    constructor(io) {
        this.io = io;

        this.hospitals = generateIndiaHospitals();

        // Fleet Distribution: Place 2-3 ambulances in each major city at start
        this.ambulances = [];
        let ambCounter = 101;

        INDIA_CITIES.forEach(city => {
            const cityHospitals = this.hospitals.filter(h => h.city === city.name);
            cityHospitals.forEach(hosp => {
                for (let i = 0; i < 10; i++) {
                    this.ambulances.push({
                        id: `AMB-${ambCounter++}`,
                        location: { ...hosp.location },
                        status: 'available',
                        baseHospitalId: hosp.id,
                        city: city.name
                    });
                }
            });
        });

        this.reserveUnits = [];
        // Add reserves at each city
        INDIA_CITIES.forEach((city, cityIdx) => {
            for (let i = 1; i <= 5; i++) {
                const hospId = this.hospitals.find(h => h.city === city.name).id;
                this.reserveUnits.push({
                    id: `AMB-RE-${city.name.substring(0, 3).toUpperCase()}-${i}`,
                    status: 'reserve',
                    baseHospitalId: hospId,
                    city: city.name
                });
            }
        });

        this.activeIncidents = new Map();
        this.pendingIncidents = new Map();
        this.simulatorActive = true; // Auto-start for Hackathon
        this.autoDispatch = true;

        // Force start movement interval immediately
        this.movementInterval = setInterval(() => this.updateSimulationStep(), 1500);
        this.sosInterval = setInterval(() => this.generateRandomSOS(), 5000);

        // Handle initial state requests
        this.io.on('connection', (socket) => {
            console.log(`[SIMULATOR] New client connection: ${socket.id}`);
            socket.on('request_initial_state', () => {
                console.log(`[SIMULATOR] Initial state requested by: ${socket.id}`);
                socket.emit('all_ambulances_update', this.ambulances);
                socket.emit('hospitals_update', this.hospitals);
                socket.emit('pending_incidents_update', Array.from(this.pendingIncidents.values()));
                socket.emit('auto_dispatch_status', { enabled: this.autoDispatch });
            });
        });
    }

    start() {
        this.simulatorActive = true;
        console.log('[SIMULATOR] Engine Started with Dynamic Scaling');

        // Prevent interval leakage
        clearInterval(this.sosInterval);
        clearInterval(this.movementInterval);

        // Generate SOS more frequently to test surge
        this.sosInterval = setInterval(() => this.generateRandomSOS(), 5000);
        this.movementInterval = setInterval(() => this.updateSimulationStep(), 1500); // Faster updates

        this.broadcastState();
    }

    toggleAutoDispatch(enabled) {
        this.autoDispatch = enabled;
        console.log(`[SIMULATOR] Auto-Dispatch: ${this.autoDispatch ? 'ENABLED' : 'DISABLED'}`);
        this.io.emit('auto_dispatch_status', { enabled: this.autoDispatch });
    }

    stop() {
        this.simulatorActive = false;
        clearInterval(this.sosInterval);
        clearInterval(this.movementInterval);
        console.log('[SIMULATOR] Engine Stopped');
    }

    broadcastState() {
        this.io.emit('all_ambulances_update', this.ambulances);
        this.io.emit('hospitals_update', this.hospitals);
        this.io.emit('pending_incidents_update', Array.from(this.pendingIncidents.values()));
    }

    handleRealSOS(incident) {
        const incidentId = incident.id;
        const fullIncident = {
            ...incident,
            status: 'pending',
            id: incidentId
        };

        this.pendingIncidents.set(incidentId, fullIncident);
        console.log(`[SIMULATOR] Real SOS Linked: ${incidentId} (${incident.userProfile?.name})`);

        this.checkSurgeAndReleaseUnits(incident.city);

        // Broadcast new incident to all dispatchers
        this.io.emit('new_emergency', fullIncident);

        if (this.autoDispatch && this.simulatorActive) {
            // Slight delay to ensure frontend processes 'new_emergency' first
            setTimeout(() => {
                if (this.pendingIncidents.has(incidentId)) {
                    this.autoAssignAmbulance(incidentId, fullIncident);
                }
            }, 1000);
        }
    }

    async generateRandomSOS() {
        if (!this.simulatorActive) return;

        // More frequent for the demo - 33% chance every 5 seconds
        if (Math.random() > 0.33) return;

        const city = INDIA_CITIES[Math.floor(Math.random() * INDIA_CITIES.length)];
        const lat = city.lat + (Math.random() - 0.5) * 0.15;
        const lng = city.lng + (Math.random() - 0.5) * 0.15;

        const types = ['Minor Trauma', 'Wellness Check', 'Vehicle Breakdown'];
        const type = types[Math.floor(Math.random() * types.length)];

        const incident = {
            citizenId: `DUMMY-${Math.floor(Math.random() * 9000) + 1000}`,
            userProfile: { name: 'Demo Incident' },
            location: { lat, lng, address: `Demo Alert in ${city.name}` },
            city: city.name,
            type,
            timestamp: new Date().toISOString()
        };

        try {
            const API_URL = process.env.API_URL || 'http://127.0.0.1:4000';
            const response = await axios.post(`${API_URL}/api/sos`, incident);
            const incidentId = response.data.id;
            this.pendingIncidents.set(incidentId, { ...incident, id: incidentId, status: 'pending' });
            this.broadcastState();
        } catch (e) {
            console.error('[SIMULATOR] Dummy SOS Fail:', e.message);
        }
    }

    checkSurgeAndReleaseUnits(cityName) {
        const pendingInCity = Array.from(this.pendingIncidents.values()).filter(p => p.city === cityName).length;
        const availableInCity = this.ambulances.filter(a => a.status === 'available' && a.city === cityName).length;

        if (pendingInCity > availableInCity) {
            const reserveIndex = this.reserveUnits.findIndex(r => r.city === cityName);
            if (reserveIndex !== -1) {
                console.log(`[SIMULATOR] SURGE in ${cityName}! Releasing reserve unit...`);
                const unit = this.reserveUnits.splice(reserveIndex, 1)[0];
                const hospital = this.hospitals.find(h => h.id === unit.baseHospitalId);

                this.ambulances.push({
                    ...unit,
                    location: { ...hospital.location },
                    status: 'available'
                });
                this.broadcastState();
            }
        }
    }

    async autoAssignAmbulance(incidentId, incident) {
        // Find ambulances in the same city first
        const localAvailable = this.ambulances.filter(a => a.status === 'available' && a.city === incident.city);

        if (localAvailable.length > 0) {
            // Sort by Euclidean distance (as proxy for drive time)
            const bestAmb = localAvailable.sort((a, b) => {
                const d1 = Math.sqrt(Math.pow(a.location.lat - incident.location.lat, 2) + Math.pow(a.location.lng - incident.location.lng, 2));
                const d2 = Math.sqrt(Math.pow(b.location.lat - incident.location.lat, 2) + Math.pow(b.location.lng - incident.location.lng, 2));
                return d1 - d2;
            })[0];

            this.assignAmbulance(incidentId, bestAmb.id, incident.location);
        } else {
            // No available unit in city, check inter-city (rare but possible in simulation)
            const anyAvailable = this.ambulances.find(a => a.status === 'available');
            if (anyAvailable) this.assignAmbulance(incidentId, anyAvailable.id, incident.location);
        }
    }

    assignAmbulance(incidentId, ambId, targetLocation) {
        const amb = this.ambulances.find(a => a.id === ambId);
        if (!amb) return;

        amb.status = 'busy';
        this.activeIncidents.set(ambId, {
            incidentId,
            targetLocation,
            status: 'enroute_patient',
            patientLocation: targetLocation,
            path: [], // Road path points
            pathIndex: 0
        });

        this.fetchRoute(ambId, amb.location, targetLocation);

        // Update status in pending list for visualization
        const incident = this.pendingIncidents.get(incidentId);
        if (incident) {
            incident.status = 'dispatched';
        }

        console.log(`[SIMULATOR] ${ambId} dispatched to ${incidentId}`);
        this.io.emit('ambulance_assigned', { ambId, incidentId, status: 'enroute', location: targetLocation, ambulance: amb });
        this.broadcastState();
    }

    async fetchRoute(ambId, start, end) {
        try {
            const url = `http://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`;
            const response = await axios.get(url);

            if (response.data.code === 'Ok') {
                const coordinates = response.data.routes[0].geometry.coordinates;
                const path = coordinates.map(c => ({ lat: c[1], lng: c[0] }));
                const active = this.activeIncidents.get(ambId);
                if (active) {
                    active.path = path;
                    active.pathIndex = 0;
                    console.log(`[SIMULATOR] Path found for ${ambId}: ${path.length} points`);
                }
            }
        } catch (e) {
            console.error(`[SIMULATOR] Route fetch fail for ${ambId}:`, e.message);
        }
    }

    updateSimulationStep() {
        if (!this.simulatorActive) return;

        this.ambulances.forEach(amb => {
            const active = this.activeIncidents.get(amb.id);
            if (!active) {
                // Return to base logic if available and not at base
                if (amb.status === 'available') {
                    const baseHosp = this.hospitals.find(h => h.id === amb.baseHospitalId);
                    const distH = Math.sqrt(Math.pow(baseHosp.location.lat - amb.location.lat, 2) + Math.pow(baseHosp.location.lng - amb.location.lng, 2));
                    if (distH > 0.001) {
                        this.moveTowards(amb, baseHosp.location, 0.002);
                    }
                }
                return;
            }

            if (active.path && active.path.length > 0) {
                // Move along the path
                const targetPoint = active.path[active.pathIndex];
                const distToPoint = Math.sqrt(Math.pow(targetPoint.lat - amb.location.lat, 2) + Math.pow(targetPoint.lng - amb.location.lng, 2));

                if (distToPoint < 0.0005) {
                    active.pathIndex++;
                    if (active.pathIndex >= active.path.length) {
                        // Reached end of path
                        this.handleStateTransition(amb, active);
                    }
                } else {
                    this.moveTowards(amb, targetPoint, 0.003); // Adjust speed for road following
                }
            } else {
                // Fallback to straight line if no path yet
                const dist = Math.sqrt(Math.pow(active.targetLocation.lat - amb.location.lat, 2) + Math.pow(active.targetLocation.lng - amb.location.lng, 2));
                if (dist < 0.003) {
                    amb.location = { ...active.targetLocation };
                    this.handleStateTransition(amb, active);
                } else {
                    this.moveTowards(amb, active.targetLocation, 0.004);
                }
            }

            // Sync incident location with ambulance if patient is on board
            if (active.status === 'pickup' || active.status === 'enroute_hospital') {
                const incident = this.pendingIncidents.get(active.incidentId);
                if (incident) {
                    incident.location = { ...amb.location };
                    incident.status = active.status;
                }
            }
        });

        this.broadcastState();
    }

    moveTowards(unit, target, speed) {
        const distLat = target.lat - unit.location.lat;
        const distLng = target.lng - unit.location.lng;
        const distance = Math.sqrt(distLat * distLat + distLng * distLng);

        if (distance <= speed) {
            unit.location.lat = target.lat;
            unit.location.lng = target.lng;
            return;
        }

        unit.location.lat += (distLat / distance) * speed;
        unit.location.lng += (distLng / distance) * speed;
    }

    handleStateTransition(amb, active) {
        switch (active.status) {
            case 'enroute_patient':
                active.status = 'pickup';
                this.io.emit('ambulance_status_update', { ambId: amb.id, status: 'pickup', incidentId: active.incidentId });
                setTimeout(() => {
                    const nearestHosp = this.findNearestHospital(amb.location);
                    if (nearestHosp) {
                        active.status = 'enroute_hospital';
                        active.targetLocation = nearestHosp.location;
                        active.hospitalId = nearestHosp.id;
                        this.io.emit('ambulance_status_update', { ambId: amb.id, status: 'enroute_hospital', incidentId: active.incidentId });

                        // Fetch new route to hospital
                        this.fetchRoute(amb.id, amb.location, nearestHosp.location);
                    }
                }, 4000);
                break;

            case 'enroute_hospital':
                active.status = 'dropoff';
                this.io.emit('ambulance_status_update', { ambId: amb.id, status: 'dropoff', incidentId: active.incidentId });
                setTimeout(() => {
                    this.completeIncident(amb, active);
                }, 4000);
                break;
        }
    }

    findNearestHospital(loc) {
        return this.hospitals.filter(h => h.beds > 0).sort((a, b) => {
            return Math.sqrt(Math.pow(a.location.lat - loc.lat, 2) + Math.pow(a.location.lng - loc.lng, 2)) -
                Math.sqrt(Math.pow(b.location.lat - loc.lat, 2) + Math.pow(b.location.lng - loc.lng, 2));
        })[0];
    }

    completeIncident(amb, active) {
        const hosp = this.hospitals.find(h => h.id === active.hospitalId);
        if (hosp) hosp.beds--;

        amb.status = 'available';
        this.activeIncidents.delete(amb.id);
        this.pendingIncidents.delete(active.incidentId);

        // If it was a reserve unit, decide whether to keep or decommission
        if (amb.id.includes('RES') && this.pendingIncidents.size === 0) {
            // decommissioning purely for demo scaling, or keep them? 
            // let's keep them and they will return to their baseHospitalId
        }

        this.io.emit('ambulance_status_update', { ambId: amb.id, status: 'available' });
        this.broadcastState();
    }

    async manualAssign(incidentId, ambId) {
        const incident = this.pendingIncidents.get(incidentId);
        if (!incident) return { success: false, message: 'Incident not found' };

        let amb;
        if (ambId) {
            amb = this.ambulances.find(a => a.id === ambId);
            if (!amb || amb.status !== 'available') return { success: false, message: 'Ambulance busy' };
        } else {
            // Find nearest available
            const available = this.ambulances.filter(a => a.status === 'available');
            if (available.length === 0) return { success: false, message: 'No ambulances available' };

            amb = available.sort((a, b) => {
                const d1 = Math.sqrt(Math.pow(a.location.lat - incident.location.lat, 2) + Math.pow(a.location.lng - incident.location.lng, 2));
                const d2 = Math.sqrt(Math.pow(b.location.lat - incident.location.lat, 2) + Math.pow(b.location.lng - incident.location.lng, 2));
                return d1 - d2;
            })[0];
        }

        this.assignAmbulance(incidentId, amb.id, incident.location);
        return { success: true, ambulanceId: amb.id };
    }
}

module.exports = EROSSimulator;
