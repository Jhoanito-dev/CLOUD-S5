const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken, requireRole, optionalAuth } = require('../middleware/auth');
const settings = require('../config/settings');

const router = express.Router();

// Get current price per m2 (returns value and created_at)
router.get('/price-per-m2', optionalAuth, async (req, res) => {
  try {
    const row = await settings.getPricePerM2();
    if (!row) return res.json({ price_per_m2: null });
    res.json({ price_per_m2: row.price, created_at: row.created_at });
  } catch (error) {
    console.error('Get price error:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update price per m2 (manager only) — creates a new historical entry
router.put('/price-per-m2', authenticateToken, requireRole('manager'), [
  body('price_per_m2').isFloat({ min: 0 }).withMessage('price_per_m2 must be a non-negative number'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const price = parseFloat(req.body.price_per_m2);
    await settings.setPricePerM2(price);
    const row = await settings.getPricePerM2();
    res.json({ message: 'Price updated', price_per_m2: row.price, created_at: row.created_at });
  } catch (error) {
    console.error('Set price error:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
