import { CURRENT_YEAR, IMPORT_LIMIT_YEAR } from './constants.js';
import { calcularImpuestosIndividual, formatDOP } from './calculos.js';

let vehicles = [];
let nextId = 1;
let saveTimeout = null;
let totalChart = null;
let history = [];

// ─── Chart Management ───────────────────────────────────────────────────────
export function updateChart(data) {
    const ctx = document.getElementById('totalChart')?.getContext('2d');
    if (!ctx) return;

    const chartData = {
        labels: ['Arancel', 'ITBIS', 'Placa', 'Servicio'],
        datasets: [{
            data: [data.arancel, data.itbis, data.placa, data.servicio],
            backgroundColor: ['#3b82f6', '#64748b', '#60a5fa', '#94a3b8'],
            borderWidth: 0,
            hoverOffset: 4
        }]
    };

    if (totalChart) {
        totalChart.data = chartData;
        totalChart.update();
    } else {
        totalChart = new Chart(ctx, {
            type: 'doughnut',
            data: chartData,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (context) => ` ${context.label}: ${formatDOP(context.raw)}`
                        }
                    }
                },
                cutout: '70%'
            }
        });
    }
}

// ─── History Management ─────────────────────────────────────────────────────
export function saveToHistory(total, vehicleCount) {
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

export function loadFromHistory(id) {
    const entry = history.find(h => h.id === id);
    if (!entry) return;
    vehicles = JSON.parse(JSON.stringify(entry.vehicles));
    renderVehicles();
    showToast('Cálculo recuperado del historial', 'success');
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

// ─── Contact Form (AJAX con FormSubmit) ──────────────────────────────────────
export async function handleContactSubmit(form) {
    const btn = form.querySelector('button');
    const origText = btn.innerText;
    
    const name = form.querySelector('[name="name"]').value;
    const email = form.querySelector('[name="email"]').value;
    const message = form.querySelector('[name="message"]').value;

    btn.disabled = true;
    btn.innerText = 'ENVIANDO...';

    try {
        const response = await fetch("https://formsubmit.co/ajax/info.aduanasenlinea@gmail.com", {
            method: "POST",
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                name: name,
                email: email,
                message: message,
                _subject: `Nueva consulta de ImportCalc Pro: ${name}`
            })
        });

        const result = await response.json();

        if (response.ok) {
            showToast('¡Mensaje enviado con éxito! Nos contactaremos pronto.', 'success');
            form.reset();
        } else {
            throw new Error('Error en la respuesta del servidor');
        }
    } catch (error) {
        console.error("Error envío formulario:", error);
        showToast('Hubo un error al enviar. Por favor, intente más tarde.', 'error');
    } finally {
        btn.disabled = false;
        btn.innerText = origText;
    }
}

export function printPage() { window.print(); }

// ─── Toast helper ───────────────────────────────────────────────────────────
let toastTimer = null;
export function showToast(msg, type = 'info') {
    const icons = { success: '✓', error: '✕', info: 'ℹ', warning: '⚠' };
    const t = document.getElementById('toast');
    if (!t) return;
    t.className = `toast ${type}`;
    t.innerHTML = `<span style="font-size:16px">${icons[type] ?? 'ℹ'}</span> ${msg}`;
    void t.offsetWidth; // Force reflow
    t.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 3500);
}

// ─── Navigation ─────────────────────────────────────────────────────────────
export function navigateTo(pageId) {
    const views = ['view-home', 'view-blog-guia', 'view-blog-subastas', 'view-blog-ley', 'view-contacto', 'view-guia'];
    const target = `view-${pageId}`;
    views.forEach(v => {
        const el = document.getElementById(v);
        if (el) v === target ? el.classList.remove('hidden') : el.classList.add('hidden');
    });
    const navInfo = document.getElementById('nav-info-calc');
    if (navInfo) pageId === 'home' ? navInfo.classList.remove('hidden') : navInfo.classList.add('hidden');
    window.scrollTo(0, 0);
}

// ─── Persistence ─────────────────────────────────────────────────────────────
export function saveData() {
    const data = {
        vehicles, nextId,
        tasa: parseFloat(document.getElementById('global-tasa')?.value || 60),
        entidad: document.getElementById('entidad')?.value || 'fisica',
        isShared: document.getElementById('check-shared')?.checked || false,
        gSeguro: parseFloat(document.getElementById('g-seguro')?.value || 100),
        gFlete: parseFloat(document.getElementById('g-flete')?.value || 1200),
        gOtros: parseFloat(document.getElementById('g-otros')?.value || 0),
    };
    localStorage.setItem('importcalc_data', JSON.stringify(data));
    const stat = document.getElementById('save-status');
    if (stat) { stat.style.opacity = '1'; setTimeout(() => stat.style.opacity = '0', 2000); }
}

