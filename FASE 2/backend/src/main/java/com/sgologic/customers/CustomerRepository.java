package com.sgologic.customers;

import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CustomerRepository extends JpaRepository<Customer, Long> {

    /** Búsqueda del backoffice por nombre, correo o teléfono; {@code q} vacío trae los más recientes. */
    @Query("""
            select c from Customer c
            where :q is null or :q = ''
               or lower(c.fullName) like lower(concat('%', :q, '%'))
               or lower(coalesce(c.email, '')) like lower(concat('%', :q, '%'))
               or coalesce(c.phone, '') like concat('%', :q, '%')
            order by c.id desc
            """)
    List<Customer> search(@Param("q") String q, Pageable page);
}
