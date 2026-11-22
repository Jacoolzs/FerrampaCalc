/**
 * Tratados comerciales de RD aplicables a vehículos, según el país de fabricación.
 * Fuente: Ministerio de Hacienda, Informe de Gasto Tributario 2026 (EPA y DR-CAFTA),
 * y ProDominicana, Guía de Exportación 2025 (pruebas de origen).
 */
export const TRATADOS = {
    cafta: { nombre: 'DR-CAFTA', prueba: 'certificación de origen' },
    epa: { nombre: 'EPA (Unión Europea)', prueba: 'certificado EUR.1' },
    uk: { nombre: 'Acuerdo CARIFORO-Reino Unido', prueba: 'certificado EUR.1' },
};

const UE = [
    ['DE', 'Alemania'], ['AT', 'Austria'], ['BE', 'Bélgica'], ['BG', 'Bulgaria'], ['CY', 'Chipre'],
    ['HR', 'Croacia'], ['DK', 'Dinamarca'], ['SK', 'Eslovaquia'], ['SI', 'Eslovenia'], ['ES', 'España'],
    ['EE', 'Estonia'], ['FI', 'Finlandia'], ['FR', 'Francia'], ['GR', 'Grecia'], ['HU', 'Hungría'],
    ['IE', 'Irlanda'], ['IT', 'Italia'], ['LV', 'Letonia'], ['LT', 'Lituania'], ['LU', 'Luxemburgo'],
    ['MT', 'Malta'], ['NL', 'Países Bajos'], ['PL', 'Polonia'], ['PT', 'Portugal'], ['CZ', 'República Checa'],
    ['RO', 'Rumania'], ['SE', 'Suecia'],
];

export const GRUPOS_PAISES = [
    { grupo: 'DR-CAFTA', tratado: 'cafta', paises: [['US', 'Estados Unidos'], ['CR', 'Costa Rica'], ['SV', 'El Salvador'], ['GT', 'Guatemala'], ['HN', 'Honduras'], ['NI', 'Nicaragua']] },
    { grupo: 'Unión Europea (EPA)', tratado: 'epa', paises: UE },
    { grupo: 'Reino Unido', tratado: 'uk', paises: [['GB', 'Reino Unido']] },
    { grupo: 'Sin tratado', tratado: null, paises: [['JP', 'Japón'], ['KR', 'Corea del Sur'], ['CN', 'China'], ['MX', 'México'], ['CA', 'Canadá'], ['OTRO', 'Otro país']] },
];

const POR_CODIGO = new Map(GRUPOS_PAISES.flatMap(g => g.paises.map(([codigo, nombre]) => [codigo, { nombre, tratado: g.tratado }])));

export const nombrePais = (codigo) => POR_CODIGO.get(codigo)?.nombre || 'Otro país';
export const tratadoDePais = (codigo) => POR_CODIGO.get(codigo)?.tratado || null;
export const esPreferencial = (origen) => Object.hasOwn(TRATADOS, origen);

/** Deriva el origen fiscal y migra vehículos guardados con el formato anterior. */
export function normalizarOrigen(v) {
    if (!v.pais) v.pais = v.origen === 'cafta' ? 'US' : 'OTRO';
    if (v.aplicarTratado === undefined) v.aplicarTratado = true;
    const tratado = tratadoDePais(v.pais);
    v.origen = tratado && v.aplicarTratado ? tratado : 'otros';
    return v;
}

const NHTSA = {
    'UNITED STATES (USA)': 'US', 'COSTA RICA': 'CR', 'EL SALVADOR': 'SV', GUATEMALA: 'GT', HONDURAS: 'HN', NICARAGUA: 'NI',
    GERMANY: 'DE', AUSTRIA: 'AT', BELGIUM: 'BE', BULGARIA: 'BG', CYPRUS: 'CY', CROATIA: 'HR', DENMARK: 'DK', SLOVAKIA: 'SK',
    SLOVENIA: 'SI', SPAIN: 'ES', ESTONIA: 'EE', FINLAND: 'FI', FRANCE: 'FR', GREECE: 'GR', HUNGARY: 'HU', IRELAND: 'IE',
    ITALY: 'IT', LATVIA: 'LV', LITHUANIA: 'LT', LUXEMBOURG: 'LU', MALTA: 'MT', NETHERLANDS: 'NL', 'THE NETHERLANDS': 'NL',
    POLAND: 'PL', PORTUGAL: 'PT', 'CZECH REPUBLIC': 'CZ', CZECHIA: 'CZ', ROMANIA: 'RO', SWEDEN: 'SE',
    'UNITED KINGDOM (UK)': 'GB', 'UNITED KINGDOM': 'GB', JAPAN: 'JP', 'SOUTH KOREA': 'KR', 'KOREA, SOUTH': 'KR', KOREA: 'KR',
    'REPUBLIC OF KOREA': 'KR', CHINA: 'CN', MEXICO: 'MX', CANADA: 'CA',
};

export const paisDesdeNHTSA = (texto) => NHTSA[(texto || '').trim().toUpperCase()] || null;

// Orden del segundo carácter en los rangos WMI (ISO 3780): el VIN no usa I, O ni Q.
const ORDEN = 'ABCDEFGHJKLMNPRSTUVWXYZ1234567890';
const RANGOS = {
    S: [['A', 'M', 'GB'], ['N', 'T', 'DE'], ['U', 'Z', 'PL']],
    T: [['J', 'P', 'CZ'], ['R', 'V', 'HU'], ['W', '1', 'PT']],
    U: [['U', 'Z', 'RO'], ['5', '7', 'SK']],
    V: [['A', 'E', 'AT'], ['F', 'R', 'FR'], ['S', 'W', 'ES'], ['3', '5', 'HR'], ['6', '0', 'EE']],
    W: [['A', '0', 'DE']],
    X: [['A', 'E', 'BG'], ['F', 'K', 'GR'], ['L', 'R', 'NL'], ['X', '2', 'LU']],
    Y: [['A', 'E', 'BE'], ['F', 'K', 'FI'], ['L', 'R', 'MT'], ['S', 'W', 'SE']],
    Z: [['A', 'R', 'IT'], ['X', '2', 'SI'], ['3', '5', 'LT']],
    3: [['A', 'W', 'MX'], ['X', '7', 'CR']],
};
const DIRECTOS = { 1: 'US', 4: 'US', 5: 'US', 2: 'CA', J: 'JP', L: 'CN' };

/** Identifica el país de ensamblaje por los dos primeros caracteres del VIN. */
export function paisDesdeVIN(vin) {
    const a = (vin || '').charAt(0).toUpperCase();
    const b = (vin || '').charAt(1).toUpperCase();
    if (DIRECTOS[a]) return DIRECTOS[a];
    if (a === 'K') return ORDEN.indexOf(b) >= ORDEN.indexOf('L') && ORDEN.indexOf(b) <= ORDEN.indexOf('R') ? 'KR' : 'OTRO';
    const pos = ORDEN.indexOf(b);
    const rango = (RANGOS[a] || []).find(([ini, fin]) => pos >= ORDEN.indexOf(ini) && pos <= ORDEN.indexOf(fin));
    return pos >= 0 && rango ? rango[2] : 'OTRO';
}
