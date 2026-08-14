const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { neon } = require('@neondatabase/serverless');
const { mg, DOMAIN, FROM_EMAIL } = require('./mailgun.config');
require('dotenv').config();

// Development defaults for quick local testing (do NOT use in production).
if (process.env.NODE_ENV !== 'production') {
  process.env.DEV_USER_EMAIL = process.env.DEV_USER_EMAIL || 'test@example.com';
  process.env.DEV_USER_PASSWORD = process.env.DEV_USER_PASSWORD || 'password123';
  process.env.DEV_USER_FIRSTNAME = process.env.DEV_USER_FIRSTNAME || 'Dev';
  process.env.DEV_USER_LASTNAME = process.env.DEV_USER_LASTNAME || 'User';
}

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key';

// Middleware
app.use(cors({
  origin: 'http://localhost:8081',
  credentials: true
}));
app.use(express.json());

// Neon Database Connection
let sql;
if (process.env.DATABASE_URL) {
  sql = neon(process.env.DATABASE_URL);
} else {
  console.warn('⚠️ DATABASE_URL not set. Database calls will fail until configured.');
  sql = async function() {
    throw new Error('No DATABASE_URL configured. Set DATABASE_URL in environment.');
  };
}

// ==================== DATABASE INITIALIZATION ====================

/**
 * Create tables if they don't exist
 * This runs automatically when the server starts
 */
