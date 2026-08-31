package com.ericmignardi.atlas.user;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

/**
 * The one repository whose lookups are not user-scoped, because this is where
 * a user is first identified. Email is matched case-insensitively to line up
 * with the {@code lower(email)} unique index.
 */
public interface UserRepository extends JpaRepository<User, UUID> {

	Optional<User> findByEmailIgnoreCase(String email);

	boolean existsByEmailIgnoreCase(String email);
}
