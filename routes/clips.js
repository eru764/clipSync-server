const express = require('express');
const authGuard = require('../middleware/authGuard');
const { db } = require('../config/firebase');

module.exports = (io) => {
  const router = express.Router();

  router.post('/', authGuard, async (req, res) => {
  try {
    const { content, type } = req.body;

    if (!content || !type) {
      return res.status(400).json({ 
        error: 'Bad Request', 
        message: 'content and type are required' 
      });
    }

    const validTypes = ['text', 'image', 'pdf', 'doc', 'video'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ 
        error: 'Bad Request', 
        message: 'type must be text, image, pdf, doc, or video' 
      });
    }

    const clipData = {
      userId: req.user.uid,
      content,
      type,
      timestamp: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    };

    const clipRef = await db.collection('clips').add(clipData);
    const savedClip = { id: clipRef.id, ...clipData };

    io.to(req.user.uid).emit('new-clip', savedClip);

    res.json(savedClip);
  } catch (error) {
    console.error('Error creating clip:', error);
    res.status(500).json({ 
      error: 'Internal Server Error', 
      message: 'Failed to create clip' 
    });
  }
});

router.get('/', authGuard, async (req, res) => {
  try {
    const clipsSnapshot = await db
      .collection('clips')
      .where('userId', '==', req.user.uid)
      .orderBy('timestamp', 'desc')
      .limit(20)
      .get();

    const clips = [];
    clipsSnapshot.forEach(doc => {
      clips.push({ id: doc.id, ...doc.data() });
    });

    res.json(clips);
  } catch (error) {
    console.error('Error fetching clips:', error);
    res.status(500).json({ 
      error: 'Internal Server Error', 
      message: 'Failed to fetch clips' 
    });
  }
});

  return router;
};
