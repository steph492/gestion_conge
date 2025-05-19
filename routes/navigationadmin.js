const express = require('express');
const router = express.Router();
const db = require('../db');

// Middleware pour vérifier si l'utilisateur est un administrateur
function ensureAdmin(req, res, next) {
  if (req.session.role !== 'admin') {
    return res.status(403).send("Accès refusé. Vous devez être un administrateur.");
  }
  next();
}

// Appliquer le middleware à toutes les routes de ce fichier
router.use(ensureAdmin);

// GET - Afficher tous les types de congés
router.get('/typeconge', async (req, res) => {
  try {
    const [typesConges] = await db.promise().query('SELECT * FROM type_conges');
    res.render('navigationadmin/typeconge', { typesConges });
  } catch (err) {
    console.error('Erreur lors du chargement des types de congé :', err);
    res.status(500).send("Erreur serveur lors du chargement des types de congé.");
  }
});

// POST - Ajouter un type de congé
router.post('/typeconge', async (req, res) => {
  try {
    const { nom_type_conge, description, duree_maximale } = req.body;

    if (!nom_type_conge || !duree_maximale) {
      return res.status(400).json({ message: "Le nom et la durée maximale sont obligatoires." });
    }

    await db.promise().query(
      'INSERT INTO type_conges (nom_type_conge, description, duree_maximale) VALUES (?, ?, ?)',
      [nom_type_conge, description || '', duree_maximale]
    );

    res.status(200).json({ message: "Type de congé ajouté avec succès." });
  } catch (err) {
    console.error("Erreur lors de l'ajout du type de congé :", err);
    res.status(500).json({ message: "Erreur serveur lors de l'ajout." });
  }
});

// POST - Modifier un type de congé
router.post('/typeconge/:id', async (req, res) => {
  try {
    const { nom_type_conge, description, duree_maximale } = req.body;
    const { id } = req.params;

    if (!nom_type_conge || !duree_maximale) {
      return res.status(400).json({ message: "Le nom et la durée maximale sont obligatoires." });
    }

    const [result] = await db.promise().query(
      'UPDATE type_conges SET nom_type_conge = ?, description = ?, duree_maximale = ? WHERE id_type_conge = ?',
      [nom_type_conge, description || '', duree_maximale, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Type de congé non trouvé." });
    }

    res.status(200).json({ message: "Type de congé modifié avec succès." });
  } catch (err) {
    console.error("Erreur lors de la modification du type de congé :", err);
    res.status(500).json({ message: "Erreur serveur lors de la modification." });
  }
});

// DELETE - Supprimer un type de congé
router.delete('/typeconge/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await db.promise().query(
      'DELETE FROM type_conges WHERE id_type_conge = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Type de congé non trouvé." });
    }

    res.status(200).json({ message: "Type de congé supprimé avec succès." });
  } catch (err) {
    console.error("Erreur lors de la suppression du type de congé :", err);
    res.status(500).json({ message: "Erreur serveur lors de la suppression." });
  }
});

// Route GET - Consulter toutes les demandes (sans pagination)
router.get('/consultedemande', (req, res) => {
  const queryDemandes = `
    SELECT c.*, u.nom AS nom_utilisateur, u.email, c.piece_jointe, c.statut_vue
    FROM conges c
    JOIN utilisateurs u ON c.utilisateur_id = u.id
    ORDER BY c.id DESC
  `;

  db.query(queryDemandes, (errDemandes, demandesResult) => {
    if (errDemandes) {
      console.error('Erreur récupération demandes :', errDemandes);
      return res.status(500).send("Erreur serveur (demandes)");
    }

    demandesResult.forEach(demande => {
      const debut = new Date(demande.date_debut);
      const fin = new Date(demande.date_fin);
      const diff = fin.getTime() - debut.getTime();
      let duree = Math.ceil(diff / (1000 * 3600 * 24)) + 1;

      if (demande.periode_journee === 'matin' || demande.periode_journee === 'soir') {
        duree = duree * 0.5;
      }

      demande.duree = duree;
      demande.reference = 'REF-' + demande.id;

      if (demande.piece_jointe) {
        demande.piece_jointe_url = `data:application/pdf;base64,${demande.piece_jointe.toString('base64')}`;
      } else {
        demande.piece_jointe_url = null;
      }
    });

    res.render('navigationadmin/consultedemande', {
      demandes: demandesResult
    });
  });
});

