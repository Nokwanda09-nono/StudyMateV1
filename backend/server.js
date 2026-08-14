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

// Middleware
app.use(cors({
  origin: '*',
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

// Auto-migration helper for database tables
const initDb = async () => {
  try {
    await sql`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS onboarding_profiles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        qualification VARCHAR(100),
        year VARCHAR(50),
        academic_goal VARCHAR(100),
        learning_style VARCHAR(100),
        study_challenges TEXT[],
        study_hours VARCHAR(50),
        productive_time VARCHAR(100),
        reminder_frequency VARCHAR(50),
        ai_support VARCHAR(100),
        resource_recommendations VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    console.log('✅ Database schema verified');
  } catch (err) {
    console.error('⚠️ DB init note:', err.message);
  }
};
initDb();

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Authentication token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'secret', (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
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

    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const existingUser = await sql`
      SELECT * FROM users WHERE email = ${email.toLowerCase()}
    `;

    if (existingUser.length > 0) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const verificationCode = generateVerificationCode();
    const codeExpires = new Date();
    codeExpires.setMinutes(codeExpires.getMinutes() + 15);

    const result = await sql`
      INSERT INTO users (
        first_name, 
        last_name, 
        email, 
        password_hash, 
        verification_code,
        verification_code_expires,
        verification_attempts,
        onboarding_completed
      )
      VALUES (
        ${firstName}, 
        ${lastName}, 
        ${email.toLowerCase()}, 
        ${passwordHash}, 
        ${verificationCode},
        ${codeExpires},
        0,
        FALSE
      )
      RETURNING id, email, first_name, last_name, email_verified, onboarding_completed
    `;

    const newUser = result[0];

    try {
      await sendVerificationCodeEmail(email, firstName, verificationCode);
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
      return res.status(201).json({
        message: 'Registration successful but email sending failed. Please request a new code.',
        user: {
          id: newUser.id,
          firstName: newUser.first_name,
          lastName: newUser.last_name,
          email: newUser.email,
          emailVerified: false,
          onboardingCompleted: false
        },
        emailSent: false
      });
    }

    res.status(201).json({
      message: 'Registration successful! Please check your email for the verification code.',
      user: {
        id: newUser.id,
        firstName: newUser.first_name,
        lastName: newUser.last_name,
        email: newUser.email,
        emailVerified: false,
        onboardingCompleted: false
      },
      emailSent: true,
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Server error during registration' });
  }
});

// 2. Verify Code Route - Verifies and automatically logs user in
app.post('/api/verify-code', async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ error: 'Email and verification code are required' });
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
      return res.status(404).json({ error: 'User not found' });
    }

    if (user[0].email_verified) {
      const token = jwt.sign(
        { 
          userId: user[0].id, 
          email: user[0].email,
          firstName: user[0].first_name,
          lastName: user[0].last_name
        },
        process.env.JWT_SECRET || 'secret',
        { expiresIn: '7d' }
      );

      return res.json({
        message: 'Email already verified. Logging in.',
        verified: true,
        token,
        user: {
          id: user[0].id,
          firstName: user[0].first_name,
          lastName: user[0].last_name,
          email: user[0].email,
          emailVerified: true,
          onboardingCompleted: Boolean(user[0].onboarding_completed)
        }
      });
    }

    if (user[0].verification_code !== code) {
      await sql`
        UPDATE users 
        SET verification_attempts = verification_attempts + 1
        WHERE id = ${user[0].id}
      `;

      const attempts = user[0].verification_attempts + 1;
      
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

    // Generate JWT token for immediate auto-login after verification
    const token = jwt.sign(
      { 
        userId: user[0].id, 
        email: user[0].email,
        firstName: user[0].first_name,
        lastName: user[0].last_name
      },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Email verified successfully!',
      verified: true,
      token,
      user: {
        id: user[0].id,
        firstName: user[0].first_name,
        lastName: user[0].last_name,
        email: user[0].email,
        emailVerified: true,
        onboardingCompleted: Boolean(user[0].onboarding_completed)
      }
    });

  } catch (error) {
    console.error('Code verification error:', error);
    res.status(500).json({ error: 'Server error during verification' });
  }
});

// 3. Resend Verification Code
app.post('/api/resend-verification', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const user = await sql`
      SELECT * FROM users WHERE email = ${email.toLowerCase()}
    `;

    if (user.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user[0].email_verified) {
      return res.status(400).json({ error: 'Email already verified' });
    }

    if (user[0].verification_attempts >= 5) {
      await sql`
        UPDATE users 
        SET verification_attempts = 0
        WHERE id = ${user[0].id}
      `;
    }

    const verificationCode = generateVerificationCode();
    const codeExpires = new Date();
    codeExpires.setMinutes(codeExpires.getMinutes() + 15);

    await sql`
      UPDATE users 
      SET 
        verification_code = ${verificationCode},
        verification_code_expires = ${codeExpires}
      WHERE id = ${user[0].id}
    `;

    await sendVerificationCodeEmail(email, user[0].first_name, verificationCode);

    res.json({ message: 'New verification code sent successfully' });

  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({ error: 'Server error while resending verification' });
  }
});

// 4. Login Route
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await sql`
      SELECT * FROM users WHERE email = ${email.toLowerCase()}
    `;

    if (user.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!user[0].email_verified) {
      return res.status(403).json({ 
        error: 'Please verify your email before logging in',
        requiresVerification: true 
      });
    }

    const validPassword = await bcrypt.compare(password, user[0].password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { 
        userId: user[0].id, 
        email: user[0].email,
        firstName: user[0].first_name,
        lastName: user[0].last_name
      },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '7d' }
    );

    const profile = await sql`
      SELECT * FROM onboarding_profiles WHERE user_id = ${user[0].id}
    `;

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user[0].id,
        firstName: user[0].first_name,
        lastName: user[0].last_name,
        email: user[0].email,
        emailVerified: Boolean(user[0].email_verified),
        onboardingCompleted: Boolean(user[0].onboarding_completed),
        profile: profile.length > 0 ? {
          qualification: profile[0].qualification,
          year: profile[0].year,
          academicGoal: profile[0].academic_goal,
          learningStyle: profile[0].learning_style,
          studyChallenges: profile[0].study_challenges || [],
          studyHours: profile[0].study_hours,
          productiveTime: profile[0].productive_time,
          reminderFrequency: profile[0].reminder_frequency,
          aiSupport: profile[0].ai_support,
          resourceRecommendations: profile[0].resource_recommendations
        } : null
      }
    });

  } catch (error) {
    console.error('Login error:', error && error.stack ? error.stack : error);
    // Include error message in response during development to aid debugging.
    // Remove `details` in production to avoid leaking internals.
    res.status(500).json({ error: 'Server error during login', details: error && error.message ? error.message : String(error) });
  }
});

// 5. Save Onboarding Profile Route
app.post('/api/onboarding', authenticateToken, async (req, res) => {
  try {
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

    const userId = req.user.userId;

    await sql`
      INSERT INTO onboarding_profiles (
        user_id, qualification, year, academic_goal, learning_style,
        study_challenges, study_hours, productive_time, reminder_frequency,
        ai_support, resource_recommendations, updated_at
      ) VALUES (
        ${userId}, ${qualification || ''}, ${year || ''}, ${academicGoal || ''},
        ${learningStyle || ''}, ${studyChallenges || []}, ${studyHours || ''},
        ${productiveTime || ''}, ${reminderFrequency || ''}, ${aiSupport || ''},
        ${resourceRecommendations || ''}, NOW()
      )
      ON CONFLICT (user_id) DO UPDATE SET
        qualification = EXCLUDED.qualification,
        year = EXCLUDED.year,
        academic_goal = EXCLUDED.academic_goal,
        learning_style = EXCLUDED.learning_style,
        study_challenges = EXCLUDED.study_challenges,
        study_hours = EXCLUDED.study_hours,
        productive_time = EXCLUDED.productive_time,
        reminder_frequency = EXCLUDED.reminder_frequency,
        ai_support = EXCLUDED.ai_support,
        resource_recommendations = EXCLUDED.resource_recommendations,
        updated_at = NOW()
    `;

    const updatedUser = await sql`
      UPDATE users
      SET onboarding_completed = TRUE, updated_at = NOW()
      WHERE id = ${userId}
      RETURNING id, first_name, last_name, email, email_verified, onboarding_completed
    `;

    const savedProfile = {
      qualification: qualification || '',
      year: year || '',
      academicGoal: academicGoal || '',
      learningStyle: learningStyle || '',
      studyChallenges: studyChallenges || [],
      studyHours: studyHours || '',
      productiveTime: productiveTime || '',
      reminderFrequency: reminderFrequency || '',
      aiSupport: aiSupport || '',
      resourceRecommendations: resourceRecommendations || ''
    };

    res.json({
      success: true,
      message: 'Onboarding profile saved successfully',
      user: {
        id: updatedUser[0].id,
        firstName: updatedUser[0].first_name,
        lastName: updatedUser[0].last_name,
        email: updatedUser[0].email,
        emailVerified: Boolean(updatedUser[0].email_verified),
        onboardingCompleted: true,
        profile: savedProfile
      },
      profile: savedProfile
    });

  } catch (error) {
    console.error('Save onboarding error:', error);
    res.status(500).json({ error: 'Server error while saving onboarding profile' });
  }
});

// 6. Get Onboarding Profile Route
app.get('/api/onboarding', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const profile = await sql`
      SELECT * FROM onboarding_profiles WHERE user_id = ${userId}
    `;

    if (profile.length === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    res.json({
      success: true,
      profile: {
        qualification: profile[0].qualification,
        year: profile[0].year,
        academicGoal: profile[0].academic_goal,
        learningStyle: profile[0].learning_style,
        studyChallenges: profile[0].study_challenges || [],
        studyHours: profile[0].study_hours,
        productiveTime: profile[0].productive_time,
        reminderFrequency: profile[0].reminder_frequency,
        aiSupport: profile[0].ai_support,
        resourceRecommendations: profile[0].resource_recommendations
      }
    });
  } catch (error) {
    console.error('Fetch onboarding error:', error);
    res.status(500).json({ error: 'Server error while fetching onboarding profile' });
  }
});

// 7. Update Profile Route
app.put('/api/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { firstName, lastName, qualification, year, academicGoal, learningStyle, studyChallenges, studyHours, productiveTime, reminderFrequency, aiSupport, resourceRecommendations } = req.body;

    if (firstName !== undefined || lastName !== undefined) {
      await sql`
        UPDATE users
        SET 
          first_name = COALESCE(${firstName}, first_name),
          last_name = COALESCE(${lastName}, last_name),
          updated_at = NOW()
        WHERE id = ${userId}
      `;
    }

    await sql`
      INSERT INTO onboarding_profiles (
        user_id, qualification, year, academic_goal, learning_style,
        study_challenges, study_hours, productive_time, reminder_frequency,
        ai_support, resource_recommendations, updated_at
      ) VALUES (
        ${userId}, ${qualification || ''}, ${year || ''}, ${academicGoal || ''},
        ${learningStyle || ''}, ${studyChallenges || []}, ${studyHours || ''},
        ${productiveTime || ''}, ${reminderFrequency || ''}, ${aiSupport || ''},
        ${resourceRecommendations || ''}, NOW()
      )
      ON CONFLICT (user_id) DO UPDATE SET
        qualification = COALESCE(EXCLUDED.qualification, onboarding_profiles.qualification),
        year = COALESCE(EXCLUDED.year, onboarding_profiles.year),
        academic_goal = COALESCE(EXCLUDED.academic_goal, onboarding_profiles.academic_goal),
        learning_style = COALESCE(EXCLUDED.learning_style, onboarding_profiles.learning_style),
        study_challenges = COALESCE(EXCLUDED.study_challenges, onboarding_profiles.study_challenges),
        study_hours = COALESCE(EXCLUDED.study_hours, onboarding_profiles.study_hours),
        productive_time = COALESCE(EXCLUDED.productive_time, onboarding_profiles.productive_time),
        reminder_frequency = COALESCE(EXCLUDED.reminder_frequency, onboarding_profiles.reminder_frequency),
        ai_support = COALESCE(EXCLUDED.ai_support, onboarding_profiles.ai_support),
        resource_recommendations = COALESCE(EXCLUDED.resource_recommendations, onboarding_profiles.resource_recommendations),
        updated_at = NOW()
    `;

    const userRes = await sql`SELECT * FROM users WHERE id = ${userId}`;
    const profileRes = await sql`SELECT * FROM onboarding_profiles WHERE user_id = ${userId}`;

    const profileObj = profileRes.length > 0 ? {
      qualification: profileRes[0].qualification,
      year: profileRes[0].year,
      academicGoal: profileRes[0].academic_goal,
      learningStyle: profileRes[0].learning_style,
      studyChallenges: profileRes[0].study_challenges || [],
      studyHours: profileRes[0].study_hours,
      productiveTime: profileRes[0].productive_time,
      reminderFrequency: profileRes[0].reminder_frequency,
      aiSupport: profileRes[0].ai_support,
      resourceRecommendations: profileRes[0].resource_recommendations
    } : null;

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: userRes[0].id,
        firstName: userRes[0].first_name,
        lastName: userRes[0].last_name,
        email: userRes[0].email,
        emailVerified: Boolean(userRes[0].email_verified),
        onboardingCompleted: Boolean(userRes[0].onboarding_completed),
        profile: profileObj
      },
      profile: profileObj
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Server error while updating profile' });
  }
});

// Health check
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
});