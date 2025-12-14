export interface CreateEventInput {
  summary: string;
  description?: string;
  start: Date;
  end: Date;
  uid?: string;
  url?: string;
  location?: string;
}

export interface CreatedEvent {
  uid: string;
  href: string;
  etag?: string;
  rawIcs: string;
}

export interface CalDavClientOptions {
  baseUrl: string;
  username: string;
  password: string;
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
}
