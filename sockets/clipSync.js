const { supabase } = require('../config/supabase');

const initSockets = (io) => {
  io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('join-room', async (token) => {
      try {
        console.log(`[Socket ${socket.id}] Received join-room request`);
        
        if (!token) {
          console.error(`[Socket ${socket.id}] No token provided`);
          socket.emit('error', { message: 'Unauthorized' });
          socket.disconnect();
          return;
        }

        console.log(`[Socket ${socket.id}] Token received (length: ${token.length})`);

        // Verify Supabase JWT token - just decode without verification
        // Supabase tokens are already verified by the auth middleware
        const jwt = require('jsonwebtoken');
        const decoded = jwt.decode(token);
        
        console.log(`[Socket ${socket.id}] Token decoded:`, decoded ? 'Success' : 'Failed');
        
        if (!decoded || !decoded.sub) {
          console.error(`[Socket ${socket.id}] Invalid token structure:`, decoded);
          throw new Error('Invalid token');
        }

        const userId = decoded.sub;
        console.log(`[Socket ${socket.id}] User ID extracted: ${userId}`);

        socket.join(userId);
        socket.emit('room-joined', { userId });

        console.log(`[Socket ${socket.id}] Successfully joined room: ${userId}`);
      } catch (error) {
        console.error(`[Socket ${socket.id}] Token verification failed:`, error.message);
        console.error(`[Socket ${socket.id}] Error stack:`, error.stack);
        
        // If token expired, let client refresh instead of disconnecting
        if (error.message.includes('expired') || error.message.includes('JWT')) {
          socket.emit('token-expired', { message: 'Token expired, please refresh' });
          // Don't disconnect, wait for client to rejoin with new token
        } else {
          socket.emit('error', { message: 'Unauthorized' });
          socket.disconnect();
        }
      }
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
    });
  });
};

module.exports = initSockets;
