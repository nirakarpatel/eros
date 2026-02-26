const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const EROSSimulator = require('./simulator');
const db = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const simulator = new EROSSimulator(io);

const PORT = process.env.PORT || 4000;

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        message: 'EROS Backend Engine is running.',
        simulator: simulator.simulatorActive ? 'active' : 'inactive'
    });
});

// Simulator Toggle
app.post('/api/simulator/toggle', (req, res) => {
    const { active } = req.body;
    if (active) {
        simulator.start();
    } else {
        simulator.stop();
    }
    res.json({ success: true, active: simulator.simulatorActive });
});

// Simulator Manual Dispatch
app.post('/api/simulator/assign', async (req, res) => {
    const { incidentId, ambulanceId } = req.body;
    const result = await simulator.manualAssign(incidentId, ambulanceId);
    res.json(result);
});

// Simulator Auto-Dispatch Toggle
app.post('/api/simulator/auto-dispatch', (req, res) => {
    const { enabled } = req.body;
    simulator.toggleAutoDispatch(enabled);
    res.json({ success: true, autoDispatch: simulator.autoDispatch });
});

// Registration endpoint (Simple persistence for demo)
app.post('/api/register', (req, res) => {
    const { phone, name, bloodType, allergies } = req.body;
    console.log(`[USER REGISTERED] Name: ${name}, Phone: ${phone}`);
    res.json({ success: true, message: 'User registered successfully' });
});

// SOS Trigger endpoint
app.post('/api/sos', async (req, res) => {
    const { citizenId, location, type, userProfile } = req.body;
    const emergencyId = Date.now().toString();

    console.log(`[SOS TRIGGERED] Citizen: ${citizenId}, Location: ${JSON.stringify(location)}, Type: ${type}`);
    if (userProfile) {
        console.log(`[PROFILE ATTACHED] Name: ${userProfile.name}, Blood Type: ${userProfile.bloodType}`);
    }

    const incidentData = {
        id: emergencyId,
        citizenId,
        userProfile,
        location,
        city: req.body.city || (location && location.city),
        type,
        timestamp: new Date().toISOString(),
        status: 'pending'
    };

    // Persist to Firestore if available
    const firestore = db.firestore();
    if (firestore) {
        try {
            await firestore.collection('active_incidents').doc(emergencyId).set(incidentData);
            console.log(`[FIREBASE] Incident ${emergencyId} persisted.`);
        } catch (e) {
            console.error('[FIREBASE] Error persisting incident:', e.message);
        }
    }

    // Register with simulator for ambulance movement and broadcasting
    simulator.handleRealSOS(incidentData);

    res.status(202).json({ success: true, message: 'SOS received and broadcasting.', id: emergencyId });
});

io.on('connection', (socket) => {
    console.log(`[SOCKET CONNECTED] ID: ${socket.id}`);

    socket.on('disconnect', () => {
        console.log(`[SOCKET DISCONNECTED] ID: ${socket.id}`);
    });

    // Handle ambulance status updates
    socket.on('update_ambulance_location', (data) => {
        // data: { ambulanceId, location }
        socket.broadcast.emit('ambulance_location_update', data);
    });
});

server.listen(PORT, () => {
    console.log(`EROS Backend Engine listening on port ${PORT}`);
});
