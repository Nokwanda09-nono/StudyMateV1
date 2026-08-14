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
  // Provide a stub that matches the tagged-template usage (e.g., sql`SELECT ...`).
  // This stub will throw a clear error when used, but prevents startup crashes.
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

    // Create indexes for better performance
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

    // Create function to update updated_at timestamp
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

    // Create triggers for updated_at
    await sql`
      DROP TRIGGER IF EXISTS update_users_updated_at ON users
    `;
    await sql`
      CREATE TRIGGER update_users_updated_at 
        BEFORE UPDATE ON users 
        FOR EACH ROW 
        EXECUTE FUNCTION update_updated_at_column()
    `;
    console.log('✅ Users trigger ready');

    await sql`
      DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles
    `;
    await sql`
      CREATE TRIGGER update_user_profiles_updated_at 
        BEFORE UPDATE ON user_profiles 
        FOR EACH ROW 
        EXECUTE FUNCTION update_updated_at_column()
    `;
    console.log('✅ User profiles trigger ready');

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

// ==================== ROUTES ====================

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

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📧 Using Mailgun for email delivery`);
  console.log(`🔐 Using code-based verification`);
  console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
})
// 9. Test auth endpoint (protected route)
app.get('/api/protected', auth, (req, res) => {
  res.json({
    message: 'This is a protected route',
    user: req.user
  });
});

// 10. Database status endpoint
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

// Add this endpoint to debug database issues
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
      console.log(`🔒 Protected route: http://localhost:${PORT}/api/protected (requires auth)\n`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
