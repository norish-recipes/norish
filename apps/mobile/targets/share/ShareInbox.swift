import Foundation

/// Shares that found no server, kept in the App Group for the app to import into its Outbox.
/// `share-inbox/<id>.json` names its images `<id>-<n>.jpg`; the images are written first, the JSON last.
enum ShareInbox {
  static func save(_ item: SharedItem, for session: SharedSession) throws {
    guard let group = SharedSession.appGroup,
      let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group)
    else { throw CocoaError(.fileNoSuchFile) }
    let folder = container.appendingPathComponent("share-inbox", isDirectory: true)
    try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)

    let id = UUID().uuidString.lowercased()
    // The app drops an item saved for another server rather than import it there.
    var entry: [String: Any] = [
      "serverAddress": session.address,
      "savedAt": ISO8601DateFormatter().string(from: Date()),
    ]
    switch item {
    case .link(let url):
      entry["kind"] = "url"
      entry["url"] = url.absoluteString
    case .text(let text):
      entry["kind"] = "text"
      entry["text"] = text
    case .images(let images):
      entry["kind"] = "images"
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
