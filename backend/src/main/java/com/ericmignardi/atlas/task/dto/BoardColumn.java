package com.ericmignardi.atlas.task.dto;

import java.util.List;

import com.ericmignardi.atlas.task.TaskStatus;

public record BoardColumn(TaskStatus status, List<TaskResponse> tasks) {
}
