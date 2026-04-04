const express = require('express');
const router = express.Router();
const multer = require('multer');
const authGuard = require('../middleware/supabaseAuthGuard');
const { supabase } = require('../config/supabase');

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max file size
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

    const userId = req.user.id || req.user.uid;

    // Check current storage usage for this user
    const { data: existingFiles, error: listError } = await supabase.storage
      .from('uploads')
      .list(userId);

    if (!listError && existingFiles) {
      const totalSize = existingFiles.reduce((sum, file) => sum + (file.metadata?.size || 0), 0);
      const storageLimit = 100 * 1024 * 1024; // 100MB total limit
      
      if (totalSize + req.file.size > storageLimit) {
        return res.status(413).json({
          error: 'Storage Limit Exceeded',
          message: 'You have reached your 100MB storage limit. Please delete some files or wait for old files to expire.',
          currentUsage: totalSize,
          limit: storageLimit
        });
      }
    }

    // Generate unique filename with timestamp
    const timestamp = Date.now();
    const originalName = req.file.originalname;
    const storagePath = `${userId}/${timestamp}_${originalName}`;
    
    console.log(`Uploading file for user ${userId}: ${originalName}`);

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('uploads')
      .upload(storagePath, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false
      });

    if (error) {
      console.error('Supabase Storage upload error:', error);
      throw error;
    }

    console.log(`File uploaded successfully: ${storagePath}`);

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('uploads')
      .getPublicUrl(storagePath);

    console.log(`Public URL: ${publicUrl}`);

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
    console.error('Error details:', JSON.stringify(error, null, 2));
    res.status(500).json({ 
      error: 'Internal Server Error', 
      message: error.message || 'Failed to upload file',
      details: error.toString()
    });
  }
});

module.exports = router;
