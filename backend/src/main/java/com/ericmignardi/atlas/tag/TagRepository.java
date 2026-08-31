package com.ericmignardi.atlas.tag;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

/**
 * {@code project_tags} has no repository of its own: the join rows are only
 * ever reached through {@code Project.getTags()}, which cascades them.
 */
public interface TagRepository extends JpaRepository<Tag, UUID> {

	Optional<Tag> findByIdAndUserId(UUID id, UUID userId);

	Optional<Tag> findByUserIdAndName(UUID userId, String name);

	List<Tag> findByUserIdOrderByNameAsc(UUID userId);
}
