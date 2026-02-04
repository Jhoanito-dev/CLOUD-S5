const jwt = require('jsonwebtoken');
const db = require('../config/database');
const { verifyFirebaseToken, isFirebaseAvailable } = require('../config/firebase');

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key';

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token required' });
  }

  try {
    // Try Firebase token first if available
    if (isFirebaseAvailable()) {
      const firebaseUser = await verifyFirebaseToken(token);
      if (firebaseUser) {
        req.user = {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          firebaseAuth: true,
        };
        
        // Get user from local DB
        const result = await db.query('SELECT * FROM users WHERE uid = $1', [firebaseUser.uid]);
        if (result.rows.length > 0) {
          req.user = { ...req.user, ...result.rows[0] };
        }
        return next();
      }
    }

    // Try local JWT token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Check if session is valid
    const sessionResult = await db.query(
      'SELECT * FROM sessions WHERE token = $1 AND expires_at > NOW()',
      [token]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(401).json({ error: 'Session expired or invalid' });
    }

    // Get user data
    const userResult = await db.query('SELECT * FROM users WHERE id = $1', [decoded.userId]);
    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];
    
    if (user.is_blocked) {
      return res.status(403).json({ error: 'Account is blocked' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error.message);
    return res.status(401).json({ error: 'Invalid token' });
  }
};

const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};

const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    if (isFirebaseAvailable()) {
      const firebaseUser = await verifyFirebaseToken(token);
      if (firebaseUser) {
        const result = await db.query('SELECT * FROM users WHERE uid = $1', [firebaseUser.uid]);
        req.user = result.rows.length > 0 ? result.rows[0] : { uid: firebaseUser.uid, email: firebaseUser.email };
        return next();
      }
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const userResult = await db.query('SELECT * FROM users WHERE id = $1', [decoded.userId]);
    req.user = userResult.rows.length > 0 ? userResult.rows[0] : null;
    next();
  } catch (error) {
    req.user = null;
    next();
  }
};

module.exports = {
  authenticateToken,
  requireRole,
  optionalAuth,
  JWT_SECRET,
};
