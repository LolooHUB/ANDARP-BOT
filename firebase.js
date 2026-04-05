const admin = require("firebase-admin");

// Parseamos el JSON que viene de los Secrets de GitHub/Replit/Hosting
const serviceAccount = JSON.parse(process.env.FIREBASE_JSON);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: "andarp.appspot.com" // Asegúrate que coincida con tu bucket
});

const db = admin.firestore();
const storage = admin.storage();

/**
 * Función para manejar el ID incremental de los tickets en Firestore
 */
async function getNextTicketId() {
    try {
        const counterRef = db.collection('settings').doc('ticket_counter');
        const doc = await counterRef.get();

        if (!doc.exists) {
            await counterRef.set({ count: 1 });
            return 1;
        }

        const newCount = (doc.data().count || 0) + 1;
        await counterRef.update({ count: newCount });
        return newCount;
    } catch (error) {
        console.error("Error obteniendo ID de ticket:", error);
        return Math.floor(Math.random() * 9000) + 1000; // Backup por si falla la DB
    }
}

module.exports = { db, storage, getNextTicketId };