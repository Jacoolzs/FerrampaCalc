/**
 * Cálculo del traspaso de vehículos en República Dominicana.
 * Fuentes: Ley 173-07 art. 9, Norma General 03-2025 arts. 6 y 7, Ley 30-26 arts. 5 a 7
 * y la calculadora de transferencia de la DGII, cuyas reglas de plazo y mora se replican aquí.
 * Las fechas se manejan en UTC para que la zona horaria del navegador no mueva el día.
 */
export const TASAS = {
    impuestoPct: 2,
    matricula: 100,
    mesesPlazo: 3,
    diasHabiles: 90,
    recargoPrimerMesPct: 10,
    recargoMesSiguientePct: 4,
    recargoActualPct: 3,
    topeRecargoPct: 100,
    ultimoDiaRegimenAnterior: '2026-06-30',
    interesMensualPct: 1.1,
    mesesMaxInteres: 12,
    umbralCheque: 15000,
    umbralConstancia: 800000,
    umbralConstanciaAnterior: 500000,
    constanciaAnteriorDesde: '2022-12-13',
    constanciaAnteriorHasta: '2025-08-31',
};

const DIA_MS = 86400000;
const redondear = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const iso = (d) => d.toISOString().slice(0, 10);
const utc = (y, m, d) => new Date(Date.UTC(y, m, d));
const sumarDias = (d, n) => new Date(d.getTime() + n * DIA_MS);
const ultimoDiaMes = (y, m) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();

export function parseFecha(texto) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto || '');
    if (!m) return null;
    const d = utc(+m[1], +m[2] - 1, +m[3]);
    return iso(d) === texto ? d : null;
}

export function hoyRD(ahora = new Date()) {
    const texto = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santo_Domingo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(ahora);
    return parseFecha(texto);
}

function pascua(y) {
    const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
    const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7, n = Math.floor((a + 11 * h + 22 * l) / 451);
    const mes = Math.floor((h + l - 7 * n + 114) / 31), dia = ((h + l - 7 * n + 114) % 31) + 1;
    return utc(y, mes - 1, dia);
}

/** Ley 139-97: martes y miércoles pasan al lunes anterior; jueves y viernes, al lunes siguiente. */
function trasladar(d) {
    const dia = d.getUTCDay();
    if (dia === 2 || dia === 3) return sumarDias(d, 1 - dia);
    if (dia === 4 || dia === 5) return sumarDias(d, 8 - dia);
    return d;
}

const cacheFeriados = new Map();
function feriados(y) {
    if (!cacheFeriados.has(y)) {
        const p = pascua(y);
        const lista = [utc(y, 0, 1), utc(y, 0, 21), utc(y, 1, 27), utc(y, 7, 16), utc(y, 8, 24), utc(y, 11, 25), sumarDias(p, -2), sumarDias(p, 60)];
        [utc(y, 0, 6), utc(y, 0, 26), utc(y, 4, 1), utc(y, 10, 6)].forEach((d) => lista.push(trasladar(d)));
        cacheFeriados.set(y, new Set(lista.map(iso)));
    }
    return cacheFeriados.get(y);
}

export function esLaborable(d) {
    const dia = d.getUTCDay();
    return dia !== 0 && dia !== 6 && !feriados(d.getUTCFullYear()).has(iso(d));
}

function siguienteLaborable(d) {
    let r = d;
    while (!esLaborable(r)) r = sumarDias(r, 1);
    return r;
}

function sumarMeses(d, meses) {
    const y = d.getUTCFullYear(), m = d.getUTCMonth(), dia = d.getUTCDate();
    const destino = new Date(Date.UTC(y, m + meses, 1));
    const yD = destino.getUTCFullYear(), mD = destino.getUTCMonth();
    const ultimo = ultimoDiaMes(yD, mD);
    return utc(yD, mD, dia === ultimoDiaMes(y, m) ? ultimo : Math.min(dia, ultimo));
}

/** Último día para pagar sin mora, como lo aplica la calculadora de la DGII. */
export const fechaLimite = (acto) => siguienteLaborable(sumarMeses(acto, TASAS.mesesPlazo));

/** Referencia de la Norma 03-2025: 90 días hábiles contados desde la firma. */
export function fechaDiasHabiles(acto) {
    let r = acto, n = 0;
    while (n < TASAS.diasHabiles) {
        r = sumarDias(r, 1);
        if (esLaborable(r)) n += 1;
    }
    return r;
}

/** Meses de mora: cada mes o fracción de mes cuenta completo. */
export function mesesEntre(desde, hasta) {
    if (hasta <= desde) return 0;
    const dif = (hasta.getUTCFullYear() - desde.getUTCFullYear()) * 12 + hasta.getUTCMonth() - desde.getUTCMonth();
    return dif + (hasta.getUTCDate() > desde.getUTCDate() ? 1 : 0);
}

export function porcentajeRecargo(limite, pago) {
    const meses = mesesEntre(limite, pago);
    const anteriores = Math.min(meses, mesesEntre(limite, parseFecha(TASAS.ultimoDiaRegimenAnterior)));
    const previo = anteriores > 0 ? TASAS.recargoPrimerMesPct + TASAS.recargoMesSiguientePct * (anteriores - 1) : 0;
    if (previo >= TASAS.topeRecargoPct) return previo;
    return Math.min(TASAS.topeRecargoPct, previo + TASAS.recargoActualPct * (meses - anteriores));
}

export function umbralConstancia(acto) {
    if (!acto) return TASAS.umbralConstancia;
    const f = iso(acto);
    if (f < TASAS.constanciaAnteriorDesde) return null;
    return f <= TASAS.constanciaAnteriorHasta ? TASAS.umbralConstanciaAnterior : TASAS.umbralConstancia;
}

export function calcularActo({ precio = 0, valorTabla = 0, fecha = null, hoy }) {
    const base = Math.max(precio, valorTabla);
    const impuesto = redondear(base * TASAS.impuestoPct / 100);
    const usable = fecha && fecha <= hoy ? fecha : null;
    const limite = usable ? fechaLimite(usable) : null;
    const meses = limite ? mesesEntre(limite, hoy) : 0;
    const recargoPct = limite ? porcentajeRecargo(limite, hoy) : 0;
    const interesPct = redondear(Math.min(meses, TASAS.mesesMaxInteres) * TASAS.interesMensualPct);
    return {
        precio, valorTabla, base, fecha: usable, limite, meses, recargoPct, interesPct, impuesto,
        origen: valorTabla > precio ? 'tabla' : 'contrato',
        limiteHabil: usable ? fechaDiasHabiles(usable) : null,
        recargo: redondear(impuesto * recargoPct / 100),
        interes: redondear(impuesto * interesPct / 100),
    };
}

/** Devuelve null mientras no exista un valor con el cual calcular. */
export function calcularTraspaso({ precio = 0, valorTabla = 0, fecha = null, doble = false, precioAnterior = 0, fechaAnterior = null, hoy }) {
    if (Math.max(precio, valorTabla) <= 0) return null;
    const actual = calcularActo({ precio, valorTabla, fecha, hoy });
    const anterior = doble ? calcularActo({ precio: precioAnterior, valorTabla, fecha: fechaAnterior, hoy }) : null;
    const actos = anterior ? [anterior, actual] : [actual];
    const suma = (campo) => redondear(actos.reduce((t, a) => t + a[campo], 0));
    const impuesto = suma('impuesto'), recargo = suma('recargo'), interes = suma('interes');
    return { actual, anterior, impuesto, recargo, interes, matricula: TASAS.matricula, total: redondear(impuesto + recargo + interes + TASAS.matricula) };
}
