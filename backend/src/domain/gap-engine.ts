export function calculateGap(requiredQty: number, functionalQty: number) {
  if (!Number.isInteger(requiredQty) || !Number.isInteger(functionalQty) || requiredQty < 0 || functionalQty < 0) throw new Error('Quantities must be non-negative integers');
  const gapQty = Math.max(requiredQty - functionalQty, 0);
  return { gapQty, gapRatio: requiredQty > 0 ? gapQty / requiredQty : 0 };
}
