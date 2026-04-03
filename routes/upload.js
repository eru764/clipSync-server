const express = require('express');
const router = express.Router();
const multer = require('multer');
const authGuard = require('../middleware/authGuard');
const axios = require('axios');

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  },
});

// Upload image to Imgur (free, no payment required)
router.post('/', authGuard, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        error: 'Bad Request', 
        message: 'No file provided' 
      });
    }

    // Only allow images
    if (!req.file.mimetype.startsWith('image/')) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Only images are supported'
      });
    }

    // Convert buffer to base64
    const base64Image = req.file.buffer.toString('base64');

    // Upload to Imgur (anonymous upload - no API key needed for basic use)
    const imgurResponse = await axios.post(
      'https://api.imgur.com/3/image',
      {
        image: base64Image,
        type: 'base64'
      },
      {
        headers: {
          'Authorization': 'Client-ID 546c25a59c58ad7', // Anonymous Imgur client ID
          'Content-Type': 'application/json'
        }
      }
    );

    if (imgurResponse.data.success) {
      const imageUrl = imgurResponse.data.data.link;
      const deleteHash = imgurResponse.data.data.deletehash;

      res.json({
        success: true,
        url: imageUrl,
        deleteHash: deleteHash,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
      });
    } else {
      throw new Error('Imgur upload failed');
    }
  } catch (error) {
    console.error('Error uploading to Imgur:', error);
    res.status(500).json({ 
      error: 'Internal Server Error', 
      message: 'Failed to upload image' 
    });
  }
});

module.exports = router;
