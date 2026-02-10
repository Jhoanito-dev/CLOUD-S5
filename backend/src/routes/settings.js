const express = require('express');
const db = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

/**
 * @swagger
 * /api/settings:
 *   get:
 *     summary: Get all settings
 *     tags: [Settings]
 *     responses:
 *       200:
 *         description: All settings as key-value pairs
 */
router.get('/', async (req, res) => {
  try {
    const result = await db.query('SELECT key, value, description FROM settings');
    const settings = {};
    result.rows.forEach(row => {
      settings[row.key] = { value: row.value, description: row.description };
    });
    res.json(settings);
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/settings/prix_par_m2:
 *   get:
 *     summary: Get prix par m2
 *     tags: [Settings]
 *     responses:
 *       200:
 *         description: Prix par m2 value
 */
router.get('/prix_par_m2', async (req, res) => {
  try {
    const result = await db.query("SELECT value FROM settings WHERE key = 'prix_par_m2'");
    const value = result.rows.length > 0 ? parseFloat(result.rows[0].value) : 50000;
    res.json({ prix_par_m2: value });
  } catch (error) {
    console.error('Get prix_par_m2 error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/settings/prix_par_m2:
 *   put:
 *     summary: Update prix par m2 (Manager only)
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - value
 *             properties:
 *               value:
 *                 type: number
 *                 minimum: 0
 *     responses:
 *       200:
 *         description: Setting updated
 *       403:
 *         description: Manager only
 */
router.put('/prix_par_m2', authenticateToken, requireRole('manager'), async (req, res) => {
  try {
    const { value } = req.body;
    
    if (value === undefined || value === null || isNaN(value) || value < 0) {
      return res.status(400).json({ error: 'Value must be a positive number' });
    }

    await db.query(
      `INSERT INTO settings (key, value, description, updated_at) 
       VALUES ('prix_par_m2', $1, 'Prix par mètre carré pour le calcul du budget (en Ariary)', CURRENT_TIMESTAMP)
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = CURRENT_TIMESTAMP`,
      [value.toString()]
    );

    res.json({ message: 'Prix par m² mis à jour', prix_par_m2: value });
  } catch (error) {
    console.error('Update prix_par_m2 error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