//actualisation automatique du rendu:
// Route GET - Consulter toutes les demandes (version API)
router.get('/consultedemande/page', (req, res) => {
  const queryDemandes = `
    SELECT c.*, u.nom AS nom_utilisateur, u.email, c.piece_jointe, c.statut_vue
    FROM conges c
    JOIN utilisateurs u ON c.utilisateur_id = u.id
    ORDER BY c.id DESC
  `;

  db.query(queryDemandes, (errDemandes, demandesResult) => {
    if (errDemandes) {
      console.error('Erreur récupération demandes :', errDemandes);
      return res.status(500).json({ error: "Erreur serveur (demandes)" });
    }

    const demandesWithDetails = demandesResult.map(demande => {
      const debut = new Date(demande.date_debut);
      const fin = new Date(demande.date_fin);
      const diff = fin.getTime() - debut.getTime();
      let duree = Math.ceil(diff / (1000 * 3600 * 24)) + 1;

      if (demande.periode_journee === 'matin' || demande.periode_journee === 'soir') {
        duree = duree * 0.5;
      }

      return {
        ...demande,
        duree,
        reference: 'REF-' + demande.id,
        piece_jointe_url: demande.piece_jointe
          ? `data:application/pdf;base64,${demande.piece_jointe.toString('base64')}`
          : null
      };
    });

    res.json({ demandes: demandesWithDetails });
  });
});


// Route POST - Marquer une demande comme vue
router.post('/marquer-comme-vu', (req, res) => {
  const { demandeId } = req.body;

  if (!demandeId) {
      return res.status(400).json({ error: "ID de demande manquant" });
  }

  const query = 'UPDATE conges SET statut_vue = TRUE WHERE id = ?';

  db.query(query, [demandeId], (err, result) => {
      if (err) {
          console.error('Erreur lors de la mise à jour du statut_vue:', err);
          return res.status(500).json({ error: "Erreur serveur lors de la mise à jour" });
      }

      if (result.affectedRows === 0) {
          return res.status(404).json({ error: "Demande non trouvée" });
      }

      res.json({ success: true, message: "Demande marquée comme vue" });
  });
});



