"use client";

import type { ReactNode } from "react";
import { Table } from "@heroui/react";

export interface DataTableColumn<Row> {
  key: string;
  label: ReactNode;
  /** Exactly one column should be the row header for accessibility */
  isRowHeader?: boolean;
  /**
   * Horizontal alignment for the whole column, heading included. A column of
   * icon buttons reads as a stray cluster when its cells are pushed one way
   * and the heading above them stays where the text columns start.
   */
  align?: "start" | "center" | "end";
  /** Cell-only styling. Alignment belongs in `align`, so the heading follows. */
  className?: string;
  /**
   * Drops the column below `sm`. A phone has room for about two columns, and
   * a table wider than that scrolls sideways with no hint that it does — so
   * the columns a reader scans by stay and the rest wait for a wider screen.
   * Only for detail a row already leads to somewhere else, never the only
   * place a fact appears.
   */
  hideOnNarrow?: boolean;
  render: (row: Row) => ReactNode;
}

interface DataTableProps<Row> {
  "aria-label": string;
  columns: DataTableColumn<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string;
  /** Makes rows clickable */
  onRowAction?: (row: Row) => void;
  /** Rendered inside the table body when there are no rows */
  emptyState?: ReactNode;
}

const ALIGNMENT = { start: null, center: "text-center", end: "text-right" } as const;

/**
 * Shared table look for settings/admin cards (API tokens, site auth
 * tokens, job queues, ...). Wraps the HeroUI Table boilerplate so all
 * tables render consistently.
 */
export default function DataTable<Row>({
  "aria-label": ariaLabel,
  columns,
  rows,
  rowKey,
  onRowAction,
  emptyState,
}: DataTableProps<Row>) {
  // Hidden by media query rather than by dropping the column, so the table
  // does not rebuild itself around a breakpoint the server cannot know.
  const sharedClass = (column: DataTableColumn<Row>) =>
    [ALIGNMENT[column.align ?? "start"], column.hideOnNarrow ? "hidden sm:table-cell" : null]
      .filter(Boolean)
      .join(" ") || undefined;

  const columnClass = (column: DataTableColumn<Row>) =>
    [column.className, sharedClass(column)].filter(Boolean).join(" ") || undefined;

  return (
    <Table>
      <Table.ScrollContainer>
        <Table.Content aria-label={ariaLabel}>
          <Table.Header>
            {columns.map((column) => (
              <Table.Column
                key={column.key}
                className={sharedClass(column)}
                id={column.key}
                isRowHeader={column.isRowHeader}
              >
                {column.label}
              </Table.Column>
            ))}
          </Table.Header>
          <Table.Body
            renderEmptyState={
              emptyState
                ? () => <div className="text-muted px-4 py-8 text-center text-sm">{emptyState}</div>
                : undefined
            }
          >
            {rows.map((row) => (
              <Table.Row
                key={rowKey(row)}
                className={onRowAction ? "cursor-pointer" : undefined}
                id={rowKey(row)}
                onAction={onRowAction ? () => onRowAction(row) : undefined}
              >
                {columns.map((column) => (
                  <Table.Cell key={column.key} className={columnClass(column)}>
                    {column.render(row)}
                  </Table.Cell>
                ))}
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
    </Table>
  );
}
