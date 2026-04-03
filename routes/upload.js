const express = require('express');
const router = express.Router();
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const authGuard = require('../middleware/authGuard');

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  },
});

// Upload image/file to Firebase Storage
router.post('/', authGuard, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        error: 'Bad Request', 
        message: 'No file provided' 
      });
    }

    const admin = require('../firebase/admin');
    const bucket = admin.storage().bucket();
    
    // Generate unique filename
    const fileExtension = req.file.originalname.split('.').pop();
    const fileName = `clips/${req.user.uid}/${uuidv4()}.${fileExtension}`;
    
    // Create file in bucket
    const file = bucket.file(fileName);
    
    // Upload file buffer
    await file.save(req.file.buffer, {
      metadata: {
        contentType: req.file.mimetype,
        metadata: {
          uploadedBy: req.user.uid,
          originalName: req.file.originalname,
        },
      },
    });

    // Make file publicly accessible
    await file.makePublic();

    // Get public URL
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;

    res.json({
      success: true,
      url: publicUrl,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({ 
      error: 'Internal Server Error', 
      message: 'Failed to upload file' 
    });
  }
});

module.exports = router;
