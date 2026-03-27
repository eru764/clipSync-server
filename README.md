# clipSync-server

A real-time clipboard synchronization server built with Node.js, Express, Socket.io, and Firebase.

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
PORT=3000
FIREBASE_SERVICE_ACCOUNT=<base64_encoded_service_account_json>
```

### Getting the Firebase Service Account

1. Go to Firebase Console → Project Settings → Service Accounts
2. Generate a new private key (downloads a JSON file)
3. Base64 encode the JSON file:
   - Linux/Mac: `base64 -i serviceAccount.json`
   - Windows PowerShell: `[Convert]::ToBase64String([IO.File]::ReadAllBytes("serviceAccount.json"))`
4. Add the base64 string to your `.env` file

## Installation & Running

```bash
# Install dependencies
npm install

# Start the server
npm start
```

The server will run on `http://localhost:3000` (or the PORT specified in `.env`).

## API Endpoints

All protected routes require an `Authorization` header with format: `Bearer <firebase_id_token>`

### GET /health

Check server status.

**Request:**
```http
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-03-28T01:00:00.000Z"
}
```

---

### POST /devices/register

Register a new device for the authenticated user.

**Request:**
```http
POST /devices/register
Authorization: Bearer <firebase_id_token>
Content-Type: application/json

{
  "deviceName": "My iPhone",
  "platform": "ios"
}
```

**Parameters:**
- `deviceName` (string, required): Name of the device
- `platform` (string, required): One of "android", "ios", or "pc"

**Response:**
```json
{
  "success": true,
  "deviceId": "550e8400-e29b-41d4-a716-446655440000"
}
```

---

### GET /devices

Get all registered devices for the authenticated user.

**Request:**
```http
GET /devices
Authorization: Bearer <firebase_id_token>
```

**Response:**
```json
[
  {
    "userId": "firebase_user_id",
    "deviceId": "550e8400-e29b-41d4-a716-446655440000",
    "deviceName": "My iPhone",
    "platform": "ios",
    "registeredAt": "2026-03-28T01:00:00.000Z"
  }
]
```

---

### POST /clips

Create a new clipboard entry. Emits a real-time `new-clip` event to all connected devices.

**Request:**
```http
POST /clips
Authorization: Bearer <firebase_id_token>
Content-Type: application/json

{
  "content": "Hello, World!",
  "type": "text"
}
```

**Parameters:**
- `content` (string, required): The clipboard content
- `type` (string, required): One of "text", "image", "pdf", "doc", or "video"

**Response:**
```json
{
  "id": "firestore_document_id",
  "userId": "firebase_user_id",
  "content": "Hello, World!",
  "type": "text",
  "timestamp": "2026-03-28T01:00:00.000Z",
  "expiresAt": "2026-04-04T01:00:00.000Z"
}
```

---

### GET /clips

Get the 20 most recent clipboard entries for the authenticated user.

**Request:**
```http
GET /clips
Authorization: Bearer <firebase_id_token>
```

**Response:**
```json
[
  {
    "id": "firestore_document_id",
    "userId": "firebase_user_id",
    "content": "Hello, World!",
    "type": "text",
    "timestamp": "2026-03-28T01:00:00.000Z",
    "expiresAt": "2026-04-04T01:00:00.000Z"
  }
]
```

---

## Socket.io Real-time Communication

The server uses Socket.io for real-time clipboard synchronization across devices.

### Connection Flow

1. **Connect to Socket.io server:**
   ```javascript
   const socket = io('http://localhost:3000');
   ```

2. **Join user room (authenticate):**
   ```javascript
   socket.emit('join-room', firebaseIdToken);
   ```

3. **Listen for room-joined confirmation:**
   ```javascript
   socket.on('room-joined', (data) => {
     console.log('Joined room for user:', data.userId);
   });
   ```

4. **Listen for authentication errors:**
   ```javascript
   socket.on('error', (error) => {
     console.error('Socket error:', error.message);
     // Socket will be disconnected after error
   });
   ```

5. **Listen for new clipboard entries:**
   ```javascript
   socket.on('new-clip', (clip) => {
     console.log('New clip received:', clip);
     // Update UI with new clipboard content
   });
   ```

### Events

**Client → Server:**
- `join-room` (token: string): Authenticate and join user-specific room

**Server → Client:**
- `room-joined` ({ userId: string }): Confirmation of successful authentication
- `error` ({ message: string }): Authentication failed (socket will disconnect)
- `new-clip` (clip: object): New clipboard entry created (broadcast to all user's devices)

### Example Client Implementation

```javascript
const io = require('socket.io-client');
const socket = io('http://localhost:3000');

// Authenticate with Firebase token
socket.emit('join-room', firebaseIdToken);

// Handle successful authentication
socket.on('room-joined', ({ userId }) => {
  console.log('Connected and authenticated for user:', userId);
});

// Handle authentication errors
socket.on('error', ({ message }) => {
  console.error('Authentication failed:', message);
});

// Listen for new clipboard entries
socket.on('new-clip', (clip) => {
  console.log('New clip synced:', clip);
  // Update local clipboard or UI
});
```

## Project Structure

```
clipSync-server/
├── config/
│   └── firebase.js          # Firebase Admin SDK initialization
├── middleware/
│   └── authGuard.js         # JWT token verification middleware
├── routes/
│   ├── devices.js           # Device registration endpoints
│   └── clips.js             # Clipboard sync endpoints
├── sockets/
│   └── clipSync.js          # Socket.io connection handling
├── index.js                 # Main server entry point
├── package.json
└── .env                     # Environment variables (not in git)
```

## Technologies

- **Express.js**: REST API framework
- **Socket.io**: Real-time bidirectional communication
- **Firebase Admin SDK**: Authentication and Firestore database
- **UUID**: Unique device ID generation
- **CORS**: Cross-origin resource sharing
- **dotenv**: Environment variable management