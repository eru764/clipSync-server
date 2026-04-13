# ClipSync - AI Assistant Documentation

## Project Overview
ClipSync is a cross-platform clipboard synchronization application that allows users to sync text, images, and files across Windows, Chrome (web), and Android devices in real-time.

### Tech Stack
**Backend:**
- Node.js + Express
- Socket.IO (WebSocket real-time sync)
- Supabase (PostgreSQL database + Storage)
- JWT authentication
- Multer (file uploads)

**Frontend:**
- Flutter (cross-platform: Windows, Web, Android)
- Supabase Flutter SDK
- Socket.IO client
- Material Design

**Infrastructure:**
- Railway (backend hosting)
- Supabase Cloud (database + storage)
- GitHub (version control)

## Architecture

### Authentication Flow
1. User signs up/logs in via Supabase Auth
2. Supabase returns JWT access token + refresh token
3. Tokens stored in SharedPreferences (mobile) or localStorage (web)
4. All API requests include `Authorization: Bearer <token>` header
5. Backend decodes JWT to extract user ID
6. Socket connections authenticated with same JWT

### Data Flow
```
User Action → Flutter App → HTTP/WebSocket → Express Server → Supabase DB/Storage
                                    ↓
                              Socket.IO broadcast
                                    ↓
                         All connected user devices
```

### File Upload Flow
1. User selects image/file
2. Flutter sends multipart/form-data to `/upload` endpoint
3. Server uploads to Supabase Storage bucket `uploads`
4. Server creates clip record in database with file URL
5. UI refreshes to show new clip
6. Files auto-delete after 2 hours (cron job)

## Database Schema

### Clips Table
```sql
CREATE TABLE clips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  type VARCHAR(50) DEFAULT 'text',  -- 'text', 'image', 'file'
  user_id TEXT NOT NULL,            -- Supabase user ID
  file_url TEXT,
  file_name TEXT,
  file_size BIGINT,
  mime_type TEXT,
  storage_path TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Devices Table
```sql
CREATE TABLE devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  device_name TEXT NOT NULL,
  device_id TEXT NOT NULL UNIQUE,
  platform TEXT,
  fcm_token TEXT,
  last_active TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Row Level Security (RLS)
- Enabled on both tables
- Users can only access their own clips and devices
- Policy: `auth.uid()::text = user_id`

## Backend API Endpoints

### Authentication
**Middleware:** `supabaseAuthGuard.js`
- Decodes JWT from `Authorization: Bearer <token>` header
- Attaches `req.user = { uid, email }` to request
- Returns 401 if token invalid/missing

### Routes

#### POST `/clips`
Create a new text clip
```javascript
Body: {
  content: "text to sync",
  type: "text"
}
Response: { id, content, type, userId, timestamp, expiresAt }
```

#### POST `/clips` (with file)
Create image/file clip (after upload)
```javascript
Body: {
  content: "filename",
  type: "image" | "file",
  fileUrl: "https://...",
  fileName: "example.pdf",
  fileSize: 123456,
  mimeType: "application/pdf",
  storagePath: "userId/timestamp_filename"
}
```

#### GET `/clips`
Get all user's clips (sorted by timestamp desc)

#### DELETE `/clips/:id`
Delete a clip by ID

#### POST `/upload`
Upload file to Supabase Storage
```javascript
Multipart form-data with field "file"
Response: {
  success: true,
  url: "public URL",
  fileName: "original name",
  fileSize: bytes,
  mimeType: "mime/type",
  storagePath: "path/in/storage"
}
```

**Storage Limits:**
- Max file size: 50MB
- Total storage per user: 100MB
- Returns 413 if limit exceeded

#### POST `/devices`
Register a device

#### GET `/devices`
Get all user's devices

#### DELETE `/devices/:id`
Remove a device

## WebSocket Events (Socket.IO)

### Client → Server
- `join-room` - Join user's room with JWT token
  ```javascript
  socket.emit('join-room', token)
  ```

### Server → Client
- `room-joined` - Confirmation of room join
  ```javascript
  { userId: "user-id" }
  ```
- `new-clip` - New clip created
  ```javascript
  { clip: ClipModel }
  ```
- `clip-deleted` - Clip deleted
  ```javascript
  { clipId: "uuid" }
  ```
- `error` - Authentication error
- `token-expired` - Token needs refresh

## Flutter App Structure

### Key Files

#### `/lib/main.dart`
- Initializes Supabase
- Sets up routing
- Checks auth state on launch