// Route POST - Action sur une demande (approuver/refuser)
router.post('/action', async (req, res) => {
  const { demandeId, action, comment } = req.body;
  const validateur_id = req.session.userId;

  if (!demandeId || !['approuvé', 'refusé'].includes(action)) {
    return res.status(400).json({ message: "Données invalides." });
  }

  try {
    // 1. D'abord marquer la demande comme vue et traitée
    await db.promise().query(
      'UPDATE conges SET statut_vue = TRUE, traite = TRUE WHERE id = ?',
      [demandeId]
    );

    // 2. Ensuite mettre à jour le statut de la demande
    const updateQuery = 'UPDATE conges SET statut = ?, validateur_id = ?, date_validation = NOW(), commentaire = ? WHERE id = ?';
    const [result] = await db.promise().query(updateQuery, [action, validateur_id, comment, demandeId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Demande non trouvée." });
    }

    // 3. Récupérer les infos de la demande (pour notification et solde)
    const [demandeRows] = await db.promise().query(
      'SELECT utilisateur_id, type_conge, date_debut, date_fin, periode_journee FROM conges WHERE id = ?',
      [demandeId]
    );
    const demande = demandeRows[0];

    // 4. Si la demande est approuvée et type "congé payé", mise à jour du solde congé
    if (action === 'approuvé' && demande.type_conge.toLowerCase() === 'congé payé') {
      const debut = new Date(demande.date_debut);
      const fin = new Date(demande.date_fin);
      const diff = fin.getTime() - debut.getTime();
      let duree = Math.ceil(diff / (1000 * 3600 * 24)) + 1;
      if (demande.periode_journee === 'matin' || demande.periode_journee === 'soir') {
        duree = duree * 0.5;
      }

      const updateSoldeQuery = 'UPDATE utilisateurs SET solde_conges = solde_conges - ? WHERE id = ?';
      await db.promise().query(updateSoldeQuery, [duree, demande.utilisateur_id]);
    }

    // 5. Ajout de notification
    const dateDebutStr = new Date(demande.date_debut).toLocaleDateString('fr-FR');
    const dateFinStr = new Date(demande.date_fin).toLocaleDateString('fr-FR');
    const message = `Votre demande de congé de type "${demande.type_conge}" du ${dateDebutStr} au ${dateFinStr} a été ${action} par l'administrateur.`;

    await db.promise().query(
      `INSERT INTO notificationss (id_admin, id_utilisateur, message, date_creation, est_lu)
       VALUES (?, ?, ?, NOW(), 0)`,
      [validateur_id, demande.utilisateur_id, message]
    );

    res.status(200).json({ message: `Demande ${action} avec succès.` });
  } catch (err) {
    console.error("Erreur lors de l'action :", err);
    res.status(500).json({ message: "Erreur serveur lors de l'action." });
  }
});

// Route GET - Tableau de bord principal (adminbord.ejs)
router.get('/adminbord', (req, res) => {
  const statsQuery = `
    SELECT
      (SELECT COUNT(*) FROM conges WHERE statut = 'en attente') AS demandes_en_attente,
      (SELECT COUNT(DISTINCT id) FROM utilisateurs) AS employes_actifs,
      (SELECT COUNT(*) FROM conges WHERE statut = 'approuvé' AND CURDATE() BETWEEN date_debut AND date_fin) AS absences_aujourdhui,
      (SELECT COUNT(*) FROM conges
       WHERE statut = 'approuvé'
       AND EXISTS (
         SELECT 1 FROM conges c2
         WHERE c2.id != conges.id
         AND c2.statut = 'approuvé'
         AND (
           (c2.date_debut BETWEEN conges.date_debut AND conges.date_fin) OR
           (c2.date_fin BETWEEN conges.date_debut AND conges.date_fin) OR
           (conges.date_debut BETWEEN c2.date_debut AND c2.date_fin)
         )
       )) AS conges_critiques,
      (SELECT SUM(solde_conges) FROM utilisateurs) AS solde_conges_total
  `;

  db.query(statsQuery, (err, statsResult) => {
    if (err) {
      console.error('Erreur stats dashboard :', err);
      return res.status(500).send("Erreur serveur");
    }

    const stats = statsResult[0];

    res.render('navigationadmin/adminbord', {
      demandes_en_attente: stats.demandes_en_attente || 0,
      employes_actifs: stats.employes_actifs || 0,
      absences_aujourdhui: stats.absences_aujourdhui || 0,
      conges_critiques: stats.conges_critiques || 0,
      solde_conges_total: stats.solde_conges_total || 0
    });
  });
});

// Route GET - Statistiques (statadmin.ejs)
router.get('/statadmin', (req, res) => {
  const statsQuery = `
      SELECT
          (SELECT COUNT(*) FROM conges WHERE statut = 'en attente') AS demandes_en_attente,
          (SELECT COUNT(DISTINCT utilisateur_id) FROM conges) AS employes_actifs,
          (SELECT COUNT(*) FROM conges WHERE statut = 'approuvé' AND CURDATE() BETWEEN date_debut AND date_fin) AS absences_aujourdhui,
          (SELECT COUNT(DISTINCT utilisateur_id) FROM conges WHERE statut = 'approuvé' AND date_debut <= CURDATE() AND date_fin >= CURDATE()) AS conges_critiques
  `;

  const repartitionQuery = `
      SELECT type_conge, COUNT(*) AS total
      FROM conges
      GROUP BY type_conge
  `;

  const histogramQuery = `
      SELECT MONTH(date_demande) AS mois, COUNT(*) AS total
      FROM conges
      WHERE YEAR(date_demande) = YEAR(CURDATE())
      GROUP BY mois
      ORDER BY mois
  `;

  db.query(statsQuery, (err, statsResult) => {
    if (err) {
      console.error('Erreur stats dashboard :', err);
      return res.status(500).json({ error: 'Erreur stats dashboard' });
    }

    db.query(repartitionQuery, (err2, repartitionResult) => {
      if (err2) {
        console.error('Erreur repartition :', err2);
        return res.status(500).json({ error: 'Erreur repartition' });
      }

      db.query(histogramQuery, (err3, histogramResult) => {
        if (err3) {
          console.error('Erreur histogramme :', err3);
          return res.status(500).json({ error: 'Erreur histogramme' });
        }

        const stats = statsResult[0];
        const repartition = {};
        let totalConges = 0;
        repartitionResult.forEach(r => totalConges += r.total);
        repartitionResult.forEach(r => {
          repartition[r.type_conge] = {
            count: r.total,
            percent: totalConges ? Math.round((r.total / totalConges) * 100) : 0
          };
        });

        // Pour le camembert
        const camembertLabels = repartitionResult.map(r => r.type_conge);
        const camembertData = repartitionResult.map(r => r.total);

        // Pour l'histogramme
        const histogramLabels = Array.from({ length: 12 }, (_, i) =>
          new Date(0, i).toLocaleString('fr', { month: 'short' })
        );
        const histogramData = Array(12).fill(0);
        histogramResult.forEach(row => {
          histogramData[row.mois - 1] = row.total;
        });

        res.render('navigationadmin/statadmin', {
          demandes_en_attente: stats.demandes_en_attente,
          employes_actifs: stats.employes_actifs,
          absences_aujourdhui: stats.absences_aujourdhui,
          conges_critiques: stats.conges_critiques,
          repartition_conges: repartition,
          camembertLabels,
          camembertData,
          histogramLabels,
          histogramData
        });
      });
    });
  });
});

// Route GET - Afficher la liste des utilisateurs avec pagination
router.get('/gestionsolde', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = 10;
  const offset = (page - 1) * limit;

  const queryCount = 'SELECT COUNT(*) as total FROM utilisateurs';
  const queryUtilisateurs = `
    SELECT id, nom, email, solde_conges
    FROM utilisateurs
    ORDER BY nom ASC
    LIMIT ? OFFSET ?
  `;

  db.query(queryCount, (errCount, countResult) => {
    if (errCount) {
      console.error('Erreur comptage utilisateurs :', errCount);
      return res.status(500).send("Erreur serveur (count)");
    }

    const totalUtilisateurs = countResult[0].total;
    const totalPages = Math.ceil(totalUtilisateurs / limit);

    db.query(queryUtilisateurs, [limit, offset], (errUtilisateurs, utilisateursResult) => {
      if (errUtilisateurs) {
        console.error('Erreur récupération utilisateurs :', errUtilisateurs);
        return res.status(500).send("Erreur serveur (utilisateurs)");
      }

      res.render('navigationadmin/gestionsolde', {
        utilisateurs: utilisateursResult,
        pagination: {
          currentPage: page,
          totalPages: totalPages,
          totalItems: totalUtilisateurs,
          startItem: offset + 1,
          endItem: Math.min(offset + limit, totalUtilisateurs)
        },
        demandes_en_attente: 0 // À remplacer par le nombre réel de demandes en attente
      });
    });
  });
});

