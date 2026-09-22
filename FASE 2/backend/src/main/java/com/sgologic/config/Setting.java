package com.sgologic.config;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "setting", schema = "config")
@Getter
@Setter
@NoArgsConstructor
public class Setting {

    @Id
    private String key;

    private String value;

    private String description;
}
