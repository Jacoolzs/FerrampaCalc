import { CURRENT_YEAR, IMPORT_LIMIT_YEAR } from './constants.js';
import { calcularImpuestosIndividual, formatDOP } from './calculos.js';
import { 
    initHistory, 
    saveToHistory as persistHistory, 
    renderHistory, 
    deleteHistoryItem, 
    clearHistory, 
    getHistory 
} from './history.js';
import { fetchVINData } from './vin-service.js';
import { GRUPOS_PAISES, TRATADOS, VOLANTE_DERECHA, esPreferencial, nombrePais, normalizarOrigen, tratadoDePais } from './tratados.js';

const PDF_LIBS = [
    { src: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js', integrity: 'sha384-JcnsjUPPylna1s1fvi1u12X5qjY5OL56iySh75FdtrwhO/SWXgMjoVqcKyIIWOLk' },
    { src: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.25/jspdf.plugin.autotable.min.js', integrity: 'sha384-GbQVk5KsTZEMJtvSbtmGpderuiERKpKVVFucxROOKnIXvtg03h3pORjyyGlPD6UO' },
];
let pdfLibsPromise = null;

function cargarLibreriasPDF() {
    pdfLibsPromise ??= PDF_LIBS.reduce((previa, { src, integrity }) => previa.then(() => new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.integrity = integrity;
        script.crossOrigin = 'anonymous';
        script.onload = resolve;
        script.onerror = () => reject(new Error('No se pudo cargar el generador de PDF.'));
        document.head.appendChild(script);
    })), Promise.resolve()).catch((error) => { pdfLibsPromise = null; throw error; });
    return pdfLibsPromise;
}
import { generatePDF, generateExcel } from './report-export.js';

let vehicles = [];
let nextId = 1;
let saveTimeout = null;
let totalChart = null;

const opcionesPais = (actual) => GRUPOS_PAISES.map(g => `<optgroup label="${g.grupo}">${g.paises.map(([codigo, nombre]) => `<option value="${codigo}" ${codigo === actual ? 'selected' : ''}>${nombre}</option>`).join('')}</optgroup>`).join('');

// Sugerencia editable: híbridos 1%, eléctricos 0% y gasolina sin dato 3%.
function sugerirCo2(v, esElectrico = false) {
    if (v.co2Manual) return;
    v.co2Pct = v.engineType === 'hybrid_electric' ? (esElectrico ? 0 : 0.01) : 0.03;
}

function avisoTratado(v) {
    const volante = VOLANTE_DERECHA.has(v.pais) ? `<p class="alert alert--bad mt-2">Verifique que tenga el volante a la izquierda. La DGA prohíbe importar vehículos con volante a la derecha y ordena su comiso. <a href="/guia-importacion-2026#requisitos">Ver la regla</a></p>` : '';
    return avisoBase(v) + volante;
}

function avisoBase(v) {
    const clave = tratadoDePais(v.pais);
    if (!clave) return `<p class="note-row">Sin tratado vigente para este país: aplica el arancel general.</p>`;
    const t = TRATADOS[clave];
    return `<label class="check-row"><input type="checkbox" ${v.aplicarTratado ? 'checked' : ''} onchange="window.updateVehicleData(${v.id}, 'aplicarTratado', this.checked)"><span>Aplicar <strong>${t.nombre}</strong> (0% arancel). Requiere ${t.prueba} y cumplir la regla de origen.</span></label>`;
}

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

// ─── History Management (Delegado al módulo history.js) ─────────────────────
export function saveToHistory(total, vehicleCount) {
    persistHistory(total, vehicleCount, vehicles);
}

