const express = require('express');
const router = express.Router();
const db = require('../db');
const multer = require('multer');
const path = require('path');



// Configuration du stockage pour multer
const storage = multer.memoryStorage(); // Stocker le fichier en mémoire
const upload = multer({ storage: storage });

// Middleware pour détecter les requêtes AJAX
router.use((req, res, next) => {
    req.xhr = req.get('X-Requested-With') === 'XMLHttpRequest';
    next();
});

// Middleware pour vérifier si l'utilisateur est connecté
function ensureAuthenticated(req, res, next) {
    if (!req.session.userId || !req.session.sessionId) {
        return res.status(401).send("Vous devez être connecté pour accéder à cette page.");
    }
    next();
}

// Appliquer le middleware à toutes les routes de ce fichier
router.use(ensureAuthenticated);

// Fonction pour obtenir le type de congé par son ID
async function getTypeCongeById(id) {
    const [rows] = await db.promise().query('SELECT * FROM type_conges WHERE id_type_conge = ?', [id]);
    return rows[0];
}

// Route GET - Page de gestion des demandes
router.get('/', async (req, res) => {
    try {
        const userId = req.session.userId;
        const page = parseInt(req.query.page) || 1;
        const limit = 5;
        const offset = (page - 1) * limit;

        const [countResult] = await db.promise().query('SELECT COUNT(*) as total FROM conges WHERE utilisateur_id = ?', [userId]);
        const totalDemandes = countResult[0].total;
        const totalPages = Math.ceil(totalDemandes / limit);

        const [demandesResults] = await db.promise().query(`
            SELECT id, type_conge, date_debut, date_fin, statut, motif, date_demande,
                   date_validation, validateur_id, commentaire, piece_jointe, date_modification,
                   periode_journee, traite
            FROM conges
            WHERE utilisateur_id = ?
            ORDER BY id DESC
            LIMIT ? OFFSET ?`, [userId, limit, offset]);

        demandesResults.forEach(demande => {
            const debut = new Date(demande.date_debut);
            const fin = new Date(demande.date_fin);
            const diff = fin.getTime() - debut.getTime();
            let duree = Math.ceil(diff / (1000 * 3600 * 24)) + 1;
            if (demande.periode_journee === 'matin' || demande.periode_journee === 'soir') {
                duree = duree * 0.5;
            }
            demande.duree = duree;
            demande.reference = 'REF-' + demande.id;
        });

        const [soldeResult] = await db.promise().query('SELECT solde_conges, solde_utilisable FROM utilisateurs WHERE id = ?', [userId]);
        const soldeConge = soldeResult.length > 0 ? soldeResult[0].solde_conges : 0;
        const soldeUtilisable = soldeResult.length > 0 ? soldeResult[0].solde_utilisable : 0;

        // Récupérer les types de congés
        const [typesConges] = await db.promise().query('SELECT id_type_conge, nom_type_conge FROM type_conges');

        res.render('navigationuser/gestiondemande', {
            demandes: demandesResults,
            soldeConge: soldeConge,
            soldeUtilisable: soldeUtilisable,
            typesConges: typesConges,
            pagination: {
                currentPage: page,
                totalPages: totalPages,
                totalItems: totalDemandes,
                startItem: offset + 1,
                endItem: Math.min(offset + limit, totalDemandes)
            }
        });
    } catch (err) {
        console.error('Erreur:', err);
        res.status(500).send("Erreur serveur");
    }
});

