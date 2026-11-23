import { CURRENT_YEAR } from './constants.js';
import { paisDesdeNHTSA, paisDesdeVIN } from './tratados.js';

/**
 * Servicio de decodificación y análisis de VIN (NHTSA API + Heurística de prefijos de manufactura).
 */
export async function fetchVINData(vin) {
    if (!vin || vin.length < 17) {
        throw new Error('El VIN debe contener 17 caracteres alfanuméricos.');
    }

    // El país se toma de la planta reportada por NHTSA y, si no existe, del prefijo del VIN.
    const paisVin = paisDesdeVIN(vin);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
        const response = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${vin}?format=json`, { 
            signal: controller.signal 
        });
        clearTimeout(timeoutId);

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        const res = data.Results?.[0];

        if (res && res.Make && res.Make.trim() !== '' && res.ModelYear) {
            const fuel = (res.FuelTypePrimary || '').toLowerCase();
            const plantCountry = (res.PlantCountry || '').toUpperCase();

            return {
                success: true,
                make: res.Make.trim(),
                model: (res.Model || '').trim(),
                name: `${res.Make} ${res.Model}`.trim(),
                year: parseInt(res.ModelYear) || CURRENT_YEAR,
                engineType: (fuel.includes('electric') || fuel.includes('hybrid')) ? 'hybrid_electric' : 'gas',
                esElectrico: fuel.trim() === 'electric',
                pais: paisDesdeNHTSA(plantCountry) || paisVin,
                plantCountry: plantCountry
            };
        } else {
            return {
                success: false,
                pais: paisVin
            };
        }
    } catch (err) {
        clearTimeout(timeoutId);
        return {
            success: false,
            error: err.message,
            pais: paisVin
        };
    }
}
