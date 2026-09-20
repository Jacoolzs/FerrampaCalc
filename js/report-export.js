import { formatDOP } from './calculos.js';

export const formatUSD = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

/**
 * Servicio de exportación de cotizaciones en PDF y Excel
 */
export function generatePDF(vehicles, vId = null, tasa = 60) {
    if (!window.jspdf || !window.jspdf.jsPDF) {
        throw new Error('Librería jsPDF no disponible.');
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');
    const items = vId ? vehicles.filter(v => v.id === vId) : vehicles;

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

export function generateExcel(vehicles) {
    if (typeof XLSX === 'undefined') {
        throw new Error('Librería XLSX no cargada');
    }
    const data = vehicles.map(v => ({ 
        'Vehículo': v.name, 
        'Año': v.year, 
        'CIF DOP': v.results.cif, 
        'Arancel': v.results.gravamen, 
        'Placa': v.results.placa, 
        'ITBIS': v.results.itbis, 
        'Servicio': v.results.service, 
        'TOTAL': v.results.subtotal 
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new(); 
    XLSX.utils.book_append_sheet(wb, ws, 'Cotización');
    XLSX.writeFile(wb, 'ImportCalc_RD.xlsx');
}
