const navLinks = document.querySelectorAll('.nav-links a');
const mainContent = document.querySelector('.main-content');

function animateMainContent() {
    // Éviter d'empiler les classes si déjà en animation
    if (mainContent.classList.contains('animating')) return;

    mainContent.classList.add('animating', 'animate');

    // Supprimer l'animation après la fin pour la réutiliser proprement
    setTimeout(() => {
        mainContent.classList.remove('animate');
        mainContent.classList.remove('animating');
    }, 700); // correspond à la durée de l'animation CSS
}

navLinks.forEach(link => {
    link.addEventListener('click', e => {
        animateMainContent();
    });
});
