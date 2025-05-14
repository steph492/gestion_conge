const cron = require('node-cron');
const db = require('./db'); // Connexion à la base de données

async function updateSoldeUtilisable() {
    try {
        const now = new Date();
        const currentMonth = now.getMonth() + 1; // Mois de 1 à 12
        const currentYear = now.getFullYear();
        const currentDay = now.getDate(); // Jour du mois

        // Si c’est le 1er juin
        if (currentMonth === 6 && currentDay === 1) {
            console.log(`🔄 Remise à zéro annuelle pour l'année ${currentYear}...`);
            await db.promise().query('UPDATE utilisateurs SET solde_utilisable = 0');
            console.log('✅ Remise à zéro terminée.');
        }

        // Si c’est le 1er jour du mois, on ajoute 2.5 jours
        if (currentDay === 1) {
            console.log('➕ Incrémentation mensuelle du solde utilisable...');
            await db.promise().query('UPDATE utilisateurs SET solde_utilisable = solde_utilisable + 2.5');
            console.log('✅ Incrémentation terminée.');
        }

        console.log('✔️ Mise à jour du solde utilisable terminée.');
    } catch (error) {
        console.error('❌ Erreur lors de la mise à jour du solde utilisable :', error);
    }
}

// ✅ Ce cron s'exécute toutes les heures à la minute 5
cron.schedule('5 * * * *', async () => {
    console.log('⏰ Exécution du script de mise à jour du solde utilisable...');
    await updateSoldeUtilisable();
});

// Exportation
module.exports = {
    startCron: () => {
        console.log('🟢 Cron de solde utilisable démarré.');
        updateSoldeUtilisable(); // appel immédiat au démarrage si besoin
    }
};
