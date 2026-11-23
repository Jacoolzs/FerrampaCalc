import { formatDOP } from './calculos.js';

let history = [];

export function getHistory() {
    return history;
}

export function initHistory(onLoadItem) {
    const savedHistory = localStorage.getItem('importcalc_history');
    if (savedHistory) {
        try { 
            history = JSON.parse(savedHistory); 
            renderHistory(onLoadItem); 
        } catch(e) { 
            history = []; 
        }
    }
}

export function saveToHistory(total, vehicleCount, vehicles) {
    const entry = {
        id: Date.now(),
        date: new Date().toLocaleString(),
        total: total,
        count: vehicleCount,
        vehicles: JSON.parse(JSON.stringify(vehicles))
    };
    history.unshift(entry);
    if (history.length > 10) history.pop();
    localStorage.setItem('importcalc_history', JSON.stringify(history));
    renderHistory();
}

export function renderHistory() {
    const container = document.getElementById('history-container');
    if (!container) return;
    
    if (history.length === 0) {
        container.innerHTML = '<p class="text-slate-600 dark:text-slate-300">Aún no hay cálculos guardados.</p>';
        return;
    }

    container.innerHTML = history.map(item => `
        <div class="history-item">
            <button type="button" class="history-open" onclick="window.loadFromHistory(${item.id})" aria-label="Recuperar cálculo de ${formatDOP(item.total)} del ${item.date}">
                <small>${item.date} · ${item.count} ${item.count === 1 ? 'vehículo' : 'vehículos'}</small>
                <strong>${formatDOP(item.total)}</strong>
            </button>
            <button type="button" onclick="window.deleteHistoryItem(${item.id})" class="icon-btn icon-btn--danger" aria-label="Eliminar cálculo de ${formatDOP(item.total)}">
                <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
        </div>
    `).join('');
}

export function deleteHistoryItem(id) {
    history = history.filter(h => h.id !== id);
    localStorage.setItem('importcalc_history', JSON.stringify(history));
    renderHistory();
}

export function clearHistory() {
    if (confirm('¿Seguro que deseas limpiar todo el historial?')) {
        history = [];
        localStorage.removeItem('importcalc_history');
        renderHistory();
    }
}