const initializeDatabase = async () => {
  try {
    console.log('🔧 Initializing database tables...');

    // Create users table
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        email_verified BOOLEAN DEFAULT FALSE,
        onboarding_completed BOOLEAN DEFAULT FALSE,
        verification_code VARCHAR(6),
        verification_code_expires TIMESTAMP,
        verification_attempts INTEGER DEFAULT 0,
        role VARCHAR(50) DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Add missing columns for existing deployments created from older schemas
    await sql`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255),
      ADD COLUMN IF NOT EXISTS first_name VARCHAR(100),
      ADD COLUMN IF NOT EXISTS last_name VARCHAR(100),
      ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS verification_code VARCHAR(6),
      ADD COLUMN IF NOT EXISTS verification_code_expires TIMESTAMP,
      ADD COLUMN IF NOT EXISTS verification_attempts INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'user',
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    `;
    console.log('✅ Users table ready');

    // Create user_profiles table
    await sql`
      CREATE TABLE IF NOT EXISTS user_profiles (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        qualification VARCHAR(50) NOT NULL,
        year VARCHAR(50) NOT NULL,
        academic_goal VARCHAR(50) NOT NULL,
        learning_style VARCHAR(50) NOT NULL,
        study_challenges JSONB NOT NULL,
        study_hours VARCHAR(50) NOT NULL,
        productive_time VARCHAR(50) NOT NULL,
        reminder_frequency VARCHAR(50) NOT NULL,
        ai_support VARCHAR(50) NOT NULL,
        resource_recommendations VARCHAR(10) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id)
      )
    `;
    console.log('✅ User profiles table ready');

    // ===== SCHEDULE TABLES =====
    await sql`
      CREATE TABLE IF NOT EXISTS schedule (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(100) NOT NULL,
        description TEXT,
        day_of_week INTEGER NOT NULL,
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,
        color VARCHAR(7) DEFAULT '#6366f1',
        location VARCHAR(255),
        teacher_name VARCHAR(100),
        is_recurring BOOLEAN DEFAULT TRUE,
        status VARCHAR(50) DEFAULT 'scheduled',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log('✅ Schedule table ready');

    await sql`
      CREATE TABLE IF NOT EXISTS class_attendance (
        id SERIAL PRIMARY KEY,
        schedule_id INTEGER NOT NULL REFERENCES schedule(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        attendance_date DATE NOT NULL,
        status VARCHAR(50) DEFAULT 'present',
        check_in_time TIMESTAMP,
        check_out_time TIMESTAMP,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(schedule_id, user_id, attendance_date)
      )
    `;
    console.log('✅ Class attendance table ready');

    await sql`
      CREATE TABLE IF NOT EXISTS academic_periods (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        type VARCHAR(50) DEFAULT 'semester',
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log('✅ Academic periods table ready');

    // ===== MODULES TABLES =====
    await sql`
      CREATE TABLE IF NOT EXISTS modules (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        module_code VARCHAR(50) UNIQUE,
        credits INTEGER DEFAULT 3,
        department VARCHAR(100),
        level VARCHAR(50) DEFAULT 'beginner',
        status VARCHAR(50) DEFAULT 'published',
        is_mandatory BOOLEAN DEFAULT FALSE,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log('✅ Modules table ready');

    await sql`
      CREATE TABLE IF NOT EXISTS user_modules (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        module_id INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
        enrollment_date DATE NOT NULL,
        completion_date DATE,
        progress DECIMAL(5,2) DEFAULT 0.00,
        status VARCHAR(50) DEFAULT 'enrolled',
        grade DECIMAL(5,2),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, module_id)
      )
    `;
    console.log('✅ User modules table ready');

    await sql`
      CREATE TABLE IF NOT EXISTS module_chapters (
        id SERIAL PRIMARY KEY,
        module_id INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        content TEXT,
        video_url VARCHAR(255),
        resource_urls JSONB,
        chapter_number INTEGER NOT NULL,
        duration_minutes INTEGER,
        is_published BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log('✅ Module chapters table ready');

    await sql`
      CREATE TABLE IF NOT EXISTS module_resources (
        id SERIAL PRIMARY KEY,
        module_id INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
        chapter_id INTEGER REFERENCES module_chapters(id) ON DELETE SET NULL,
        title VARCHAR(255) NOT NULL,
        resource_type VARCHAR(50) DEFAULT 'document',
        file_url VARCHAR(255),
        description TEXT,
        file_size INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log('✅ Module resources table ready');

    await sql`
      CREATE TABLE IF NOT EXISTS module_progress (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        module_id INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
        chapter_id INTEGER NOT NULL REFERENCES module_chapters(id) ON DELETE CASCADE,
        status VARCHAR(50) DEFAULT 'not_started',
        progress_percentage DECIMAL(5,2) DEFAULT 0.00,
        time_spent INTEGER DEFAULT 0,
        completed_at TIMESTAMP,
        last_accessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, module_id, chapter_id)
      )
    `;
    console.log('✅ Module progress table ready');

    // ===== ASSESSMENTS TABLES =====
    await sql`
      CREATE TABLE IF NOT EXISTS assessments (
        id SERIAL PRIMARY KEY,
        module_id INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        type VARCHAR(50) DEFAULT 'quiz',
        total_marks INTEGER DEFAULT 100,
        passing_marks INTEGER DEFAULT 40,
        duration_minutes INTEGER,
        start_date TIMESTAMP,
        end_date TIMESTAMP,
        is_proctored BOOLEAN DEFAULT FALSE,
        attempts_allowed INTEGER DEFAULT 1,
        status VARCHAR(50) DEFAULT 'draft',
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log('✅ Assessments table ready');

    await sql`
      CREATE TABLE IF NOT EXISTS assessment_questions (
        id SERIAL PRIMARY KEY,
        assessment_id INTEGER NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
        question_type VARCHAR(50) DEFAULT 'multiple_choice',
        question TEXT NOT NULL,
        options JSONB,
        correct_answer TEXT,
        marks INTEGER DEFAULT 1,
        order_number INTEGER DEFAULT 0,
        difficulty VARCHAR(50) DEFAULT 'medium',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log('✅ Assessment questions table ready');

    await sql`
      CREATE TABLE IF NOT EXISTS assessment_attempts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        assessment_id INTEGER NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
        attempt_number INTEGER DEFAULT 1,
        start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        end_time TIMESTAMP,
        score DECIMAL(5,2),
        obtained_marks DECIMAL(5,2),
        percentage DECIMAL(5,2),
        status VARCHAR(50) DEFAULT 'in_progress',
        answers JSONB,
        feedback TEXT,
        graded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, assessment_id, attempt_number)
      )
    `;
    console.log('✅ Assessment attempts table ready');

    await sql`
      CREATE TABLE IF NOT EXISTS assessment_results (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        assessment_id INTEGER NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
        attempt_id INTEGER REFERENCES assessment_attempts(id) ON DELETE SET NULL,
        total_marks DECIMAL(5,2),
        obtained_marks DECIMAL(5,2),
        percentage DECIMAL(5,2),
        grade VARCHAR(5),
        is_passed BOOLEAN DEFAULT FALSE,
        feedback TEXT,
        reviewed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log('✅ Assessment results table ready');

    // ===== AI CHAT TABLES =====
    await sql`
      CREATE TABLE IF NOT EXISTS ai_chat_sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        session_title VARCHAR(255) DEFAULT 'New Chat Session',
        context VARCHAR(50) DEFAULT 'general',
        module_id INTEGER REFERENCES modules(id) ON DELETE SET NULL,
        is_active BOOLEAN DEFAULT TRUE,
        messages_count INTEGER DEFAULT 0,
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ended_at TIMESTAMP
      )
    `;
    console.log('✅ AI chat sessions table ready');

    await sql`
      CREATE TABLE IF NOT EXISTS ai_chat_messages (
        id SERIAL PRIMARY KEY,
        session_id INTEGER NOT NULL REFERENCES ai_chat_sessions(id) ON DELETE CASCADE,
        sender VARCHAR(50) NOT NULL,
        message TEXT NOT NULL,
        message_type VARCHAR(50) DEFAULT 'text',
        attachment_url VARCHAR(255),
        metadata JSONB,
        token_count INTEGER,
        response_time_ms INTEGER,
        is_read BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log('✅ AI chat messages table ready');

    await sql`
      CREATE TABLE IF NOT EXISTS ai_chat_feedback (
        id SERIAL PRIMARY KEY,
        message_id INTEGER NOT NULL REFERENCES ai_chat_messages(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        rating INTEGER CHECK (rating >= 1 AND rating <= 5),
        feedback_text TEXT,
        is_helpful BOOLEAN,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(message_id, user_id)
      )
    `;
    console.log('✅ AI chat feedback table ready');

    // ===== DASHBOARD & ANALYTICS TABLES =====
    await sql`
      CREATE TABLE IF NOT EXISTS dashboard_stats (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        stat_date DATE NOT NULL,
        total_modules INTEGER DEFAULT 0,
        completed_modules INTEGER DEFAULT 0,
        total_classes INTEGER DEFAULT 0,
        attended_classes INTEGER DEFAULT 0,
        average_score DECIMAL(5,2) DEFAULT 0.00,
        study_hours INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, stat_date)
      )
    `;
    console.log('✅ Dashboard stats table ready');

    await sql`
      CREATE TABLE IF NOT EXISTS learning_analytics (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        module_id INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        study_time_minutes INTEGER DEFAULT 0,
        assessments_completed INTEGER DEFAULT 0,
        assessment_score DECIMAL(5,2),
        class_attendance_count INTEGER DEFAULT 0,
        ai_interactions INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, module_id, date)
      )
    `;
    console.log('✅ Learning analytics table ready');

    await sql`
      CREATE TABLE IF NOT EXISTS motivational_quotes (
        id SERIAL PRIMARY KEY,
        quote TEXT NOT NULL,
        author VARCHAR(100),
        category VARCHAR(50),
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log('✅ Motivational quotes table ready');

    // ===== NOTIFICATION TABLES =====
    await sql`
      CREATE TABLE IF NOT EXISTS push_notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        body TEXT,
        data JSONB,
        type VARCHAR(50) DEFAULT 'system',
        is_read BOOLEAN DEFAULT FALSE,
        is_sent BOOLEAN DEFAULT FALSE,
        sent_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log('✅ Push notifications table ready');

    await sql`
      CREATE TABLE IF NOT EXISTS user_device_tokens (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        device_token VARCHAR(255) NOT NULL,
        device_type VARCHAR(50) DEFAULT 'mobile',
        device_name VARCHAR(100),
        is_active BOOLEAN DEFAULT TRUE,
        last_used TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, device_token)
      )
    `;
    console.log('✅ User device tokens table ready');

    await sql`
      CREATE TABLE IF NOT EXISTS study_sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        module_id INTEGER REFERENCES modules(id) ON DELETE SET NULL,
        session_date DATE NOT NULL,
        start_time TIMESTAMP NOT NULL,
        end_time TIMESTAMP,
        duration_minutes INTEGER,
        activity_type VARCHAR(50) DEFAULT 'study',
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log('✅ Study sessions table ready');

    await sql`
      CREATE TABLE IF NOT EXISTS user_activity_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        activity_type VARCHAR(50) NOT NULL,
        page_name VARCHAR(50),
        screen_name VARCHAR(50),
        action_data JSONB,
        ip_address VARCHAR(45),
        device_type VARCHAR(50) DEFAULT 'mobile',
        app_version VARCHAR(20),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log('✅ User activity logs table ready');

    await sql`
      CREATE TABLE IF NOT EXISTS app_settings (
        id SERIAL PRIMARY KEY,
        setting_key VARCHAR(100) UNIQUE NOT NULL,
        setting_value TEXT,
        setting_group VARCHAR(50) DEFAULT 'general',
        description VARCHAR(255),
        data_type VARCHAR(50) DEFAULT 'string',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log('✅ App settings table ready');

    // ===== CREATE INDEXES FOR BETTER PERFORMANCE =====
    console.log('📊 Creating indexes...');
    
    // Users indexes
    await sql`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)
    `;
    console.log('✅ Users email index ready');

    await sql`
      CREATE INDEX IF NOT EXISTS idx_users_onboarding ON users(onboarding_completed)
    `;
    console.log('✅ Users onboarding index ready');

    await sql`
      CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id)
    `;
    console.log('✅ User profiles index ready');

    // Schedule indexes
    await sql`
      CREATE INDEX IF NOT EXISTS idx_schedule_user_day ON schedule(user_id, day_of_week)
    `;
    console.log('✅ Schedule user_day index ready');

    await sql`
      CREATE INDEX IF NOT EXISTS idx_schedule_user_status ON schedule(user_id, status)
    `;
    console.log('✅ Schedule user_status index ready');

    // Attendance indexes
    await sql`
      CREATE INDEX IF NOT EXISTS idx_attendance_user ON class_attendance(user_id)
    `;
    console.log('✅ Attendance user index ready');
    await sql`
      CREATE INDEX IF NOT EXISTS idx_attendance_date ON class_attendance(attendance_date)
    `;
    console.log('✅ Attendance date index ready');

    // Modules indexes
    await sql`
      CREATE INDEX IF NOT EXISTS idx_modules_code ON modules(module_code)
    `;
    console.log('✅ Modules code index ready');
    await sql`
      CREATE INDEX IF NOT EXISTS idx_modules_status ON modules(status)
    `;
    console.log('✅ Modules status index ready');

    // User modules indexes
    await sql`
      CREATE INDEX IF NOT EXISTS idx_user_modules_user ON user_modules(user_id)
    `;
    console.log('✅ User modules user index ready');
    await sql`
      CREATE INDEX IF NOT EXISTS idx_user_modules_module ON user_modules(module_id)
    `;
    console.log('✅ User modules module index ready');
    await sql`
      CREATE INDEX IF NOT EXISTS idx_user_modules_status ON user_modules(status)
    `;
    console.log('✅ User modules status index ready');

    // Chapter indexes
    await sql`
      CREATE INDEX IF NOT EXISTS idx_chapters_module ON module_chapters(module_id)
    `;
    console.log('✅ Chapters module index ready');

    // Progress indexes
    await sql`
      CREATE INDEX IF NOT EXISTS idx_progress_user ON module_progress(user_id)
    `;
    console.log('✅ Progress user index ready');
    await sql`
      CREATE INDEX IF NOT EXISTS idx_progress_status ON module_progress(status)
    `;
    console.log('✅ Progress status index ready');

    // Assessments indexes
    await sql`
      CREATE INDEX IF NOT EXISTS idx_assessments_module ON assessments(module_id)
    `;
    console.log('✅ Assessments module index ready');
    await sql`
      CREATE INDEX IF NOT EXISTS idx_assessments_dates ON assessments(start_date, end_date)
    `;
    console.log('✅ Assessments dates index ready');
    await sql`
      CREATE INDEX IF NOT EXISTS idx_assessments_status ON assessments(status)
    `;
    console.log('✅ Assessments status index ready');

    // Assessment attempts indexes
    await sql`
      CREATE INDEX IF NOT EXISTS idx_attempts_user ON assessment_attempts(user_id)
    `;
    console.log('✅ Attempts user index ready');
    await sql`
      CREATE INDEX IF NOT EXISTS idx_attempts_assessment ON assessment_attempts(assessment_id)
    `;
    console.log('✅ Attempts assessment index ready');
    await sql`
      CREATE INDEX IF NOT EXISTS idx_attempts_status ON assessment_attempts(status)
    `;
    console.log('✅ Attempts status index ready');

    // Chat indexes
    await sql`
      CREATE INDEX IF NOT EXISTS idx_chat_sessions_user ON ai_chat_sessions(user_id)
    `;
    console.log('✅ Chat sessions user index ready');
    await sql`
      CREATE INDEX IF NOT EXISTS idx_chat_sessions_active ON ai_chat_sessions(is_active)
    `;
    console.log('✅ Chat sessions active index ready');

    await sql`
      CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON ai_chat_messages(session_id)
    `;
    console.log('✅ Chat messages session index ready');

    // Notifications indexes
    await sql`
      CREATE INDEX IF NOT EXISTS idx_notifications_user ON push_notifications(user_id, is_read)
    `;
    console.log('✅ Notifications index ready');

    // Device tokens indexes
    await sql`
      CREATE INDEX IF NOT EXISTS idx_device_tokens_user ON user_device_tokens(user_id)
    `;
    console.log('✅ Device tokens user index ready');

    // Analytics indexes
    await sql`
      CREATE INDEX IF NOT EXISTS idx_analytics_user ON learning_analytics(user_id)
    `;
    console.log('✅ Analytics user index ready');
    await sql`
      CREATE INDEX IF NOT EXISTS idx_analytics_date ON learning_analytics(date)
    `;
    console.log('✅ Analytics date index ready');

    // Activity logs indexes
    await sql`
      CREATE INDEX IF NOT EXISTS idx_activity_user ON user_activity_logs(user_id)
    `;
    console.log('✅ Activity user index ready');
    await sql`
      CREATE INDEX IF NOT EXISTS idx_activity_type ON user_activity_logs(activity_type)
    `;
    console.log('✅ Activity type index ready');

    // ===== CREATE FUNCTION TO UPDATE UPDATED_AT TIMESTAMP =====
    console.log('🔧 Creating updated_at function...');
    await sql`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql'
    `;
    console.log('✅ Update timestamp function ready');

    // ===== CREATE TRIGGERS FOR ALL TABLES WITH updated_at =====
    console.log('🔧 Creating triggers...');

    // List of tables that have updated_at column
    const tablesWithUpdatedAt = [
      'users',
      'user_profiles',
      'schedule',
      'class_attendance',
      'academic_periods',
      'modules',
      'user_modules',
      'module_chapters',
      'module_progress',
      'assessments',
      'assessment_attempts',
      'assessment_results',
      'ai_chat_sessions',
      'dashboard_stats',
      'learning_analytics',
      'push_notifications',
      'user_device_tokens',
      'app_settings'
    ];

    // Create triggers for each table
    for (const table of tablesWithUpdatedAt) {
      await sql`
        DROP TRIGGER IF EXISTS update_${table}_updated_at ON ${table}
      `;
      await sql`
        CREATE TRIGGER update_${table}_updated_at 
          BEFORE UPDATE ON ${table} 
          FOR EACH ROW 
          EXECUTE FUNCTION update_updated_at_column()
      `;
      console.log(`✅ ${table} trigger ready`);
    }

    // ===== SEED INITIAL DATA =====
    console.log('🌱 Seeding initial data...');
    
    // Insert default app settings
    await sql`
      INSERT INTO app_settings (setting_key, setting_value, setting_group, description, data_type)
      VALUES 
        ('app_name', 'Scholar LMS', 'general', 'Application name', 'string'),
        ('max_assessment_attempts', '3', 'assessments', 'Maximum attempts per assessment', 'integer'),
        ('ai_chat_enabled', 'true', 'ai', 'Enable AI chat feature', 'boolean'),
        ('default_theme', 'light', 'ui', 'Default application theme', 'string'),
        ('reminder_time_before_class', '15', 'schedule', 'Minutes before class to send reminder', 'integer')
      ON CONFLICT (setting_key) DO NOTHING
    `;
    console.log('✅ App settings seeded');

    // Insert motivational quotes if empty
    const quoteCount = await sql`SELECT COUNT(*) FROM motivational_quotes`;
    if (parseInt(quoteCount[0].count) === 0) {
      await sql`
        INSERT INTO motivational_quotes (quote, author, category, is_active) VALUES
        ('Success is not final, failure is not fatal: it is the courage to continue that counts.', 'Winston Churchill', 'success', TRUE),
        ('The only way to do great work is to love what you do.', 'Steve Jobs', 'motivation', TRUE),
        ('Believe you can and you''re halfway there.', 'Theodore Roosevelt', 'belief', TRUE),
        ('It does not matter how slowly you go as long as you do not stop.', 'Confucius', 'perseverance', TRUE),
        ('The future belongs to those who believe in the beauty of their dreams.', 'Eleanor Roosevelt', 'dreams', TRUE),
        ('Education is the most powerful weapon which you can use to change the world.', 'Nelson Mandela', 'education', TRUE),
        ('The beautiful thing about learning is that nobody can take it away from you.', 'B.B. King', 'learning', TRUE)
      `;
      console.log('✅ Motivational quotes seeded');
    }

    console.log('🎉 Database initialization complete!');
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    // Don't exit the process, just log the error
    // The server will still start but some features might not work
  }
};

// ==================== AUTHENTICATION MIDDLEWARE ====================

/**
 * Authentication Middleware
 * Verifies JWT token and attaches user to request
 */
const auth = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.header('Authorization');

    if (!authHeader) {
      return res.status(401).json({
        error: 'No authentication token provided'
      });
    }

    // Check if it's a Bearer token
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return res.status(401).json({
        error: 'Invalid authorization format. Use Bearer token.'
      });
    }

    const token = parts[1];

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({
          error: 'Token has expired. Please login again.'
        });
      }
      if (jwtError.name === 'JsonWebTokenError') {
        return res.status(401).json({
          error: 'Invalid token. Please login again.'
        });
      }
      throw jwtError;
    }

    // Get user from database using Neon SQL
    const userResult = await sql`
      SELECT id, email, first_name, last_name, email_verified, onboarding_completed 
      FROM users 
      WHERE id = ${decoded.userId}
    `;

    if (userResult.length === 0) {
      return res.status(401).json({
        error: 'User not found. Please login again.'
      });
    }

    const user = userResult[0];

    // Check if email is verified
    if (!user.email_verified) {
      return res.status(403).json({
        error: 'Please verify your email before accessing this resource'
      });
    }

    // Attach user to request
    req.user = {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      emailVerified: user.email_verified,
      onboardingCompleted: user.onboarding_completed
    };

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({
      error: 'Authentication failed. Please try again.'
    });
  }
};

