const { db } = require('../config/firebase');

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

    expiredClipsSnapshot.forEach(doc => {
      batch.delete(doc.ref);
      deleteCount++;
    });

    await batch.commit();
    console.log(`Deleted ${deleteCount} expired clips`);
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
