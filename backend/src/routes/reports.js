const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { authenticateToken, optionalAuth, requireRole } = require('../middleware/auth');
const { admin, isFirebaseAvailable, getFirestore, sendStatusChangeNotification } = require('../config/firebase');

const router = express.Router();

/**
 * @swagger
 * /api/reports:
 *   get:
 *     summary: Get all reports (with pagination and filters)
 *     tags: [Reports]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [new, in_progress, done]
 *       - in: query
 *         name: uid
 *         schema:
 *           type: string
 *         description: Filter by user UID
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           default: created_at
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *     responses:
 *       200:
 *         description: List of reports
 */
router.get('/', optionalAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    const offset = (page - 1) * limit;
    const status = req.query.status;
    const uid = req.query.uid;
    const sort = req.query.sort || 'created_at';
    const order = req.query.order === 'asc' ? 'ASC' : 'DESC';

    const allowedSorts = ['created_at', 'status', 'surface', 'budget'];
    const sortColumn = allowedSorts.includes(sort) ? sort : 'created_at';

    let whereConditions = ['r.is_deleted = false'];
    let params = [];
    let paramCount = 1;

    if (status) {
      whereConditions.push(`r.status = $${paramCount}`);
      params.push(status);
      paramCount++;
    }

    if (uid) {
      // Filter by user UID (from users table)
      whereConditions.push(`u.uid = $${paramCount}`);
      params.push(uid);
      paramCount++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Count total with join
    const countParams = [...params];
    const countQuery = `
      SELECT COUNT(*) FROM reports r 
      LEFT JOIN users u ON r.user_id = u.id 
      ${whereClause}
    `;
    const countResult = await db.query(countQuery, countParams);
    const totalCount = parseInt(countResult.rows[0].count);

    // Get reports
    params.push(limit, offset);
    const dataQuery = `
      SELECT r.*, u.first_name, u.last_name, u.email as user_email
      FROM reports r
      LEFT JOIN users u ON r.user_id = u.id
      ${whereClause}
      ORDER BY r.${sortColumn} ${order}
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;

    const result = await db.query(dataQuery, params);

    res.json({
      reports: result.rows,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error('Get reports error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/reports/{id}:
 *   get:
 *     summary: Get a single report by ID
 *     tags: [Reports]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Report details
 *       404:
 *         description: Report not found
 */
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT r.*, u.first_name, u.last_name, u.email as user_email
       FROM reports r
       LEFT JOIN users u ON r.user_id = u.id
       WHERE r.id = $1 AND r.is_deleted = false`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }

    res.json({ report: result.rows[0] });
  } catch (error) {
    console.error('Get report error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/reports:
 *   post:
 *     summary: Create a new report
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - latitude
 *               - longitude
 *             properties:
 *               latitude:
 *                 type: number
 *               longitude:
 *                 type: number
 *               description:
 *                 type: string
 *               surface:
 *                 type: number
 *               budget:
 *                 type: number
 *               company:
 *                 type: string
 *               photo_url:
 *                 type: string
 *               niveau:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 10
 *                 description: Niveau de dégradation (1-10)
 *     responses:
 *       201:
 *         description: Report created
 *       400:
 *         description: Validation error
 */
router.post('/', authenticateToken, [
  body('latitude').isFloat({ min: -90, max: 90 }).withMessage('Invalid latitude'),
  body('longitude').isFloat({ min: -180, max: 180 }).withMessage('Invalid longitude'),
  body('description').optional().isString(),
  body('surface').optional().isFloat({ min: 0 }).withMessage('Surface must be a positive number'),
  body('budget').optional().isFloat({ min: 0 }).withMessage('Budget must be a positive number'),
  body('company').optional().isString(),
  body('niveau').optional().isInt({ min: 1, max: 10 }).withMessage('Niveau must be between 1 and 10'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { latitude, longitude, description, surface, budget, company, photo_url, niveau } = req.body;
    
    let reportUid = null;
    
    // First, create in Firestore to get the document ID
    if (isFirebaseAvailable()) {
      try {
        const firestore = getFirestore();
        if (firestore) {
          const firestoreDoc = await firestore.collection('reports').add({
            latitude,
            longitude,
            description: description || '',
            surface: surface || null,
            budget: budget || null,
            company: company || '',
            niveau: niveau || null,
            status: 'new',
            user_uid: req.user.uid || '',
            user_email: req.user.email || '',
            created_at: admin.firestore.FieldValue.serverTimestamp(),
          });
          reportUid = firestoreDoc.id;
          console.log(`✅ Report created in Firestore with ID: ${reportUid}`);
        }
      } catch (firestoreError) {
        console.error('⚠️ Firestore create error:', firestoreError.message);
        // Continue with UUID if Firestore fails
        reportUid = uuidv4();
      }
    } else {
      reportUid = uuidv4();
    }

    // Then create in PostgreSQL with the Firestore ID as uid
    const result = await db.query(
      `INSERT INTO reports (uid, user_id, latitude, longitude, description, surface, budget, company, photo_url, niveau, firebase_synced, date_nouveau)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP)
       RETURNING *`,
      [reportUid, req.user.id, latitude, longitude, description, surface, budget, company, photo_url, niveau, isFirebaseAvailable()]
    );

    res.status(201).json({
      message: 'Report created successfully',
      report: result.rows[0],
    });
  } catch (error) {
    console.error('Create report error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/reports/{id}:
 *   put:
 *     summary: Update a report (Manager only)
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               description:
 *                 type: string
 *               surface:
 *                 type: number
 *               budget:
 *                 type: number
 *               company:
 *                 type: string
 *               niveau:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 10
 *                 description: Niveau de dégradation (1-10)
 *     responses:
 *       200:
 *         description: Report updated
 *       404:
 *         description: Report not found
 */
router.put('/:id', authenticateToken, requireRole('manager'), [
  body('surface').optional().isFloat({ min: 0 }).withMessage('Surface must be a positive number'),
  body('budget').optional().isFloat({ min: 0 }).withMessage('Budget must be a positive number'),
  body('niveau').optional().isInt({ min: 1, max: 10 }).withMessage('Niveau must be between 1 and 10'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { description, surface, budget, company, niveau } = req.body;

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (description !== undefined) {
      updates.push(`description = $${paramCount}`);
      values.push(description);
      paramCount++;
    }
    if (surface !== undefined) {
      updates.push(`surface = $${paramCount}`);
      values.push(surface);
      paramCount++;
    }
    if (budget !== undefined) {
      updates.push(`budget = $${paramCount}`);
      values.push(budget);
      paramCount++;
    }
    if (company !== undefined) {
      updates.push(`company = $${paramCount}`);
      values.push(company);
      paramCount++;
    }
    if (niveau !== undefined) {
      updates.push(`niveau = $${paramCount}`);
      values.push(niveau);
      paramCount++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(req.params.id);

    const result = await db.query(
      `UPDATE reports SET ${updates.join(', ')} 
       WHERE id = $${paramCount} AND is_deleted = false
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const report = result.rows[0];

    // Sync updates to Firestore if available
    if (isFirebaseAvailable() && report.uid) {
      try {
        const firestore = getFirestore();
        if (firestore) {
          const firestoreUpdates = {
            updated_at: admin.firestore.FieldValue.serverTimestamp()
          };
          if (description !== undefined) firestoreUpdates.description = description;
          if (surface !== undefined) firestoreUpdates.surface = surface;
          if (budget !== undefined) firestoreUpdates.budget = budget;
          if (company !== undefined) firestoreUpdates.company = company;
          if (niveau !== undefined) firestoreUpdates.niveau = niveau;
          
          await firestore.collection('reports').doc(report.uid).update(firestoreUpdates);
          console.log(`✅ Report ${report.uid} synced to Firestore`);
        }
      } catch (firestoreError) {
        console.error('⚠️ Firestore sync error (non-blocking):', firestoreError.message);
      }
    }

    res.json({
      message: 'Report updated successfully',
      report: report,
    });
  } catch (error) {
    console.error('Update report error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/reports/{id}/status:
 *   patch:
 *     summary: Update report status (Manager only)
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [new, in_progress, done]
 *     responses:
 *       200:
 *         description: Status updated
 *       400:
 *         description: Invalid status
 *       404:
 *         description: Report not found
 */
router.patch('/:id/status', authenticateToken, requireRole('manager'), [
  body('status').isIn(['new', 'in_progress', 'done']).withMessage('Invalid status'),
  body('repair_level').optional().isInt({ min: 1, max: 10 }).withMessage('Repair level must be between 1 and 10'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { status, repair_level } = req.body;

    // Déterminer la colonne de date à mettre à jour selon le statut
    let dateColumn = '';
    if (status === 'new') dateColumn = ', date_nouveau = CURRENT_TIMESTAMP, date_en_cours = NULL, date_termine = NULL';
    else if (status === 'in_progress') dateColumn = ', date_en_cours = CURRENT_TIMESTAMP, date_termine = NULL';
    else if (status === 'done') dateColumn = ', date_termine = CURRENT_TIMESTAMP';

    // Ajouter le repair_level si fourni
    let repairLevelUpdate = '';
    const params = [status, req.params.id];
    if (repair_level !== undefined && repair_level !== null) {
      repairLevelUpdate = ', niveau = $3';
      params.push(repair_level);
    }

    // Update in PostgreSQL and get the uid (which is the Firestore doc ID)
    const result = await db.query(
      `UPDATE reports SET status = $1${dateColumn}${repairLevelUpdate} WHERE id = $2 AND is_deleted = false RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const report = result.rows[0];

    // Sync status to Firestore if available
    if (isFirebaseAvailable() && report.uid) {
      try {
        const firestore = getFirestore();
        if (firestore) {
          // The uid in PostgreSQL is the Firestore document ID
          const firestoreUpdate = {
            status: status,
            updated_at: admin.firestore.FieldValue.serverTimestamp()
          };
          if (repair_level !== undefined && repair_level !== null) {
            firestoreUpdate.niveau = repair_level;
          }
          await firestore.collection('reports').doc(report.uid).update(firestoreUpdate);
          console.log(`✅ Status synced to Firestore for report ${report.uid}: ${status}`);
        }
      } catch (firestoreError) {
        console.error('⚠️ Firestore sync error (non-blocking):', firestoreError.message);
        // Don't fail the request if Firestore sync fails
      }

      // Envoyer une notification push à l'utilisateur qui a créé le signalement
      try {
        // Récupérer le user_uid du créateur du report
        const userResult = await db.query('SELECT uid FROM users WHERE id = $1', [report.user_id]);
        if (userResult.rows.length > 0) {
          await sendStatusChangeNotification(userResult.rows[0].uid, report.id, status);
        }
      } catch (notifError) {
        console.error('⚠️ Push notification error (non-blocking):', notifError.message);
      }
    }

    res.json({
      message: 'Status updated successfully',
      report: report,
    });
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/reports/{id}:
 *   delete:
 *     summary: Delete a report (soft delete, Manager only)
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Report deleted
 *       404:
 *         description: Report not found
 */
router.delete('/:id', authenticateToken, requireRole('manager'), async (req, res) => {
  try {
    // First get the report to have the uid for Firestore
    const getResult = await db.query(
      'SELECT uid FROM reports WHERE id = $1 AND is_deleted = false',
      [req.params.id]
    );
    
    if (getResult.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }
    
    const reportUid = getResult.rows[0].uid;
    
    // Soft delete in PostgreSQL
    const result = await db.query(
      'UPDATE reports SET is_deleted = true WHERE id = $1 AND is_deleted = false RETURNING id',
      [req.params.id]
    );

    // Also delete from Firestore
    if (isFirebaseAvailable() && reportUid) {
      try {
        const firestore = getFirestore();
        if (firestore) {
          await firestore.collection('reports').doc(reportUid).delete();
          console.log(`✅ Report ${reportUid} deleted from Firestore`);
        }
      } catch (firestoreError) {
        console.error('⚠️ Firestore delete error (non-blocking):', firestoreError.message);
      }
    }

    res.json({ message: 'Report deleted successfully' });
  } catch (error) {
    console.error('Delete report error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
