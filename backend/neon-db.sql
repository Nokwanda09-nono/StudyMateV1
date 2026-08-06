-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    email_verified BOOLEAN DEFAULT FALSE,
    verification_code VARCHAR(6),
    verification_code_expires TIMESTAMP,
    verification_attempts INTEGER DEFAULT 0;
    qualification VARCHAR(50) NOT NULL,
    academic_goal VARCHAR(50) NOT NULL,
    year VACHAR(50) NOT NULL,
    learning_style VARCHAR(50) NOT NULL,
    study_challenges JSONB NOT NULL,
    study_hours VARCHAR(50) NOT NULL,
    productive_time VARCHAR(50) NOT NULL,
    reminder_frequency VARCHAR(50) NOT NULL,
    ai_support VARCHAR(50) NOT NULL,
    resource_recommendations VARCHAR(10) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- Create index for faster lookups
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_verification_token ON users(verification_token);
CREATE INDEX idx_user_profiles_user_id ON user_profiles(user_id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;