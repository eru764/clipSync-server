const express = require('express');
const { supabase } = require('../config/supabase');
const authGuard = require('../middleware/supabaseAuthGuard');

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
      user_id: req.user.uid,
      timestamp: new Date().toISOString(),
      expires_at: new Date(Date.now() + expiryTime).toISOString()
    };

    // Add file metadata if present
    if (fileUrl) {
      clipData.file_url = fileUrl;
      clipData.file_name = fileName || 'unknown';
      clipData.file_size = fileSize || 0;
      clipData.mime_type = mimeType || 'application/octet-stream';
      clipData.storage_path = req.body.storagePath || null;
    }

    const { data: savedClip, error: insertError } = await supabase
      .from('clips')
      .insert([clipData])
      .select()
      .single();

    if (insertError) throw insertError;

    console.log('Emitting to room:', req.user.uid);
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
    const { data: clips, error } = await supabase
      .from('clips')
      .select('*')
      .eq('user_id', req.user.uid)
      .order('timestamp', { ascending: false })
      .limit(20);

    if (error) throw error;

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

    // Delete the clip (RLS policy ensures user can only delete their own clips)
    const { error } = await supabase
      .from('clips')
      .delete()
      .eq('id', clipId)
      .eq('user_id', req.user.uid);

    if (error) throw error;

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
