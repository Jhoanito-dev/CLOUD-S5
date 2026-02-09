const express = require('express');
const db = require('../config/database');
const { optionalAuth } = require('../middleware/auth');

const router = express.Router();

/**
 * @swagger
 * /api/stats:
 *   get:
 *     summary: Get dashboard statistics
 *     tags: [Statistics]
 *     responses:
 *       200:
 *         description: Dashboard statistics
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Stats'
 */
router.get('/', optionalAuth, async (req, res) => {
  try {
    // Total counts
    const totalResult = await db.query(`
      SELECT 
        COUNT(*) as total_reports,
        COALESCE(SUM(surface), 0) as total_surface,
        COALESCE(SUM(budget), 0) as total_budget
      FROM reports 
      WHERE is_deleted = false
    `);

    // Count by status
    const statusResult = await db.query(`
      SELECT 
        status,
        COUNT(*) as count
      FROM reports 
      WHERE is_deleted = false
      GROUP BY status
    `);

    const byStatus = {
      new: 0,
      in_progress: 0,
      done: 0,
    };

    statusResult.rows.forEach(row => {
      byStatus[row.status] = parseInt(row.count);
    });

    const total = totalResult.rows[0];
    const totalReports = parseInt(total.total_reports);
    // Avancement pondéré : nouveau=0%, en_cours=50%, terminé=100%
    const progressPercentage = totalReports > 0 
      ? Math.round(((0 * byStatus.new + 50 * byStatus.in_progress + 100 * byStatus.done) / totalReports) * 100) / 100
      : 0;

    res.json({
      total_reports: totalReports,
      total_surface: parseFloat(total.total_surface) || 0,
      total_budget: parseFloat(total.total_budget) || 0,
      by_status: byStatus,
      progress_percentage: progressPercentage,
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/stats/monthly:
 *   get:
 *     summary: Get monthly statistics
 *     tags: [Statistics]
 *     responses:
 *       200:
 *         description: Monthly statistics
 */
router.get('/monthly', optionalAuth, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        DATE_TRUNC('month', created_at) as month,
        COUNT(*) as count,
        COALESCE(SUM(surface), 0) as total_surface,
        COALESCE(SUM(budget), 0) as total_budget
      FROM reports 
      WHERE is_deleted = false
        AND created_at >= NOW() - INTERVAL '12 months'
      GROUP BY DATE_TRUNC('month', created_at)
      ORDER BY month DESC
    `);

    res.json({ monthly_stats: result.rows });
  } catch (error) {
    console.error('Get monthly stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