export function debouncedSave() {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(saveData, 1000);
}

export function toggleSharedPanel(shouldSave = true) {
    const el = document.getElementById('check-shared');
    if (!el) return;
    const p = document.getElementById('panel-shared-costs');
    if (p) p.style.display = el.checked ? 'block' : 'none';
    renderVehicles();
    if (shouldSave) debouncedSave();
}

// ─── Vehicle state ───────────────────────────────────────────────────────────
export function addVehicle() {
    const newV = {
        id: nextId++, vin: "", name: "Nuevo Vehículo",
        year: CURRENT_YEAR, fob: 5000, origen: 'cafta',
        engineType: 'gas', placaPct: 0.17, co2Pct: 0.00,
        seguro: 100, flete: 1200, otros: 0, results: {},
    };
    vehicles.push(newV);
    renderVehicles();
    debouncedSave();
}

export function removeVehicle(id) {
    if (vehicles.length === 1) return;
    vehicles = vehicles.filter(v => v.id !== id);
    renderVehicles();
    debouncedSave();
}

// ─── VIN decode (Robustez y Soporte Multiregión) ────────────────────────────
export async function decodeVIN(vId) {
    const v = vehicles.find(x => x.id === vId);
    if (!v || !v.vin || v.vin.length < 17) return;

    const btn = document.getElementById(`btn-vin-${vId}`);
    if (!btn) return;

    const orig = btn.innerHTML;
    btn.innerHTML = `<span class="animate-spin inline-block w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full"></span>`;
    btn.disabled = true;

    // Lógica Pre-API: Identificar origen por el primer dígito del VIN
    const firstDigit = v.vin.charAt(0).toUpperCase();
    
    // Prefijos que califican para Tratado (0% Arancel sugerido):
    // 1,4,5 = USA | 2 = Canadá | 3 = México | W = Alemania | S = UK | V = Francia/España | Z = Italia | Y = Suecia
    const isCaftaUePrefix = ['1','2','3','4','5','W','S','V','Z','Y'].includes(firstDigit);
    
    // Prefijos de Asia (Suelen pagar 20% / 10%): J = Japón | K = Corea | L = China
    const isAsianPrefix = ['J', 'K', 'L'].includes(firstDigit);

    // Aplicar pre-selección de origen basada en el VIN (Mejora: Automático por Tratado)
    if (isCaftaUePrefix) {
        v.origen = 'cafta'; // EEUU / UE / CAFTA
    } else if (isAsianPrefix) {
        v.origen = 'otros';
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        const response = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${v.vin}?format=json`, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        const res = data.Results?.[0];

        if (res && res.Make && res.Make.trim() !== '' && res.ModelYear) {
            v.name = `${res.Make} ${res.Model}`.trim();
            v.year = parseInt(res.ModelYear) || CURRENT_YEAR;
            
            const fuel = (res.FuelTypePrimary || '').toLowerCase();
            v.engineType = (fuel.includes('electric') || fuel.includes('hybrid')) ? 'hybrid_electric' : 'gas';
            
            // Validación final con la respuesta de la API (si está disponible)
            const plantCountry = (res.PlantCountry || '').toUpperCase();
            const caftaCountries = ['UNITED STATES (USA)', 'MEXICO', 'CANADA', 'GERMANY', 'SPAIN', 'FRANCE', 'ITALY', 'BELGIUM', 'GUATEMALA', 'HONDURAS', 'EL SALVADOR', 'NICARAGUA', 'COSTA RICA', 'UNITED KINGDOM (UK)', 'SWEDEN'];
            v.origen = caftaCountries.includes(plantCountry) ? 'cafta' : v.origen;

            renderVehicles();
            debouncedSave();
            showToast(`VIN Decodificado: ${v.name} (${v.year})`, 'success');
        } else {
            // Caso: API no lo conoce (Europa/Japón), pero ya pre-seleccionamos el origen arriba
            renderVehicles();
            debouncedSave();
            let msg = 'VIN no reconocido por base de datos USA.';
            if (isAsianPrefix) msg += ' (Vehículo de origen Asiático).';
            if (isCaftaUePrefix) msg += ' (Vehículo Europeo/Norteamericano detectado).';
            showToast(`${msg} Complete marca y año manualmente.`, 'warning');
            highlightManualFields(vId);
        }
    } catch (err) {
        renderVehicles();
        showToast('Error de conexión. Se aplicó origen sugerido por VIN, rellene el resto.', 'error');
        highlightManualFields(vId);
    } finally {
        btn.innerHTML = orig;
        btn.disabled = false;
    }
}

// Resalta visualmente los campos que requieren atención manual
function highlightManualFields(vId) {
    const fields = [`badge-year-${vId}`, `btn-vin-${vId}`]; // Podríamos añadir más si fuera necesario
    // Animamos los selects para que el usuario sepa qué rellenar
    const container = document.getElementById('vehicles-container');
    if (container) {
        const selects = container.querySelectorAll('select, input[type="number"]');
        selects.forEach(el => {
            if (el.closest('.vehicle-card')?.innerHTML.includes(`updateVehicleData(${vId}`)) {
                el.classList.add('ring-2', 'ring-blue-400', 'animate-pulse');
                setTimeout(() => el.classList.remove('ring-2', 'ring-blue-400', 'animate-pulse'), 4000);
            }
        });
    }
}

// ─── Tasa de Cambio Automática ──────────────────────────────────────────────
export async function toggleAutoTasa() {
    const isAuto = document.getElementById('check-auto-tasa').checked;
    const tasaInput = document.getElementById('global-tasa');

    if (isAuto) {
        tasaInput.disabled = true;
        tasaInput.classList.add('opacity-50');
        showToast('Obteniendo tasa actual...', 'info');

        try {
            // Usamos una API gratuita confiable para la tasa USD/DOP
            const response = await fetch('https://open.er-api.com/v6/latest/USD');
            const data = await response.json();
            
            if (data && data.rates && data.rates.DOP) {
                // El Banco Central suele estar 0.5 - 1.0 por encima de las APIs globales (tasa venta)
                // Ajustamos ligeramente para reflejar la realidad del mercado dominicano
                const marketRate = (data.rates.DOP + 0.85).toFixed(2);
                tasaInput.value = marketRate;
                showToast(`Tasa actualizada: RD$ ${marketRate}`, 'success');
                calculateAll();
            } else {
                throw new Error('Formato de datos inválido');
            }
        } catch (error) {
            console.error('Error tasa:', error);
            showToast('No se pudo obtener la tasa. Ingrese manualmente.', 'error');
            document.getElementById('check-auto-tasa').checked = false;
            tasaInput.disabled = false;
            tasaInput.classList.remove('opacity-50');
        }
    } else {
        tasaInput.disabled = false;
        tasaInput.classList.remove('opacity-50');
    }
}
export function updateVehicleData(id, field, value) {
    const v = vehicles.find(v => v.id === id);
    if (!v) return;

    if (field === 'year') {
        v.year = parseInt(value) || 0;
        const b = document.getElementById(`badge-year-${id}`);
        if (b) {
            const ok = v.year >= IMPORT_LIMIT_YEAR;
            b.innerText = ok ? 'OK' : 'No Permitido';
            b.className = `px-2 py-2 rounded-xl text-[8px] font-black uppercase text-center ${ok ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700 animate-pulse'}`;
        }
    } else if (field === 'engineType') {
        v.engineType = value;
        renderVehicles(); // Estructura cambia, requiere render total
        return;
    } else if (['fob', 'seguro', 'flete', 'otros', 'co2Pct'].includes(field)) {
        v[field] = parseFloat(value) || 0;
    } else {
        v[field] = value;
        if (field === 'vin') {
            const b = document.getElementById(`btn-vin-${id}`);
            if (b) value.length >= 11 ? b.classList.remove('hidden') : b.classList.add('hidden');
        }
    }
    calculateAll(); // Solo actualiza nodos de texto
    debouncedSave();
}

export function renderVehicles() {
    const container = document.getElementById('vehicles-container');
    const sh = document.getElementById('check-shared')?.checked;
    if (!container) return;
    container.innerHTML = '';

    if (vehicles.length === 0) {
        document.getElementById('empty-state').classList.remove('hidden');
    } else {
        document.getElementById('empty-state').classList.add('hidden');
        vehicles.forEach((v, index) => {
            const isOk = v.year >= IMPORT_LIMIT_YEAR;
            const card = document.createElement('div');
            card.className = 'vehicle-card glass-card p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm transition-all text-left relative';

            // FIX 2: "otros" por vehículo cuando shared is OFF
            const perVehicleCosts = !sh ? `
                <div class="grid grid-cols-3 gap-2 p-2 bg-slate-50 dark:bg-slate-800/50 rounded-2xl text-left">
                    <div><label class="text-[9px] font-bold text-slate-400">Seguro (USD)</label><input type="number" value="${v.seguro}" oninput="window.updateVehicleData(${v.id}, 'seguro', this.value)" class="w-full p-1.5 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-lg text-[11px] text-left"></div>
                    <div><label class="text-[9px] font-bold text-slate-400">Flete (USD)</label><input type="number" value="${v.flete}" oninput="window.updateVehicleData(${v.id}, 'flete', this.value)" class="w-full p-1.5 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-lg text-[11px] text-left"></div>
                    <div><label class="text-[9px] font-bold text-slate-400">Otros (USD)</label><input type="number" value="${v.otros}" oninput="window.updateVehicleData(${v.id}, 'otros', this.value)" class="w-full p-1.5 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-lg text-[11px] text-left"></div>
                </div>` : '';

            card.innerHTML = `
                <div class="flex justify-between items-center mb-4">
                    <div class="flex items-center gap-2 w-full text-left"><span class="bg-blue-600 text-white font-black px-2 py-1 rounded-md text-[9px] uppercase">V#${index + 1}</span><input type="text" value="${v.name}" oninput="window.updateVehicleData(${v.id}, 'name', this.value)" class="w-full bg-transparent border-b border-transparent hover:border-slate-200 dark:hover:border-slate-700 focus:border-blue-500 outline-none font-bold text-slate-700 dark:text-slate-200 py-1 text-sm text-left"></div>
                    <div class="flex items-center gap-1">
                        <button onclick="window.exportSinglePDF(${v.id})" class="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg></button>
                        <button onclick="window.removeVehicle(${v.id})" class="p-2 text-slate-300 hover:text-red-500 rounded-lg"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>
                    </div>
                </div>
                <div class="mb-6"><div class="flex items-center justify-between mb-1"><label class="block text-[10px] font-bold text-slate-400 uppercase">VIN NUMBER (OPCIONAL)</label><button onclick="document.getElementById('tip-vin-info-${v.id}').classList.toggle('hidden')" class="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black hover:bg-blue-600 hover:text-white transition-all shadow-sm">?</button></div><div class="flex gap-2 relative"><input type="text" value="${v.vin}" maxlength="17" oninput="window.updateVehicleData(${v.id}, 'vin', this.value.toUpperCase())" class="flex-1 p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-[11px] outline-none uppercase focus:ring-1 focus:ring-blue-500"><button id="btn-vin-${v.id}" onclick="window.decodeVIN(${v.id})" class="${v.vin.length < 11 ? 'hidden' : ''} bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-2 rounded-xl border border-blue-100 dark:border-blue-800 font-bold text-[9px]">AUTO</button><div id="tip-vin-info-${v.id}" class="hidden mt-10 p-3 bg-blue-800 text-white rounded-xl text-[10px] leading-relaxed shadow-xl absolute z-[50] w-full border border-blue-400 text-left"><p class="font-bold mb-1 underline">Ayuda VIN:</p><p class="text-left">• Rellena: <span class="font-bold">País, Motor, Año y Arancel sugerido</span>.</p><p class="text-left">• <span class="text-amber-300 font-bold">No rellena</span>: Valor FOB ni Emisión CO2.</p><p class="mt-1 opacity-90 italic">Verifique que el nombre, motor y origen sean correctos.</p></div></div></div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="space-y-4">
                        <div class="flex gap-4"><div class="flex-1"><label class="block text-[10px] font-bold text-slate-400 uppercase">Año</label><input type="number" value="${v.year}" oninput="window.updateVehicleData(${v.id}, 'year', this.value)" class="w-full p-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl font-bold text-xs text-left"></div><div class="flex-1 self-end"><div id="badge-year-${v.id}" class="px-2 py-2 rounded-xl text-[8px] font-black uppercase text-center ${isOk ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 animate-pulse'}">${isOk ? 'OK' : 'No Permitido'}</div></div></div>
                        <div class="text-left"><label class="block text-[10px] font-bold text-slate-400 mb-1 uppercase">FOB (USD)</label><input type="number" value="${v.fob}" oninput="window.updateVehicleData(${v.id}, 'fob', this.value)" class="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-blue-600 dark:text-blue-400 text-sm outline-none focus:ring-1 focus:ring-blue-500"></div>
                        ${perVehicleCosts}
                        <div class="grid grid-cols-1 gap-4">
                            <div class="text-left"><label class="block text-[10px] font-bold text-slate-400 mb-1 uppercase">Origen</label><select onchange="window.updateVehicleData(${v.id}, 'origen', this.value)" class="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold cursor-pointer text-left"><option value="cafta" ${v.origen === 'cafta' ? 'selected' : ''}>EEUU / UE / CAFTA</option><option value="otros" ${v.origen === 'otros' ? 'selected' : ''}>Otros Orígenes</option></select></div>
                            <div class="grid grid-cols-2 gap-4">
                                <div class="flex-1 text-left"><label class="block text-[10px] font-bold text-slate-400 mb-1 uppercase">Motor</label><select onchange="window.updateVehicleData(${v.id}, 'engineType', this.value)" class="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold cursor-pointer text-left"><option value="gas" ${v.engineType === 'gas' ? 'selected' : ''}>Gasolina</option><option value="hybrid_electric" ${v.engineType === 'hybrid_electric' ? 'selected' : ''}>Híbrido / Eléctrico</option></select></div>
                                <div class="flex-1 text-left"><div class="flex items-center justify-between mb-1"><label class="block text-[10px] font-bold text-slate-400 uppercase">CO2</label><button onclick="document.getElementById('tip-co2-info-${v.id}').classList.toggle('hidden')" class="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black">?</button></div><div class="relative"><select onchange="window.updateVehicleData(${v.id}, 'co2Pct', this.value)" class="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-left"><option value="0.00" ${v.co2Pct == 0 ? 'selected' : ''}>0%</option><option value="0.01" ${v.co2Pct == 0.01 ? 'selected' : ''}>1%</option><option value="0.02" ${v.co2Pct == 0.02 ? 'selected' : ''}>2%</option><option value="0.03" ${v.co2Pct == 0.03 ? 'selected' : ''}>3%</option></select><div id="tip-co2-info-${v.id}" class="hidden mt-2 p-3 bg-blue-800 text-white rounded-xl text-[10px] leading-relaxed shadow-xl absolute z-[60] w-48 border border-blue-400 right-0"><p class="font-bold mb-1">Cargos CO2:</p><p class="text-left">• 120-220g: <span class="font-bold">1%</span></p><p class="text-left">• 220-380g: <span class="font-bold">2%</span></p><p class="text-left">• 380g+: <span class="font-bold">3%</span></p></div></div></div>
                            </div>
                        </div>
                    </div>
                    <div class="bg-blue-50 dark:bg-blue-900/20 rounded-3xl p-5 flex flex-col justify-between border border-blue-100 dark:border-blue-800 h-full text-left">
                        <div class="space-y-2 text-xs">
                            <div class="flex justify-between text-slate-500 dark:text-slate-400 text-left"><span id="v-lbl-grav-${v.id}">Arancel:</span><span id="v-res-gravamen-${v.id}" class="text-slate-600 dark:text-slate-300 font-bold text-left">RD$ 0.00</span></div>
                            <div class="flex justify-between text-slate-500 dark:text-slate-400 text-left"><span id="v-lbl-itbis-${v.id}">ITBIS:</span><span id="v-res-itbis-${v.id}" class="font-bold text-slate-600 dark:text-slate-300 text-left">RD$ 0.00</span></div>
                            <div class="flex justify-between text-slate-500 dark:text-slate-400 text-left"><span><span class="font-bold text-slate-700 dark:text-slate-200">Serv. Aduana</span>:</span><span id="v-res-service-${v.id}" class="font-bold text-slate-500 dark:text-slate-400">RD$ 0.00</span></div>
                            <div class="flex justify-between text-slate-500 dark:text-slate-400 text-left"><span id="v-lbl-placa-${v.id}">Placa:</span><span id="v-res-placa-${v.id}" class="font-bold text-blue-600 dark:text-blue-400 text-left">RD$ 0.00</span></div>
                        </div>
                        <div class="mt-4 pt-4 border-t border-blue-100 dark:border-blue-800 flex justify-between items-baseline"><span class="text-[9px] font-black uppercase text-slate-400">Subtotal</span><span id="v-res-total-${v.id}" class="text-xl font-black text-blue-700 dark:text-blue-400 text-right">RD$ 0.00</span></div>
                    </div>
                </div>
            `;
            container.appendChild(card);
        });
    }
    calculateAll();
}

export function calculateAll() {
    const tEl = document.getElementById('global-tasa');
    const eEl = document.getElementById('entidad');
    const cEl = document.getElementById('check-shared');
    const aEl = document.getElementById('check-auto');
    if (!tEl || !eEl || !cEl || !aEl) return;

    const isAuto = aEl.checked;
    
    // Si Modo Auto está activo, forzar Gastos Compartidos
    if (isAuto) {
        cEl.checked = true;
        cEl.disabled = true; // Impedir que lo desactiven
        const panel = document.getElementById('panel-shared-costs');
        if (panel) panel.style.display = 'block';
    } else {
        cEl.disabled = false;
    }

    const totalFobAll = vehicles.reduce((acc, v) => acc + v.fob, 0);

    // Bloquear/Actualizar Inputs Globales
    const gS = document.getElementById('g-seguro');
    const gF = document.getElementById('g-flete');
    if (gS) {
        if (isAuto) {
            gS.value = (totalFobAll * 0.02).toFixed(2);
            gS.disabled = true;
            gS.classList.add('opacity-50', 'italic');
        } else {
            gS.disabled = false;
            gS.classList.remove('opacity-50', 'italic');
        }
    }
    if (gF) {
        if (isAuto) {
            gF.value = (totalFobAll * 0.15).toFixed(2);
            gF.disabled = true;
            gF.classList.add('opacity-50', 'italic');
        } else {
            gF.disabled = false;
            gF.classList.remove('opacity-50', 'italic');
        }
    }

    const config = {
        tasa: parseFloat(tEl.value) || 60,
        entidad: eEl.value,
        isShared: cEl.checked,
        sharedCosts: {
            seguro: parseFloat(document.getElementById('g-seguro')?.value || 0),
            flete: parseFloat(document.getElementById('g-flete')?.value || 0),
            otros: parseFloat(document.getElementById('g-otros')?.value || 0),
        },
        totalVehicles: vehicles.length || 1,
        isAuto: isAuto
    };

    let tAra = 0, tItb = 0, tPla = 0, tSer = 0, tFob = 0, tCif = 0, tSeg = 0, tFle = 0, tOtr = 0;

    vehicles.forEach(v => {
        // En modo individual + automático, forzar 2% y 15%
        if (isAuto && !config.isShared) {
            v.seguro = v.fob * 0.02;
            v.flete = v.fob * 0.15;
        }

        const res = calcularImpuestosIndividual(v, config);
        v.results = res;

        const ue = (id, txt) => { const el = document.getElementById(id); if (el) el.innerText = txt; };
        const ueh = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html; };

        ue(`v-res-gravamen-${v.id}`, formatDOP(res.gravamen));
        ueh(`v-lbl-grav-${v.id}`, `<span class="font-bold text-slate-700">Arancel</span> (${(res.gravPct * 100).toFixed(1)}%):`);
        ue(`v-res-itbis-${v.id}`, formatDOP(res.itbis));
        ueh(`v-lbl-itbis-${v.id}`, `<span class="font-bold text-slate-700">ITBIS</span> (${(res.itbisPct * 100).toFixed(0)}%):`);
        ue(`v-res-service-${v.id}`, formatDOP(res.service));
        ue(`v-res-placa-${v.id}`, formatDOP(res.placa));
        ueh(`v-lbl-placa-${v.id}`, `<span class="font-bold text-slate-700">Placa</span> (${(res.placaPct * 100).toFixed(1)}%):`);
        ue(`v-res-total-${v.id}`, formatDOP(res.subtotal));

        tAra += res.gravamen; tItb += res.itbis; tPla += res.placa; tSer += res.service;
        tFob += v.fob; tCif += res.cif;
        tSeg += res.seguroUSD; tFle += res.fleteUSD; tOtr += res.otrosUSD;
    });

    const tasa = config.tasa;
    const formatUSD = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
    const u = (id, dop, usd) => {
        const elD = document.getElementById(`${id}-dop`);
        const elU = document.getElementById(`${id}-usd`);
        if (elD) elD.innerText = formatDOP(dop).replace('DOP', '').trim();
        if (elU) elU.innerText = formatUSD(usd).replace('USD', '').trim();
    };

    u('g-fob', tFob * tasa, tFob);
    u('g-seg', tSeg * tasa, tSeg);
    u('g-fle', tFle * tasa, tFle);
    u('g-otr', tOtr * tasa, tOtr);
    u('g-cif', tCif, tCif / tasa);

    const totalFinal = tAra + tItb + tPla + tSer;
    const ug = (id, txt) => { const el = document.getElementById(id); if (el) el.innerText = txt; };
    ug('res-total-global', formatDOP(totalFinal));
    ug('res-total-usd', formatUSD(totalFinal / tasa));
    ug('nav-total', formatDOP(totalFinal));
}

