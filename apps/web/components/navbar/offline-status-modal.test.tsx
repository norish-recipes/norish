import type { ReactNode } from "react";
import { createContext, useContext } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import "@testing-library/jest-dom";

import OfflineStatusModal, { isBackendSimulatorEnabled } from "./offline-status-modal";

const mocks = vi.hoisted(() => ({
  acknowledge: vi.fn().mockResolvedValue(undefined),
  clearCachedData: vi.fn().mockResolvedValue(undefined),
  open: vi.fn().mockResolvedValue(undefined),
  retryConnection: vi.fn().mockResolvedValue(true),
  setSimulation: vi.fn().mockResolvedValue(true),
  connectivity: {
    state: "online",
    lastOutcomeAt: 20,
    lastSuccessAt: 20,
    lastFailureAt: null,
    simulatedBackendUnavailable: false,
    recoveryInProgress: false,
  },
  diagnostics: {
    pending: 0,
    retrying: 0,
    quarantined: 0,
    terminal: 0,
    expired: 0,
    completed: 0,
    discarded: 0,
    attention: [],
  },
  results: [] as Array<{
    id: string;
    entryId: string;
    backendOrigin: string;
    userId: string;
    operationId: string;
    path: string;
    encryptedResponse: { iv: ArrayBuffer; ciphertext: ArrayBuffer };
    createdAt: number;
  }>,
  opened: {} as Record<string, unknown>,
  offline: {
    phase: "live",
    activeScope: {
      key: "scope-1",
      lastLiveSuccessAt: 10,
    },
    inventory: {
      scopeKey: "scope-1",
      schemaVersion: 1,
      lastLiveSuccessAt: 10,
      persistenceWarning: null,
      recipeSummaries: { count: 4, dataUpdatedAt: 10, persistedAt: 11 },
      recipeDetails: { count: 2, dataUpdatedAt: 10, persistedAt: 11 },
      calendarItems: { count: 3, dataUpdatedAt: 10, persistedAt: 11 },
      groceries: { count: 5, dataUpdatedAt: 10, persistedAt: 11 },
      recurringGroceries: { count: 1, dataUpdatedAt: 10, persistedAt: 11 },
      stores: { count: 2, dataUpdatedAt: 10, persistedAt: 11 },
      totalRecords: 6,
    },
    persistenceWarning: null as null | { code: string },
    renderUser: null,
    renderIdentityOnly: false,
    usingCachedData: false,
    isQueryUnavailable: vi.fn(),
    retryConnection: vi.fn(),
    clearCachedData: vi.fn(),
  },
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key} ${Object.values(values).join(" ")}` : key,
}));

vi.mock("@/context/offline-web-context", () => ({
  useOfflineWeb: () => ({
    ...mocks.offline,
    retryConnection: mocks.retryConnection,
    clearCachedData: mocks.clearCachedData,
  }),
}));

vi.mock("@/lib/connectivity", () => ({
  useWebConnectivity: () => mocks.connectivity,
  webConnectivityRuntime: { setSimulatedBackendUnavailable: mocks.setSimulation },
}));

vi.mock("@/lib/offline-delivery-user", () => ({
  getWebOutboxUserId: vi.fn().mockResolvedValue("user-1"),
}));

vi.mock("@norish/shared-react/outbox", () => ({
  useWebOutboxDiagnostics: () => mocks.diagnostics,
  useWebOutboxResults: () => ({
    results: mocks.results,
    opened: mocks.opened,
    open: mocks.open,
    acknowledge: mocks.acknowledge,
  }),
}));

vi.mock("@heroui/react", () => {
  const ModalContext = createContext({ close: () => {} });
  const Backdrop = ({
    children,
    className,
    isOpen,
    onOpenChange,
  }: {
    children: ReactNode;
    className?: string;
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
  }) =>
    isOpen ? (
      <ModalContext.Provider value={{ close: () => onOpenChange(false) }}>
        <div className={className}>{children}</div>
      </ModalContext.Provider>
    ) : null;
  const Container = ({
    children,
    className,
    placement,
    size,
  }: {
    children: ReactNode;
    className?: string;
    placement?: string;
    size?: string;
  }) => (
    <div className={className} data-placement={placement} data-size={size}>
      {children}
    </div>
  );
  const Dialog = ({ children, className }: { children: ReactNode; className?: string }) => (
    <div className={className} role="dialog">
      {children}
    </div>
  );
  const CloseTrigger = () => {
    const modal = useContext(ModalContext);

    return <button aria-label="close-trigger" onClick={modal.close} />;
  };
  const Button = ({
    children,
    onPress,
    slot,
    isDisabled,
    ...props
  }: {
    children: ReactNode;
    onPress?: () => void;
    slot?: string;
    isDisabled?: boolean;
    [key: string]: unknown;
  }) => {
    const modal = useContext(ModalContext);

    return (
      <button
        disabled={isDisabled}
        onClick={() => {
          onPress?.();
          if (slot === "close") modal.close();
        }}
      >
        {children}
      </button>
    );
  };
  const Switch = Object.assign(
    ({
      children,
      isDisabled,
      isSelected,
      onChange,
      ...props
    }: {
      children: ReactNode;
      isDisabled?: boolean;
      isSelected?: boolean;
      onChange?: (value: boolean) => void;
      [key: string]: unknown;
    }) => (
      <label>
        <input
          aria-label={props["aria-label"] as string}
          checked={isSelected}
          disabled={isDisabled}
          type="checkbox"
          onChange={(event) => onChange?.(event.target.checked)}
        />
        {children}
      </label>
    ),
    {
      Content: ({ children }: { children: ReactNode }) => <>{children}</>,
      Control: ({ children }: { children: ReactNode }) => <>{children}</>,
      Thumb: () => null,
    }
  );
  const Alert = Object.assign(({ children }: { children: ReactNode }) => <div>{children}</div>, {
    Indicator: () => null,
    Content: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    Title: ({ children }: { children: ReactNode }) => <p>{children}</p>,
    Description: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  });

  return {
    Alert,
    Button,
    Chip: ({ children }: { children: ReactNode }) => <span>{children}</span>,
    Modal: Object.assign(() => null, {
      Backdrop,
      Body: ({ children, className }: { children: ReactNode; className?: string }) => (
        <div className={className}>{children}</div>
      ),
      CloseTrigger,
      Container,
      Dialog,
      Footer: ({ children }: { children: ReactNode }) => <footer>{children}</footer>,
      Header: ({ children }: { children: ReactNode }) => <header>{children}</header>,
      Heading: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
      Icon: ({ children }: { children: ReactNode }) => <span>{children}</span>,
    }),
    Switch,
  };
});

describe("OfflineStatusModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.connectivity.state = "online";
    mocks.connectivity.simulatedBackendUnavailable = false;
    mocks.offline.phase = "live";
    mocks.offline.usingCachedData = false;
    mocks.offline.persistenceWarning = null;
    mocks.offline.inventory.totalRecords = 6;
    mocks.diagnostics.pending = 0;
    mocks.diagnostics.retrying = 0;
    mocks.diagnostics.quarantined = 0;
    mocks.diagnostics.terminal = 0;
    mocks.diagnostics.expired = 0;
    mocks.diagnostics.attention = [];
    mocks.results.length = 0;
    mocks.opened = {};
  });

  it("shows status, responsive sizing, inventory, and a real retry action", async () => {
    render(<OfflineStatusModal isOpen returnFocusRef={{ current: null }} onOpenChange={vi.fn()} />);

    expect(screen.getByRole("dialog").parentElement).toHaveAttribute("data-size", "lg");
    expect(screen.getByRole("dialog")).toHaveClass("max-h-[calc(100dvh-2rem)]", "sm:max-w-2xl");
    expect(screen.getByText("connectivity.online")).toBeInTheDocument();
    expect(screen.getByText("data.live")).toBeInTheDocument();
    expect(screen.getByText("inventory.recipeSummaries")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /actions.retry/ }));
    await waitFor(() => expect(mocks.retryConnection).toHaveBeenCalledOnce());
  });

  it("requires confirmation before clearing only the active cache", async () => {
    render(<OfflineStatusModal isOpen returnFocusRef={{ current: null }} onOpenChange={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /actions.clear/ }));
    expect(screen.getByText("cache.clearConfirm")).toBeInTheDocument();
    expect(mocks.clearCachedData).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /actions.clear/ }));
    await waitFor(() => expect(mocks.clearCachedData).toHaveBeenCalledOnce());
  });

  it("shows persistence warnings, queue attention, and retained-result controls", async () => {
    mocks.offline.persistenceWarning = { code: "quota-exceeded" };
    mocks.diagnostics.pending = 2;
    mocks.diagnostics.retrying = 1;
    mocks.diagnostics.terminal = 1;
    mocks.diagnostics.attention = [
      { id: "entry-1", path: "groceries.create", state: "terminal", code: "BAD_REQUEST" },
    ];
    mocks.results.push({
      id: "result-1",
      entryId: "entry-1",
      backendOrigin: "http://localhost",
      userId: "user-1",
      operationId: "operation-1",
      path: "recipes.create",
      encryptedResponse: { iv: new ArrayBuffer(0), ciphertext: new ArrayBuffer(0) },
      createdAt: 1,
    });
    mocks.opened = { "result-1": { id: "recipe-1" } };

    render(<OfflineStatusModal isOpen returnFocusRef={{ current: null }} onOpenChange={vi.fn()} />);

    expect(screen.getByText("warnings.quota-exceeded")).toBeInTheDocument();
    expect(screen.getByText("groceries.create")).toBeInTheDocument();
    expect(screen.getByText(/recipe-1/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /actions.openResult/ }));
    fireEvent.click(screen.getByRole("button", { name: /actions.acknowledge/ }));
    await waitFor(() => {
      expect(mocks.open).toHaveBeenCalledOnce();
      expect(mocks.acknowledge).toHaveBeenCalledOnce();
    });
  });

  it("shows the development simulator and excludes it for production", async () => {
    render(<OfflineStatusModal isOpen returnFocusRef={{ current: null }} onOpenChange={vi.fn()} />);

    fireEvent.click(screen.getByRole("checkbox", { name: "simulation.title" }));
    await waitFor(() => expect(mocks.setSimulation).toHaveBeenCalledWith(true));
    expect(isBackendSimulatorEnabled("development")).toBe(true);
    expect(isBackendSimulatorEnabled("production")).toBe(false);
  });
});
