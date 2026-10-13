/** Demo-only opaque token. Encoding UUID digits prevents accidental PAN-shaped runs. */
export function generarTokenSimulado(prefix = 'tok_'): string {
  return prefix + crypto.randomUUID().replace(/[0-9]/g, digit => String.fromCharCode(103 + Number(digit)))
}
