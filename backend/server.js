const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { neon } = require('@neondatabase/serverless');
const { mg, DOMAIN, FROM_EMAIL } = require('./mailgun.config');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: 'http://localhost:8081',
  credentials: true
}));
app.use(express.json());

// Neon Database Connection
const sql = neon(process.env.DATABASE_URL);

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
      // Don't send the code back in response for security
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

    // Find user with this email
    const user = await sql`
      SELECT * FROM users WHERE email = ${email.toLowerCase()}
    `;

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
      SELECT * FROM users WHERE email = ${email.toLowerCase()}
    `;

    if (user.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check if email is verified
    if (!user[0].email_verified) {
      return res.status(403).json({ 
        error: 'Please verify your email before logging in',
        requiresVerification: true 
      });
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, user[0].password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user[0].id, 
        email: user[0].email,
        firstName: user[0].first_name,
        lastName: user[0].last_name
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user[0].id,
        firstName: user[0].first_name,
        lastName: user[0].last_name,
        email: user[0].email,
        emailVerified: user[0].email_verified
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// Save onboarding profile
app.post('/onboarding', auth, async (req, res) => {
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

    // Check if user already has a profile
    const existingProfile = await db.query(
      'SELECT id FROM user_profiles WHERE user_id = $1',
      [userId]
    );

    let result;
    if (existingProfile.rows.length > 0) {
      // Update existing profile
      result = await db.query(
        `UPDATE user_profiles 
         SET 
           qualification = $1,
           year = $2,
           academic_goal = $3,
           learning_style = $4,
           study_challenges = $5,
           study_hours = $6,
           productive_time = $7,
           reminder_frequency = $8,
           ai_support = $9,
           resource_recommendations = $10,
           updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $11
         RETURNING *`,
        [
          qualification,
          year,
          academicGoal,
          learningStyle,
          JSON.stringify(studyChallenges),
          studyHours,
          productiveTime,
          reminderFrequency,
          aiSupport,
          resourceRecommendations,
          userId
        ]
      );
    } else {
      // Create new profile
      result = await db.query(
        `INSERT INTO user_profiles (
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
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING *`,
        [
          userId,
          qualification,
          year,
          academicGoal,
          learningStyle,
          JSON.stringify(studyChallenges),
          studyHours,
          productiveTime,
          reminderFrequency,
          aiSupport,
          resourceRecommendations
        ]
      );
    }

    // Update user's onboarding status
    await db.query(
      'UPDATE users SET onboarding_completed = true WHERE id = $1',
      [userId]
    );

    // Return the profile data
    res.status(200).json({
      success: true,
      profile: result.rows[0],
      message: 'Onboarding completed successfully'
    });

  } catch (error) {
    console.error('Error saving onboarding profile:', error);
    res.status(500).json({
      error: 'Failed to save onboarding profile. Please try again.'
    });
  }
});

// Get onboarding profile
app.get('/onboarding', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await db.query(
      'SELECT * FROM user_profiles WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Profile not found'
      });
    }

    const profile = result.rows[0];
    // Parse JSON fields if needed
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

// Update onboarding profile
app.put('/onboarding', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const updates = req.body;

    // Build dynamic update query
    const allowedFields = [
      'qualification', 'year', 'academic_goal', 'learning_style',
      'study_challenges', 'study_hours', 'productive_time',
      'reminder_frequency', 'ai_support', 'resource_recommendations'
    ];

    const updateFields = [];
    const values = [];
    let paramCounter = 1;

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        // Convert camelCase to snake_case for database
        const dbField = field.replace(/([A-Z])/g, '_$1').toLowerCase();
        updateFields.push(`${dbField} = $${paramCounter}`);
        values.push(field === 'study_challenges' ? JSON.stringify(updates[field]) : updates[field]);
        paramCounter++;
      }
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        error: 'No fields to update'
      });
    }

    values.push(userId);
    const query = `
      UPDATE user_profiles 
      SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $${paramCounter}
      RETURNING *
    `;

    const result = await db.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Profile not found'
      });
    }

    res.status(200).json({
      success: true,
      profile: result.rows[0],
      message: 'Profile updated successfully'
    });

  } catch (error) {
    console.error('Error updating onboarding profile:', error);
    res.status(500).json({
      error: 'Failed to update onboarding profile'
    });
  }
});

// 5. Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    emailProvider: 'Mailgun',
    verificationMethod: 'Code-based'
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📧 Using Mailgun for email delivery`);
  console.log(`🔐 Using code-based verification`);
  console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
});