// Helper function to generate a 6-digit verification code
const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Helper function to send verification code email
const sendVerificationCodeEmail = async (email, firstName, code) => {
  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #6366f1; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 5px 5px; }
          .code-container { 
            background: #eef2ff; 
            padding: 20px; 
            text-align: center; 
            border-radius: 8px;
            margin: 20px 0;
          }
          .code { 
            font-size: 36px; 
            font-weight: bold; 
            color: #6366f1; 
            letter-spacing: 8px;
            font-family: monospace;
          }
          .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎓 Study Mate</h1>
          </div>
          <div class="content">
            <h2>Welcome ${firstName}!</h2>
            <p>Thank you for registering with Study Mate. Please use the verification code below to complete your registration:</p>
            <div class="code-container">
              <div class="code">${code}</div>
            </div>
            <p>Enter this code in the app to verify your email address.</p>
            <p style="font-size: 13px; color: #6b7280;">This code will expire in 15 minutes.</p>
            <p style="font-size: 13px; color: #6b7280;">If you didn't create an account with Study Mate, please ignore this email.</p>
          </div>
          <div class="footer">
            <p>&copy; 2024 Study Mate. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  try {
    const data = await mg.messages.create(DOMAIN, {
      from: FROM_EMAIL,
      to: [email],
      subject: 'Your Verification Code - Study Mate',
      html: htmlContent,
    });

    console.log(`Verification code sent to ${email}`, data);
    return data;
  } catch (error) {
    console.error('Error sending verification code:', error);
    throw new Error('Failed to send verification code');
  }
};

// ==================== AUTHENTICATION ROUTES ====================

// 1. Register Route - Sends verification code
app.post('/api/register', async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body;

    // Validation
    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({
        error: 'All fields are required'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: 'Password must be at least 6 characters'
      });
    }

    // Check if user already exists
    const existingUser = await sql`
      SELECT * FROM users WHERE email = ${email.toLowerCase()}
    `;

    if (existingUser.length > 0) {
      return res.status(400).json({
        error: 'User with this email already exists'
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Generate verification code
    const verificationCode = generateVerificationCode();
    const codeExpires = new Date();
    codeExpires.setMinutes(codeExpires.getMinutes() + 15); // 15 minutes expiry

    // Insert user into database
    const result = await sql`
      INSERT INTO users (
        first_name, 
        last_name, 
        email, 
        password_hash, 
        verification_code,
        verification_code_expires,
        verification_attempts
      )
      VALUES (
        ${firstName}, 
        ${lastName}, 
        ${email.toLowerCase()}, 
        ${passwordHash}, 
        ${verificationCode},
        ${codeExpires},
        0
      )
      RETURNING id, email, first_name, last_name, email_verified
    `;

    const newUser = result[0];

    // Send verification code email
    try {
      await sendVerificationCodeEmail(email, firstName, verificationCode);
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
      return res.status(201).json({
        message: 'Registration successful but email sending failed. Please request a new code.',
        user: newUser,
        emailSent: false
      });
    }

    res.status(201).json({
      message: 'Registration successful! Please check your email for the verification code.',
      user: newUser,
      emailSent: true,
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      error: 'Server error during registration'
    });
  }
});

