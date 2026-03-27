const express = require('express');
const { v4: uuidv4 } = require('uuid');
const authGuard = require('../middleware/authGuard');
const { db } = require('../config/firebase');

const router = express.Router();

router.post('/register', authGuard, async (req, res) => {
  try {
    const { deviceName, platform } = req.body;

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

module.exports = router;
