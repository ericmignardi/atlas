package com.ericmignardi.atlas.tag;

import java.time.Instant;
import java.util.UUID;

import org.hibernate.Hibernate;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import com.ericmignardi.atlas.user.User;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

/**
 * A label (PRD 5.6). Per user, lowercased on write, reusable across projects.
 * There is no {@code updated_at} — a tag's name and colour are the whole row,
 * and the list view sorts by name — so this does not extend {@code Auditable}.
 */
@Entity
@Table(name = "tags")
@EntityListeners(AuditingEntityListener.class)
@Getter
@Setter
public class Tag {

	@Id
	@GeneratedValue
	@Column(name = "id", nullable = false, updatable = false)
	private UUID id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "user_id", nullable = false)
	private User user;

	@Column(name = "name", nullable = false, length = 50)
	private String name;

	/**
	 * {@code #RRGGBB}, so a fixed-width CHAR(7). The explicit JDBC type code
	 * matters: without it Hibernate expects VARCHAR and {@code ddl-auto: validate}
	 * refuses to start against the CHAR column the migration created.
	 */
	@JdbcTypeCode(SqlTypes.CHAR)
	@Column(name = "color", nullable = false, length = 7, columnDefinition = "char(7)")
	private String color = "#454D5F";

	@CreatedDate
	@Column(name = "created_at", nullable = false, updatable = false)
	private Instant createdAt;

	@Override
	public boolean equals(Object o) {
		if (this == o) {
			return true;
		}
		if (o == null || Hibernate.getClass(this) != Hibernate.getClass(o)) {
			return false;
		}
		Tag other = (Tag) o;
		return id != null && id.equals(other.id);
	}

	@Override
	public int hashCode() {
		return Hibernate.getClass(this).hashCode();
	}
}