// 2. Verify Code Route
app.post('/api/verify-code', async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({
        error: 'Email and verification code are required'
      });
    }
    let user;
    try {
      user = await sql`
        SELECT * FROM users WHERE email = ${email.toLowerCase()}
      `;
    } catch (dbErr) {
      console.warn('Database query failed during login:', dbErr && dbErr.message ? dbErr.message : dbErr);
      // Development fallback: allow a dev user when DATABASE_URL isn't configured.
      // To enable locally, set DEV_USER_EMAIL and DEV_USER_PASSWORD environment variables.
      if (process.env.NODE_ENV !== 'production' && process.env.DEV_USER_EMAIL && process.env.DEV_USER_PASSWORD) {
        if (email.toLowerCase() === process.env.DEV_USER_EMAIL.toLowerCase()) {
          // Create a fake user object shaped like the DB result to continue the flow.
          user = [{
            id: '00000000-0000-0000-0000-000000000000',
            first_name: process.env.DEV_USER_FIRSTNAME || 'Dev',
            last_name: process.env.DEV_USER_LASTNAME || 'User',
            email: process.env.DEV_USER_EMAIL.toLowerCase(),
            password_hash: await bcrypt.hash(process.env.DEV_USER_PASSWORD, 10),
            email_verified: true,
            onboarding_completed: false
          }];
        } else {
          user = [];
        }
      } else {
        throw dbErr;
      }
    }

    if (user.length === 0) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    // Check if already verified
    if (user[0].email_verified) {
      return res.status(400).json({
        error: 'Email already verified'
      });
    }

    // Check if code matches
    if (user[0].verification_code !== code) {
      // Increment verification attempts
      await sql`
        UPDATE users 
        SET verification_attempts = verification_attempts + 1
        WHERE id = ${user[0].id}
      `;

      const attempts = user[0].verification_attempts + 1;

      // Lock account after 5 failed attempts
      if (attempts >= 5) {
        return res.status(403).json({
          error: 'Too many failed attempts. Please request a new verification code.',
          locked: true
        });
      }

      return res.status(400).json({
        error: 'Invalid verification code',
        attemptsRemaining: 5 - attempts
      });
    }

    // Check if code is expired
    if (new Date(user[0].verification_code_expires) < new Date()) {
      return res.status(400).json({
        error: 'Verification code has expired. Please request a new one.',
        expired: true
      });
    }

    // Update user as verified
    await sql`
      UPDATE users 
      SET 
        email_verified = TRUE,
        verification_code = NULL,
        verification_code_expires = NULL,
        verification_attempts = 0,
        updated_at = NOW()
      WHERE id = ${user[0].id}
    `;

    res.json({
      message: 'Email verified successfully! You can now log in.',
      verified: true
    });

  } catch (error) {
    console.error('Code verification error:', error);
    res.status(500).json({
      error: 'Server error during verification'
    });
  }
});

// 3. Resend Verification Code
app.post('/api/resend-verification', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Find user
    const user = await sql`
      SELECT * FROM users WHERE email = ${email.toLowerCase()}
    `;

    if (user.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user[0].email_verified) {
      return res.status(400).json({ error: 'Email already verified' });
    }

    // Check if user has been locked out
    if (user[0].verification_attempts >= 5) {
      // Reset attempts but still warn
      await sql`
        UPDATE users 
        SET verification_attempts = 0
        WHERE id = ${user[0].id}
      `;
    }

    // Generate new verification code
    const verificationCode = generateVerificationCode();
    const codeExpires = new Date();
    codeExpires.setMinutes(codeExpires.getMinutes() + 15);

    // Update user with new code
    await sql`
      UPDATE users 
      SET 
        verification_code = ${verificationCode},
        verification_code_expires = ${codeExpires}
      WHERE id = ${user[0].id}
    `;

    // Send new verification code
    await sendVerificationCodeEmail(email, user[0].first_name, verificationCode);

    res.json({
      message: 'New verification code sent successfully'
    });

  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({
      error: 'Server error while resending verification'
    });
  }
});

// 4. Login Route
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user
    const user = await sql`
      SELECT id, email, password_hash, first_name, last_name, email_verified, onboarding_completed
      FROM users
      WHERE email = ${String(email).toLowerCase().trim()}
    `;

    if (user.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const userRecord = user[0];
    if (!userRecord.password_hash) {
      return res.status(500).json({
        error: 'Account data is incomplete. Please contact support or re-register.'
      });
    }

    // Check if email is verified
    if (!userRecord.email_verified) {
      return res.status(403).json({
        error: 'Please verify your email before logging in',
        requiresVerification: true
      });
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, userRecord.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: userRecord.id,
        email: userRecord.email,
        firstName: userRecord.first_name,
        lastName: userRecord.last_name
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: userRecord.id,
        firstName: userRecord.first_name,
        lastName: userRecord.last_name,
        email: userRecord.email,
        emailVerified: userRecord.email_verified,
        onboardingCompleted: userRecord.onboarding_completed || false
      }
    });

  } catch (error) {
    console.error('❌ Login error:', {
      message: error?.message || String(error),
      stack: error?.stack,
      code: error?.code,
      detail: error?.detail
    });
    res.status(500).json({
      error: 'Server error during login',
      details: process.env.NODE_ENV === 'development' ? error?.message : undefined
    });
  }
})

// ==================== ONBOARDING ROUTES ====================

// 5. Save onboarding profile
app.post('/api/onboarding', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      qualification,
      year,
      academicGoal,
      learningStyle,
      studyChallenges,
      studyHours,
      productiveTime,
      reminderFrequency,
      aiSupport,
      resourceRecommendations
    } = req.body;

    // Validate required fields
    if (!qualification || !year || !academicGoal || !learningStyle ||
      !studyChallenges || studyChallenges.length < 2 || !studyHours ||
      !productiveTime || !reminderFrequency || !aiSupport ||
      !resourceRecommendations) {
      return res.status(400).json({
        error: 'All fields are required. Please complete all steps.'
      });
    }

    // Check if user already has a profile using Neon SQL
    const existingProfile = await sql`
      SELECT id FROM user_profiles WHERE user_id = ${userId}
    `;

    let result;
    if (existingProfile.length > 0) {
      // Update existing profile
      result = await sql`
        UPDATE user_profiles 
        SET 
          qualification = ${qualification},
          year = ${year},
          academic_goal = ${academicGoal},
          learning_style = ${learningStyle},
          study_challenges = ${JSON.stringify(studyChallenges)},
          study_hours = ${studyHours},
          productive_time = ${productiveTime},
          reminder_frequency = ${reminderFrequency},
          ai_support = ${aiSupport},
          resource_recommendations = ${resourceRecommendations},
          updated_at = NOW()
        WHERE user_id = ${userId}
        RETURNING *
      `;
    } else {
      // Create new profile
      result = await sql`
        INSERT INTO user_profiles (
          user_id,
          qualification,
          year,
          academic_goal,
          learning_style,
          study_challenges,
          study_hours,
          productive_time,
          reminder_frequency,
          ai_support,
          resource_recommendations,
          created_at,
          updated_at
        ) VALUES (
          ${userId},
          ${qualification},
          ${year},
          ${academicGoal},
          ${learningStyle},
          ${JSON.stringify(studyChallenges)},
          ${studyHours},
          ${productiveTime},
          ${reminderFrequency},
          ${aiSupport},
          ${resourceRecommendations},
          NOW(),
          NOW()
        )
        RETURNING *
      `;
    }

    // Update user's onboarding status
    await sql`
      UPDATE users SET onboarding_completed = TRUE WHERE id = ${userId}
    `;

    // Get updated user data
    const userResult = await sql`
      SELECT id, email, first_name, last_name, onboarding_completed 
      FROM users 
      WHERE id = ${userId}
    `;

    // Parse study_challenges back to array for response
    const profileData = result[0];
    if (profileData.study_challenges) {
      profileData.study_challenges = JSON.parse(profileData.study_challenges);
    }

    res.status(200).json({
      success: true,
      profile: profileData,
      user: userResult[0],
      message: 'Onboarding completed successfully'
    });

  } catch (error) {
    console.error('Error saving onboarding profile:', error);
    res.status(500).json({
      error: 'Failed to save onboarding profile. Please try again.'
    });
  }
});

// 6. Get onboarding profile
app.get('/api/onboarding', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await sql`
      SELECT * FROM user_profiles WHERE user_id = ${userId}
    `;

    if (result.length === 0) {
      return res.status(404).json({
        error: 'Profile not found'
      });
    }

    const profile = result[0];
    // Parse JSON fields
    if (profile.study_challenges) {
      profile.study_challenges = JSON.parse(profile.study_challenges);
    }

    res.status(200).json({
      success: true,
      profile
    });

  } catch (error) {
    console.error('Error fetching onboarding profile:', error);
    res.status(500).json({
      error: 'Failed to fetch onboarding profile'
    });
  }
});