// Route POST - Enregistrement d'une demande (avec gestion de pièce jointe en LONGBLOB)
router.post('/demande', upload.single('piece_jointe'), async (req, res) => {
    try {
        const { type_conge, date_debut, date_fin, motif, periode_journee } = req.body;
        const utilisateur_id = req.session.userId;
        const piece_jointe = req.file ? req.file.buffer : null; // Récupérer le buffer du fichier

        if (!type_conge || !date_debut || !date_fin || !motif) {
            return res.status(400).json({ message: "Tous les champs sont obligatoires." });
        }

        // Obtenir le nom du type de congé
        const typeConge = await getTypeCongeById(type_conge);
        const nomTypeConge = typeConge.nom_type_conge;

        // Récupérer le solde de l'utilisateur
        const [soldeResult] = await db.promise().query('SELECT solde_conges, solde_utilisable FROM utilisateurs WHERE id = ?', [utilisateur_id]);
        const soldeConge = soldeResult[0].solde_conges;
        const soldeUtilisable = soldeResult[0].solde_utilisable;

        // Calculer la durée de la demande
        const debut = new Date(date_debut);
        const fin = new Date(date_fin);
        const diff = fin.getTime() - debut.getTime();
        let duree = Math.ceil(diff / (1000 * 3600 * 24)) + 1;

        if (periode_journee === 'matin' || periode_journee === 'soir') {
            duree = duree * 0.5;
        }

        // Vérifier le solde
        const soldeMin = Math.min(soldeConge, soldeUtilisable);
        if (duree > soldeMin) {
            return res.status(400).json({
                message: "Solde congés payés insuffisant pour cette demande."
            });
        }

        // Insertion de la demande avec le nom du type de congé
        const [result] = await db.promise().query(
            `INSERT INTO conges (utilisateur_id, type_conge, date_debut, date_fin, statut, motif, periode_journee, piece_jointe)
            VALUES (?, ?, ?, ?, 'en attente', ?, ?, ?)`,
            [utilisateur_id, nomTypeConge, date_debut, date_fin, motif, periode_journee, piece_jointe]
        );

        // Récupérer le nom de l'utilisateur pour la notification
        const [userResult] = await db.promise().query(
            'SELECT nom FROM utilisateurs WHERE id = ?',
            [utilisateur_id]
        );
        const userName = userResult[0].nom; // Seulement le nom

        await db.promise().query(
            `INSERT INTO notifications (id_utilisateur, message, est_lu, date_creation)
             VALUES (?, ?, ?, NOW())`,
            [
                utilisateur_id,
                `une nouvelle demande de congé de type "${nomTypeConge}" du ${new Date(date_debut).toLocaleDateString('fr-FR')} au ${new Date(date_fin).toLocaleDateString('fr-FR')} est arrivée.`,
                0
            ]
        );

        console.log("Demande enregistrée :", result.insertId);
        res.status(200).json({ message: "Demande envoyée avec succès." });
    } catch (err) {
        console.error("Erreur lors de l'insertion :", err);
        res.status(500).json({ message: "Erreur serveur lors de l'enregistrement." });
    }
});