// ─── Export ──────────────────────────────────────────────────────────────────
export function exportToPDF(vId = null) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4'); // Orientación vertical
    const items = vId ? vehicles.filter(v => v.id === vId) : vehicles;
    const tasa = parseFloat(document.getElementById('global-tasa')?.value || 60);
    
    if (!vId) {
        const total = items.reduce((acc, v) => acc + v.results.subtotal, 0);
        saveToHistory(total, items.length);
    }

    const formatUSD = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

    // Encabezado
    doc.setFillColor(29, 78, 216);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('FERRAMPA LOGISTICS', 14, 20);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Calculadora de Importación Vehicular 2026', 14, 28);
    doc.text(`Fecha: ${new Date().toLocaleDateString()} | Tasa: RD$ ${tasa.toFixed(2)}`, 14, 34);

    // Cálculos de Totales
    const tFob = items.reduce((acc, v) => acc + v.fob, 0);
    const tSeg = items.reduce((acc, v) => acc + (v.results.seguroUSD || 0), 0);
    const tFle = items.reduce((acc, v) => acc + (v.results.fleteUSD || 0), 0);
    const tOtr = items.reduce((acc, v) => acc + (v.results.otrosUSD || 0), 0);
    const tCIF = items.reduce((acc, v) => acc + v.results.cif, 0);
    const tAra = items.reduce((acc, v) => acc + v.results.gravamen, 0);
    const tItb = items.reduce((acc, v) => acc + v.results.itbis, 0);
    const tSer = items.reduce((acc, v) => acc + v.results.service, 0);
    const tPla = items.reduce((acc, v) => acc + v.results.placa, 0);
    const tTotal = tAra + tItb + tSer + tPla;

    let currentY = 50;
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(14);
    doc.text('RESUMEN EJECUTIVO', 14, currentY);
    
    // Tabla de Resumen Dividida (Izquierda: Logística | Derecha: Impuestos)
    doc.autoTable({
        startY: currentY + 5,
        head: [['GASTOS DEL VEHICULO (USD / DOP)', 'IMPUESTOS A PAGAR (DOP / USD)']],
        body: [
            [`Total FOB: ${formatUSD(tFob)} / ${formatDOP(tFob * tasa)}`, `Arancel: ${formatDOP(tAra)} / ${formatUSD(tAra / tasa)}`],
            [`Seguro: ${formatUSD(tSeg)} / ${formatDOP(tSeg * tasa)}`, `ITBIS: ${formatDOP(tItb)} / ${formatUSD(tItb / tasa)}`],
            [`Flete: ${formatUSD(tFle)} / ${formatDOP(tFle * tasa)}`, `Servicio Aduanero: ${formatDOP(tSer)} / ${formatUSD(tSer / tasa)}`],
            [`Otros: ${formatUSD(tOtr)} / ${formatDOP(tOtr * tasa)}`, `Total Placa: ${formatDOP(tPla)} / ${formatUSD(tPla / tasa)}`],
            [
                { content: `TOTAL CIF: ${formatDOP(tCIF)} / ${formatUSD(tCIF / tasa)}`, styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } },
                { content: `TOTAL IMPUESTOS: ${formatDOP(tTotal)} / ${formatUSD(tTotal / tasa)}`, styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } }
            ]
        ],
        theme: 'grid',
        styles: { fontSize: 7.5, cellPadding: 3 },
        headStyles: { fillColor: [51, 65, 85] }
    });

    currentY = doc.lastAutoTable.finalY + 15;

    // Detalle por Vehículo
    doc.setFontSize(14);
    doc.text('DETALLE POR VEHÍCULO', 14, currentY);

    const detailData = items.map(v => [
        v.name,
        v.year,
        formatUSD(v.fob),
        formatDOP(v.results.gravamen),
        formatDOP(v.results.itbis),
        formatDOP(v.results.placa),
        formatDOP(v.results.subtotal)
    ]);

    doc.autoTable({
        startY: currentY + 5,
        head: [['Vehículo', 'Año', 'FOB (USD)', 'Arancel', 'ITBIS', 'Placa', 'Subtotal']],
        body: detailData,
        theme: 'striped',
        styles: { fontSize: 8 },
        headStyles: { fillColor: [29, 78, 216] }
    });

    // Pie de página legal
    const finalY = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text('Nota: Estos valores son referenciales basados en la tasa del día. La liquidación oficial es emitida por la DGA.', 14, finalY);
    doc.text('Generado por Ferrampa Logistics ImportCalc.', 14, finalY + 5);

    doc.save(`Cotizacion_Ferrampa_${vId ? 'Vehiculo' : 'General'}.pdf`);
}

