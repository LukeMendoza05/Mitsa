// Paid R1 is withdrawn. Original bytes/hashes remain in artifacts/superseded-paid-r1-20261031/.
export const productionWebsite = 'https://mitsa-fireworksinventory.vercel.app';
export function protectedProductionPlan() {
  throw new Error('SUPERSEDED_BY_FREE_ONLY_STRATEGY: paid R1 is withdrawn');
}