#### `/lib/screens/home_screen.dart`
Main screen with:
- Platform-specific UI (mobile bottom nav vs desktop toolbar)
- Clipboard monitoring
- Text sync
- Image/file upload
- Clip list with swipe-to-delete (mobile)
- Real-time socket updates

**Platform Detection:**
```dart
bool get _isMobile => !kIsWeb && (Platform.isAndroid || Platform.isIOS);
bool get _isDesktop => kIsWeb || Platform.isWindows || Platform.isMacOS;
```

#### `/lib/services/auth_service.dart`
- Sign up / sign in with Supabase
- Token management
- Auto-refresh tokens

#### `/lib/services/socket_service.dart`
- Socket.IO connection
- Room joining
- Event handling
- Auto-reconnect on token refresh

#### `/lib/models/clip_model.dart`
```dart
class ClipModel {
  final String id;
  final String userId;
  final String content;
  final String type;
  final String? fileUrl;
  final String? fileName;
  final int? fileSize;
  final String? mimeType;
  final DateTime timestamp;
  
  // Parses both snake_case (DB) and camelCase (JSON)
  factory ClipModel.fromJson(Map<String, dynamic> json)
}
```

### Android-Specific

#### Permissions (`AndroidManifest.xml`)
```xml
<uses-permission android:name="android.permission.INTERNET"/>
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="32"/>
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32"/>
<uses-permission android:name="android.permission.READ_MEDIA_IMAGES"/>
<uses-permission android:name="android.permission.READ_MEDIA_VIDEO"/>
<uses-permission android:name="android.permission.READ_MEDIA_AUDIO"/>
```

## Environment Variables

### Backend (`.env`)
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
PORT=3000
```

### Flutter (`.env`)
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SERVER_URL=https://clipsync-server-production-0685.up.railway.app
```

## Key Features

### 1. Platform-Specific UI
- **Android/iOS:** Bottom navigation bar, swipe-to-delete, compact layout
- **Windows/Chrome:** Desktop toolbar, floating action button, spacious layout

### 2. Clipboard Monitoring
- Auto-sync clipboard changes
- Vocabulary word detection
- Real-time updates via WebSocket

### 3. File Management
- Upload images (multi-select)
- Upload any file type (PDF, video, audio, etc.)
- 50MB max per file
- 100MB total storage per user
- Auto-delete after 2 hours

### 4. Real-time Sync
- Socket.IO for instant updates
- Auto-reconnect on connection loss
- Token refresh on expiry

### 5. UI/UX Features
- Pull-to-refresh (mobile)
- Refresh button (desktop)
- Swipe-to-delete (mobile)
- Clear all clips
- Delete individual clips
- Thumbnail previews for images
- File type icons (PDF, video, audio)

## Common Development Tasks

### Add New Clip Type
1. Add type to database schema
2. Update `ClipModel.fromJson()` in Flutter
3. Create `_build[Type]ClipCard()` widget
4. Handle in `itemBuilder` logic
5. Add upload logic if needed

### Add New API Endpoint
1. Create route file in `/routes`
2. Add middleware (`authGuard`)
3. Implement handler with Supabase queries
4. Register in `index.js`
5. Add Flutter service method

### Modify Database Schema
1. Update `supabase_schema.sql`
2. Run SQL in Supabase SQL Editor
3. Update backend queries
4. Update Flutter models
5. Test migration

## Troubleshooting

### "401 Unauthorized" Errors
**Cause:** Invalid/expired JWT token
**Fix:**
- Check token in SharedPreferences/localStorage
- Verify Supabase project URL and keys
- Ensure `supabaseAuthGuard.js` correctly decodes token
- Test token with `jwt.decode(token)` in backend

### "Invalid UUID" Database Errors
**Cause:** `user_id` field is UUID type but Supabase uses TEXT
**Fix:** Change column type to TEXT in schema

### Files Upload But Don't Show in UI
**Cause:** Missing `_refreshClips()` call after upload
**Fix:** Add `await _refreshClips()` after successful upload

### Web File Upload Fails
**Cause:** Using `path` property which doesn't exist on web
**Fix:** Use `pickedFile.bytes` instead of `File(pickedFile.path!).readAsBytes()`

### Socket Connection Loops
**Cause:** Socket connecting multiple times
**Fix:** Check for duplicate `socket.connect()` calls, add connection state check

### Storage Limit Not Enforced
**Cause:** Missing storage check in upload endpoint
**Fix:** Query existing files with `supabase.storage.from('uploads').list(userId)` and sum sizes

## Deployment

