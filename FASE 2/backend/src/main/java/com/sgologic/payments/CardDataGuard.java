package com.sgologic.payments;

/**
 * Segunda barrera de DC-08, del lado de la aplicación: el backend no debe recibir nunca el
 * número completo de la tarjeta. El formulario de pago tokeniza contra PayKlik y aquí solo
 * entra ese token más los últimos 4 dígitos.
 *
 * <p>La base tiene la misma verificación (audit.has_card_number, V4__guardia_de_tarjetas.sql).
 * Esta existe para responder un 400 claro en vez de dejar que el dato llegue hasta el INSERT y
 * reviente como un error de base.
 */
public final class CardDataGuard {

    private CardDataGuard() {
    }

    /** true si el texto contiene algo que parece un número de tarjeta (13 a 19 dígitos que pasan Luhn). */
    public static boolean looksLikeCardNumber(String text) {
        if (text == null || text.isBlank()) {
            return false;
        }
        String compact = text.replace(" ", "").replace("-", "");
        int start = -1;
        for (int i = 0; i <= compact.length(); i++) {
            boolean digit = i < compact.length() && Character.isDigit(compact.charAt(i));
            if (digit && start < 0) {
                start = i;
            } else if (!digit && start >= 0) {
                String run = compact.substring(start, i);
                if (run.length() >= 13 && run.length() <= 19 && passesLuhn(run)) {
                    return true;
                }
                start = -1;
            }
        }
        return false;
    }

    /** El dígito de control que usan las tarjetas reales. Evita marcar por error una referencia larga. */
    private static boolean passesLuhn(String digits) {
        int sum = 0;
        boolean doubling = false;
        for (int i = digits.length() - 1; i >= 0; i--) {
            int d = digits.charAt(i) - '0';
            if (doubling) {
                d *= 2;
                if (d > 9) {
                    d -= 9;
                }
            }
            sum += d;
            doubling = !doubling;
        }
        return sum % 10 == 0;
    }
}
