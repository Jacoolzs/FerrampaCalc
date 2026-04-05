/**
 * Lógica pura de cálculo de impuestos para un vehículo.
 */

export function calcularImpuestosIndividual(v, config) {
    const { tasa, isShared, sharedCosts, totalVehicles } = config;
    
    const sU = isShared ? sharedCosts.seguro / totalVehicles : (v.seguro || 0);
    const fU = isShared ? sharedCosts.flete / totalVehicles : (v.flete || 0);
    const oU = isShared ? sharedCosts.otros / totalVehicles : (v.otros || 0);

    const cifUSD = (v.fob || 0) + sU + fU + oU;
    const cifDOP = cifUSD * tasa;

    // Arancel
    let fG = 0;
    if (v.origen === 'cafta') {
        fG = 0;
    } else if (config.entidad === 'dealer') {
        fG = (v.engineType === 'hybrid_electric') ? 0.05 : 0.10;
    } else {
        fG = (v.engineType === 'hybrid_electric') ? 0.10 : 0.20;
    }

    // Placa
    const pPctBase = (v.engineType === 'hybrid_electric') ? 0.085 : 0.17;
    const totalPlacaPct = pPctBase + parseFloat(v.co2Pct || 0);

    // ITBIS
    const itbisRate = (v.engineType === 'hybrid_electric') ? 0.09 : 0.18;

    const sDOP = 150 * tasa;
    const gD = cifDOP * fG;
    const pD = cifDOP * totalPlacaPct;
    const iD = (cifDOP + gD) * itbisRate;
return {
    cif: cifDOP,
    gravamen: gD,
    itbis: iD,
    placa: pD,
    service: sDOP,
    subtotal: gD + iD + pD + sDOP,
    total: gD + iD + pD + sDOP,
    gravPct: fG,
    placaPct: totalPlacaPct,
    itbisPct: itbisRate,
    seguroUSD: sU,
    fleteUSD: fU,
    otrosUSD: oU
};
}

export const formatDOP = (val) => new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(val);
