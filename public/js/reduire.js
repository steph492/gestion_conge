const toggleBt = document.getElementById('toggleSolde');
const toggleIco = document.getElementById('toggleIcon');
const soldeConten = document.getElementById('soldeContent');

toggleBt.addEventListener('click', () => {
    soldeConten.classList.toggle('collapsed');
    toggleIco.classList.toggle('fa-chevron-up');
    toggleIco.classList.toggle('fa-chevron-down');
});