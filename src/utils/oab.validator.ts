export function validateOAB(oab: string): boolean {
    const oabRegex = /^[0-9]{1,6}-[A-Z]{1}$/; // Example regex for OAB validation
    return oabRegex.test(oab);
}

export function formatOAB(oab: string): string {
    return oab.trim().toUpperCase();
}