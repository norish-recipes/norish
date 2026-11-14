import Foundation

/// How a share ended, each with its own line on the sheet.
enum ShareOutcome: Equatable {
  case sent, saved, signedOut, tooOld, noAi, failed
}

/// The app's three import requests, sent with the session cookie to the Server Address only.
final class ImportClient: NSObject, URLSessionTaskDelegate {
  private let session: SharedSession
  private let origin: String?
  private lazy var urlSession: URLSession = {
    let configuration = URLSessionConfiguration.ephemeral
    // The cookie is set by hand per request; nothing is stored or picked up from a jar.
    configuration.httpCookieStorage = nil
    configuration.httpShouldSetCookies = false
    configuration.urlCache = nil
    configuration.timeoutIntervalForRequest = 20
    return URLSession(configuration: configuration, delegate: self, delegateQueue: nil)
  }()

  init(session: SharedSession) {
    self.session = session
    origin = URL(string: session.address).flatMap(Self.origin)
  }

  /// Health first, AI for images, then the import; no HTTP answer at any step means saved for later.
  /// `operationId` goes in `x-operation-id`, so a timed-out import the drain sends again runs once.
  func send(_ item: SharedItem, operationId: String) async -> ShareOutcome {
    if let outcome = await health() { return outcome }
    if item.needsAI {
      guard let reply = await request("GET", "/api/trpc/permissions.get") else { return .saved }
      if reply.status == 401 { return .signedOut }
      if Self.isRetryable(reply.status) { return .saved }
      guard reply.status == 200, let data = reply.data(), let json = data["json"] as? [String: Any]
      else { return .failed }
      if json["isAIEnabled"] as? Bool != true { return .noAi }
    }

    let (_, procedure, fields) = item.route
    let path = "/api/trpc/" + procedure
    let reply: Reply?
    // Photos go as the form-data link's multipart, the rest as superjson.
    if case .images(let images) = item {
      reply = await request("POST", path, images: images, operationId: operationId)
    } else {
      reply = await request("POST", path, json: ["json": fields], operationId: operationId)
    }

    guard let reply else { return .saved }
    if reply.status == 401 { return .signedOut }
    // A 504 can hide an import the server took; the drain resends it under the same operation id.
    if Self.isRetryable(reply.status) { return .saved }
    return reply.status == 200 && reply.data() != nil ? .sent : .failed
  }

  /// Nil when a Norish server new enough answered; the deprecated route, as the app's gate reads it.
  private func health() async -> ShareOutcome? {
    guard let reply = await request("GET", "/api/v1/health", withCookie: false) else { return .saved }
    // A reverse proxy answering for a server that is down is the server being unreachable.
    if Self.isRetryable(reply.status) { return .saved }
    guard reply.status == 200, let health = reply.json,
      health["status"] as? String == "ok", health["parser"] is [String: Any]
    else { return .failed }

    guard let version = health["version"] as? String, !Self.isOlder(version, than: Self.minimumServerVersion)
    else { return .tooOld }
    return nil
  }

  /// An answer the app's drain retries, as `classifyReplayError` calls a status ambiguous.
  static func isRetryable(_ status: Int) -> Bool { status >= 500 || status == 408 || status == 429 }

  /// The containing app's `major.minor.0`, as the app's `MINIMUM_SERVER_VERSION`.
  static let minimumServerVersion: String = {
    // The extension sits in the app's PlugIns folder.
    let app = Bundle(url: Bundle.main.bundleURL.deletingLastPathComponent().deletingLastPathComponent())
    let version = app?.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "0.0.0"
    return numbers(version).prefix(2).map(String.init).joined(separator: ".") + ".0"
  }()

  static func isOlder(_ version: String, than minimum: String) -> Bool {
    numbers(version).lexicographicallyPrecedes(numbers(minimum))
  }

  /// `major.minor.patch` as numbers, a suffix such as `-beta` dropped, as shared/lib/version.ts reads it.
  private static func numbers(_ version: String) -> [Int] {
    let base = version.split(separator: "-", maxSplits: 1).first ?? ""
    let parts = base.split(separator: ".", omittingEmptySubsequences: false).map { Int($0) ?? 0 }
    return (0..<3).map { $0 < parts.count ? parts[$0] : 0 }
  }

  private struct Reply {
    let status: Int
    let json: [String: Any]?
    /// tRPC's `result.data`, present only on a success.
    func data() -> [String: Any]? {
      (json?["result"] as? [String: Any])?["data"] as? [String: Any]
    }
  }

  /// Nil when no HTTP answer came back.
  private func request(
    _ method: String, _ path: String, withCookie: Bool = true, json: Any? = nil, images: [Data]? = nil,
    operationId: String? = nil
  ) async -> Reply? {
    guard let url = URL(string: session.address + path) else { return nil }
    var request = URLRequest(url: url)
    request.httpMethod = method
    request.setValue("application/json", forHTTPHeaderField: "Accept")
    if withCookie { request.setValue(session.cookie, forHTTPHeaderField: "Cookie") }
    if let operationId { request.setValue(operationId, forHTTPHeaderField: "x-operation-id") }
    if let json {
      request.setValue("application/json", forHTTPHeaderField: "Content-Type")
      request.httpBody = try? JSONSerialization.data(withJSONObject: json)
    }
    if let images {
      let boundary = "norish-\(UUID().uuidString)"
      request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
      request.httpBody = Self.multipart(images, boundary: boundary)
    }

    guard let (body, response) = try? await urlSession.data(for: request),
      let http = response as? HTTPURLResponse
    else { return nil }
    let parsed = (try? JSONSerialization.jsonObject(with: body)) as? [String: Any]
    return Reply(status: http.statusCode, json: parsed)
  }

  /// `file0…fileN`, the fields the app's form-data link sends to `importFromImages`.
  private static func multipart(_ images: [Data], boundary: String) -> Data {
    var body = Data()
    for (index, image) in images.enumerated() {
      body.append(Data("--\(boundary)\r\n".utf8))
      body.append(Data("Content-Disposition: form-data; name=\"file\(index)\"; filename=\"photo-\(index + 1).jpg\"\r\n".utf8))
      body.append(Data("Content-Type: image/jpeg\r\n\r\n".utf8))
      body.append(image)
      body.append(Data("\r\n".utf8))
    }
    body.append(Data("--\(boundary)--\r\n".utf8))
    return body
  }

  static func origin(_ url: URL) -> String? {
    guard let scheme = url.scheme?.lowercased(), let host = url.host?.lowercased() else { return nil }
    let port = url.port ?? (scheme == "https" ? 443 : scheme == "http" ? 80 : -1)
    return "\(scheme)://\(host):\(port)"
  }

  /// A redirect is followed only within the Server Address's origin, and keeps the cookie there.
  func urlSession(
    _ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse,
    newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void
  ) {
    guard let target = request.url.flatMap(Self.origin), target == origin else {
      return completionHandler(nil)
    }
    var followed = request
    if task.originalRequest?.value(forHTTPHeaderField: "Cookie") != nil {
      followed.setValue(self.session.cookie, forHTTPHeaderField: "Cookie")
    }
    completionHandler(followed)
  }
}
