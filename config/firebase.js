const admin = require('firebase-admin');

const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT;

if (!serviceAccountBase64) {
  throw new Error('FIREBASE_SERVICE_ACCOUNT environment variable is not set');
}

const serviceAccount = JSON.parse(
  Buffer.from(serviceAccountBase64, 'base64').toString('utf-8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET
});

const db = admin.firestore();
const auth = admin.auth();

module.exports = { db, auth };
