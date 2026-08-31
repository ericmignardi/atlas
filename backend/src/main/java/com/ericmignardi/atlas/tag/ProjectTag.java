package com.ericmignardi.atlas.tag;

import java.util.Objects;
import java.util.UUID;

import org.hibernate.Hibernate;

import com.ericmignardi.atlas.project.Project;

import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.MapsId;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * The {@code project_tags} join row (PRD 5.6), modelled as an entity rather
 * than a {@code @ManyToMany} so the association is explicit and can grow a
 * column later without a migration of the mapping style.
 *
 * <p>{@code @MapsId} is the point of interest: the two {@code @ManyToOne} fields
 * and the two id fields are the <em>same</em> two columns. {@code @MapsId} tells
 * Hibernate to fill the key from the associations rather than making you set
 * both, so you assign {@code project} and {@code tag} and the id follows.
 */
@Entity
@Table(name = "project_tags")
@Getter
@Setter
@NoArgsConstructor
public class ProjectTag {

	@EmbeddedId
	private ProjectTagId id = new ProjectTagId();

	@MapsId("projectId")
	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "project_id", nullable = false)
	private Project project;

	@MapsId("tagId")
	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "tag_id", nullable = false)
	private Tag tag;

	public ProjectTag(Project project, Tag tag) {
		this.project = project;
		this.tag = tag;
	}

	/*
	 * Identity is the two associations, read through their ids — deliberately
	 * NOT the @EmbeddedId. @MapsId does not populate the key until flush, so a
	 * freshly constructed join row still has (null, null) in it; comparing that
	 * makes every new ProjectTag equal to every other, and a Set of them
	 * collapses to a single element before anything reaches the database.
	 *
	 * The associations themselves are set once at construction and never change,
	 * so this is stable for the object's whole life.
	 */
	@Override
	public boolean equals(Object o) {
		if (this == o) {
			return true;
		}
		if (o == null || Hibernate.getClass(this) != Hibernate.getClass(o)) {
			return false;
		}
		ProjectTag other = (ProjectTag) o;
		return Objects.equals(projectId(), other.projectId()) && Objects.equals(tagId(), other.tagId());
	}

	private UUID projectId() {
		return project == null ? null : project.getId();
	}

	private UUID tagId() {
		return tag == null ? null : tag.getId();
	}

	@Override
	public int hashCode() {
		return Hibernate.getClass(this).hashCode();
	}
}