// Route DELETE - Suppression d'une demande
router.delete('/demande/:id', async (req, res) => {
    try {
        const demandeId = req.params.id;
        const userId = req.session.userId;

        const [result] = await db.promise().query(
            'DELETE FROM conges WHERE id = ? AND utilisateur_id = ? AND statut = "en attente"',
            [demandeId, userId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Demande non trouvée ou déjà traitée." });
        }

        res.status(200).json({ message: "Demande supprimée avec succès." });
    } catch (err) {
        console.error("Erreur lors de la suppression :", err);
        res.status(500).json({ message: "Erreur serveur lors de la suppression." });
    }
});

// Route POST - Mise à jour d'une demande
router.post('/modifier/:id', async (req, res) => {
    try {
        const demandeId = req.params.id;
        const { type_conge, date_debut, date_fin, motif, periode_journee } = req.body;
        const userId = req.session.userId;

        if (!type_conge || !date_debut || !date_fin || !motif) {
            return res.status(400).json({ message: "Tous les champs sont obligatoires." });
        }

        // Obtenir le nom du type de congé
        const typeConge = await getTypeCongeById(type_conge);
        const nomTypeConge = typeConge.nom_type_conge;

        const [result] = await db.promise().query(
            'UPDATE conges SET type_conge = ?, date_debut = ?, date_fin = ?, motif = ?, periode_journee = ? WHERE id = ? AND utilisateur_id = ? AND statut = "en attente"',
            [nomTypeConge, date_debut, date_fin, motif, periode_journee, demandeId, userId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Demande non trouvée ou déjà traitée." });
        }

        // Récupérer le nom de l'utilisateur pour la notification
        const [userResult] = await db.promise().query(
            'SELECT nom FROM utilisateurs WHERE id = ?',
            [userId]  // Utilisez userId au lieu de utilisateur_id
        );
        const userName = userResult[0].nom; // Seulement le nom
        
        
        await db.promise().query(
            `INSERT INTO notifications (id_utilisateur, message, est_lu, date_creation)
             VALUES (?, ?, ?, NOW())`,
            [
                userId,  // Utilisez userId au lieu de utilisateur_id
                `le demande de congé de type "${nomTypeConge}" du ${new Date(date_debut).toLocaleDateString('fr-FR')} au ${new Date(date_fin).toLocaleDateString('fr-FR')}  en attente a été modifiée.`,  // Changé "enregistrée" par "modifiée"
                0
            ]
        );

        res.status(200).json({ message: "Demande mise à jour avec succès." });
    } catch (err) {
        console.error("Erreur lors de la mise à jour :", err);
        res.status(500).json({ message: "Erreur serveur lors de la mise à jour." });
    }
});
//route poure le rechargement 
// Route GET pour le rechargement des demandes avec pagination
router.get('/demandes/page/:page', async (req, res) => {
    try {
        const userId = req.session.userId;
        const page = parseInt(req.params.page) || 1;
        const limit = 5;
        const offset = (page - 1) * limit;

        // Récupérer les demandes paginées
        const [demandesResults] = await db.promise().query(`
            SELECT id, type_conge, date_debut, date_fin, statut, motif, date_demande,
                   date_validation, validateur_id, commentaire, piece_jointe, date_modification,
                   periode_journee
            FROM conges
            WHERE utilisateur_id = ?
            ORDER BY id DESC
            LIMIT ? OFFSET ?`, [userId, limit, offset]);

        // Calculer la durée pour chaque demande
        demandesResults.forEach(demande => {
            const debut = new Date(demande.date_debut);
            const fin = new Date(demande.date_fin);
            const diff = fin.getTime() - debut.getTime();
            let duree = Math.ceil(diff / (1000 * 3600 * 24)) + 1;
            if (demande.periode_journee === 'matin' || demande.periode_journee === 'soir') {
                duree = duree * 0.5;
            }
            demande.duree = duree;
            demande.reference = 'REF-' + demande.id;
        });

        // Récupérer le nombre total de demandes pour la pagination
        const [countResult] = await db.promise().query('SELECT COUNT(*) as total FROM conges WHERE utilisateur_id = ?', [userId]);
        const totalDemandes = countResult[0].total;
        const totalPages = Math.ceil(totalDemandes / limit);

        res.json({
            success: true,
            demandes: demandesResults,
            pagination: {
                currentPage: page,
                totalPages: totalPages,
                totalItems: totalDemandes,
                startItem: offset + 1,
                endItem: Math.min(offset + limit, totalDemandes)
            }
        });
    } catch (err) {
        console.error('Erreur:', err);
        res.status(500).json({
            success: false,
            message: "Erreur serveur lors du chargement des demandes"
        });
    }
});


router.get('/tableaubord', async (req, res) => {
    try {
        const userId = req.session.userId;

        const [statsResult] = await db.promise().query(`
            SELECT
                COUNT(*) AS totalDemandes,
                SUM(CASE WHEN statut = 'approuvé' THEN 1 ELSE 0 END) AS totalAcceptees,
                SUM(CASE WHEN statut = 'refusé' THEN 1 ELSE 0 END) AS totalRefusees,
                SUM(CASE WHEN statut = 'en attente' THEN 1 ELSE 0 END) AS totalEnAttente
            FROM conges
            WHERE utilisateur_id = ?
        `, [userId]);

        const [soldeResult] = await db.promise().query('SELECT solde_conges, solde_utilisable FROM utilisateurs WHERE id = ?', [userId]);
        const soldeConge = soldeResult.length > 0 ? soldeResult[0].solde_conges : 0;
        const soldeUtilisable = soldeResult.length > 0 ? soldeResult[0].solde_utilisable : 0;

        const [resultTypes] = await db.promise().query(`
            SELECT type_conge,
                   SUM(DATEDIFF(date_fin, date_debut) + 1) AS jours_utilises
            FROM conges
            WHERE utilisateur_id = ? AND statut = 'approuvé'
            GROUP BY type_conge
        `, [userId]);

        const [userResult] = await db.promise().query('SELECT nom, poste FROM utilisateurs WHERE id = ?', [userId]);
        const user = userResult[0];

        const stats = statsResult[0];

        res.render('navigationuser/tableaubord', {
            totalDemandes: stats.totalDemandes || 0,
            totalAcceptees: stats.totalAcceptees || 0,
            totalRefusees: stats.totalRefusees || 0,
            totalEnAttente: stats.totalEnAttente || 0,
            soldeConge: soldeConge,
            soldeUtilisable: soldeUtilisable, // Passe le soldeUtilisable à la vue
            resumeParType: resultTypes,
            user: user
        });
    } catch (err) {
        console.error('Erreur:', err);
        res.status(500).send("Erreur serveur");
    }
});

// Route API JSON pour le calendrier des congés
router.get('/calendrierconge/data', async (req, res) => {
    try {
        const userId = req.session.userId;
        if (!userId) return res.status(401).json({ error: "non authentifié" });

        let year = parseInt(req.query.year) || new Date().getFullYear();
        let month = parseInt(req.query.month);
        if (isNaN(month) || month < 0 || month > 11) {
            month = new Date().getMonth();
        }

        const [results] = await db.promise().query(`
            SELECT date_debut, date_fin, type_conge, periode_journee
            FROM conges
            WHERE utilisateur_id = ?
              AND MONTH(date_debut) = ?
              AND YEAR(date_debut)  = ?
              AND statut = 'approuvé'
              AND (
                   (date_debut BETWEEN ? AND ?)
                OR (date_fin   BETWEEN ? AND ?)
                OR (date_debut <= ? AND date_fin >= ?)
              )
            ORDER BY date_debut ASC
        `, [
            userId,
            month + 1,
            year,
            `${year}-${month + 1}-01`,
            `${year}-${month + 1}-${new Date(year, month + 1, 0).getDate()}`,
            `${year}-${month + 1}-01`,
            `${year}-${month + 1}-${new Date(year, month + 1, 0).getDate()}`,
            `${year}-${month + 1}-01`,
            `${year}-${month + 1}-${new Date(year, month + 1, 0).getDate()}`
        ]);

        const conges = results.map(conge => {
            return {
                date_debut: conge.date_debut,
                date_fin: conge.date_fin,
                type_conge: conge.type_conge,
                statut: conge.statut,
                periode_journee: conge.periode_journee
            };
        });

        res.json({ conges: conges });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Erreur serveur" });
    }
});

// Route pour afficher le calendrier des congés
router.get('/calendrierconge', async (req, res) => {
    try {
        const today = new Date();
        const year = today.getFullYear();

        const [results] = await db.promise().query(`
            SELECT date_debut, date_fin, type_conge, statut, periode_journee
            FROM conges
            WHERE utilisateur_id = ?
              AND YEAR(date_debut) = ?
            ORDER BY date_debut ASC
        `, [req.session.userId, year]);

        res.render('navigationuser/calendrierconge', {
            conges: results,
            currentYear: year
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Erreur serveur");
    }
});


router.get('/notificationuser', async (req, res) => {
    try {
        const userId = req.session.userId;
  
        const [notificationsResult] = await db.promise().query(
          `SELECT n.id, n.message, n.date_creation, n.est_lu, u.nom
           FROM notificationss n
           JOIN utilisateurs u ON n.id_admin = u.id
           WHERE n.id_utilisateur = ?
           ORDER BY n.date_creation DESC`,
          [userId]
        );
  
        res.render('navigationuser/notificationuser', {
            notifications: notificationsResult
        });
    } catch (err) {
        console.error('Erreur:', err);
        res.status(500).send("Erreur serveur");
    }
  });
  

// Marquer notification comme lue (ADMIN)
router.post('/notifications/mark-read/:id', async (req, res) => {
  try {
      const notificationId = req.params.id;

      await db.promise().query(
          'UPDATE notificationss SET est_lu = 1 WHERE id = ?',
          [notificationId]
      );

      res.json({ success: true });
  } catch (err) {
      console.error('Erreur mark-read:', err);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Supprimer notification (ADMIN)
router.delete('/notifications/delete/:id', async (req, res) => {
  try {
      const notificationId = req.params.id;

      await db.promise().query(
          'DELETE FROM notificationss WHERE id = ?',
          [notificationId]
      );

      res.json({ success: true });
  } catch (err) {
      console.error('Erreur delete:', err);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Supprimer plusieurs notifications (ADMIN)
router.post('/notifications/delete-multiple', async (req, res) => {
  try {
    const { ids } = req.body;

    // Validation des entrées
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Aucun ID de notification fourni ou format invalide"
      });
    }

    // Construction de la requête SQL avec placeholders
    const placeholders = ids.map(() => '?').join(',');
    const sql = `DELETE FROM notificationss WHERE id IN (${placeholders})`;

    // Exécution de la requête
    await db.promise().query(sql, ids);

    res.json({
      success: true,
      message: `${ids.length} notification(s) supprimée(s) avec succès`
    });
  } catch (err) {
    console.error('Erreur delete-multiple:', err);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la suppression multiple'
    });
  }
});
//route de demande traite pour le badge
router.get('/get-demandes-traitees', (req, res) => {
  const userId = req.session.userId;

  if (!userId) {
    return res.status(401).json({ error: "Utilisateur non connecté" });
  }

  const query = `
    SELECT COUNT(*) AS traiteesCount
    FROM conges
    WHERE traite = TRUE AND utilisateur_id = ?
  `;

  db.query(query, [userId], (err, results) => {
    if (err) {
      console.error('Erreur récupération demandes traitées :', err);
      return res.status(500).json({ error: "Erreur serveur" });
    }

    res.json({ traiteesCount: results[0].traiteesCount });
  });
});


// Badge de notification pour l'utilisateur connecté
router.get('/get-notifications-count', (req, res) => {
  const userId = req.session.userId; // récupère l'id de l'utilisateur depuis la session

  if (!userId) {
    return res.status(401).json({ error: 'Utilisateur non connecté' });
  }

  const sql = "SELECT COUNT(*) AS notificationCount FROM notificationss WHERE est_lu = 0 AND id_utilisateur = ?";
  db.query(sql, [userId], (err, result) => {
    if (err) {
      console.error('Erreur MySQL :', err);
      return res.status(500).json({ error: 'Erreur serveur' });
    }
    res.json({ notificationCount: result[0].notificationCount });
  });
});


//mise a jour traiter
router.post('/reset-traite', (req, res) => {
  const userId = req.session.userId;
  if (!userId) return res.status(401).json({ success: false, message: 'Non autorisé' });

  const sql = 'UPDATE conges SET traite = 0 WHERE traite = 1 AND utilisateur_id = ?';
  db.query(sql, [userId], (err, results) => {
    if (err) {
      console.error('Erreur reset-traite :', err);
      return res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
    res.json({ success: true, affectedRows: results.affectedRows });
  });
});


module.exports = router;
