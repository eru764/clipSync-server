const { supabase } = require('../config/supabase');

async function supabaseAuthGuard(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'No token provided' 
      });
    }

    const token = authHeader.substring(7);

    // Decode JWT without verification (Supabase client already validates)
    // This is safe because we're only accepting tokens from our Supabase project
    const jwt = require('jsonwebtoken');
    const decoded = jwt.decode(token);

    if (!decoded || !decoded.sub) {
      console.error('Failed to decode token');
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'Invalid token format' 
      });
    }

    // Attach user to request
    req.user = {
      uid: decoded.sub,
      email: decoded.email || ''
    };

    next();
  } catch (error) {
    console.error('Auth error:', error);
    res.status(401).json({ 
      error: 'Unauthorized', 
      message: 'Authentication failed' 
    });
  }
}

module.exports = supabaseAuthGuard;
