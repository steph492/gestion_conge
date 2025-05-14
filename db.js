// db.js
const mysql = require('mysql2');

// Crée une connexion MySQL
const db = mysql.createConnection({
  host: '127.0.0.1',
  user: 'root',
  password: '', // Mettez ici votre mot de passe MySQL
  database: 'gestion_conge', // Nom de votre base de données
  port: 3306 // Port par défaut de MySQL
});

// Connexion à la base de données
db.connect((err) => {
  if (err) {
    return console.error('Erreur de connexion à MySQL :', err.stack);
  }
  console.log('Connecté à la base de données MySQL.');
});

module.exports = db;
