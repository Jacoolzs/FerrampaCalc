import { TASAS, calcularTraspaso, hoyRD, parseFecha, umbralConstancia } from './traspaso-calculo.js';

const $ = (id) => document.getElementById(id);
const moneda = new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' });
const entero = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const fechaLarga = new Intl.DateTimeFormat('es-DO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const DGOP = (n) => moneda.format(n);
const fecha = (d) => fechaLarga.format(d);
const plural = (n) => `${n} ${n === 1 ? 'mes' : 'meses'}`;

const hoy = hoyRD();
const camposMonto = ['tx-precio', 'tx-tabla', 'tx-precio-anterior'];
const camposFecha = ['tx-fecha', 'tx-fecha-anterior'];

const leerMonto = (id) => {
    const n = parseFloat($(id).value.replace(/,/g, ''));
    return Number.isFinite(n) && n > 0 ? n : 0;
};

/** Agrega separadores de miles sin mover el cursor del usuario. */
function formatearMonto(input) {
    const previo = input.value;
    const cursor = input.selectionStart ?? previo.length;
    const digitosAntes = previo.slice(0, cursor).replace(/[^\d.]/g, '').length;
    let limpio = previo.replace(/[^\d.]/g, '');
    const punto = limpio.indexOf('.');
    if (punto >= 0) limpio = limpio.slice(0, punto + 1) + limpio.slice(punto + 1).replace(/\./g, '').slice(0, 2);
    limpio = limpio.slice(0, 15);
    const [ent, dec] = limpio.split('.');
    const texto = (ent ? entero.format(Number(ent)) : (punto >= 0 ? '0' : '')) + (punto >= 0 ? `.${dec ?? ''}` : '');
    if (texto === previo) return;
    input.value = texto;
    let pos = 0, vistos = 0;
    while (pos < texto.length && vistos < digitosAntes) {
        if (/[\d.]/.test(texto[pos])) vistos += 1;
        pos += 1;
    }
    input.setSelectionRange(pos, pos);
}

function leerFecha(id, errorId) {
    const input = $(id), error = $(errorId);
    const d = parseFecha(input.value);
    const futura = !!d && d > hoy;
    error.hidden = !futura;
    input.setAttribute('aria-invalid', String(futura));
    return futura ? null : d;
}

function fila(etiqueta, valor, clase = '') {
    const row = document.createElement('div');
    row.className = `result-row ${clase}`.trim();
    const a = document.createElement('span');
    const b = document.createElement('span');
    a.textContent = etiqueta;
    b.textContent = valor;
    row.append(a, b);
    return row;
}

function aviso(texto, tipo = 'info') {
    const li = document.createElement('li');
    li.className = `tx-alert tx-alert--${tipo}`;
    li.textContent = texto;
    return li;
}

function estadoActo(acto) {
    if (!acto.fecha) return { clase: 'neutral', texto: 'Agregue la fecha del contrato para revisar recargos' };
    if (acto.meses > 0) return { clase: 'bad', texto: `${plural(acto.meses)} de atraso. Venció el ${fecha(acto.limite)}` };
    return { clase: 'ok', texto: `A tiempo. Pague hasta el ${fecha(acto.limite)}` };
}

function construirAvisos(r, datos) {
    const lista = [];
    const actos = r.anterior ? [['contrato anterior', r.anterior], ['contrato actual', r.actual]] : [['contrato', r.actual]];
    actos.forEach(([nombre, a]) => {
        if (a.valorTabla > a.precio && a.precio > 0) lista.push(aviso(`La DGII cobrará sobre la tabla en el ${nombre}, porque ${DGOP(a.valorTabla)} es mayor que el precio escrito.`));
        if (a.precio === 0) lista.push(aviso(a.valorTabla > 0 ? `Falta el precio del ${nombre}. Se calculó con el valor de la tabla.` : `Falta el precio del ${nombre}, así que todavía no está incluido en el total.`, 'warn'));
        const umbral = umbralConstancia(a.fecha);
        if (umbral && a.precio > umbral) lista.push(aviso(`Como el ${nombre} supera ${DGOP(umbral).replace('.00', '')}, debe presentar la constancia del pago.`));
        if (!a.fecha) return;
        const dias = Math.round((a.limite - hoy) / 86400000);
        if (a.meses === 0 && dias <= 15) lista.push(aviso(dias === 0 ? `Hoy es el último día para pagar el ${nombre} sin recargos.` : `Le ${dias === 1 ? 'queda 1 día' : `quedan ${dias} días`} para pagar el ${nombre} sin recargos.`, 'warn'));
        if (hoy > a.fechaDgii && hoy <= a.limite) lista.push(aviso(`Por ley, el ${nombre} está en plazo hasta el ${fecha(a.limite)}. La calculadora publicada por la DGII puede mostrar mora desde el ${fecha(a.fechaDgii)}. Si se la cobran, pida la revisión citando el artículo 185 de la Ley 63-17.`, 'warn'));
        if (a.meses > 0 && a.limite < parseFecha('2015-05-01')) lista.push(aviso('Antes de mayo de 2015 regía otra tasa de interés, así que el monto real puede variar.', 'warn'));
    });
    if (r.total > TASAS.umbralCheque) lista.push(aviso('Por superar RD$15,000, el pago debe hacerse con cheque certificado o de administración a nombre del Colector de Impuestos Internos.'));
    if (r.anterior) lista.push(aviso('Se incluye una sola impresión de matrícula. Confirme este cargo con la DGII en un doble traspaso.'));
    if (hoy.getUTCFullYear() >= 2027 && (r.interes > 0)) lista.push(aviso('La DGII fija la tasa de interés cada enero. Confirme que el 1.10% siga vigente antes de pagar.', 'warn'));
    if (datos.precioSinTabla) lista.push(aviso('Sin el valor de la tabla, el resultado puede quedar por debajo de lo que cobre la DGII.', 'warn'));
    return lista;
}

let ultimoResumen = '';

function render() {
    const doble = $('tx-doble').checked;
    $('tx-panel-doble').hidden = !doble;
    const precio = leerMonto('tx-precio');
    const valorTabla = leerMonto('tx-tabla');
    const datos = {
        precio, valorTabla, doble, hoy,
        fecha: leerFecha('tx-fecha', 'tx-fecha-error'),
        precioAnterior: doble ? leerMonto('tx-precio-anterior') : 0,
        fechaAnterior: doble ? leerFecha('tx-fecha-anterior', 'tx-fecha-anterior-error') : null,
    };
    const r = calcularTraspaso(datos);
    const detalle = $('tx-detalle'), avisos = $('tx-avisos'), estados = $('tx-estados');
    detalle.replaceChildren();
    avisos.replaceChildren();
    estados.replaceChildren();
    $('tx-vacio').hidden = !!r;
    $('tx-copiar').disabled = !r;

    if (!r) {
        $('tx-total').textContent = DGOP(0);
        $('tx-total-movil').textContent = DGOP(0);
        $('tx-amnistia').hidden = true;
        ultimoResumen = '';
        return;
    }

    $('tx-total').textContent = DGOP(r.total);
    $('tx-total-movil').textContent = DGOP(r.total);
    $('tx-amnistia').hidden = r.totalAmnistia === null;
    if (r.totalAmnistia !== null) $('tx-amnistia-total').textContent = DGOP(r.totalAmnistia);

    const estadosLista = r.anterior ? [['Contrato anterior', r.anterior], ['Contrato actual', r.actual]] : [[null, r.actual]];
    estadosLista.forEach(([titulo, acto]) => {
        const e = estadoActo(acto);
        const p = document.createElement('p');
        p.className = `tx-status tx-status--${e.clase}`;
        p.textContent = titulo ? `${titulo}: ${e.texto}` : e.texto;
        estados.append(p);
    });

    const lineas = [];
    const agregar = (etiqueta, valor) => { detalle.append(fila(etiqueta, DGOP(valor))); lineas.push(`${etiqueta}: ${DGOP(valor)}`); };
    if (r.anterior) {
        agregar('Valor usado, contrato anterior', r.anterior.base);
        agregar('Valor usado, contrato actual', r.actual.base);
        agregar('2% del contrato anterior', r.anterior.impuesto);
        agregar('2% del contrato actual', r.actual.impuesto);
    } else {
        agregar(r.actual.origen === 'tabla' ? 'Valor usado (tabla DGII)' : 'Valor usado (contrato)', r.actual.base);
        agregar('Impuesto de 2%', r.impuesto);
    }
    if (r.recargo > 0) agregar('Recargo por mora', r.recargo);
    if (r.interes > 0) agregar('Interés indemnizatorio', r.interes);
    agregar('Impresión de matrícula', r.matricula);

    avisos.append(...construirAvisos(r, { precioSinTabla: precio > 0 && valorTabla === 0 }));
    ultimoResumen = ['Estimado de traspaso en la DGII', ...lineas, `Total estimado: ${DGOP(r.total)}`, ...(r.totalAmnistia !== null ? [`Con la amnistía, si se solicita hasta el 31 de diciembre de 2026: ${DGOP(r.totalAmnistia)}`] : []), 'Calculado en ferrampalogistics.com/calculadora-traspaso'].join('\n');
}

async function copiar() {
    if (!ultimoResumen) return;
    const estado = $('tx-copiado');
    try {
        await navigator.clipboard.writeText(ultimoResumen);
        estado.textContent = 'Resumen copiado';
    } catch (e) {
        estado.textContent = 'No se pudo copiar en este navegador';
    }
    setTimeout(() => { estado.textContent = ''; }, 3000);
}

function limpiar() {
    [...camposMonto, ...camposFecha].forEach((id) => { $(id).value = ''; });
    $('tx-doble').checked = false;
    render();
    $('tx-precio').focus();
}

const maximo = hoy.toISOString().slice(0, 10);
camposFecha.forEach((id) => {
    $(id).max = maximo;
    $(id).addEventListener('input', render);
});
camposMonto.forEach((id) => $(id).addEventListener('input', (e) => { formatearMonto(e.target); render(); }));
$('tx-doble').addEventListener('change', render);
$('tx-copiar').addEventListener('click', copiar);
$('tx-limpiar').addEventListener('click', limpiar);
render();
