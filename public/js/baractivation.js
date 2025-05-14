
  document.addEventListener("DOMContentLoaded", function () {
    const currentPath = window.location.pathname;
    const navItems = document.querySelectorAll('.nav-links li');

    navItems.forEach(li => {
      const link = li.querySelector('a');
      if (link && link.getAttribute('href') === currentPath) {
        li.classList.add('active-li');
      }
    });
  });

