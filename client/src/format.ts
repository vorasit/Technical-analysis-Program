export function pricePrecision(absValue: number): { precision: number; minMove: number } {
  if (absValue === 0 || absValue >= 100) return { precision: 2, minMove: 0.01 };
  if (absValue >= 1) return { precision: 4, minMove: 0.0001 };
  if (absValue >= 0.01) return { precision: 6, minMove: 0.000001 };
  return { precision: 8, minMove: 0.00000001 };
}

export function formatPrice(v: number): string {
  const { precision } = pricePrecision(Math.abs(v));
  return v.toLocaleString(undefined, { maximumFractionDigits: precision });
}
