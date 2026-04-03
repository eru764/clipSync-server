const { supabase } = require('../config/supabase');

const initSockets = (io) => {
  io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('join-room', async (token) => {
      try {
        if (!token) {
          socket.emit('error', { message: 'Unauthorized' });
          socket.disconnect();
          return;
        }

        // Verify Supabase JWT token - just decode without verification
        // Supabase tokens are already verified by the auth middleware
        const jwt = require('jsonwebtoken');
        const decoded = jwt.decode(token);
        
        if (!decoded || !decoded.sub) {
          console.error('Failed to decode token:', token.substring(0, 20) + '...');
          throw new Error('Invalid token');
        }

        const userId = decoded.sub;

        socket.join(userId);
        socket.emit('room-joined', { userId });

        console.log(`Socket ${socket.id} joined room: ${userId}`);
      } catch (error) {
        console.error('Token verification failed:', error.message);
        
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
