const express = require('express');
const router = express.Router();
const multer = require('multer');
const authGuard = require('../middleware/supabaseAuthGuard');
const { supabase } = require('../config/supabase');

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  },
});

// Upload file to Supabase Storage (secure, private storage)
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
    const storagePath = `${userId}/${timestamp}_${originalName}`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('uploads')
      .upload(storagePath, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false
      });

    if (error) throw error;

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('uploads')
      .getPublicUrl(storagePath);

    res.json({
      success: true,
      url: publicUrl,
      fileName: originalName,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      storagePath: storagePath, // For deletion later
    });
  } catch (error) {
    console.error('Error uploading to Supabase Storage:', error);
    res.status(500).json({ 
      error: 'Internal Server Error', 
      message: 'Failed to upload file' 
    });
  }
});

module.exports = router;