### Backend (Railway)
1. Push to GitHub
2. Railway auto-deploys from `main` branch
3. Set environment variables in Railway dashboard
4. Monitor logs for errors
5. Check deployment status

**Build Config:**
- Nixpacks (auto-detected)
- Node.js 18+
- `npm ci` install
- `npm run start` start command

### Frontend
**Windows:**
```bash
flutter build windows --release
```

**Android:**
```bash
flutter build apk --release
```

**Web:**
```bash
flutter build web --release
```

## Testing Checklist

### Cross-Platform
- [ ] Sign up/login works on all platforms
- [ ] Text sync appears on all devices
- [ ] Image upload works
- [ ] File upload works
- [ ] Delete works
- [ ] Real-time updates via socket
- [ ] Token refresh works
- [ ] Storage limit enforced

### Platform-Specific
- [ ] Android: Swipe to delete
- [ ] Android: Bottom nav works
- [ ] Android: Pull to refresh
- [ ] Desktop: Toolbar buttons work
- [ ] Desktop: Refresh button
- [ ] Desktop: Clear all button
- [ ] Web: File upload uses bytes

## Code Patterns

### Error Handling
```dart
try {
  final response = await http.get(...);
  if (response.statusCode == 401) {
    await _refreshToken();
    // Retry request
  }
  if (response.statusCode == 200) {
    // Success
  }
} catch (e) {
  print('Error: $e');
  if (mounted) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Error: $e')),
    );
  }
}
```

### Database Queries
```javascript
// Insert
const { data, error } = await supabase
  .from('clips')
  .insert([{ content, type, user_id: userId, expires_at }])
  .select()
  .single();

// Select
const { data, error } = await supabase
  .from('clips')
  .select('*')
  .eq('user_id', userId)
  .order('timestamp', { ascending: false });

// Delete
const { error } = await supabase
  .from('clips')
  .delete()
  .eq('id', clipId)
  .eq('user_id', userId);
```

### File Upload
```dart
final formData = http.MultipartRequest('POST', Uri.parse('$serverUrl/upload'));
formData.headers['Authorization'] = 'Bearer $_token';
formData.files.add(
  http.MultipartFile.fromBytes('file', bytes, filename: name),
);
final response = await http.Response.fromStream(await formData.send());
```

## Performance Considerations

### Database
- Indexed on `user_id`, `timestamp`, `expires_at`
- RLS policies filter by user automatically
- Use `.single()` for single-row queries
- Limit results with `.limit(100)`

### File Storage
- Public bucket for easy access
- Files stored in user-specific folders: `userId/timestamp_filename`
- Cleanup job runs hourly to delete expired files

### Flutter
- Use `ListView.builder` for long lists (lazy loading)
- Dispose controllers in `dispose()`
- Use `if (mounted)` before `setState()`
- Cache network images
- Debounce clipboard monitoring

## Security

### Authentication
- JWT tokens with Supabase
- Tokens stored securely (SharedPreferences/localStorage)
- Auto-refresh before expiry
- Server validates every request

### Authorization
- RLS policies on database
- User can only access own data
- File paths include user ID
- No service role key in client

### File Upload
- Max file size: 50MB
- Total storage limit: 100MB
- Files auto-delete after 2 hours
- Mime type validation
- Path sanitization

## Future Enhancements

### Planned Features
- [ ] End-to-end encryption
- [ ] Offline support with local cache
- [ ] File preview (PDF viewer, video player)
- [ ] Drag & drop file upload
- [ ] Keyboard shortcuts
- [ ] Search clips
- [ ] Tags/categories
- [ ] Favorites/pin clips
- [ ] Export clips
- [ ] Multi-language support

### Performance
- [ ] Optimize image thumbnails
- [ ] Implement pagination
- [ ] Add caching layer (Redis)
- [ ] Compress large files
- [ ] CDN for file delivery

### DevOps
- [ ] Automated testing (unit, integration, E2E)
- [ ] CI/CD pipeline
- [ ] Monitoring and alerts
- [ ] Usage analytics
- [ ] Error tracking (Sentry)

## Resources

- [Supabase Docs](https://supabase.com/docs)
- [Flutter Docs](https://docs.flutter.dev)
- [Socket.IO Docs](https://socket.io/docs)
- [Express Docs](https://expressjs.com)
- [Railway Docs](https://docs.railway.app)

## Contact & Support

For issues or questions:
1. Check logs (Railway backend, Flutter console)
2. Review this documentation
3. Check Supabase dashboard for DB issues
4. Verify environment variables
5. Test with curl/Postman for API issues
