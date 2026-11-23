/** Comportamiento común del sitio: tema, menú móvil y botón para volver arriba. */
(function () {
    const root = document.documentElement;

    const themeBtn = document.getElementById('theme-toggle');
    const syncTheme = () => themeBtn?.setAttribute('aria-pressed', String(root.classList.contains('dark')));
    themeBtn?.addEventListener('click', () => {
        const dark = root.classList.toggle('dark');
        try { localStorage.setItem('dark_mode', dark); } catch (e) { /* almacenamiento no disponible */ }
        syncTheme();
    });
    syncTheme();

    const menuBtn = document.getElementById('menu-toggle');
    const menu = document.getElementById('mobile-menu');
    const setMenu = (open) => {
        menu.hidden = !open;
        menuBtn.setAttribute('aria-expanded', String(open));
        menuBtn.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
    };
    if (menuBtn && menu) {
        menuBtn.addEventListener('click', () => setMenu(menu.hidden));
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !menu.hidden) { setMenu(false); menuBtn.focus(); }
        });
    }

    const top = document.getElementById('back-top');
    if (top) {
        const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const update = () => { top.hidden = window.scrollY < 600; };
        window.addEventListener('scroll', update, { passive: true });
        top.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'auto' });
            document.getElementById('contenido')?.focus({ preventScroll: true });
        });
        update();
    }
})();
