/**
 * Gestor universal de consentimiento de cookies (GDPR / ePrivacy / Google TCF v2.2)
 * Persiste la decisión en localStorage para no molestar repetidamente al usuario.
 */
(function initCookieBanner() {
    const CONSENT_KEY = 'ferrampa_cookie_consent';
    
    // Si el usuario ya tomó una decisión, no mostrar el banner
    if (localStorage.getItem(CONSENT_KEY)) {
        return;
    }

    function renderBanner() {
        // Evitar duplicados
        if (document.getElementById('cookie-consent-banner')) return;

        const banner = document.createElement('div');
        banner.id = 'cookie-consent-banner';
        banner.className = 'fixed bottom-4 left-4 right-4 md:left-8 md:right-8 md:max-w-4xl md:mx-auto bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 p-5 rounded-3xl shadow-2xl z-[99999] transition-all transform duration-300 translate-y-0 text-left';
        
        banner.innerHTML = `
            <div class="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div class="flex items-start gap-3">
                    <span class="text-2xl flex-shrink-0">🍪</span>
                    <div class="space-y-1">
                        <h4 class="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">Aviso de Privacidad y Cookies</h4>
                        <p class="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                            Utilizamos almacenamiento local técnico y cookies analíticas y de publicidad (Google AdSense) para ofrecerle la calculadora de impuestos y anuncios personalizados. Consulte nuestra 
                            <a href="cookies.html" class="text-blue-600 dark:text-blue-400 underline font-bold hover:text-blue-700">Política de Cookies</a> y 
                            <a href="privacidad.html" class="text-blue-600 dark:text-blue-400 underline font-bold hover:text-blue-700">Privacidad</a>.
                        </p>
                    </div>
                </div>
                <div class="flex items-center gap-2 w-full md:w-auto flex-shrink-0 justify-end">
                    <button id="btn-cookie-reject" class="w-1/2 md:w-auto px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-bold uppercase tracking-wider transition-colors">
                        Solo Esenciales
                    </button>
                    <button id="btn-cookie-accept" class="w-1/2 md:w-auto px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-black uppercase tracking-wider shadow-lg shadow-blue-500/20 transition-all hover:scale-105 active:scale-95">
                        Aceptar Todas
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(banner);

        document.getElementById('btn-cookie-accept').addEventListener('click', () => {
            localStorage.setItem(CONSENT_KEY, 'all');
            banner.remove();
        });

        document.getElementById('btn-cookie-reject').addEventListener('click', () => {
            localStorage.setItem(CONSENT_KEY, 'essential');
            banner.remove();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', renderBanner);
    } else {
        renderBanner();
    }
})();
