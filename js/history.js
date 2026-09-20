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
        container.innerHTML = '<p class="text-[10px] text-slate-400 italic text-center py-4">No hay cálculos recientes.</p>';
        return;
    }

    container.innerHTML = history.map(item => `
        <div class="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700 flex justify-between items-center group">
            <div class="cursor-pointer flex-1" onclick="window.loadFromHistory(${item.id})">
                <p class="text-[9px] font-bold text-slate-400 uppercase leading-none mb-1">${item.date}</p>
                <div class="flex items-center gap-2">
                    <span class="text-xs font-black text-slate-700 dark:text-slate-200">${formatDOP(item.total)}</span>
                    <span class="text-[8px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full font-bold">${item.count} Veh.</span>
                </div>
            </div>
            <button onclick="window.deleteHistoryItem(${item.id})" class="opacity-0 group-hover:opacity-100 p-1.5 text-slate-300 hover:text-red-500 transition-all">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
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
