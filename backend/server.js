const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { neon } = require('@neondatabase/serverless');
const { Resend } = require('resend');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: '*', // In production, set your frontend URL
  credentials: true
}));
app.use(express.json());

// Neon Database Connection
const sql = neon(process.env.DATABASE_URL);

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY);

// Helper function to send verification email using Resend
const sendVerificationEmail = async (email, firstName, token) => {
  const verificationLink = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;
  
  try {
    const { data, error } = await resend.emails.send({
      from: 'Study Mate <noreply@your-domain.com>', // Replace with your domain
      to: [email],
      subject: 'Verify Your Email - Study Mate',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #6366f1; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
              .content { background: #f9fafb; padding: 30px; border-radius: 0 0 5px 5px; }
              .button { display: inline-block; padding: 12px 24px; background: #6366f1; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
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
                <p>Thank you for registering with Study Mate. Please verify your email address by clicking the button below:</p>
                <div style="text-align: center;">
                  <a href="${verificationLink}" class="button">Verify Email</a>
                </div>
                <p>If the button doesn't work, you can also copy and paste this link into your browser:</p>
                <p style="word-break: break-all; color: #6366f1;">${verificationLink}</p>
                <p>This link will expire in 24 hours.</p>
                <p>If you didn't create an account with Study Mate, please ignore this email.</p>
              </div>
              <div class="footer">
                <p>&copy; 2024 Study Mate. All rights reserved.</p>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    if (error) {
      console.error('Resend error:', error);
      throw new Error('Failed to send verification email');
    }

    console.log(`Verification email sent to ${email}`, data);
    return data;
  } catch (error) {
    console.error('Error sending verification email:', error);
    throw new Error('Failed to send verification email');
  }
};

// ==================== ROUTES ====================

// 1. Register Route
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

    // Generate verification token
    const verificationToken = uuidv4();
    const tokenExpires = new Date();
    tokenExpires.setHours(tokenExpires.getHours() + 24); // 24 hours expiry

    // Insert user into database
    const result = await sql`
      INSERT INTO users (
        first_name, 
        last_name, 
        email, 
        password_hash, 
        verification_token, 
        verification_token_expires
      )
      VALUES (
        ${firstName}, 
        ${lastName}, 
        ${email.toLowerCase()}, 
        ${passwordHash}, 
        ${verificationToken}, 
        ${tokenExpires}
      )
      RETURNING id, email, first_name, last_name, email_verified
    `;

    const newUser = result[0];

    // Send verification email with Resend
    try {
      await sendVerificationEmail(email, firstName, verificationToken);
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
      // If email fails, we still created the user but they won't receive verification
      return res.status(201).json({
        message: 'Registration successful but email verification failed. Please contact support.',
        user: newUser,
        emailSent: false
      });
    }

    res.status(201).json({
      message: 'Registration successful! Please check your email to verify your account.',
      user: newUser,
      emailSent: true
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      error: 'Server error during registration' 
    });
  }
});

// 2. Verify Email Route
app.get('/api/verify-email', async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ error: 'Verification token is required' });
    }

    // Find user with this token
    const user = await sql`
      SELECT * FROM users 
      WHERE verification_token = ${token}
        AND verification_token_expires > NOW()
    `;

    if (user.length === 0) {
      return res.status(400).json({ 
        error: 'Invalid or expired verification token' 
      });
    }

    // Update user as verified
    await sql`
      UPDATE users 
      SET 
        email_verified = TRUE,
        verification_token = NULL,
        verification_token_expires = NULL,
        updated_at = NOW()
      WHERE id = ${user[0].id}
    `;

    res.json({
      message: 'Email verified successfully! You can now log in.',
      verified: true
    });

  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({ 
      error: 'Server error during email verification' 
    });
  }
});

// 3. Resend Verification Email
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

    // Generate new verification token
    const verificationToken = uuidv4();
    const tokenExpires = new Date();
    tokenExpires.setHours(tokenExpires.getHours() + 24);

    // Update user with new token
    await sql`
      UPDATE users 
      SET 
        verification_token = ${verificationToken},
        verification_token_expires = ${tokenExpires}
      WHERE id = ${user[0].id}
    `;

    // Resend verification email with Resend
    await sendVerificationEmail(email, user[0].first_name, verificationToken);

    res.json({
      message: 'Verification email resent successfully'
    });

  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({ 
      error: 'Server error while resending verification' 
    });
  }
});

// 4. Login Route (with verification check)
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

// 5. Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Start server

if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Using Resend for email delivery`);
    console.log(`Health check: http://localhost:${PORT}/api/health`);
  });
}

module.exports = app;
