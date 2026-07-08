"use client";

import type { ReactNode } from "react";
import { Table } from "@heroui/react";

export interface DataTableColumn<Row> {
  key: string;
  label: ReactNode;
  /** Exactly one column should be the row header for accessibility */
  isRowHeader?: boolean;
  className?: string;
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
  return (
    <Table>
      <Table.ScrollContainer>
        <Table.Content aria-label={ariaLabel}>
          <Table.Header>
            {columns.map((column) => (
              <Table.Column key={column.key} id={column.key} isRowHeader={column.isRowHeader}>
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
                  <Table.Cell key={column.key} className={column.className}>
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
