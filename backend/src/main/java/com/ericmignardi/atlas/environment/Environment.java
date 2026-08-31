package com.ericmignardi.atlas.environment;

import java.util.UUID;

import org.hibernate.Hibernate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import com.ericmignardi.atlas.common.Auditable;
import com.ericmignardi.atlas.project.Project;

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
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "environments")
@EntityListeners(AuditingEntityListener.class)
@Getter
@Setter
public class Environment extends Auditable {

	@Id
	@GeneratedValue
	@Column(name = "id", nullable = false, updatable = false)
	private UUID id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "project_id", nullable = false)
	private Project project;

	@Column(name = "name", nullable = false, length = 120)
	private String name;

	@Enumerated(EnumType.STRING)
	@Column(name = "platform", nullable = false, length = 16)
	private Platform platform;

	@Enumerated(EnumType.STRING)
	@Column(name = "type", nullable = false, length = 16)
	private EnvironmentType type;

	@Column(name = "branch", length = 200)
	private String branch;

	/** Free text: a Neon connection string is not a URL. */
	@Column(name = "url", length = 600)
	private String url;

	@Column(name = "notes", columnDefinition = "text")
	private String notes;

	/**
	 * The owning side. The database's UNIQUE on this column is what makes the
	 * relation genuinely one-to-one, and why pairing has to release before it
	 * assigns (FR-3.11).
	 */
	@OneToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "paired_with_id", unique = true)
	private Environment pairedWith;

	/** The inverse view. No second column, and no write from this side. */
	@OneToOne(mappedBy = "pairedWith", fetch = FetchType.LAZY)
	private Environment pairedBy;

	@Override
	public boolean equals(Object o) {
		if (this == o) {
			return true;
		}
		if (o == null || Hibernate.getClass(this) != Hibernate.getClass(o)) {
			return false;
		}
		Environment other = (Environment) o;
		return id != null && id.equals(other.id);
	}

	@Override
	public int hashCode() {
		return Hibernate.getClass(this).hashCode();
	}
}
