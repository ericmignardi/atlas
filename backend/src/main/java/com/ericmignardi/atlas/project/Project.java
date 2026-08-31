package com.ericmignardi.atlas.project;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import org.hibernate.Hibernate;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import com.ericmignardi.atlas.common.Auditable;
import com.ericmignardi.atlas.environment.Environment;
import com.ericmignardi.atlas.tag.ProjectTag;
import com.ericmignardi.atlas.user.User;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

/**
 * A project (PRD 5.3) — the aggregate root the rest of the portal hangs off.
 *
 * <p>Two child collections, two different lifecycles. Environments are owned
 * outright and die with the project. Tasks are <em>not</em> mapped here at all:
 * a task belongs to the user, survives the project's deletion, and is reached
 * through {@code TaskRepository}, so putting a {@code @OneToMany} of tasks on
 * this class would invite exactly the cascade the schema is designed to avoid.
 */
@Entity
@Table(name = "projects")
@EntityListeners(AuditingEntityListener.class)
@Getter
@Setter
public class Project extends Auditable {

	@Id
	@GeneratedValue
	@Column(name = "id", nullable = false, updatable = false)
	private UUID id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "user_id", nullable = false)
	private User user;

	@Column(name = "name", nullable = false, length = 120)
	private String name;

	/** Unique per user, not globally — two accounts may both own {@code /atlas}. */
	@Column(name = "slug", nullable = false, length = 140)
	private String slug;

	@Column(name = "client", length = 120)
	private String client;

	@Column(name = "description", columnDefinition = "text")
	private String description;

	@Enumerated(EnumType.STRING)
	@Column(name = "status", nullable = false, length = 16)
	private ProjectStatus status = ProjectStatus.IDEA;

	@Column(name = "repo_url", length = 500)
	private String repoUrl;

	@Column(name = "live_url", length = 500)
	private String liveUrl;

	@Column(name = "engagement", length = 80)
	private String engagement;

	/**
	 * A real Postgres {@code text[]}, not a comma-joined string and not a child
	 * table. {@code @JdbcTypeCode(ARRAY)} is what tells Hibernate to bind it
	 * through {@code java.sql.Array} — this is the mapping H2 could not have
	 * modelled, and the reason the tests run against real Postgres (NFR-3.4).
	 */
	@JdbcTypeCode(SqlTypes.ARRAY)
	@Column(name = "tech_stack", nullable = false, columnDefinition = "text[]")
	private List<String> techStack = new ArrayList<>();

	@Column(name = "is_pinned", nullable = false)
	private boolean pinned = false;

	@Column(name = "started_at")
	private LocalDate startedAt;

	/** Owned outright: environments have no meaning without their project. */
	@OneToMany(mappedBy = "project", cascade = CascadeType.ALL, orphanRemoval = true)
	private Set<Environment> environments = new LinkedHashSet<>();

	/** The join rows, not the tags. Removing one here removes the association only. */
	@OneToMany(mappedBy = "project", cascade = CascadeType.ALL, orphanRemoval = true)
	private Set<ProjectTag> tags = new LinkedHashSet<>();

	public void addEnvironment(Environment environment) {
		environments.add(environment);
		environment.setProject(this);
	}

	public void removeEnvironment(Environment environment) {
		environments.remove(environment);
		environment.setProject(null);
	}

	@Override
	public boolean equals(Object o) {
		if (this == o) {
			return true;
		}
		if (o == null || Hibernate.getClass(this) != Hibernate.getClass(o)) {
			return false;
		}
		Project other = (Project) o;
		return id != null && id.equals(other.id);
	}

	@Override
	public int hashCode() {
		return Hibernate.getClass(this).hashCode();
	}
}
