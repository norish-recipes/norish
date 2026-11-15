import Foundation

/// Shares that found no server, kept in the App Group for the app to import into its Outbox.
/// `share-inbox/<id>.json` names its images `<id>-<n>.jpg`; the images are written first, the JSON last.
enum ShareInbox {
  /// `id` is the operation id the import was sent under, which the app's drain sends again.
  static func save(_ item: SharedItem, id: String, for session: SharedSession) throws {
    guard let group = SharedSession.appGroup,
      let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group)
    else { throw CocoaError(.fileNoSuchFile) }
    let folder = container.appendingPathComponent("share-inbox", isDirectory: true)
    try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)

    // The app imports it only into this account on this server, as its Outbox keeps an entry for its owner.
    let (kind, _, fields) = item.route
    var entry: [String: Any] = fields
    entry["kind"] = kind
    entry["ownerId"] = session.userId
    entry["serverAddress"] = session.address
    entry["savedAt"] = ISO8601DateFormatter().string(from: Date())
    if case .images(let images) = item {
      entry["images"] = try images.enumerated().map { index, image in
        let name = "\(id)-\(index).jpg"
        try image.write(to: folder.appendingPathComponent(name), options: .atomic)
        return name
      }
    }

    let json = try JSONSerialization.data(withJSONObject: entry)
    try json.write(to: folder.appendingPathComponent("\(id).json"), options: .atomic)
  }
}
