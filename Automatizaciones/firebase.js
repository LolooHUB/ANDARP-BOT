const admin = require('firebase-admin');

// Intentamos inicializar Firebase con el Secret de GitHub
try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    }
} catch (error) {
    console.error("❌ Error crítico al inicializar Firebase. Revisa el Secret FIREBASE_JSON:", error.message);
}

const db = admin.firestore();

/**
 * Función para obtener el siguiente número de ticket correlativo.
 * Si falla, devuelve un número aleatorio para no bloquear el bot.
 */
async function getNextTicketId() {
    try {
        const docRef = db.collection('configuracion').doc('tickets');
        const doc = await docRef.get();

        let nuevoId;
        if (!doc.exists) {
            nuevoId = 1;
            await docRef.set({ contador: nuevoId });
        } else {
            nuevoId = (doc.data().contador || 0) + 1;
            await docRef.update({ contador: nuevoId });
        }
        return nuevoId;
    } catch (error) {
        console.error("⚠️ Error en getNextTicketId (Firebase):", error.message);
        // Plan B: Retornar un ID aleatorio para que el ticket se cree de todos modos
        return Math.floor(1000 + Math.random() * 9000);
    }
}

module.exports = { db, getNextTicketId };