// Route POST - Modifier le solde des congés
router.post('/modifyLeaveBalance', (req, res) => {
  const { newLeaveBalance, userId } = req.body;

  if (newLeaveBalance === undefined || userId === undefined) {
    return res.status(400).json({ message: "Données invalides." });
  }

  const updateQuery = 'UPDATE utilisateurs SET solde_conges = ? WHERE id = ?';

  db.query(updateQuery, [newLeaveBalance, userId], (err, result) => {
    if (err) {
      console.error("Erreur mise à jour solde congés :", err);
      return res.status(500).json({ message: "Erreur lors de la mise à jour du solde des congés." });
    }

    res.status(200).json({ message: "Solde des congés mis à jour avec succès." });
  });
});

// Route GET - Page des notifications (toutes les notifications)
router.get('/notificationadmin', async (req, res) => {
  try {
    const [notificationsResult] = await db.promise().query(
      `SELECT n.id, n.message, n.date_creation, n.est_lu, u.nom
      FROM notifications n
      JOIN utilisateurs u ON n.id_utilisateur = u.id
      WHERE u.role = 'employé'
      ORDER BY n.date_creation DESC`
    );

    res.render('navigationadmin/notificationadmin', {
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
      'UPDATE notifications SET est_lu = 1 WHERE id = ?',
      [notificationId]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Erreur mark-read:', err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

router.get('/get-notifications-count', (req, res) => {
  const sql = "SELECT COUNT(*) AS notificationCount FROM notifications WHERE est_lu = false";
  db.query(sql, (err, result) => {
    if (err) {
      console.error('Erreur MySQL :', err);
      return res.status(500).json({ error: 'Erreur serveur' });
    }
    res.json({ notificationCount: result[0].notificationCount });
  });
});

// Supprimer notification (ADMIN)
router.delete('/notifications/delete/:id', async (req, res) => {
  try {
    const notificationId = req.params.id;

    await db.promise().query(
      'DELETE FROM notifications WHERE id = ?',
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
    const sql = `DELETE FROM notifications WHERE id IN (${placeholders})`;

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



// Route pour obtenir les comptes de demandes
router.get('/get-demandes-count', (req, res) => {
  const query = `
      SELECT
          COUNT(CASE WHEN statut_vue = FALSE THEN 1 END) AS newDemandesCount,
          COUNT(CASE WHEN statut = 'en attente' THEN 1 END) AS pendingCount
      FROM conges
  `;

  db.query(query, (err, results) => {
      if (err) {
          console.error('Erreur lors de la récupération des comptes:', err);
          return res.status(500).json({ error: "Erreur serveur" });
      }

      res.json({
          newDemandesCount: results[0].newDemandesCount,
          pendingCount: results[0].pendingCount
      });
  });
});

module.exports = router;
