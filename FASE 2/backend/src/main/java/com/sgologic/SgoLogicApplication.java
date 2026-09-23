package com.sgologic;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class SgoLogicApplication {
    public static void main(String[] args) {
        SpringApplication.run(SgoLogicApplication.class, args);
    }
}