export function exportSinglePDF(id) { exportToPDF(id); }

export function exportToExcel() {
    const data = vehicles.map(v => ({ 'Vehículo': v.name, 'Año': v.year, 'CIF DOP': v.results.cif, 'Arancel': v.results.gravamen, 'Placa': v.results.placa, 'ITBIS': v.results.itbis, 'Servicio': v.results.service, 'TOTAL': v.results.subtotal }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Cotización');
    XLSX.writeFile(wb, 'ImportCalc_RD.xlsx');
    
    const total = vehicles.reduce((acc, v) => acc + v.results.subtotal, 0);
    saveToHistory(total, vehicles.length);
}

export function shareWhatsApp() { window.open(`https://wa.me/?text=${encodeURIComponent('Resumen Cotización RD: ' + document.getElementById('nav-total').innerText)}`, '_blank'); }

// ─── Theme Toggle ───────────────────────────────────────────────────────────
export function toggleDarkMode() {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('dark_mode', isDark);
    updateThemeIcons();
    // Re-render chart if colors changed
    if (totalChart) calculateAll();
}

function updateThemeIcons() {
    const sunIcon = document.getElementById('sun-icon');
    const moonIcon = document.getElementById('moon-icon');
    if (!sunIcon || !moonIcon) return;

    if (document.documentElement.classList.contains('dark')) {
        sunIcon.classList.remove('hidden');
        moonIcon.classList.add('hidden');
    } else {
        sunIcon.classList.add('hidden');
        moonIcon.classList.remove('hidden');
    }
}

// ─── Init ────────────────────────────────────────────────────────────────────
export function initApp() {
    updateThemeIcons();
    
    // Cargar Historial
    const savedHistory = localStorage.getItem('importcalc_history');
    if (savedHistory) {
        try { history = JSON.parse(savedHistory); renderHistory(); } catch(e) { history = []; }
    }

    const saved = localStorage.getItem('importcalc_data');
    if (saved) {
        try {
            const data = JSON.parse(saved);
            vehicles = data.vehicles || [];
            nextId = data.nextId || (vehicles.length > 0 ? Math.max(...vehicles.map(v => v.id)) + 1 : 1);
            if (document.getElementById('global-tasa')) document.getElementById('global-tasa').value = data.tasa || 60.00;
            if (document.getElementById('entidad')) document.getElementById('entidad').value = data.entidad || 'fisica';
            if (document.getElementById('check-shared')) document.getElementById('check-shared').checked = data.isShared !== undefined ? data.isShared : true;
            if (document.getElementById('g-seguro')) document.getElementById('g-seguro').value = data.gSeguro || 100;
            if (document.getElementById('g-flete')) document.getElementById('g-flete').value = data.gFlete || 1200;
            if (document.getElementById('g-otros')) document.getElementById('g-otros').value = data.gOtros || 0;
            toggleSharedPanel(false);
        } catch (e) { addVehicle(); }
    } else { addVehicle(); }
    document.getElementById('loading').classList.add('hidden');
    ['global-tasa', 'g-seguro', 'g-flete', 'g-otros'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', () => { calculateAll(); debouncedSave(); });
    });
}

// ─── Global Exposure ─────────────────────────────────────────────────────────
window.navigateTo = navigateTo;
window.handleUIChange = () => { calculateAll(); debouncedSave(); };
window.updateVehicleData = updateVehicleData;
window.addVehicle = addVehicle;
window.removeVehicle = removeVehicle;
window.toggleSharedPanel = toggleSharedPanel;
window.decodeVIN = decodeVIN;
window.toggleDarkMode = toggleDarkMode;
window.exportToPDF = exportToPDF;
window.exportSinglePDF = exportSinglePDF;
window.exportToExcel = exportToExcel;
window.shareWhatsApp = shareWhatsApp;
window.printPage = printPage;
window.handleContactSubmit = handleContactSubmit;
window.loadFromHistory = loadFromHistory;
window.deleteHistoryItem = deleteHistoryItem;
window.clearHistory = clearHistory;
window.toggleAutoTasa = toggleAutoTasa;

// ─── AdBlock Detector ───────────────────────────────────────────────────────
function checkAdBlock() {
    setTimeout(() => {
        const ad = document.querySelector('.ad-placeholder');
        if (ad && (ad.offsetHeight === 0 || window.getComputedStyle(ad).display === 'none')) {
            document.getElementById('adblock-modal')?.classList.remove('hidden');
        }
    }, 2500); // Pequeño retraso para dar tiempo a los bloqueadores a actuar
}

window.addEventListener('load', checkAdBlock);