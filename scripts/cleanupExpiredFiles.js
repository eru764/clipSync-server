const admin = require('firebase-admin');

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(require('../serviceAccountKey.json')),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET
  });
}

const db = admin.firestore();
const bucket = admin.storage().bucket();

async function cleanupExpiredFiles() {
  try {
    console.log('Starting cleanup of expired files...');
    
    // Get all expired clips with file URLs
    const now = new Date();
    const expiredClipsSnapshot = await db.collection('clips')
      .where('expiresAt', '<=', now)
      .where('fileUrl', '!=', null)
      .get();

    console.log(`Found ${expiredClipsSnapshot.size} expired clips with files`);

    for (const doc of expiredClipsSnapshot.docs) {
      const clipData = doc.data();
      
      // Delete from Firebase Storage if storagePath exists
      if (clipData.storagePath) {
        try {
          const file = bucket.file(clipData.storagePath);
          await file.delete();
          console.log(`Deleted file: ${clipData.storagePath}`);
        } catch (error) {
          console.error(`Error deleting file ${clipData.storagePath}:`, error.message);
        }
      }
      
      // Delete the clip document
      await doc.ref.delete();
      console.log(`Deleted clip: ${doc.id}`);
    }

    console.log('Cleanup completed successfully');
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
}

// Run cleanup
cleanupExpiredFiles()
  .then(() => {
    console.log('Cleanup script finished');
    process.exit(0);
  })
  .catch(error => {
    console.error('Cleanup script failed:', error);
    process.exit(1);
  });