// 7. Update onboarding profile
app.post('/api/onboarding', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    console.log('📝 Saving onboarding for user:', userId);

    const {
      qualification,
      year,
      academicGoal,
      learningStyle,
      studyChallenges,
      studyHours,
      productiveTime,
      reminderFrequency,
      aiSupport,
      resourceRecommendations
    } = req.body;

    console.log('📊 Received profile data:', {
      qualification,
      year,
      academicGoal,
      learningStyle,
      studyChallenges: studyChallenges?.length,
      studyHours,
      productiveTime,
      reminderFrequency,
      aiSupport,
      resourceRecommendations
    });

    // Validate required fields
    if (!qualification || !year || !academicGoal || !learningStyle ||
      !studyChallenges || studyChallenges.length < 2 || !studyHours ||
      !productiveTime || !reminderFrequency || !aiSupport ||
      !resourceRecommendations) {
      console.log('❌ Validation failed: Missing required fields');
      return res.status(400).json({
        error: 'All fields are required. Please complete all steps.'
      });
    }

    // Check if user already has a profile
    let existingProfile;
    try {
      existingProfile = await sql`
        SELECT id FROM user_profiles WHERE user_id = ${userId}
      `;
      console.log('📋 Existing profile:', existingProfile.length > 0 ? 'Found' : 'Not found');
    } catch (dbError) {
      console.error('❌ Error checking existing profile:', dbError);
      // If table doesn't exist, we'll create it
      existingProfile = [];
    }

    let result;
    if (existingProfile && existingProfile.length > 0) {
      // Update existing profile
      console.log('🔄 Updating existing profile...');
      try {
        result = await sql`
          UPDATE user_profiles 
          SET 
            qualification = ${qualification},
            year = ${year},
            academic_goal = ${academicGoal},
            learning_style = ${learningStyle},
            study_challenges = ${JSON.stringify(studyChallenges)}::jsonb,
            study_hours = ${studyHours},
            productive_time = ${productiveTime},
            reminder_frequency = ${reminderFrequency},
            ai_support = ${aiSupport},
            resource_recommendations = ${resourceRecommendations},
            updated_at = NOW()
          WHERE user_id = ${userId}
          RETURNING *
        `;
        console.log('✅ Profile updated successfully');
      } catch (updateError) {
        console.error('❌ Error updating profile:', updateError);
        throw new Error('Failed to update profile: ' + updateError.message);
      }
    } else {
      // Create new profile
      console.log('📝 Creating new profile...');
      try {
        result = await sql`
          INSERT INTO user_profiles (
            user_id,
            qualification,
            year,
            academic_goal,
            learning_style,
            study_challenges,
            study_hours,
            productive_time,
            reminder_frequency,
            ai_support,
            resource_recommendations,
            created_at,
            updated_at
          ) VALUES (
            ${userId},
            ${qualification},
            ${year},
            ${academicGoal},
            ${learningStyle},
            ${JSON.stringify(studyChallenges)}::jsonb,
            ${studyHours},
            ${productiveTime},
            ${reminderFrequency},
            ${aiSupport},
            ${resourceRecommendations},
            NOW(),
            NOW()
          )
          RETURNING *
        `;
        console.log('✅ Profile created successfully');
      } catch (insertError) {
        console.error('❌ Error creating profile:', insertError);
        throw new Error('Failed to create profile: ' + insertError.message);
      }
    }

    // Update user's onboarding status
    try {
      await sql`
        UPDATE users SET onboarding_completed = TRUE WHERE id = ${userId}
      `;
      console.log('✅ User onboarding status updated');
    } catch (updateUserError) {
      console.error('❌ Error updating user status:', updateUserError);
      // Don't throw here, just log the error
    }

    // Get updated user data
    let userResult;
    try {
      userResult = await sql`
        SELECT id, email, first_name, last_name, onboarding_completed 
        FROM users 
        WHERE id = ${userId}
      `;
      console.log('✅ User data retrieved');
    } catch (userError) {
      console.error('❌ Error getting user data:', userError);
      userResult = [];
    }

    // Parse study_challenges back to array for response
    const profileData = result && result[0] ? { ...result[0] } : null;
    if (profileData && profileData.study_challenges) {
      try {
        profileData.study_challenges = JSON.parse(profileData.study_challenges);
      } catch (parseError) {
        console.error('❌ Error parsing study challenges:', parseError);
        profileData.study_challenges = studyChallenges;
      }
    }

    // Return success response
    res.status(200).json({
      success: true,
      profile: profileData || result,
      user: userResult && userResult[0] ? userResult[0] : null,
      message: 'Onboarding completed successfully'
    });

  } catch (error) {
    console.error('❌ Error saving onboarding profile:', error);
    console.error('❌ Error details:', error.message);
    console.error('❌ Stack trace:', error.stack);

    // Return a proper error response
    res.status(500).json({
      error: 'Failed to save onboarding profile. Please try again.',
      details: error.message
    });
  }
});

// 8. Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    emailProvider: 'Mailgun',
    verificationMethod: 'Code-based'
  });
});

// ==================== SCHEDULE ENDPOINTS ====================

// 9. Get user's schedule
app.get('/api/schedule', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { dayOfWeek } = req.query;

    let query = sql`
      SELECT * FROM schedule 
      WHERE user_id = ${userId}
    `;

    if (dayOfWeek !== undefined) {
      query = sql`
        SELECT * FROM schedule 
        WHERE user_id = ${userId} AND day_of_week = ${parseInt(dayOfWeek)}
        ORDER BY start_time
      `;
    }

    const result = await query;
    res.json({ success: true, schedule: result });
  } catch (error) {
    console.error('Error fetching schedule:', error);
    res.status(500).json({ error: 'Failed to fetch schedule' });
  }
});

// 10. Create schedule item
app.post('/api/schedule', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { title, description, dayOfWeek, startTime, endTime, color, location, teacherName, isRecurring } = req.body;

    if (!title || dayOfWeek === undefined || !startTime || !endTime) {
      return res.status(400).json({ error: 'Title, day of week, start time, and end time are required' });
    }

    const result = await sql`
      INSERT INTO schedule (
        user_id, title, description, day_of_week, start_time, end_time,
        color, location, teacher_name, is_recurring
      ) VALUES (
        ${userId}, ${title}, ${description}, ${dayOfWeek}, ${startTime}, ${endTime},
        ${color || '#6366f1'}, ${location}, ${teacherName}, ${isRecurring !== undefined ? isRecurring : true}
      )
      RETURNING *
    `;

    res.status(201).json({ success: true, schedule: result[0] });
  } catch (error) {
    console.error('Error creating schedule:', error);
    res.status(500).json({ error: 'Failed to create schedule' });
  }
});

// 11. Update schedule item
app.put('/api/schedule/:id', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const scheduleId = parseInt(req.params.id);
    const { title, description, dayOfWeek, startTime, endTime, color, location, teacherName, isRecurring, status } = req.body;

    // Verify ownership
    const check = await sql`
      SELECT id FROM schedule WHERE id = ${scheduleId} AND user_id = ${userId}
    `;
    if (check.length === 0) {
      return res.status(404).json({ error: 'Schedule item not found' });
    }

    const result = await sql`
      UPDATE schedule SET
        title = COALESCE(${title}, title),
        description = COALESCE(${description}, description),
        day_of_week = COALESCE(${dayOfWeek}, day_of_week),
        start_time = COALESCE(${startTime}, start_time),
        end_time = COALESCE(${endTime}, end_time),
        color = COALESCE(${color}, color),
        location = COALESCE(${location}, location),
        teacher_name = COALESCE(${teacherName}, teacher_name),
        is_recurring = COALESCE(${isRecurring}, is_recurring),
        status = COALESCE(${status}, status)
      WHERE id = ${scheduleId} AND user_id = ${userId}
      RETURNING *
    `;

    res.json({ success: true, schedule: result[0] });
  } catch (error) {
    console.error('Error updating schedule:', error);
    res.status(500).json({ error: 'Failed to update schedule' });
  }
});

// 12. Delete schedule item
app.delete('/api/schedule/:id', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const scheduleId = parseInt(req.params.id);

    const result = await sql`
      DELETE FROM schedule WHERE id = ${scheduleId} AND user_id = ${userId}
      RETURNING id
    `;

    if (result.length === 0) {
      return res.status(404).json({ error: 'Schedule item not found' });
    }

    res.json({ success: true, message: 'Schedule item deleted' });
  } catch (error) {
    console.error('Error deleting schedule:', error);
    res.status(500).json({ error: 'Failed to delete schedule' });
  }
});

// 13. Mark attendance
app.post('/api/attendance', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { scheduleId, status, date } = req.body;

    if (!scheduleId || !status) {
      return res.status(400).json({ error: 'Schedule ID and status are required' });
    }

    const attendanceDate = date || new Date().toISOString().split('T')[0];

    const result = await sql`
      INSERT INTO class_attendance (schedule_id, user_id, attendance_date, status)
      VALUES (${scheduleId}, ${userId}, ${attendanceDate}, ${status})
      ON CONFLICT (schedule_id, user_id, attendance_date)
      DO UPDATE SET status = ${status}, updated_at = NOW()
      RETURNING *
    `;

    res.json({ success: true, attendance: result[0] });
  } catch (error) {
    console.error('Error marking attendance:', error);
    res.status(500).json({ error: 'Failed to mark attendance' });
  }
});

