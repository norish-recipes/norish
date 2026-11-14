import Foundation
import Security

/// The Server Address and session cookie the app keeps in the keychain it shares with this extension.
/// Read only: the app writes, refreshes and removes them.
struct SharedSession {
  let address: String
  let cookie: String

  /// `group.` + the containing app's bundle id, which is this extension's minus its last part.
  static let appGroup: String? = Bundle.main.bundleIdentifier.map {
    "group." + ($0 as NSString).deletingPathExtension
  }

  // expo-secure-store's service for the app's "norish.shared" store; accounts are the keys' UTF-8.
  private static let service = "norish.shared:no-auth"
  // Better Auth's marker for a value split over chunk keys, control character included.
  private static let chunkMarker = "\u{1}ba-chunks:"

  /// The session, or nil before the app moved its keychain, without a Server Address, or signed out.
  static func read() -> SharedSession? {
    guard let group = appGroup, item("norish_keychain_moved", group) == "1",
      let address = value("norish.backend-base-url", group), !address.isEmpty,
      let stored = value("norish_cookie", group), let cookie = cookieHeader(stored)
    else { return nil }

    return SharedSession(address: address, cookie: cookie)
  }

  /// The Cookie header Better Auth's `getCookie` builds from the stored JSON, expired cookies left out.
  static func cookieHeader(_ stored: String) -> String? {
    guard let data = stored.data(using: .utf8),
      let cookies = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
    else { return nil }
    let iso = ISO8601DateFormatter()
    iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

    let pairs = cookies.sorted { $0.key < $1.key }.compactMap { name, entry -> String? in
      guard let entry = entry as? [String: Any], let value = entry["value"] as? String else {
        return nil
      }
      if let expires = (entry["expires"] as? String).flatMap(iso.date(from:)), expires < Date() {
        return nil
      }
      return "\(name)=\(value)"
    }

    return pairs.isEmpty ? nil : pairs.joined(separator: "; ")
  }

  /// A value as Better Auth's storage adapter wrote it: whole, or a marker naming its chunks.
  private static func value(_ key: String, _ group: String) -> String? {
    guard let base = item(key, group) else { return nil }
    guard base.hasPrefix(chunkMarker) else { return base }

    let parts = base.dropFirst(chunkMarker.count).split(separator: ":", omittingEmptySubsequences: false)
    let counts = parts.map { Int($0).flatMap { (1...100).contains($0) ? $0 : nil } }
    guard (1...3).contains(parts.count), let count = counts[0] else { return nil }
    guard parts.count > 1 else { return chunks(key, slot: nil, count: count, group) }
    guard let slot = Int(parts[1]), slot == 0 || slot == 1 else { return nil }

    if let whole = chunks(key, slot: slot, count: count, group) { return whole }
    // An interrupted rewrite keeps the previous slot readable, as the adapter's reader does.
    guard parts.count == 3, let fallback = counts[2] else { return nil }
    return chunks(key, slot: 1 - slot, count: fallback, group)
  }

  private static func chunks(_ key: String, slot: Int?, count: Int, _ group: String) -> String? {
    var whole = ""
    for index in 0..<count {
      let name = slot.map { "\(key).\($0).\(index)" } ?? "\(key).\(index)"
      guard let chunk = item(name, group), !chunk.isEmpty else { return nil }
      whole += chunk
    }
    return whole
  }

  private static func item(_ key: String, _ group: String) -> String? {
    let query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: service,
      kSecAttrAccount as String: Data(key.utf8),
      kSecAttrAccessGroup as String: group,
      kSecMatchLimit as String: kSecMatchLimitOne,
      kSecReturnData as String: true,
    ]
    var result: CFTypeRef?
    guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
      let data = result as? Data
    else { return nil }

    return String(data: data, encoding: .utf8)
  }
}
