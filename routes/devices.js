const express = require('express');
const { v4: uuidv4 } = require('uuid');
const authGuard = require('../middleware/supabaseAuthGuard');
const { supabase } = require('../config/supabase');

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
      user_id: req.user.uid,
      device_id: deviceId,
      device_name: deviceName,
      platform,
      fcm_token: fcmToken || null
    };

    const { error } = await supabase
      .from('devices')
      .insert([deviceData]);

    if (error) throw error;

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
    const { data: devices, error } = await supabase
      .from('devices')
      .select('*')
      .eq('user_id', req.user.uid);

    if (error) throw error;

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

    // Delete the device (RLS ensures user can only delete their own)
    const { error } = await supabase
      .from('devices')
      .delete()
      .eq('device_id', deviceId)
      .eq('user_id', req.user.uid);

    if (error) throw error;

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
