package com.ericmignardi.atlas.user;

import java.util.UUID;

import org.hibernate.Hibernate;

import com.ericmignardi.atlas.common.Auditable;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

/**
 * Every other user-owned row cascades from this one, so deleting a user is a
 * complete account delete with no orphans left behind.
 */
@Entity
@Table(name = "users")
@EntityListeners(AuditingEntityListener.class)
@Getter
@Setter
public class User extends Auditable {

	@Id
	@GeneratedValue
	@Column(name = "id", nullable = false, updatable = false)
	private UUID id;

	/** Stored lowercased and trimmed; the unique index is on {@code lower(email)}. */
	@Column(name = "email", nullable = false, length = 320)
	private String email;

	/** NFR-2.1: BCrypt output is always 60 characters, hence the column width. */
	@Column(name = "password_hash", nullable = false, length = 60)
	private String passwordHash;

	@Column(name = "display_name", length = 80)
	private String displayName;

	/** Comma-separated authorities, e.g. {@code ROLE_USER}. */
	@Column(name = "roles", nullable = false, length = 255)
	private String roles = "ROLE_USER";

	@Column(name = "enabled", nullable = false)
	private boolean enabled = true;

	/*
	 * Identity is the surrogate key and nothing else. A mutable field would
	 * change an entity's hash mid-session and lose it inside a HashSet; an
	 * association would trigger a lazy load from inside a hash lookup.
	 * Hibernate.getClass unwraps proxies so a proxy and its target compare equal.
	 */
	@Override
	public boolean equals(Object o) {
		if (this == o) {
			return true;
		}
		if (o == null || Hibernate.getClass(this) != Hibernate.getClass(o)) {
			return false;
		}
		User other = (User) o;
		return id != null && id.equals(other.id);
	}

	@Override
	public int hashCode() {
		return Hibernate.getClass(this).hashCode();
	}
}
