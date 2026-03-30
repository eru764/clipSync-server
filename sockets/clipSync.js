const { auth } = require('../config/firebase');

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

        const decodedToken = await auth.verifyIdToken(token);
        const userId = decodedToken.uid;

        socket.join(userId);
        socket.emit('room-joined', { userId });

        console.log(`Socket ${socket.id} joined room: ${userId}`);
      } catch (error) {
        console.error('Token verification failed:', error.message);
        
        // If token expired, let client refresh instead of disconnecting
        if (error.code === 'auth/id-token-expired' || error.message.includes('expired')) {
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
