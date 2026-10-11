package com.sgologic.auth;

import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

/** Enforces resource ownership even if a user manually changes an identifier in the URL. */
public class CustomerAccessFilter extends OncePerRequestFilter {
    private final JdbcTemplate jdbc;
    public CustomerAccessFilter(JdbcTemplate jdbc) { this.jdbc=jdbc; }
    @Override protected void doFilterInternal(HttpServletRequest request,HttpServletResponse response,FilterChain chain)
            throws IOException,jakarta.servlet.ServletException {
        var auth=SecurityContextHolder.getContext().getAuthentication();
        if(auth!=null && auth.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_CUSTOMER"))) {
            Long customerId=Long.valueOf(String.valueOf(auth.getDetails()));
            String path=request.getRequestURI();
            var customer=java.util.regex.Pattern.compile("^/api/customers/(\\d+)(?:/.*)?$").matcher(path);
            var order=java.util.regex.Pattern.compile("^/api/orders/(\\d+)(?:/.*)?$").matcher(path);
            boolean denied=false;
            if(customer.matches()) denied=!customerId.equals(Long.valueOf(customer.group(1)));
            if(order.matches()) {
                var owners=jdbc.queryForList("select customer_id from orders.purchase_order where id=?",Long.class,Long.valueOf(order.group(1)));
                denied=!owners.isEmpty() && !owners.get(0).equals(customerId);
            }
            if(denied) { response.setStatus(403);response.setContentType("application/json");response.getWriter().write("{\"message\":\"no tienes acceso a este recurso\"}");return; }
        }
        chain.doFilter(request,response);
    }
}
