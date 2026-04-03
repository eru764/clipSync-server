require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const devicesRouter = require('./routes/devices');
const uploadRouter = require('./routes/upload');
const initSockets = require('./sockets/clipSync');
const { startCleanupScheduler } = require('./utils/cleanup');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000
});

const clipsRouter = require('./routes/clips')(io);

app.use(cors());
app.use(express.json());

app.use('/devices', devicesRouter);
app.use('/clips', clipsRouter);
app.use('/upload', uploadRouter);

app.get('/health', (req, res) => {
  res.json({ 
    status: "ok", 
    timestamp: new Date() 
  });
});

initSockets(io);

// Start automatic cleanup of expired clips
startCleanupScheduler();

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Keep Railway container alive
setInterval(() => {
  console.log('Keep-alive ping:', new Date().toISOString());
}, 4 * 60 * 1000); // every 4 minutes
