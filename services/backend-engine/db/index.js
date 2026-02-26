const { Pool } = require('pg');
const admin = require('firebase-admin');
require('dotenv').config();

// PostgreSQL Connection
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 5432,
});

// Firebase Initialization (Using Mock Logic if Config is Missing)
const setupFirebase = () => {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
        const serviceAccount = require(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        console.log('[FIREBASE] Initialized with Service Account');
    } else {
        console.log('[FIREBASE] Config missing - Running in Mock Mode');
    }
};

const db = {
    query: (text, params) => pool.query(text, params),
    firestore: () => {
        try {
            return admin.firestore();
        } catch (e) {
            console.warn('[FIREBASE] Firestore unavailable - Mocking data persist');
            return null;
        }
    }
};

setupFirebase();

module.exports = db;