// 14. Get attendance for user
app.get('/api/attendance', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { startDate, endDate } = req.query;

    let query = sql`
      SELECT a.*, s.title, s.day_of_week, s.start_time, s.end_time
      FROM class_attendance a
      JOIN schedule s ON a.schedule_id = s.id
      WHERE a.user_id = ${userId}
    `;

    if (startDate && endDate) {
      query = sql`
        SELECT a.*, s.title, s.day_of_week, s.start_time, s.end_time
        FROM class_attendance a
        JOIN schedule s ON a.schedule_id = s.id
        WHERE a.user_id = ${userId}
        AND a.attendance_date BETWEEN ${startDate} AND ${endDate}
        ORDER BY a.attendance_date DESC
      `;
    }

    const result = await query;
    res.json({ success: true, attendance: result });
  } catch (error) {
    console.error('Error fetching attendance:', error);
    res.status(500).json({ error: 'Failed to fetch attendance' });
  }
});

// ==================== MODULES ENDPOINTS ====================

// 15. Get all modules
app.get('/api/modules', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, department } = req.query;

    let query = sql`
      SELECT m.*, 
        (SELECT COUNT(*) FROM module_chapters WHERE module_id = m.id AND is_published = TRUE) as total_chapters,
        um.progress, um.status as enrollment_status, um.grade
      FROM modules m
      LEFT JOIN user_modules um ON m.id = um.module_id AND um.user_id = ${userId}
      WHERE m.status = 'published'
    `;

    if (department) {
      query = sql`
        SELECT m.*, 
          (SELECT COUNT(*) FROM module_chapters WHERE module_id = m.id AND is_published = TRUE) as total_chapters,
          um.progress, um.status as enrollment_status, um.grade
        FROM modules m
        LEFT JOIN user_modules um ON m.id = um.module_id AND um.user_id = ${userId}
        WHERE m.status = 'published' AND m.department = ${department}
      `;
    }

    const result = await query;
    res.json({ success: true, modules: result });
  } catch (error) {
    console.error('Error fetching modules:', error);
    res.status(500).json({ error: 'Failed to fetch modules' });
  }
});

// 16. Get single module with chapters
app.get('/api/modules/:id', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const moduleId = parseInt(req.params.id);

    const moduleResult = await sql`
      SELECT m.*, um.progress, um.status as enrollment_status, um.grade
      FROM modules m
      LEFT JOIN user_modules um ON m.id = um.module_id AND um.user_id = ${userId}
      WHERE m.id = ${moduleId}
    `;

    if (moduleResult.length === 0) {
      return res.status(404).json({ error: 'Module not found' });
    }

    const chapters = await sql`
      SELECT * FROM module_chapters 
      WHERE module_id = ${moduleId} AND is_published = TRUE
      ORDER BY chapter_number
    `;

    // Get user progress for each chapter
    const chaptersWithProgress = await Promise.all(chapters.map(async (chapter) => {
      const progress = await sql`
        SELECT * FROM module_progress 
        WHERE user_id = ${userId} AND module_id = ${moduleId} AND chapter_id = ${chapter.id}
      `;
      return {
        ...chapter,
        progress: progress[0] || { status: 'not_started', progress_percentage: 0 }
      };
    }));

    res.json({
      success: true,
      module: moduleResult[0],
      chapters: chaptersWithProgress
    });
  } catch (error) {
    console.error('Error fetching module:', error);
    res.status(500).json({ error: 'Failed to fetch module' });
  }
});

// 17. Enroll in module
app.post('/api/modules/:id/enroll', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const moduleId = parseInt(req.params.id);

    // Check if already enrolled
    const existing = await sql`
      SELECT id FROM user_modules WHERE user_id = ${userId} AND module_id = ${moduleId}
    `;

    if (existing.length > 0) {
      return res.status(400).json({ error: 'Already enrolled in this module' });
    }

    const result = await sql`
      INSERT INTO user_modules (user_id, module_id, enrollment_date, status)
      VALUES (${userId}, ${moduleId}, CURRENT_DATE, 'enrolled')
      RETURNING *
    `;

    res.json({ success: true, enrollment: result[0] });
  } catch (error) {
    console.error('Error enrolling in module:', error);
    res.status(500).json({ error: 'Failed to enroll in module' });
  }
});

// 18. Update module progress
app.post('/api/modules/progress', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { moduleId, chapterId, status, progressPercentage, timeSpent } = req.body;

    if (!moduleId || !chapterId) {
      return res.status(400).json({ error: 'Module ID and Chapter ID are required' });
    }

    const result = await sql`
      INSERT INTO module_progress (user_id, module_id, chapter_id, status, progress_percentage, time_spent, last_accessed)
      VALUES (${userId}, ${moduleId}, ${chapterId}, ${status || 'in_progress'}, ${progressPercentage || 0}, ${timeSpent || 0}, NOW())
      ON CONFLICT (user_id, module_id, chapter_id)
      DO UPDATE SET 
        status = ${status || 'in_progress'},
        progress_percentage = ${progressPercentage || 0},
        time_spent = module_progress.time_spent + ${timeSpent || 0},
        last_accessed = NOW(),
        completed_at = CASE WHEN ${status || 'in_progress'} = 'completed' THEN NOW() ELSE completed_at END
      RETURNING *
    `;

    // Update overall module progress
    const progressData = await sql`
      SELECT 
        COUNT(*) as total_chapters,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_chapters
      FROM module_progress
      WHERE user_id = ${userId} AND module_id = ${moduleId}
    `;

    const total = parseInt(progressData[0].total_chapters);
    const completed = parseInt(progressData[0].completed_chapters);
    const overallProgress = total > 0 ? (completed / total) * 100 : 0;

    await sql`
      UPDATE user_modules 
      SET progress = ${overallProgress},
          status = CASE WHEN ${overallProgress} = 100 THEN 'completed' ELSE 'in_progress' END,
          completion_date = CASE WHEN ${overallProgress} = 100 THEN NOW() ELSE completion_date END
      WHERE user_id = ${userId} AND module_id = ${moduleId}
    `;

    res.json({
      success: true,
      progress: result[0],
      overallProgress: overallProgress
    });
  } catch (error) {
    console.error('Error updating progress:', error);
    res.status(500).json({ error: 'Failed to update progress' });
  }
});

// ==================== ASSESSMENTS ENDPOINTS ====================

// 19. Get assessments for module
app.get('/api/assessments', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { moduleId } = req.query;

    let query = sql`
      SELECT a.*,
        (SELECT COUNT(*) FROM assessment_questions WHERE assessment_id = a.id) as total_questions,
        (SELECT MAX(score) FROM assessment_attempts WHERE assessment_id = a.id AND user_id = ${userId} AND status = 'graded') as best_score
      FROM assessments a
      WHERE a.status IN ('published', 'ongoing')
    `;

    if (moduleId) {
      query = sql`
        SELECT a.*,
          (SELECT COUNT(*) FROM assessment_questions WHERE assessment_id = a.id) as total_questions,
          (SELECT MAX(score) FROM assessment_attempts WHERE assessment_id = a.id AND user_id = ${userId} AND status = 'graded') as best_score
        FROM assessments a
        WHERE a.module_id = ${parseInt(moduleId)} AND a.status IN ('published', 'ongoing')
      `;
    }

    const result = await query;
    res.json({ success: true, assessments: result });
  } catch (error) {
    console.error('Error fetching assessments:', error);
    res.status(500).json({ error: 'Failed to fetch assessments' });
  }
});

// 20. Get single assessment with questions
app.get('/api/assessments/:id', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const assessmentId = parseInt(req.params.id);

    const assessment = await sql`
      SELECT * FROM assessments WHERE id = ${assessmentId}
    `;

    if (assessment.length === 0) {
      return res.status(404).json({ error: 'Assessment not found' });
    }

    const questions = await sql`
      SELECT id, question_type, question, options, marks, order_number, difficulty
      FROM assessment_questions 
      WHERE assessment_id = ${assessmentId}
      ORDER BY order_number
    `;

    // Get user's attempts
    const attempts = await sql`
      SELECT * FROM assessment_attempts 
      WHERE user_id = ${userId} AND assessment_id = ${assessmentId}
      ORDER BY attempt_number DESC
    `;

    res.json({
      success: true,
      assessment: assessment[0],
      questions: questions,
      attempts: attempts,
      attemptsRemaining: assessment[0].attempts_allowed - attempts.length
    });
  } catch (error) {
    console.error('Error fetching assessment:', error);
    res.status(500).json({ error: 'Failed to fetch assessment' });
  }
});

