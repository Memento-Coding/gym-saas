/** Fecha YYYY-MM-DD relativa a hoy: los escenarios no pueden depender del calendario. */
export function diasDesdeHoy(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().split('T')[0];
}
