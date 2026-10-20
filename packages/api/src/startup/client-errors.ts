import type { Duplex } from "node:stream";

const LENGTH_ERROR_CODES = new Set([
  "HPE_INVALID_CONTENT_LENGTH",
  "HPE_UNEXPECTED_CONTENT_LENGTH",
  "HPE_INVALID_TRANSFER_ENCODING",
]);

export function writeClientError(error: Error, socket: Duplex): void {
  const code = (error as NodeJS.ErrnoException).code;
  const lengthRequired = code !== undefined && LENGTH_ERROR_CODES.has(code);
  const status = lengthRequired ? "411 Length Required" : "400 Bad Request";
  const body = lengthRequired ? "Length required" : "Bad request";

  socket.end(
    `HTTP/1.1 ${status}\r\nConnection: close\r\nContent-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`
  );
}
