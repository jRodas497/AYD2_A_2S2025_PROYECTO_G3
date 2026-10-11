package com.sgologic.inventory;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * RC08/CDU-08: la reserva de stock no puede comprometer más unidades de las que hay, y una
 * reserva vencida debe liberarse para no bloquear compras de otros clientes.
 */
class InventoryReservationServiceTest {

    private JdbcTemplate jdbc;
    private ReservationRepository reservations;
    private InventoryReservationService service;

    @BeforeEach
    void setUp() {
        jdbc = mock(JdbcTemplate.class);
        reservations = mock(ReservationRepository.class);
        service = new InventoryReservationService(jdbc, reservations);
    }

    @Test
    void reserva_en_la_primera_ubicacion_con_existencia_suficiente() {
        when(jdbc.queryForList(anyString(), eq(55L)))
                .thenReturn(List.of(Map.of("location_id",7L,"available",5),Map.of("location_id",8L,"available",5)));
        when(jdbc.update(anyString(), any(), eq(7L), any(), any())).thenReturn(1);
        when(reservations.save(any(Reservation.class))).thenAnswer(inv -> inv.getArgument(0));

        Reservation reservation = service.reserve(900L, 55L, 3, 20);

        assertThat(reservation.getOrderId()).isEqualTo(900L);
        assertThat(reservation.getLocationId()).isEqualTo(7L);
        assertThat(reservation.getProductId()).isEqualTo(55L);
        assertThat(reservation.getQuantity()).isEqualTo(3);
        assertThat(reservation.getStatus()).isEqualTo(ReservationStatus.ACTIVE);
        assertThat(reservation.getExpiresAt()).isAfter(OffsetDateTime.now());

        // No debería haber probado la segunda ubicación candidata (location 8) tras acertar en la primera.
        verify(jdbc, never()).update(anyString(), any(), eq(8L), any(), any());
    }

    @Test
    void reserva_la_cantidad_entre_ubicaciones_con_stock_dividido() {
        when(jdbc.queryForList(anyString(), eq(55L)))
                .thenReturn(List.of(Map.of("location_id",7L,"available",2),Map.of("location_id",8L,"available",1)));
        when(jdbc.update(anyString(), any(), eq(7L), any(), any())).thenReturn(1);
        when(jdbc.update(anyString(), any(), eq(8L), any(), any())).thenReturn(1);
        when(reservations.save(any(Reservation.class))).thenAnswer(inv -> inv.getArgument(0));

        Reservation reservation = service.reserve(900L, 55L, 3, 20);

        assertThat(reservation.getLocationId()).isEqualTo(7L);
        assertThat(reservation.getQuantity()).isEqualTo(2);
        ArgumentCaptor<Reservation> saved=ArgumentCaptor.forClass(Reservation.class);
        verify(reservations,times(2)).save(saved.capture());
        assertThat(saved.getAllValues()).extracting(Reservation::getLocationId).containsExactly(7L,8L);
        assertThat(saved.getAllValues()).extracting(Reservation::getQuantity).containsExactly(2,1);
    }

    @Test
    void lanza_excepcion_si_ninguna_ubicacion_tiene_existencia_suficiente() {
        when(jdbc.queryForList(anyString(), eq(55L)))
                .thenReturn(List.of());

        assertThatThrownBy(() -> service.reserve(900L, 55L, 3, 20))
                .isInstanceOf(InsufficientStockException.class)
                .hasMessageContaining("55");

        verify(reservations, never()).save(any());
    }

    @Test
    @SuppressWarnings("unchecked")
    void libera_las_reservas_vencidas_y_baja_el_stock_reservado() {
        Reservation expired = new Reservation();
        expired.setId(1L);
        expired.setOrderId(900L);
        expired.setLocationId(7L);
        expired.setProductId(55L);
        expired.setQuantity(3);
        expired.setStatus(ReservationStatus.ACTIVE);

        when(reservations.findExpiredLocked())
                .thenReturn(List.of(expired));

        int released = service.releaseExpired();

        assertThat(released).isEqualTo(1);
        assertThat(expired.getStatus()).isEqualTo(ReservationStatus.EXPIRED);
        assertThat(expired.getClosedAt()).isNotNull();

        verify(jdbc, times(1)).update(anyString(), eq(3), eq(7L), eq(55L));

        ArgumentCaptor<List<Reservation>> saved = ArgumentCaptor.forClass(List.class);
        verify(reservations).saveAll(saved.capture());
        assertThat(saved.getValue()).containsExactly(expired);
    }

    @Test
    void no_hace_nada_si_no_hay_reservas_vencidas() {
        when(reservations.findExpiredLocked())
                .thenReturn(List.of());

        int released = service.releaseExpired();

        assertThat(released).isZero();
        verify(jdbc, never()).update(anyString(), any(), any(), any());
    }
}
