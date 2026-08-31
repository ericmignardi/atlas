package com.ericmignardi.atlas.tag;

import java.io.Serializable;
import java.util.Objects;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * An {@code @Embeddable} id class must be {@link Serializable} and must
 * implement {@code equals}/{@code hashCode} over all its fields — unlike an
 * entity, a key is its values, and Hibernate uses them to look rows up in the
 * persistence context.
 */
@Embeddable
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class ProjectTagId implements Serializable {

	private static final long serialVersionUID = 1L;

	@Column(name = "project_id", nullable = false)
	private UUID projectId;

	@Column(name = "tag_id", nullable = false)
	private UUID tagId;

	@Override
	public boolean equals(Object o) {
		if (this == o) {
			return true;
		}
		if (!(o instanceof ProjectTagId other)) {
			return false;
		}
		return Objects.equals(projectId, other.projectId) && Objects.equals(tagId, other.tagId);
	}

	@Override
	public int hashCode() {
		return Objects.hash(projectId, tagId);
	}
}
