const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { createFirebaseUser, isFirebaseAvailable } = require('../config/firebase');
const { JWT_SECRET, authenticateToken } = require('../middleware/auth');

const router = express.Router();

const MAX_LOGIN_ATTEMPTS = parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 3;
const SESSION_DURATION = parseInt(process.env.SESSION_DURATION) || 3600;

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *     responses:
 *       201:
 *         description: User created successfully
 *       400:
 *         description: Validation error
 *       409:
 *         description: Email already in use
 */
router.post('/register', [
  body('email').isEmail().withMessage('Invalid email format'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('first_name').notEmpty().withMessage('First name is required'),
  body('last_name').notEmpty().withMessage('Last name is required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, first_name, last_name } = req.body;

    // Check if email already exists
    const existingUser = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'Email already in use' });
    }

    let uid = uuidv4();
    let firebaseCreated = false;

    // Try to create Firebase user if available
    if (isFirebaseAvailable()) {
      try {
        const firebaseUser = await createFirebaseUser(email, password);
        if (firebaseUser) {
          uid = firebaseUser.uid;
          firebaseCreated = true;
        }
      } catch (firebaseError) {
        if (firebaseError.code === 'auth/email-already-exists') {
          return res.status(409).json({ error: 'Email already in use' });
        }
        console.error('Firebase user creation error:', firebaseError.message);
      }
    }

    // Hash password for local storage
    const passwordHash = await bcrypt.hash(password, 10);

    // Insert user into database
    const result = await db.query(
      `INSERT INTO users (uid, email, password_hash, first_name, last_name, role)
       VALUES ($1, $2, $3, $4, $5, 'user')
       RETURNING id, uid, email, first_name, last_name, role, created_at`,
      [uid, email, passwordHash, first_name, last_name]
    );

    const user = result.rows[0];

    res.status(201).json({
      message: firebaseCreated 
        ? 'Account created successfully. A verification email has been sent.'
        : 'Account created successfully.',
      user: {
        id: user.id,
        uid: user.uid,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 *       403:
 *         description: Account blocked
 */
router.post('/login', [
  body('email').isEmail().withMessage('Invalid email format'),
  body('password').notEmpty().withMessage('Password is required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;

    // Find user
    const userResult = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    
    if (userResult.rows.length === 0) {
      // Log failed attempt
      await db.query(
        'INSERT INTO login_attempts (email, ip_address, success) VALUES ($1, $2, false)',
        [email, ipAddress]
      );
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = userResult.rows[0];

    // Check if user is blocked
    if (user.is_blocked) {
      if (user.blocked_until && new Date(user.blocked_until) > new Date()) {
        return res.status(403).json({ 
          error: 'Account blocked',
          message: `Account is blocked until ${user.blocked_until}`,
        });
      } else if (user.blocked_until && new Date(user.blocked_until) <= new Date()) {
        // Unblock if time has passed
        await db.query(
          'UPDATE users SET is_blocked = false, login_attempts = 0, blocked_until = NULL WHERE id = $1',
          [user.id]
        );
        user.is_blocked = false;
        user.login_attempts = 0;
      } else {
        return res.status(403).json({ error: 'Account is blocked. Contact administrator.' });
      }
    }

    // Check password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    
    if (!validPassword) {
      const newAttempts = user.login_attempts + 1;
      
      // Log failed attempt
      await db.query(
        'INSERT INTO login_attempts (email, ip_address, success) VALUES ($1, $2, false)',
        [email, ipAddress]
      );

      if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
        // Block user
        const blockedUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
        await db.query(
          'UPDATE users SET login_attempts = $1, is_blocked = true, blocked_until = $2 WHERE id = $3',
          [newAttempts, blockedUntil, user.id]
        );
        return res.status(403).json({ 
          error: 'Account blocked',
          message: `Too many failed attempts. Account blocked until ${blockedUntil.toISOString()}`,
        });
      } else {
        await db.query(
          'UPDATE users SET login_attempts = $1 WHERE id = $2',
          [newAttempts, user.id]
        );
        return res.status(401).json({ 
          error: 'Invalid credentials',
          attempts_remaining: MAX_LOGIN_ATTEMPTS - newAttempts,
        });
      }
    }

    // Reset login attempts on successful login
    await db.query(
      'UPDATE users SET login_attempts = 0 WHERE id = $1',
      [user.id]
    );

    // Log successful attempt
    await db.query(
      'INSERT INTO login_attempts (email, ip_address, success) VALUES ($1, $2, true)',
      [email, ipAddress]
    );

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, uid: user.uid, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: `${SESSION_DURATION}s` }
    );

    // Store session
    const expiresAt = new Date(Date.now() + SESSION_DURATION * 1000);
    await db.query(
      'INSERT INTO sessions (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, token, expiresAt]
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        uid: user.uid,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
      },
      expires_at: expiresAt.toISOString(),
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Logout user
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 */
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    // Delete session
    await db.query('DELETE FROM sessions WHERE token = $1', [token]);

    res.json({ message: 'Logout successful' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/auth/unblock/{userId}:
 *   post:
 *     summary: Unblock a user account (Manager only)
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: User unblocked successfully
 *       403:
 *         description: Not authorized
 *       404:
 *         description: User not found
 */
router.post('/unblock/:userId', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'manager') {
      return res.status(403).json({ error: 'Manager access required' });
    }

    const { userId } = req.params;

    const result = await db.query(
      'UPDATE users SET is_blocked = false, login_attempts = 0, blocked_until = NULL WHERE id = $1 RETURNING id, email',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ 
      message: 'User unblocked successfully',
      user: result.rows[0],
    });
  } catch (error) {
    console.error('Unblock error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/auth/blocked-users:
 *   get:
 *     summary: Get list of blocked users (Manager only)
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of blocked users
 */
router.get('/blocked-users', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'manager') {
      return res.status(403).json({ error: 'Manager access required' });
    }

    const result = await db.query(
      'SELECT id, email, first_name, last_name, login_attempts, blocked_until FROM users WHERE is_blocked = true'
    );

    res.json({ users: result.rows });
  } catch (error) {
    console.error('Get blocked users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
