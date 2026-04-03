const express = require('express');
const router = express.Router();
const multer = require('multer');
const authGuard = require('../middleware/authGuard');
const admin = require('firebase-admin');

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  },
});

// Get Firebase Storage bucket
const bucket = admin.storage().bucket();

// Upload file to Firebase Storage (secure, private storage)
router.post('/', authGuard, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        error: 'Bad Request', 
        message: 'No file provided' 
      });
    }

    // Generate unique filename with timestamp
    const timestamp = Date.now();
    const userId = req.user.uid;
    const originalName = req.file.originalname;
    const fileName = `uploads/${userId}/${timestamp}_${originalName}`;

    // Upload to Firebase Storage
    const file = bucket.file(fileName);
    
    await file.save(req.file.buffer, {
      metadata: {
        contentType: req.file.mimetype,
        metadata: {
          uploadedBy: userId,
          uploadedAt: new Date().toISOString(),
          originalName: originalName,
        }
      }
    });

    // Make file publicly accessible (but obscure URL)
    await file.makePublic();

    // Get public URL
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;

    res.json({
      success: true,
      url: publicUrl,
      fileName: originalName,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      storagePath: fileName, // For deletion later
    });
  } catch (error) {
    console.error('Error uploading to Firebase Storage:', error);
    res.status(500).json({ 
      error: 'Internal Server Error', 
      message: 'Failed to upload file' 
    });
  }
});

module.exports = router;
