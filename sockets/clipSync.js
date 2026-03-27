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
        socket.emit('error', { message: 'Unauthorized' });
        socket.disconnect();
      }
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
    });
  });
};

module.exports = initSockets;
