const express = require('express');
const path = require('path');
const session = require('express-session');
const bodyParser = require('body-parser');
const cron = require('node-cron');
const db = require('./db');

const loginRoutes = require('./routes/login');
const deconnexionRoute = require('./routes/deconnexion');
const profilRoutes = require('./routes/profil');
const navigationUserRoutes = require('./routes/navigationuser');
const navigationAdminRoutes = require('./routes/navigationadmin');

const app = express();

// Middleware de session
app.use(session({
    secret: 'votre_clé_secrète',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // mettre true si HTTPS
}));

// Moteur de templates
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware de parsing
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

// Fichiers statiques
app.use(express.static(path.join(__dirname, 'public')));

// Redirection page d'accueil
app.get('/', (req, res) => {
    res.redirect('/login');
});

// Authentification
app.get('/login', (req, res) => {
    res.render('login'); // login.ejs
});
app.use('/login', loginRoutes);
app.use('/deconnexion', deconnexionRoute);

// Pages principales après connexion
app.get('/admin', (req, res) => {
    res.render('admin'); // admin.ejs
});
app.get('/user', (req, res) => {
    res.render('user'); // user.ejs
});

// Routes navigation utilisateur
app.use('/navigationuser', navigationUserRoutes);
//Routes navigation administrateur
app.use('/navigationadmin', navigationAdminRoutes);

// Nouvelle route profil
app.use('/profil', profilRoutes);
//app.use('/calendrierconge', navigationAdminRoutes);

// IMPORTANT : /gestiondemande doit aussi utiliser navigationUserRoutes
app.use('/gestiondemande', navigationUserRoutes);

app.get('/adminbord', (req, res) => {
    res.render('navigationadmin/adminbord');
});

// Gestion des erreurs 404
app.use((req, res) => {
    res.status(404).send("Page non trouvée");
});

// Middleware pour loguer les erreurs en dev (optionnel)
app.use((err, req, res, next) => {
    console.error("Erreur serveur :", err.stack);
    res.status(500).send("Erreur interne du serveur");
});

// Importer et exécuter le script de mise à jour du solde utilisable
require('./updateSolde');

// Démarrer le serveur
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ Serveur en cours d'exécution sur http://localhost:${PORT}`);
});
