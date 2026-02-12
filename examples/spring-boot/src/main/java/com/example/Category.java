package com.example;

import jakarta.persistence.*;
import java.util.List;

/**
 * Category entity for grouping products.
 */
@Entity
@Table(name = "categories")
public class Category {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 100)
    private String name;

    @Column(length = 500)
    private String description;

    @OneToMany(mappedBy = "categoryEntity", cascade = CascadeType.ALL)
    private List<Product> products;
}
