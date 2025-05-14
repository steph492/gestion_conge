const toggleBtn = document.getElementById('menu-toggle');
    const sidebar = document.getElementById('sidebar');
    const appName = document.querySelector('.app-name');

    toggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('active');
      appName.classList.toggle('hidden');
    });