import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import DataTable from "@/features/admin/components/data-table";

vi.mock("@heroui/react", () => {
  const Table = ({ children }: any) => <table>{children}</table>;

  Table.ScrollContainer = ({ children }: any) => <>{children}</>;
  Table.Content = ({ children }: any) => <>{children}</>;
  Table.Header = ({ children }: any) => (
    <thead>
      <tr>{children}</tr>
    </thead>
  );
  Table.Column = ({ children, className }: any) => <th className={className}>{children}</th>;
  Table.Body = ({ children, renderEmptyState }: any) => (
    <tbody>{Array.isArray(children) && children.length ? children : renderEmptyState?.()}</tbody>
  );
  Table.Row = ({ children }: any) => <tr>{children}</tr>;
  Table.Cell = ({ children, className }: any) => <td className={className}>{children}</td>;

  return { Table };
});

type Row = { id: string; name: string; when: string };

const rows: Row[] = [{ id: "1", name: "Scheduled tasks", when: "2 hours ago" }];

const columns = [
  { key: "name", label: "Job", isRowHeader: true, render: (row: Row) => row.name },
  {
    key: "when",
    label: "Created",
    className: "text-xs",
    hideOnNarrow: true,
    render: (row: Row) => row.when,
  },
];

describe("DataTable hideOnNarrow", () => {
  it("hides the marked column below sm, header and cells alike", () => {
    render(<DataTable aria-label="Jobs" columns={columns} rowKey={(r) => r.id} rows={rows} />);

    expect(screen.getByText("Created")).toHaveClass("hidden", "sm:table-cell");
    expect(screen.getByText("2 hours ago")).toHaveClass("hidden", "sm:table-cell");
  });

  it("keeps the column's own classes alongside the hiding ones", () => {
    render(<DataTable aria-label="Jobs" columns={columns} rowKey={(r) => r.id} rows={rows} />);

    expect(screen.getByText("2 hours ago")).toHaveClass("text-xs");
  });

  it("leaves unmarked columns visible at every width", () => {
    render(<DataTable aria-label="Jobs" columns={columns} rowKey={(r) => r.id} rows={rows} />);

    expect(screen.getByText("Job")).not.toHaveClass("hidden");
    expect(screen.getByText("Scheduled tasks")).not.toHaveClass("hidden");
  });
});
