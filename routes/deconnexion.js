const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  // Détruire la session
  req.session.destroy((err) => {
    if (err) {
      console.error("Erreur lors de la destruction de la session :", err);
      return res.status(500).send("Erreur serveur.");
    }
    // Rediriger vers la page de connexion ou une autre page après la déconnexion
    res.redirect('/'); // Remplacez '/' par la route de votre page de connexion si nécessaire
  });
});

module.exports = router;