export function loadFromHistory(id) {
    const list = getHistory();
    const entry = list.find(h => h.id === id);
    if (!entry) return;
    vehicles = JSON.parse(JSON.stringify(entry.vehicles)).map(normalizarOrigen);
    renderVehicles();
    showToast('Cálculo recuperado del historial', 'success');
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
                _subject: `Nueva consulta de Ferrampa Logistics: ${name}`,
                _captcha: "false"
            })
        });

        const result = await response.json();

        if (response.ok) {
            showToast('¡Mensaje enviado con éxito! Nos contactaremos pronto.', 'success');
            form.reset();
        } else {
            console.error("Error servidor FormSubmit:", result);
            throw new Error(result.message || 'Error en la respuesta del servidor');
        }
    } catch (error) {
        console.error("Error envío formulario:", error);
        showToast(`Error: ${error.message || 'Intente más tarde'}`, 'error');
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

// ─── Navigation (Mantenida por compatibilidad, aunque se prefieren links HTML) ───
export function navigateTo(pageId) {
    const views = ['view-home']; // Solo queda la home en index.html
    const target = `view-${pageId}`;
    
    // Si intentamos navegar a algo que ya no está aquí, redirigir vía window.location
    if (pageId === 'contacto') { window.location.href = '/contacto'; return; }
    if (pageId === 'guia') { window.location.href = '/manual-usuario'; return; }

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
        year: CURRENT_YEAR, fob: 5000, pais: 'US', aplicarTratado: true, origen: 'cafta',
        engineType: 'gas', placaPct: 0.17, co2Pct: 0.03, // Ley 253-12: sin dato de emisiones aplica 3%
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

    try {
        const result = await fetchVINData(v.vin);
        if (result.pais) {
            v.pais = result.pais;
            v.aplicarTratado = true;
            normalizarOrigen(v);
        }
        const clave = tratadoDePais(v.pais);
        const detalleOrigen = `${nombrePais(v.pais)}: ${clave ? TRATADOS[clave].nombre : 'sin tratado'}`;

        if (result.success) {
            v.name = result.name;
            v.year = result.year;
            v.engineType = result.engineType;
            sugerirCo2(v, result.esElectrico);
            renderVehicles();
            debouncedSave();
            showToast(`VIN Decodificado: ${v.name} (${v.year}). ${detalleOrigen}.`, 'success');
        } else {
            renderVehicles();
            debouncedSave();
            showToast(`VIN no reconocido. Origen estimado: ${detalleOrigen}. Complete marca y año manualmente.`, 'warning');
            highlightManualFields(vId);
        }
    } catch (err) {
        renderVehicles();
        showToast('Error de conexión o VIN inválido. Rellene manualmente.', 'error');
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
            b.innerText = ok ? 'Permitido' : 'No permitido';
            b.className = `status ${ok ? 'status--ok' : 'status--bad'}`;
            const alertBox = document.getElementById(`alert-year-warning-${id}`);
            if (alertBox) {
                ok ? alertBox.classList.add('hidden') : alertBox.classList.remove('hidden');
            }
        }
    } else if (field === 'engineType') {
        v.engineType = value;
        sugerirCo2(v);
        renderVehicles(); // Estructura cambia, requiere render total
        debouncedSave();
        return;
    } else if (field === 'pais' || field === 'aplicarTratado') {
        v[field] = value;
        if (field === 'pais') v.aplicarTratado = true;
        normalizarOrigen(v);
        renderVehicles();
        debouncedSave();
        return;
    } else if (['fob', 'seguro', 'flete', 'otros', 'co2Pct'].includes(field)) {
        v[field] = parseFloat(value) || 0;
        if (field === 'co2Pct') v.co2Manual = true;
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
            card.className = 'vehicle-card card';

            // FIX 2: "otros" por vehículo cuando shared is OFF
            const perVehicleCosts = !sh ? `
                <fieldset class="grid-3">
                    <legend class="label">Costos de este vehículo (US$)</legend>
                    <div class="field"><label class="help" style="margin:0 0 4px" for="seguro-${v.id}">Seguro</label><input id="seguro-${v.id}" type="number" min="0" inputmode="decimal" value="${v.seguro}" oninput="window.updateVehicleData(${v.id}, 'seguro', this.value)" class="input"></div>
                    <div class="field"><label class="help" style="margin:0 0 4px" for="flete-${v.id}">Flete</label><input id="flete-${v.id}" type="number" min="0" inputmode="decimal" value="${v.flete}" oninput="window.updateVehicleData(${v.id}, 'flete', this.value)" class="input"></div>
                    <div class="field"><label class="help" style="margin:0 0 4px" for="otros-${v.id}">Otros</label><input id="otros-${v.id}" type="number" min="0" inputmode="decimal" value="${v.otros}" oninput="window.updateVehicleData(${v.id}, 'otros', this.value)" class="input"></div>
                </fieldset>` : '';

            const esLimpio = v.engineType === 'hybrid_electric';
            card.innerHTML = `
                <div class="vehicle-card__head">
                    <span class="vehicle-tag">Vehículo ${index + 1}</span>
                    <label class="sr-only" for="name-${v.id}">Nombre del vehículo ${index + 1}</label>
                    <input id="name-${v.id}" type="text" value="${v.name}" oninput="window.updateVehicleData(${v.id}, 'name', this.value)" class="vehicle-name">
                    <button type="button" onclick="window.exportSinglePDF(${v.id})" class="icon-btn" aria-label="Descargar PDF del vehículo ${index + 1}"><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/></svg></button>
                    <button type="button" onclick="window.removeVehicle(${v.id})" class="icon-btn icon-btn--danger" aria-label="Eliminar vehículo ${index + 1}"><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
                </div>
                <div class="vehicle-body">
                    <div class="vehicle-fields">
                        <div class="field">
                            <label class="label" for="vin-${v.id}">VIN (opcional)</label>
                            <div class="vin-row"><input id="vin-${v.id}" type="text" value="${v.vin}" maxlength="17" autocomplete="off" spellcheck="false" aria-describedby="vin-help-${v.id}" oninput="window.updateVehicleData(${v.id}, 'vin', this.value.toUpperCase())" class="input"><button type="button" id="btn-vin-${v.id}" onclick="window.decodeVIN(${v.id})" class="${v.vin.length < 11 ? 'hidden' : ''} btn btn-secondary">Completar</button></div>
                            <p id="vin-help-${v.id}" class="help">Completa país, motor y año. Verifique el resultado.</p>
                        </div>
                        <div class="grid-2">
                            <div class="field"><label class="label" for="year-${v.id}">Año</label><input id="year-${v.id}" type="number" inputmode="numeric" value="${v.year}" oninput="window.updateVehicleData(${v.id}, 'year', this.value)" class="input"></div>
                            <div class="field"><span class="label">Antigüedad</span><div id="badge-year-${v.id}" class="status ${isOk ? 'status--ok' : 'status--bad'}">${isOk ? 'Permitido' : 'No permitido'}</div></div>
                        </div>
                        <div id="alert-year-warning-${v.id}" class="${isOk ? 'hidden' : ''} alert alert--bad" role="alert">La ley prohíbe importar vehículos con más de 5 años. <a href="/guia-importacion-2026#requisitos">Ver la regla</a></div>
                        <div class="field"><label class="label" for="fob-${v.id}">Valor FOB (US$)</label><div class="input-prefix input-prefix--usd"><span aria-hidden="true">$</span><input id="fob-${v.id}" type="number" min="0" inputmode="decimal" value="${v.fob}" oninput="window.updateVehicleData(${v.id}, 'fob', this.value)" class="input"></div><p class="help">Precio del vehículo en origen, sin seguro ni flete.</p></div>
                        ${perVehicleCosts}
                        <div class="field"><label for="pais-${v.id}" class="label">País de fabricación</label><select id="pais-${v.id}" onchange="window.updateVehicleData(${v.id}, 'pais', this.value)" class="input">${opcionesPais(v.pais)}</select>${avisoTratado(v)}</div>
                        <div class="grid-2">
                            <div class="field"><label class="label" for="motor-${v.id}">Motor</label><select id="motor-${v.id}" onchange="window.updateVehicleData(${v.id}, 'engineType', this.value)" class="input"><option value="gas" ${v.engineType === 'gas' ? 'selected' : ''}>Gasolina</option><option value="hybrid_electric" ${v.engineType === 'hybrid_electric' ? 'selected' : ''}>Híbrido o eléctrico</option></select></div>
                            <div class="field"><label class="label" for="co2-${v.id}">Emisiones de CO2</label><select id="co2-${v.id}" onchange="window.updateVehicleData(${v.id}, 'co2Pct', this.value)" class="input"><option value="0.00" ${v.co2Pct == 0 ? 'selected' : ''}>0% (menos de 120 g o exento)</option><option value="0.01" ${v.co2Pct == 0.01 ? 'selected' : ''}>1% (120-220 g)</option><option value="0.02" ${v.co2Pct == 0.02 ? 'selected' : ''}>2% (220-380 g)</option><option value="0.03" ${v.co2Pct == 0.03 ? 'selected' : ''}>3% (más de 380 g o sin dato)</option></select></div>
                        </div>
                        <p class="help" style="margin-top:-6px">${esLimpio ? 'El CO2 se cobra sobre el 50% del CIF. Si no tiene el dato del fabricante, elija 3%. La reducción requiere constancia del fabricante; los híbridos necesitan al menos 10 kW, 48 V y freno regenerativo. <a class="text-link" href="/guia-ley-103-13#quienes">Ver requisitos</a>' : 'Sin dato del fabricante se aplica 3%. Ciertos vehículos de carga están exentos.'}</p>
                    </div>
                    <div class="vehicle-result">
                        <h3>Impuestos de este vehículo</h3>
                        <div class="result-row"><span id="v-lbl-grav-${v.id}">Arancel</span><span id="v-res-gravamen-${v.id}">RD$ 0.00</span></div>
                        <div class="result-row"><span id="v-lbl-itbis-${v.id}">ITBIS</span><span id="v-res-itbis-${v.id}">RD$ 0.00</span></div>
                        <div class="result-row"><span id="v-lbl-placa-${v.id}">Placa y CO2</span><span id="v-res-placa-${v.id}">RD$ 0.00</span></div>
                        <div class="result-row"><span>Servicio aduanero</span><span id="v-res-service-${v.id}">RD$ 0.00</span></div>
                        <div class="result-total"><span>Subtotal</span><span id="v-res-total-${v.id}">RD$ 0.00</span></div>
                        <div class="result-row" id="v-no-treaty-row-${v.id}" hidden><span>Sin tratado</span><span id="v-res-no-treaty-${v.id}">RD$ 0.00</span></div>
                        <div class="result-row" id="v-no-103-row-${v.id}" hidden><span>${tratadoDePais(v.pais) && v.aplicarTratado ? "Sin tratado ni Ley 103-13" : "Sin Ley 103-13"}</span><span id="v-res-no-103-${v.id}">RD$ 0.00</span></div>
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

    let tSinTratado = 0, hayTratado = false, tNoCalifica = 0, hayLimpio = false;
    let tAra = 0, tItb = 0, tPla = 0, tSer = 0, tFob = 0, tCif = 0, tSeg = 0, tFle = 0, tOtr = 0;

    vehicles.forEach(v => {
        // En modo individual + automático, forzar 2% y 15%
        if (isAuto && !config.isShared) {
            v.seguro = v.fob * 0.02;
            v.flete = v.fob * 0.15;
        }

        const res = calcularImpuestosIndividual(v, config);
        v.results = res;
        const conTratado = esPreferencial(v.origen);
        const resSinTratado = conTratado ? calcularImpuestosIndividual({ ...v, origen: 'otros' }, config) : res;
        tSinTratado += resSinTratado.total;
        hayTratado ||= conTratado;
        const esLimpio = v.engineType === 'hybrid_electric';
        const resNoCalifica = esLimpio ? calcularImpuestosIndividual({ ...v, origen: 'otros', engineType: 'gas' }, config) : resSinTratado;
        tNoCalifica += resNoCalifica.total;
        hayLimpio ||= esLimpio;
        Object.assign(v.results, { conTratado, esLimpio, sinTratado: resSinTratado.total, noCalifica: resNoCalifica.total });

        const ue = (id, txt) => { const el = document.getElementById(id); if (el) el.innerText = txt; };
        const ueh = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html; };

        ue(`v-res-gravamen-${v.id}`, formatDOP(res.gravamen));
        ueh(`v-lbl-grav-${v.id}`, `Arancel (${(res.gravPct * 100).toFixed(1)}%)`);
        ue(`v-res-itbis-${v.id}`, formatDOP(res.itbis));
        ueh(`v-lbl-itbis-${v.id}`, `ITBIS (${(res.itbisPct * 100).toFixed(0)}%)`);
        ue(`v-res-service-${v.id}`, formatDOP(res.service));
        ue(`v-res-placa-${v.id}`, formatDOP(res.placa));
        ueh(`v-lbl-placa-${v.id}`, `Placa y CO2 (${(res.placaPct * 100).toFixed(1)}%)`);
        ue(`v-res-total-${v.id}`, formatDOP(res.subtotal));
        ue(`v-res-no-treaty-${v.id}`, formatDOP(resSinTratado.total));
        const filaSinTratado = document.getElementById(`v-no-treaty-row-${v.id}`);
        if (filaSinTratado) filaSinTratado.hidden = !conTratado;
        ue(`v-res-no-103-${v.id}`, formatDOP(resNoCalifica.total));
        const filaNo103 = document.getElementById(`v-no-103-row-${v.id}`);
        if (filaNo103) filaNo103.hidden = !esLimpio;

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
    ug('g-total-sin-tratado', formatDOP(tSinTratado));
    const avisoSinTratado = document.getElementById('g-no-treaty');
    if (avisoSinTratado) avisoSinTratado.hidden = !hayTratado;
    ug('g-total-no-103', formatDOP(tNoCalifica));
    const avisoNo103 = document.getElementById('g-no-103');
    if (avisoNo103) avisoNo103.hidden = !hayLimpio;
    ug('g-no-103-label', hayTratado ? 'Si no cumple el tratado ni la Ley 103-13' : 'Si no cumple la Ley 103-13');
    ug('g-tax-arancel', formatDOP(tAra));
    ug('g-tax-itbis', formatDOP(tItb));
    ug('g-tax-placa', formatDOP(tPla));
    ug('g-tax-servicio', formatDOP(tSer));
}

// ─── Export (Delegado a report-export.js) ────────────────────────────────────
export async function exportToPDF(vId = null) {
    try {
        await cargarLibreriasPDF();
        const tasa = parseFloat(document.getElementById('global-tasa')?.value || 60);
        generatePDF(vehicles, vId, tasa);

        if (!vId) {
            const total = vehicles.reduce((acc, v) => acc + (v.results?.subtotal || 0), 0);
            saveToHistory(total, vehicles.length);
        }
    } catch (e) {
        console.error("Error al exportar a PDF:", e);
        showToast('Error al generar PDF. Intente nuevamente.', 'error');
    }
}

export function exportSinglePDF(id) { exportToPDF(id); }

export function exportToExcel() {
    try {
        generateExcel(vehicles);
        const total = vehicles.reduce((acc, v) => acc + (v.results?.subtotal || 0), 0);
        saveToHistory(total, vehicles.length);
    } catch (e) {
        console.error("Error al exportar a Excel:", e);
        showToast('Error al generar Excel. Verifique que la librería esté cargada.', 'error');
    }
}

export function shareWhatsApp() {
    const texto = (id) => document.getElementById(id)?.innerText || '';
    const visible = (id) => document.getElementById(id) && !document.getElementById(id).hidden;
    const lineas = [`Estimación de impuestos para importar a RD: ${texto('res-total-global')}`];
    if (visible('g-no-treaty')) lineas.push(`Si no demuestra el origen: ${texto('g-total-sin-tratado')}`);
    if (visible('g-no-103')) lineas.push(`${texto('g-no-103-label')}: ${texto('g-total-no-103')}`);
    lineas.push('El monto final lo determina la DGA.', 'https://ferrampalogistics.com/');
    window.open(`https://wa.me/?text=${encodeURIComponent(lineas.join('\n'))}`, '_blank');
}

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
    try {
        updateThemeIcons();
        
        // Cargar Historial
        initHistory();
        renderHistory();

        const saved = localStorage.getItem('importcalc_data');
        if (saved) {
            try {
                const data = JSON.parse(saved);
                vehicles = (data.vehicles || []).map(normalizarOrigen);
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
        
        ['global-tasa', 'g-seguro', 'g-flete', 'g-otros'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('input', () => { calculateAll(); debouncedSave(); });
        });
    } catch (err) {
        console.error("Error durante inicialización de la app:", err);
    }
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