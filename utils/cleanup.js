const { db } = require('../config/firebase');
const admin = require('firebase-admin');

// Get Firebase Storage bucket
const bucket = admin.storage().bucket();

// Clean up expired clips every hour
async function cleanupExpiredClips() {
  try {
    const now = new Date();
    const expiredClipsSnapshot = await db
      .collection('clips')
      .where('expiresAt', '<', now)
      .get();

    if (expiredClipsSnapshot.empty) {
      console.log('No expired clips to delete');
      return;
    }

    const batch = db.batch();
    let deleteCount = 0;
    let fileDeleteCount = 0;

    for (const doc of expiredClipsSnapshot.docs) {
      const clipData = doc.data();
      
      // Delete file from Firebase Storage if storagePath exists
      if (clipData.storagePath) {
        try {
          const file = bucket.file(clipData.storagePath);
          await file.delete();
          fileDeleteCount++;
          console.log(`Deleted file: ${clipData.storagePath}`);
        } catch (error) {
          console.error(`Error deleting file ${clipData.storagePath}:`, error.message);
        }
      }
      
      // Add clip document to batch delete
      batch.delete(doc.ref);
      deleteCount++;
    }

    await batch.commit();
    console.log(`Deleted ${deleteCount} expired clips and ${fileDeleteCount} files from storage`);
  } catch (error) {
    console.error('Error cleaning up expired clips:', error);
  }
}

// Run cleanup every hour
function startCleanupScheduler() {
  console.log('Starting clip cleanup scheduler (runs every hour)');
  
  // Run immediately on startup
  cleanupExpiredClips();
  
  // Then run every hour
  setInterval(cleanupExpiredClips, 60 * 60 * 1000);
}

module.exports = { startCleanupScheduler };
