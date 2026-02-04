const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { uploadToStorage, deleteFromStorage, isFirebaseAvailable, getFirestore, admin } = require('../config/firebase');

const router = express.Router();

// Configure multer for memory storage (we'll upload to Firebase Storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept only images
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  },
});

/**
 * @swagger
 * /api/photos/upload:
 *   post:
 *     summary: Upload photo(s) for a report
 *     tags: [Photos]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - report_id
 *               - photos
 *             properties:
 *               report_id:
 *                 type: string
 *                 description: The report UID (Firestore document ID)
 *               photos:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       200:
 *         description: Photos uploaded successfully
 *       400:
 *         description: No files uploaded or invalid report
 *       503:
 *         description: Firebase Storage not available
 */
router.post('/upload', authenticateToken, upload.array('photos', 5), async (req, res) => {
  try {
    if (!isFirebaseAvailable()) {
      return res.status(503).json({ error: 'Firebase Storage not available' });
    }

    const { report_id } = req.body;
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No photos uploaded' });
    }

    if (!report_id) {
      return res.status(400).json({ error: 'report_id is required' });
    }

    const uploadedPhotos = [];

    for (const file of files) {
      // Generate unique filename
      const extension = file.originalname.split('.').pop();
      const fileName = `${report_id}_${uuidv4()}.${extension}`;
      
      // Upload to Firebase Storage
      const photoUrl = await uploadToStorage(file.buffer, fileName, file.mimetype);
      
      uploadedPhotos.push({
        url: photoUrl,
        filename: fileName,
        size: file.size,
        mimetype: file.mimetype,
      });
    }

    // Update report in Firestore with photo URLs
    const firestore = getFirestore();
    if (firestore) {
      try {
        const reportRef = firestore.collection('reports').doc(report_id);
        const reportDoc = await reportRef.get();
        
        if (reportDoc.exists) {
          const existingPhotos = reportDoc.data().photos || [];
          const newPhotoUrls = uploadedPhotos.map(p => p.url);
          
          await reportRef.update({
            photos: [...existingPhotos, ...newPhotoUrls],
            updated_at: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
      } catch (firestoreError) {
        console.error('Error updating Firestore with photos:', firestoreError.message);
      }
    }

    // Also update PostgreSQL if report exists there
    try {
      const existingPhotosResult = await db.query(
        'SELECT photo_url FROM reports WHERE uid = $1',
        [report_id]
      );
      
      if (existingPhotosResult.rows.length > 0) {
        const existingPhotoUrl = existingPhotosResult.rows[0].photo_url;
        let photoUrls = [];
        
        // Parse existing photos if any
        if (existingPhotoUrl) {
          try {
            photoUrls = JSON.parse(existingPhotoUrl);
          } catch {
            photoUrls = [existingPhotoUrl];
          }
        }
        
        // Add new photos
        const newPhotoUrls = uploadedPhotos.map(p => p.url);
        photoUrls = [...photoUrls, ...newPhotoUrls];
        
        await db.query(
          'UPDATE reports SET photo_url = $1, updated_at = NOW() WHERE uid = $2',
          [JSON.stringify(photoUrls), report_id]
        );
      }
    } catch (dbError) {
      console.error('Error updating PostgreSQL with photos:', dbError.message);
    }

    res.json({
      message: `${uploadedPhotos.length} photo(s) uploaded successfully`,
      photos: uploadedPhotos,
    });
  } catch (error) {
    console.error('Photo upload error:', error);
    res.status(500).json({ error: 'Failed to upload photos' });
  }
});

/**
 * @swagger
 * /api/photos/{reportId}:
 *   get:
 *     summary: Get all photos for a report
 *     tags: [Photos]
 *     parameters:
 *       - in: path
 *         name: reportId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of photo URLs
 *       404:
 *         description: Report not found
 */
router.get('/:reportId', async (req, res) => {
  try {
    const { reportId } = req.params;

    // Try to get from Firestore first
    if (isFirebaseAvailable()) {
      const firestore = getFirestore();
      if (firestore) {
        const reportDoc = await firestore.collection('reports').doc(reportId).get();
        if (reportDoc.exists) {
          const photos = reportDoc.data().photos || [];
          return res.json({ photos });
        }
      }
    }

    // Fallback to PostgreSQL
    const result = await db.query(
      'SELECT photo_url FROM reports WHERE uid = $1',
      [reportId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }

    let photos = [];
    const photoUrl = result.rows[0].photo_url;
    
    if (photoUrl) {
      try {
        photos = JSON.parse(photoUrl);
      } catch {
        photos = [photoUrl];
      }
    }

    res.json({ photos });
  } catch (error) {
    console.error('Get photos error:', error);
    res.status(500).json({ error: 'Failed to get photos' });
  }
});

/**
 * @swagger
 * /api/photos/{reportId}/{filename}:
 *   delete:
 *     summary: Delete a photo from a report
 *     tags: [Photos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reportId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: filename
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Photo deleted successfully
 *       404:
 *         description: Photo not found
 */
router.delete('/:reportId/:filename', authenticateToken, async (req, res) => {
  try {
    const { reportId, filename } = req.params;

    // Delete from Firebase Storage
    await deleteFromStorage(filename);

    // Update Firestore
    if (isFirebaseAvailable()) {
      const firestore = getFirestore();
      if (firestore) {
        const reportRef = firestore.collection('reports').doc(reportId);
        const reportDoc = await reportRef.get();
        
        if (reportDoc.exists) {
          const photos = reportDoc.data().photos || [];
          const photoUrl = `https://storage.googleapis.com/${process.env.FIREBASE_PROJECT_ID}.appspot.com/reports/${filename}`;
          const updatedPhotos = photos.filter(p => p !== photoUrl);
          
          await reportRef.update({
            photos: updatedPhotos,
            updated_at: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
      }
    }

    res.json({ message: 'Photo deleted successfully' });
  } catch (error) {
    console.error('Delete photo error:', error);
    res.status(500).json({ error: 'Failed to delete photo' });
  }
});

module.exports = router;
