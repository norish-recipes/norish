export class FetchError extends Error {
  status: number;
  info?: unknown;

  constructor(message: string, status: number, info?: unknown) {
    super(message);
    this.name = "FetchError";
    this.status = status;
    this.info = info;
  }
}

export const fetcher = async (...args: Parameters<typeof fetch>) => {
  const res = await fetch(...args);

  if (!res.ok) {
    const info = await res.json().catch(() => ({}));

    throw new FetchError(info?.error || `HTTP error ${res.status}`, res.status, info);
  }

  return res.json();
};
