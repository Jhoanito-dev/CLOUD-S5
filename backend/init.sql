-- Database initialization script for Road Works Management System
-- Pour PostgreSQL local (base: postgres, user: postgres, mdp: 132416102004)

-- Drop existing types if they exist (pour éviter les erreurs si on relance le script)
DROP TYPE IF EXISTS user_role CASCADE;
DROP TYPE IF EXISTS report_status CASCADE;

-- Create enum for user roles
CREATE TYPE user_role AS ENUM ('visitor', 'user', 'manager');

-- Create enum for report status
CREATE TYPE report_status AS ENUM ('new', 'in_progress', 'done');

-- Drop existing tables if they exist (pour réinitialiser proprement)
DROP TABLE IF EXISTS sync_log CASCADE;
DROP TABLE IF EXISTS login_attempts CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS reports CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    uid VARCHAR(128) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    role user_role DEFAULT 'user',
    login_attempts INTEGER DEFAULT 0,
    blocked_until TIMESTAMP,
    is_blocked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Reports (Signalements) table
CREATE TABLE reports (
    id SERIAL PRIMARY KEY,
    uid VARCHAR(128) NOT NULL,
    user_id INTEGER REFERENCES users(id),
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    description TEXT,
    surface DECIMAL(10, 2),
    budget DECIMAL(15, 2),
    company VARCHAR(255),
    status report_status DEFAULT 'new',
    photo_url TEXT,
    date_nouveau TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    date_en_cours TIMESTAMP,
    date_termine TIMESTAMP,
    is_deleted BOOLEAN DEFAULT FALSE,
    firebase_synced BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sessions table for token management
CREATE TABLE sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    token VARCHAR(500) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Login attempts log
CREATE TABLE login_attempts (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    ip_address VARCHAR(45),
    success BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sync log for Firebase synchronization
CREATE TABLE sync_log (
    id SERIAL PRIMARY KEY,
    direction VARCHAR(20) NOT NULL,
    records_count INTEGER DEFAULT 0,
    status VARCHAR(50),
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_uid ON users(uid);
CREATE INDEX IF NOT EXISTS idx_reports_user_id ON reports(user_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_uid ON reports(uid);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);

-- Insert default manager account
INSERT INTO users (uid, email, password_hash, first_name, last_name, role) 
VALUES (
    'manager-default-uid',
    'manager@roadworks.mg',
    '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- password: 'password'
    'Admin',
    'Manager',
    'manager'
) ON CONFLICT (email) DO NOTHING;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for auto-updating updated_at
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_reports_updated_at ON reports;
CREATE TRIGGER update_reports_updated_at BEFORE UPDATE ON reports
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
