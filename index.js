require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const devicesRouter = require('./routes/devices');
const initSockets = require('./sockets/clipSync');

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

app.get('/health', (req, res) => {
  res.json({ 
    status: "ok", 
    timestamp: new Date() 
  });
});

initSockets(io);

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
