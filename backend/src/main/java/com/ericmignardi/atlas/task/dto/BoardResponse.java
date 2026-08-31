package com.ericmignardi.atlas.task.dto;

import java.util.List;

/** FR-4.11. All four columns, always present, always in board order. */
public record BoardResponse(List<BoardColumn> columns) {
}
