import { CURRENT_YEAR } from './constants.js';

/**
 * Servicio de decodificación y análisis de VIN (NHTSA API + Heurística de prefijos de manufactura).
 */
export async function fetchVINData(vin) {
    if (!vin || vin.length < 17) {
        throw new Error('El VIN debe contener 17 caracteres alfanuméricos.');
    }

    const firstDigit = vin.charAt(0).toUpperCase();

    // Prefijos que califican para Tratado (0% Arancel sugerido):
    // 1,4,5 = USA | 2 = Canadá | 3 = México | W = Alemania | S = UK | V = Francia/España | Z = Italia | Y = Suecia
    const isCaftaUePrefix = ['1','2','3','4','5','W','S','V','Z','Y'].includes(firstDigit);
    const isAsianPrefix = ['J', 'K', 'L'].includes(firstDigit);

    let suggestedOrigin = isCaftaUePrefix ? 'cafta' : (isAsianPrefix ? 'otros' : 'otros');

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
            const caftaCountries = [
                'UNITED STATES (USA)', 'MEXICO', 'CANADA', 'GERMANY', 'SPAIN', 
                'FRANCE', 'ITALY', 'BELGIUM', 'GUATEMALA', 'HONDURAS', 
                'EL SALVADOR', 'NICARAGUA', 'COSTA RICA', 'UNITED KINGDOM (UK)', 'SWEDEN'
            ];

            return {
                success: true,
                make: res.Make.trim(),
                model: (res.Model || '').trim(),
                name: `${res.Make} ${res.Model}`.trim(),
                year: parseInt(res.ModelYear) || CURRENT_YEAR,
                engineType: (fuel.includes('electric') || fuel.includes('hybrid')) ? 'hybrid_electric' : 'gas',
                origen: caftaCountries.includes(plantCountry) ? 'cafta' : suggestedOrigin,
                plantCountry: plantCountry
            };
        } else {
            return {
                success: false,
                suggestedOrigin: suggestedOrigin,
                isAsianPrefix: isAsianPrefix,
                isCaftaUePrefix: isCaftaUePrefix
            };
        }
    } catch (err) {
        clearTimeout(timeoutId);
        return {
            success: false,
            error: err.message,
            suggestedOrigin: suggestedOrigin,
            isAsianPrefix: isAsianPrefix,
            isCaftaUePrefix: isCaftaUePrefix
        };
    }
}
