package com.ericmignardi.atlas.task;

import java.time.Instant;
import java.util.UUID;

import org.hibernate.Hibernate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import com.ericmignardi.atlas.common.Auditable;
import com.ericmignardi.atlas.project.Project;
import com.ericmignardi.atlas.user.User;

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
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

/**
 * A task (PRD 5.5). It belongs to the <em>user</em>, and only optionally to a
 * project: deleting a project must not delete the work, so {@code project} is
 * nullable and the foreign key is ON DELETE SET NULL.
 */
@Entity
@Table(name = "tasks")
@EntityListeners(AuditingEntityListener.class)
@Getter
@Setter
public class Task extends Auditable {

	@Id
	@GeneratedValue
	@Column(name = "id", nullable = false, updatable = false)
	private UUID id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "user_id", nullable = false)
	private User user;

	/** Optional. Nulled, not cascaded, when the project is deleted. */
	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "project_id")
	private Project project;

	@Column(name = "title", nullable = false, length = 200)
	private String title;

	@Column(name = "description", columnDefinition = "text")
	private String description;

	@Enumerated(EnumType.STRING)
	@Column(name = "status", nullable = false, length = 16)
	private TaskStatus status = TaskStatus.TODO;

	@Enumerated(EnumType.STRING)
	@Column(name = "priority", nullable = false, length = 16)
	private TaskPriority priority = TaskPriority.MEDIUM;

	@Column(name = "due_date")
	private Instant dueDate;

	/**
	 * Signed, and allowed to go negative. A new task lands on top of its column
	 * by taking {@code min(sortOrder) - 1}, which reorders nothing else (FR-4.7).
	 */
	@Column(name = "sort_order", nullable = false)
	private int sortOrder = 0;

	/** Server-controlled: set when the status becomes DONE, cleared when it leaves. */
	@Column(name = "completed_at")
	private Instant completedAt;

	@Override
	public boolean equals(Object o) {
		if (this == o) {
			return true;
		}
		if (o == null || Hibernate.getClass(this) != Hibernate.getClass(o)) {
			return false;
		}
		Task other = (Task) o;
		return id != null && id.equals(other.id);
	}

	@Override
	public int hashCode() {
		return Hibernate.getClass(this).hashCode();
	}
}
