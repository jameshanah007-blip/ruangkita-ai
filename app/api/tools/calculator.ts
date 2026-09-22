export function calculate(expression: string): number {
  const sanitized = expression.replace(/[^0-9+\-*/().%\s]/g, "");

  if (!sanitized.trim()) {
    throw new Error("Ekspresi matematika tidak valid.");
  }

  const result = Function(`"use strict"; return (${sanitized})`)();

  if (typeof result !== "number" || !Number.isFinite(result)) {
    throw new Error("Hasil perhitungan tidak valid.");
  }

  return result;
}