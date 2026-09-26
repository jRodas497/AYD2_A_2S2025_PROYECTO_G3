package com.sgologic.payments;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/**
 * DC-08/RC06: el backend nunca debe aceptar un número de tarjeta completo, tokenizado o no.
 * {@link CardDataGuard} es la segunda barrera (la primera es la restricción de la base,
 * V4__guardia_de_tarjetas.sql) y responde un 400 claro antes de llegar al INSERT.
 */
class CardDataGuardTest {

    @Test
    void detecta_un_numero_de_tarjeta_de_16_digitos_que_pasa_luhn() {
        assertThat(CardDataGuard.looksLikeCardNumber("4111111111111111")).isTrue();
    }

    @Test
    void detecta_el_numero_aunque_venga_con_espacios_o_guiones() {
        assertThat(CardDataGuard.looksLikeCardNumber("4111 1111 1111 1111")).isTrue();
        assertThat(CardDataGuard.looksLikeCardNumber("4111-1111-1111-1111")).isTrue();
    }

    @Test
    void detecta_tambien_un_numero_de_15_digitos_valido_tipo_amex() {
        // El rango aceptado es 13-19 dígitos: una tarjeta de 15 dígitos (Amex) debe bloquearse
        // igual que una de 16, no solo la longitud más común.
        assertThat(CardDataGuard.looksLikeCardNumber("378282246310005")).isTrue();
    }

    @Test
    void no_marca_una_corrida_de_digitos_demasiado_corta_aunque_pase_luhn() {
        // 11 dígitos, válido por Luhn, pero fuera del rango 13-19: no es un número de tarjeta.
        assertThat(CardDataGuard.looksLikeCardNumber("79927398713")).isFalse();
    }

    @Test
    void no_marca_una_referencia_larga_que_no_pasa_luhn() {
        // Mismo largo que una tarjeta real (16 dígitos) pero sin dígito de control válido.
        assertThat(CardDataGuard.looksLikeCardNumber("1234567890123456")).isFalse();
    }

    @Test
    void no_marca_texto_sin_digitos_ni_valores_vacios() {
        assertThat(CardDataGuard.looksLikeCardNumber("token opaco de PayKlik")).isFalse();
        assertThat(CardDataGuard.looksLikeCardNumber("")).isFalse();
        assertThat(CardDataGuard.looksLikeCardNumber("   ")).isFalse();
        assertThat(CardDataGuard.looksLikeCardNumber(null)).isFalse();
    }
}
