const express = require('express');
const { v4: uuidv4 } = require('uuid');
const authGuard = require('../middleware/authGuard');
const { db } = require('../config/firebase');

const router = express.Router();

router.post('/register', authGuard, async (req, res) => {
  try {
    const { deviceName, platform, fcmToken } = req.body;

    if (!deviceName || !platform) {
      return res.status(400).json({ 
        error: 'Bad Request', 
        message: 'deviceName and platform are required' 
      });
    }

    if (!['android', 'ios', 'pc'].includes(platform)) {
      return res.status(400).json({ 
        error: 'Bad Request', 
        message: 'platform must be android, ios, or pc' 
      });
    }

    const deviceId = uuidv4();

    const deviceData = {
      userId: req.user.uid,
      deviceId,
      deviceName,
      platform,
      registeredAt: new Date()
    };

    // Add FCM token if provided
    if (fcmToken) {
      deviceData.fcmToken = fcmToken;
    }

    await db.collection('devices').doc(deviceId).set(deviceData);

    res.json({ success: true, deviceId });
  } catch (error) {
    console.error('Error registering device:', error);
    res.status(500).json({ 
      error: 'Internal Server Error', 
      message: 'Failed to register device' 
    });
  }
});

router.get('/', authGuard, async (req, res) => {
  try {
    const devicesSnapshot = await db
      .collection('devices')
      .where('userId', '==', req.user.uid)
      .get();

    const devices = [];
    devicesSnapshot.forEach(doc => {
      devices.push(doc.data());
    });

    res.json(devices);
  } catch (error) {
    console.error('Error fetching devices:', error);
    res.status(500).json({ 
      error: 'Internal Server Error', 
      message: 'Failed to fetch devices' 
    });
  }
});

router.delete('/:deviceId', authGuard, async (req, res) => {
  try {
    const { deviceId } = req.params;

    // Get the device document
    const deviceDoc = await db.collection('devices').doc(deviceId).get();

    if (!deviceDoc.exists) {
      return res.status(404).json({ 
        error: 'Not Found', 
        message: 'Device not found' 
      });
    }

    // Verify the device belongs to the authenticated user
    const deviceData = deviceDoc.data();
    if (deviceData.userId !== req.user.uid) {
      return res.status(403).json({ 
        error: 'Forbidden', 
        message: 'You do not have permission to delete this device' 
      });
    }

    // Delete the device
    await db.collection('devices').doc(deviceId).delete();

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting device:', error);
    res.status(500).json({ 
      error: 'Internal Server Error', 
      message: 'Failed to delete device' 
    });
  }
});

module.exports = router;
