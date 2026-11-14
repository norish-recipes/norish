import ImageIO
import UIKit
import UniformTypeIdentifiers

/// What was shared, in the shape the import it goes to takes.
enum SharedItem {
  case link(URL)
  case text(String)
  /// JPEG data, already downscaled.
  case images([Data])

  // The server takes at most ten photos per import; a long edge this size keeps a page legible.
  static let maxImages = 10
  private static let maxPixelSize = 2048

  /// The first web link, else the images, else the text, from the share sheet's items.
  static func load(from items: [NSExtensionItem]) async -> SharedItem? {
    let providers = items.flatMap { $0.attachments ?? [] }

    for provider in providers where provider.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
      if let url = try? await provider.loadItem(forTypeIdentifier: UTType.url.identifier) as? URL,
        isWebLink(url)
      {
        return .link(url)
      }
    }

    var images: [Data] = []
    for provider in providers.prefix(maxImages)
    where provider.hasItemConformingToTypeIdentifier(UTType.image.identifier) {
      // One image in memory at a time: extensions get a small memory budget.
      if let jpeg = await downscaledJPEG(provider) { images.append(jpeg) }
    }
    if !images.isEmpty { return .images(images) }

    for provider in providers where provider.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) {
      guard let text = try? await provider.loadItem(forTypeIdentifier: UTType.plainText.identifier) as? String
      else { continue }
      let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
      // Apps that share a link as text: a lone web address imports as the link.
      if let url = URL(string: trimmed), isWebLink(url), !trimmed.contains(where: \.isWhitespace) {
        return .link(url)
      }
      if !trimmed.isEmpty { return .text(trimmed) }
    }

    return nil
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
