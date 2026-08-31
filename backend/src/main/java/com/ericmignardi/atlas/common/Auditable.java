package com.ericmignardi.atlas.common;

import java.time.Instant;

import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;

import jakarta.persistence.Column;
import jakarta.persistence.MappedSuperclass;
import lombok.Getter;
import lombok.Setter;

/**
 * {@code @MappedSuperclass} folds these columns into each subclass's own table.
 * An {@code @Inheritance} hierarchy would put them in a shared table instead.
 *
 * <p>Tag and RefreshToken deliberately do not extend this: they are immutable
 * once written and have no {@code updated_at} column.
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
