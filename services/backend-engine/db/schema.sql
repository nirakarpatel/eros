-- EROS Database Schema (PostgreSQL)

-- Hospitals Table
CREATE TABLE IF NOT EXISTS hospitals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    address TEXT,
    total_beds INTEGER DEFAULT 0,
    available_beds INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Incidents History Table
CREATE TABLE IF NOT EXISTS incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    citizen_id TEXT,
    emergency_type TEXT NOT NULL,
    location_lat DOUBLE PRECISION,
    location_lng DOUBLE PRECISION,
    location_address TEXT,
    assigned_ambulance_id TEXT,
    hospital_id UUID REFERENCES hospitals(id),
    status TEXT DEFAULT 'resolved',
    resolved_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Initial Mock Data
INSERT INTO hospitals (name, address, total_beds, available_beds) VALUES
('City General Hospital', '123 Central Ave', 200, 30),
('St. Mary Medical Center', '456 North Blvd', 150, 87),
('Emergency Trauma Care', '789 South Road', 100, 6)
ON CONFLICT DO NOTHING;
