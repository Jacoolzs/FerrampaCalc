import { initApp } from './ui.js';

// En módulos, el código ya se ejecuta después de que el DOM está listo por defecto,
// pero usar el evento es una buena práctica.
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
