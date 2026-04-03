const express = require('express');
const authGuard = require('../middleware/authGuard');
const { db, admin } = require('../config/firebase');

module.exports = (io) => {
  const router = express.Router();

  router.post('/', authGuard, async (req, res) => {
  try {
    console.log('New clip POST received');
    console.log('User ID from token:', req.user.uid);
    
    const { content, type, fileUrl, fileName, fileSize, mimeType } = req.body;

    if (!content && !fileUrl) {
      return res.status(400).json({ 
        error: 'Bad Request', 
        message: 'Content or fileUrl is required' 
      });
    }

    const validTypes = ['text', 'image', 'pdf', 'doc', 'video'];
    if (type && !validTypes.includes(type)) {
      return res.status(400).json({ 
        error: 'Bad Request', 
        message: 'type must be text, image, pdf, doc, or video' 
      });
    }

    // Images and files expire after 2 hours, text after 24 hours
    const isMediaClip = fileUrl || type === 'image' || type === 'file';
    const expiryTime = isMediaClip 
      ? 2 * 60 * 60 * 1000  // 2 hours for images/files
      : 24 * 60 * 60 * 1000; // 24 hours for text
    
    const clipData = {
      content: content || '',
      type: type || 'text',
      userId: req.user.uid,
      timestamp: new Date(),
      expiresAt: new Date(Date.now() + expiryTime)
    };

    // Add file metadata if present
    if (fileUrl) {
      clipData.fileUrl = fileUrl;
      clipData.fileName = fileName || 'unknown';
      clipData.fileSize = fileSize || 0;
      clipData.mimeType = mimeType || 'application/octet-stream';
      clipData.storagePath = req.body.storagePath || null; // For Firebase Storage cleanup
    }

    const clipRef = await db.collection('clips').add(clipData);
    const savedClip = { id: clipRef.id, ...clipData };

    console.log('Emitting to room:', req.user.uid);
    console.log('Connected rooms:', Object.keys(io.sockets.adapter.rooms).join(', '));
    io.to(req.user.uid).emit('new-clip', savedClip);

    // Send FCM push notifications to all registered devices
    try {
      const devicesSnapshot = await db
        .collection('devices')
        .where('userId', '==', req.user.uid)
        .get();
      
      const notificationPromises = [];
      devicesSnapshot.forEach(doc => {
        const device = doc.data();
        if (device.fcmToken) {
          const notificationBody = content.length > 50 ? content.substring(0, 50) + '...' : content;
          const message = {
            token: device.fcmToken,
            notification: {
              title: 'New Clip',
              body: notificationBody
            },
            data: {
              clipId: clipRef.id,
              type: type
            }
          };
          notificationPromises.push(
            admin.messaging().send(message)
              .then(() => console.log(`FCM sent to device ${device.deviceId}`))
              .catch(err => console.error(`FCM failed for device ${device.deviceId}:`, err.message))
          );
        }
      });
      
      await Promise.all(notificationPromises);
    } catch (fcmError) {
      console.error('Error sending FCM notifications:', fcmError);
      // Don't fail the request if FCM fails
    }

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

router.delete('/:clipId', authGuard, async (req, res) => {
  try {
    const { clipId } = req.params;

    // Get the clip document
    const clipDoc = await db.collection('clips').doc(clipId).get();

    if (!clipDoc.exists) {
      return res.status(404).json({ 
        error: 'Not Found', 
        message: 'Clip not found' 
      });
    }

    // Verify the clip belongs to the authenticated user
    const clipData = clipDoc.data();
    if (clipData.userId !== req.user.uid) {
      return res.status(403).json({ 
        error: 'Forbidden', 
        message: 'You do not have permission to delete this clip' 
      });
    }

    // Delete the clip
    await db.collection('clips').doc(clipId).delete();

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting clip:', error);
    res.status(500).json({ 
      error: 'Internal Server Error', 
      message: 'Failed to delete clip' 
    });
  }
});

  return router;
};
