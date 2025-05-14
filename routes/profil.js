// routes/profil.js
const express = require('express');
const router = express.Router();
const db = require('../db'); // Assure-toi que ce chemin est correct

// Middleware pour vérifier si l'utilisateur est connecté
function isAuthenticated(req, res, next) {
  if (req.session.userId) {
    next();
  } else {
    res.status(401).send("Vous devez être connecté pour accéder à cette page.");
  }
}

// Route GET - Affichage du profil utilisateur
router.get('/pro', isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.userId;
    const [result] = await db.promise().query(
      'SELECT nom, email, poste, role, solde_conges FROM utilisateurs WHERE id = ?',
      [userId]
    );

    if (result.length === 0) {
      return res.status(404).send("Utilisateur non trouvé");
    }

    res.render('profil', { user: result[0] });
  } catch (err) {
    console.error('Erreur récupération profil :', err);
    res.status(500).send("Erreur serveur");
  }
});

module.exports = router;
