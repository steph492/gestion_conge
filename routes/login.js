const express = require('express');
const router = express.Router();
const db = require('../db');
const { v4: uuidv4 } = require('uuid');

router.post('/', async (req, res) => {
  const { email, mot_de_passe, role } = req.body;

  if (!email || !mot_de_passe || !role) {
    return res.status(400).send("Veuillez remplir tous les champs.");
  }

  try {
    const [results] = await db.promise().query('SELECT * FROM utilisateurs WHERE email = ?', [email]);

    if (results.length === 0) {
      return res.status(401).send("Utilisateur non trouvé.");
    }

    const user = results[0];

    if (mot_de_passe === user.mot_de_passe && role === user.role) {
      // Générer un ID de session unique
      const sessionId = uuidv4();

      // Stocker l'ID de l'utilisateur et l'ID de session dans la session
      req.session.userId = user.id;
      req.session.sessionId = sessionId; // Stocker l'ID de session
      req.session.role = user.role;

      return res.send("Connexion réussie");
    } else {
      return res.status(401).send("Informations d'identification incorrectes.");
    }
  } catch (err) {
    console.error("Erreur lors de la requête SQL :", err);
    return res.status(500).send("Erreur serveur.");
  }
});

module.exports = router;