// 21. Start assessment attempt
app.post('/api/assessments/:id/start', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const assessmentId = parseInt(req.params.id);

    const assessment = await sql`
      SELECT * FROM assessments WHERE id = ${assessmentId}
    `;

    if (assessment.length === 0) {
      return res.status(404).json({ error: 'Assessment not found' });
    }

    // Check attempts
    const attempts = await sql`
      SELECT COUNT(*) FROM assessment_attempts 
      WHERE user_id = ${userId} AND assessment_id = ${assessmentId}
    `;

    if (parseInt(attempts[0].count) >= assessment[0].attempts_allowed) {
      return res.status(400).json({ error: 'No more attempts allowed' });
    }

    const attemptNumber = parseInt(attempts[0].count) + 1;

    const result = await sql`
      INSERT INTO assessment_attempts (user_id, assessment_id, attempt_number, start_time, status)
      VALUES (${userId}, ${assessmentId}, ${attemptNumber}, NOW(), 'in_progress')
      RETURNING *
    `;

    res.json({
      success: true,
      attempt: result[0],
      attemptNumber: attemptNumber
    });
  } catch (error) {
    console.error('Error starting assessment:', error);
    res.status(500).json({ error: 'Failed to start assessment' });
  }
});

// 22. Submit assessment attempt
app.post('/api/assessments/:id/submit', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const assessmentId = parseInt(req.params.id);
    const { attemptId, answers } = req.body;

    if (!attemptId || !answers) {
      return res.status(400).json({ error: 'Attempt ID and answers are required' });
    }

    // Verify attempt belongs to user
    const attemptCheck = await sql`
      SELECT * FROM assessment_attempts 
      WHERE id = ${attemptId} AND user_id = ${userId} AND assessment_id = ${assessmentId}
    `;

    if (attemptCheck.length === 0) {
      return res.status(404).json({ error: 'Attempt not found' });
    }

    if (attemptCheck[0].status !== 'in_progress') {
      return res.status(400).json({ error: 'Attempt already submitted' });
    }

    // Get assessment questions with correct answers
    const questions = await sql`
      SELECT id, correct_answer, marks FROM assessment_questions 
      WHERE assessment_id = ${assessmentId}
    `;

    // Calculate score
    let obtainedMarks = 0;
    let totalMarks = 0;

    questions.forEach(q => {
      totalMarks += q.marks;
      const userAnswer = answers[q.id];
      // Simple exact match for now (can be expanded for different question types)
      if (userAnswer && userAnswer === q.correct_answer) {
        obtainedMarks += q.marks;
      }
    });

    const percentage = totalMarks > 0 ? (obtainedMarks / totalMarks) * 100 : 0;
    const isPassed = percentage >= 40; // Assuming 40% passing

    // Get assessment for passing marks
    const assessment = await sql`
      SELECT total_marks, passing_marks FROM assessments WHERE id = ${assessmentId}
    `;

    const result = await sql`
      UPDATE assessment_attempts SET
        end_time = NOW(),
        answers = ${JSON.stringify(answers)}::jsonb,
        obtained_marks = ${obtainedMarks},
        score = ${percentage},
        percentage = ${percentage},
        status = 'submitted'
      WHERE id = ${attemptId}
      RETURNING *
    `;

    // Create result record
    await sql`
      INSERT INTO assessment_results (
        user_id, assessment_id, attempt_id, total_marks, obtained_marks,
        percentage, grade, is_passed
      ) VALUES (
        ${userId}, ${assessmentId}, ${attemptId}, ${totalMarks}, ${obtainedMarks},
        ${percentage}, 
        ${percentage >= 80 ? 'A' : percentage >= 70 ? 'B' : percentage >= 60 ? 'C' : percentage >= 40 ? 'D' : 'F'},
        ${isPassed}
      )
    `;

    res.json({
      success: true,
      attempt: result[0],
      score: {
        obtainedMarks,
        totalMarks,
        percentage,
        isPassed,
        grade: percentage >= 80 ? 'A' : percentage >= 70 ? 'B' : percentage >= 60 ? 'C' : percentage >= 40 ? 'D' : 'F'
      }
    });
  } catch (error) {
    console.error('Error submitting assessment:', error);
    res.status(500).json({ error: 'Failed to submit assessment' });
  }
});

// ==================== AI CHAT ENDPOINTS ====================

// 23. Create new chat session
app.post('/api/chat/session', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { title, context, moduleId } = req.body;

    const result = await sql`
      INSERT INTO ai_chat_sessions (user_id, session_title, context, module_id)
      VALUES (${userId}, ${title || 'New Chat Session'}, ${context || 'general'}, ${moduleId || null})
      RETURNING *
    `;

    res.json({ success: true, session: result[0] });
  } catch (error) {
    console.error('Error creating chat session:', error);
    res.status(500).json({ error: 'Failed to create chat session' });
  }
});

// 24. Get user's chat sessions
app.get('/api/chat/sessions', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await sql`
      SELECT * FROM ai_chat_sessions 
      WHERE user_id = ${userId} AND is_active = TRUE
      ORDER BY last_message_at DESC
    `;

    res.json({ success: true, sessions: result });
  } catch (error) {
    console.error('Error fetching chat sessions:', error);
    res.status(500).json({ error: 'Failed to fetch chat sessions' });
  }
});

// 25. Get chat messages
app.get('/api/chat/session/:sessionId', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const sessionId = parseInt(req.params.sessionId);

    // Verify session belongs to user
    const sessionCheck = await sql`
      SELECT id FROM ai_chat_sessions 
      WHERE id = ${sessionId} AND user_id = ${userId}
    `;

    if (sessionCheck.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const messages = await sql`
      SELECT * FROM ai_chat_messages 
      WHERE session_id = ${sessionId}
      ORDER BY created_at ASC
    `;

    res.json({ success: true, messages });
  } catch (error) {
    console.error('Error fetching chat messages:', error);
    res.status(500).json({ error: 'Failed to fetch chat messages' });
  }
});

// 26. Send message (AI response simulation)
app.post('/api/chat/message', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { sessionId, message } = req.body;

    if (!sessionId || !message) {
      return res.status(400).json({ error: 'Session ID and message are required' });
    }

    // Verify session
    const sessionCheck = await sql`
      SELECT * FROM ai_chat_sessions 
      WHERE id = ${sessionId} AND user_id = ${userId} AND is_active = TRUE
    `;

    if (sessionCheck.length === 0) {
      return res.status(404).json({ error: 'Session not found or inactive' });
    }

    // Save user message
    const userMessage = await sql`
      INSERT INTO ai_chat_messages (session_id, sender, message)
      VALUES (${sessionId}, 'user', ${message})
      RETURNING *
    `;

    // Update session
    await sql`
      UPDATE ai_chat_sessions 
      SET messages_count = messages_count + 1, last_message_at = NOW()
      WHERE id = ${sessionId}
    `;

    // Generate AI response (simulated)
    const aiResponse = generateAIResponse(message, sessionCheck[0].context);

    const aiMessage = await sql`
      INSERT INTO ai_chat_messages (session_id, sender, message, message_type, response_time_ms)
      VALUES (${sessionId}, 'ai', ${aiResponse}, 'text', ${Math.floor(Math.random() * 1000) + 200})
      RETURNING *
    `;

    await sql`
      UPDATE ai_chat_sessions 
      SET messages_count = messages_count + 1
      WHERE id = ${sessionId}
    `;

    res.json({
      success: true,
      userMessage: userMessage[0],
      aiMessage: aiMessage[0]
    });
  } catch (error) {
    console.error('Error processing chat message:', error);
    res.status(500).json({ error: 'Failed to process message' });
  }
});

// Helper function for AI responses (mock)
function generateAIResponse(message, context) {
  const responses = {
    general: [
      "That's an interesting question! Let me help you understand this better.",
      "Great question! Here's what I think about that...",
      "I'm glad you asked! Let me explain this in detail.",
      "That's a very good point. Let me share my thoughts on this."
    ],
    academic: [
      "From an academic perspective, this topic involves several key concepts...",
      "In the context of your studies, this relates to the following theories...",
      "Based on academic research, here's what we know about this...",
      "This is a fundamental concept in your field. Let me break it down."
    ],
    technical: [
      "From a technical standpoint, here's how this works...",
      "The technical implementation involves these key steps...",
      "Let me explain the technical aspects of this...",
      "Here's the technical breakdown of what you're asking about."
    ],
    support: [
      "I understand your concern. Here's how we can address this...",
      "Let me help you with that. Here are some options...",
      "I hear you. Here's what we can do to resolve this...",
      "Thank you for bringing this up. Let me assist you."
    ]
  };

  const contextResponses = responses[context] || responses.general;
  const baseResponse = contextResponses[Math.floor(Math.random() * contextResponses.length)];

  if (message.length > 50) {
    return baseResponse + " I appreciate you providing such detailed context. This helps me give you a more tailored response.";
  } else {
    return baseResponse + " Could you provide more details so I can give you a more specific answer?";
  }
}

