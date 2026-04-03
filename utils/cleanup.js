const { supabase } = require('../config/supabase');

// Clean up expired clips every hour
async function cleanupExpiredClips() {
  try {
    const now = new Date().toISOString();
    
    // Get expired clips
    const { data: expiredClips, error: fetchError } = await supabase
      .from('clips')
      .select('*')
      .lt('expires_at', now);

    if (fetchError) throw fetchError;

    if (!expiredClips || expiredClips.length === 0) {
      console.log('No expired clips to delete');
      return;
    }

    let fileDeleteCount = 0;

    // Delete files from Supabase Storage
    for (const clip of expiredClips) {
      if (clip.storage_path) {
        try {
          const { error: storageError } = await supabase.storage
            .from('uploads')
            .remove([clip.storage_path]);
          
          if (!storageError) {
            fileDeleteCount++;
            console.log(`Deleted file: ${clip.storage_path}`);
          } else {
            console.error(`Error deleting file ${clip.storage_path}:`, storageError.message);
          }
        } catch (error) {
          console.error(`Error deleting file ${clip.storage_path}:`, error.message);
        }
      }
    }

    // Delete clips from database
    const { error: deleteError } = await supabase
      .from('clips')
      .delete()
      .lt('expires_at', now);

    if (deleteError) throw deleteError;

    console.log(`Deleted ${expiredClips.length} expired clips and ${fileDeleteCount} files from storage`);
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
