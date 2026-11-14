import ImageIO
import UIKit
import UniformTypeIdentifiers

/// What was shared, in the shape the import it goes to takes.
enum SharedItem {
  case link(URL)
  case text(String)
  /// JPEG data, already downscaled.
  case images([Data])

  // A long edge this size keeps a page legible.
  private static let maxPixelSize = 2048
  // ponytail: a memory guard, not a paste rule (the server takes any length and checks each recipe);
  // 1 MB of UTF-8 is far past any recipe text and small beside an extension's memory budget.
  private static let maxTextBytes = 1 << 20

  /// The first web link, else the images, else the text, from the share sheet's items;
  /// nil when there is none, an image fails to load, or the text is over `maxTextBytes`.
  static func load(from items: [NSExtensionItem]) async -> SharedItem? {
    let providers = items.flatMap { $0.attachments ?? [] }

    for provider in providers where provider.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
      if let url = try? await provider.loadItem(forTypeIdentifier: UTType.url.identifier) as? URL,
        isWebLink(url)
      {
        return .link(url)
      }
    }

    var loaded: [Data?] = []
    for provider in providers.prefix(ShareLimits.maxImages)
    where provider.hasItemConformingToTypeIdentifier(UTType.image.identifier) {
      // One image in memory at a time: extensions get a small memory budget.
      loaded.append(await downscaledJPEG(provider))
    }
    if !loaded.isEmpty { return allLoaded(loaded).map(SharedItem.images) }

    for provider in providers where provider.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) {
      guard let text = try? await provider.loadItem(forTypeIdentifier: UTType.plainText.identifier) as? String
      else { continue }
      let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
      // Apps that share a link as text: a lone web address imports as the link.
      if let url = URL(string: trimmed), isWebLink(url), !trimmed.contains(where: \.isWhitespace) {
        return .link(url)
      }
      // Over the guard, nothing is sent or saved.
      if !trimmed.isEmpty { return trimmed.utf8.count > maxTextBytes ? nil : .text(trimmed) }
    }

    return nil
  }

  /// The saved item's `kind`, the procedure that imports it, and a link's or text's input,
  /// whose field names the server and the saved item share.
  var route: (kind: String, procedure: String, fields: [String: String]) {
    switch self {
    case .link(let url): ("url", "recipes.importFromUrl", ["url": url.absoluteString])
    case .text(let text): ("text", "recipes.importFromPaste", ["text": text])
    case .images: ("images", "recipes.importFromImages", [:])
    }
  }

  /// Photos are read by AI, so their import needs it on.
  var needsAI: Bool {
    if case .images = self { true } else { false }
  }

  /// Every image, or nil when one failed: a recipe sent without one of its pages loses that page.
  static func allLoaded(_ images: [Data?]) -> [Data]? {
    let jpegs = images.compactMap { $0 }
    return jpegs.count == images.count ? jpegs : nil
  }

  private static func isWebLink(_ url: URL) -> Bool {
    ["http", "https"].contains(url.scheme?.lowercased() ?? "") && url.host != nil
  }

  /// The image as a JPEG at most `maxPixelSize` on its long edge, decoded by ImageIO without loading it whole.
  private static func downscaledJPEG(_ provider: NSItemProvider) async -> Data? {
    await withCheckedContinuation { continuation in
      _ = provider.loadFileRepresentation(forTypeIdentifier: UTType.image.identifier) { url, _ in
        guard let url, let source = CGImageSourceCreateWithURL(url as CFURL, nil) else {
          return continuation.resume(returning: nil)
        }
        let options: [CFString: Any] = [
          kCGImageSourceCreateThumbnailFromImageAlways: true,
          kCGImageSourceCreateThumbnailWithTransform: true,
          kCGImageSourceThumbnailMaxPixelSize: maxPixelSize,
        ]
        let jpeg = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary)
          .flatMap { UIImage(cgImage: $0).jpegData(compressionQuality: 0.85) }
        continuation.resume(returning: jpeg)
      }
    }
  }
}