// 27. Rate AI response
app.post('/api/chat/feedback', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { messageId, rating, feedbackText, isHelpful } = req.body;

    if (!messageId || !rating) {
      return res.status(400).json({ error: 'Message ID and rating are required' });
    }

    const result = await sql`
      INSERT INTO ai_chat_feedback (message_id, user_id, rating, feedback_text, is_helpful)
      VALUES (${messageId}, ${userId}, ${rating}, ${feedbackText}, ${isHelpful})
      ON CONFLICT (message_id, user_id)
      DO UPDATE SET 
        rating = ${rating},
        feedback_text = ${feedbackText},
        is_helpful = ${isHelpful}
      RETURNING *
    `;

    res.json({ success: true, feedback: result[0] });
  } catch (error) {
    console.error('Error saving feedback:', error);
    res.status(500).json({ error: 'Failed to save feedback' });
  }
});

// 28. End chat session
app.put('/api/chat/session/:id/end', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const sessionId = parseInt(req.params.id);

    const result = await sql`
      UPDATE ai_chat_sessions 
      SET is_active = FALSE, ended_at = NOW()
      WHERE id = ${sessionId} AND user_id = ${userId}
      RETURNING *
    `;

    if (result.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json({ success: true, session: result[0] });
  } catch (error) {
    console.error('Error ending chat session:', error);
    res.status(500).json({ error: 'Failed to end chat session' });
  }
});

// ==================== DASHBOARD ENDPOINTS ====================

// 29. Get dashboard stats
app.get('/api/dashboard', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get today's date
    const today = new Date();
    const todayDay = today.getDay();

    // Get today's classes
    const todayClasses = await sql`
      SELECT * FROM schedule 
      WHERE user_id = ${userId} AND day_of_week = ${todayDay}
      ORDER BY start_time
    `;

    // Get modules stats
    const modulesStats = await sql`
      SELECT 
        COUNT(*) as total_modules,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_modules,
        AVG(progress) as avg_progress
      FROM user_modules
      WHERE user_id = ${userId}
    `;

    // Get assessment stats
    const assessmentStats = await sql`
      SELECT 
        COUNT(*) as total_attempts,
        AVG(percentage) as avg_score,
        COUNT(CASE WHEN is_passed = TRUE THEN 1 END) as passed
      FROM assessment_results
      WHERE user_id = ${userId}
    `;

    // Get attendance stats
    const attendanceStats = await sql`
      SELECT 
        COUNT(*) as total_classes,
        COUNT(CASE WHEN status = 'present' THEN 1 END) as attended
      FROM class_attendance
      WHERE user_id = ${userId}
    `;

    // Get motivational quote
    const quote = await sql`
      SELECT * FROM motivational_quotes 
      WHERE is_active = TRUE
      ORDER BY RANDOM() 
      LIMIT 1
    `;

    res.json({
      success: true,
      dashboard: {
        todayClasses: todayClasses || [],
        modules: {
          total: parseInt(modulesStats[0]?.total_modules || 0),
          completed: parseInt(modulesStats[0]?.completed_modules || 0),
          averageProgress: parseFloat(modulesStats[0]?.avg_progress || 0)
        },
        assessments: {
          total: parseInt(assessmentStats[0]?.total_attempts || 0),
          averageScore: parseFloat(assessmentStats[0]?.avg_score || 0),
          passed: parseInt(assessmentStats[0]?.passed || 0)
        },
        attendance: {
          total: parseInt(attendanceStats[0]?.total_classes || 0),
          attended: parseInt(attendanceStats[0]?.attended || 0),
          rate: attendanceStats[0]?.total_classes > 0 
            ? Math.round((parseInt(attendanceStats[0].attended) / parseInt(attendanceStats[0].total_classes)) * 100)
            : 0
        },
        quote: quote[0] || null
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

// 30. Get notifications
app.get('/api/notifications', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 20, offset = 0, unreadOnly = false } = req.query;

    let query = sql`
      SELECT * FROM push_notifications 
      WHERE user_id = ${userId}
    `;

    if (unreadOnly === 'true') {
      query = sql`
        SELECT * FROM push_notifications 
        WHERE user_id = ${userId} AND is_read = FALSE
      `;
    }

    query = sql`
      SELECT * FROM push_notifications 
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
    `;

    const result = await query;

    res.json({ success: true, notifications: result });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// 31. Mark notification as read
app.put('/api/notifications/:id/read', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const notificationId = parseInt(req.params.id);

    const result = await sql`
      UPDATE push_notifications 
      SET is_read = TRUE
      WHERE id = ${notificationId} AND user_id = ${userId}
      RETURNING *
    `;

    if (result.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({ success: true, notification: result[0] });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: 'Failed to update notification' });
  }
});

// 32. Mark all notifications as read
app.put('/api/notifications/read-all', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    await sql`
      UPDATE push_notifications 
      SET is_read = TRUE
      WHERE user_id = ${userId} AND is_read = FALSE
    `;

    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ error: 'Failed to update notifications' });
  }
});

// 33. Get unread notification count
app.get('/api/notifications/unread-count', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await sql`
      SELECT COUNT(*) as unread_count
      FROM push_notifications
      WHERE user_id = ${userId} AND is_read = FALSE
    `;

    res.json({ 
      success: true, 
      unreadCount: parseInt(result[0]?.unread_count || 0) 
    });
  } catch (error) {
    console.error('Error getting unread count:', error);
    res.status(500).json({ error: 'Failed to get unread count' });
  }
});

// ==================== ADDITIONAL ENDPOINTS ====================

// 34. Test auth endpoint (protected route)
app.get('/api/protected', auth, (req, res) => {
  res.json({
    message: 'This is a protected route',
    user: req.user
  });
});

// 35. Database status endpoint
app.get('/api/db-status', async (req, res) => {
  try {
    // Check if tables exist
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('users', 'user_profiles')
    `;

    const userCount = await sql`SELECT COUNT(*) FROM users`;
    const profileCount = await sql`SELECT COUNT(*) FROM user_profiles`;

    res.json({
      status: 'Connected',
      tables: tables.map(t => t.table_name),
      userCount: parseInt(userCount[0].count),
      profileCount: parseInt(profileCount[0].count),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Database status error:', error);
    res.status(500).json({
      error: 'Failed to get database status'
    });
  }
});

// 36. Debug user endpoint
app.get('/api/debug-user', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    // Check users table
    const userResult = await sql`
      SELECT * FROM users WHERE id = ${userId}
    `;

    // Check user_profiles table
    const profileResult = await sql`
      SELECT * FROM user_profiles WHERE user_id = ${userId}
    `;

    // Check if user_profiles table exists
    const tableCheck = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'user_profiles'
      )
    `;

    res.json({
      user: userResult[0] || null,
      profile: profileResult[0] || null,
      tableExists: tableCheck[0].exists,
      userId: userId
    });
  } catch (error) {
    console.error('Debug error:', error);
    res.status(500).json({
      error: error.message,
      stack: error.stack
    });
  }
});

// ==================== DEVELOPMENT HELPER ====================

// Development helper: return a JWT for the dev user (only in non-production)
if (process.env.NODE_ENV !== 'production') {
  app.post('/api/dev-token', (req, res) => {
    const email = process.env.DEV_USER_EMAIL;
    if (!email) return res.status(400).json({ error: 'DEV_USER_EMAIL not configured' });

    const token = jwt.sign(
      {
        userId: '00000000-0000-0000-0000-000000000000',
        email: email.toLowerCase(),
        firstName: process.env.DEV_USER_FIRSTNAME || 'Dev',
        lastName: process.env.DEV_USER_LASTNAME || 'User'
      },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '7d' }
    );

    res.json({ token, user: { email: email.toLowerCase(), firstName: process.env.DEV_USER_FIRSTNAME || 'Dev', lastName: process.env.DEV_USER_LASTNAME || 'User' } });
  });
}

// ==================== ERROR HANDLING ====================

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);
  res.status(500).json({
    error: 'Something went wrong on the server'
  });
});

// ==================== START SERVER ====================

// Initialize database and start server
const startServer = async () => {
  try {
    // Initialize database tables
    await initializeDatabase();

    // Start the server
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`\n🚀 Server running on port ${PORT}`);
      console.log(`📧 Using Mailgun for email delivery`);
      console.log(`🔐 Using code-based verification`);
      console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
      console.log(`💾 Database status: http://localhost:${PORT}/api/db-status`);
      console.log(`🔒 Protected route: http://localhost:${PORT}/api/protected (requires auth)`);
      console.log(`\n📋 Available endpoints:`);
      console.log(`  🔐 Auth: /api/register, /api/verify-code, /api/login`);
      console.log(`  📝 Onboarding: /api/onboarding`);
      console.log(`  📅 Schedule: /api/schedule, /api/attendance`);
      console.log(`  📚 Modules: /api/modules, /api/modules/:id`);
      console.log(`  📝 Assessments: /api/assessments`);
      console.log(`  💬 AI Chat: /api/chat/sessions, /api/chat/message`);
      console.log(`  📊 Dashboard: /api/dashboard`);
      console.log(`  🔔 Notifications: /api/notifications\n`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();