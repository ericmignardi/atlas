package com.ericmignardi.atlas.common;

import java.time.Instant;

import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;

import jakarta.persistence.Column;
import jakarta.persistence.MappedSuperclass;
import lombok.Getter;
import lombok.Setter;

/**
 * The two audit columns every mutable table carries. Spring Data's auditing
 * listener fills them in; the migrations also give both a {@code now()} default
 * so a row inserted by hand in psql is still valid.
 *
 * <p>Not an entity — {@code @MappedSuperclass} means "fold these columns into
 * each subclass's own table", which is what we want. An {@code @Inheritance}
 * hierarchy would put them in a shared table, which is not.
 *
 * <p>Tag and RefreshToken deliberately do not extend this: they are immutable
 * once written and have no {@code updated_at} column (PRD 5.6, 5.7).
 */
@MappedSuperclass
@Getter
@Setter
public abstract class Auditable {

	@CreatedDate
	@Column(name = "created_at", nullable = false, updatable = false)
	private Instant createdAt;

	@LastModifiedDate
	@Column(name = "updated_at", nullable = false)
	private Instant updatedAt;
}
