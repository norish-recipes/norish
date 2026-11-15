import SwiftUI
import UIKit
import UniformTypeIdentifiers

/// The share sheet's entry: reads what was shared, imports it in place and closes; it never opens the app.
final class ShareViewController: UIViewController {
  private let model = ShareModel()
  private lazy var host = UIHostingController(rootView: ShareSheet(model: model))
  private var finished = false

  // Long enough to read the sent line before the sheet closes itself.
  private static let sentLinger: TimeInterval = 1.6
  // The link row's 52-point thumbnail at 3x.
  private static let previewImageSize = CGSize(width: 156, height: 156)

  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = .clear
    model.close = { [weak self] in self?.finish() }

    host.view.backgroundColor = .clear
    addChild(host)
    view.addSubview(host.view)
    host.view.translatesAutoresizingMaskIntoConstraints = false
    NSLayoutConstraint.activate([
      host.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
      host.view.trailingAnchor.constraint(equalTo: view.trailingAnchor),
      host.view.topAnchor.constraint(equalTo: view.topAnchor),
      host.view.bottomAnchor.constraint(equalTo: view.bottomAnchor),
    ])
    host.didMove(toParent: self)

    Task { await run() }
  }

  override func viewIsAppearing(_ animated: Bool) {
    super.viewIsAppearing(animated)
    // iOS hosts the extension in a full-height sheet whose containers paint the system background;
    // clearing them leaves only the card, sized to its content, over the page that shared.
    var ancestor = view.superview
    while let container = ancestor {
      container.backgroundColor = .clear
      ancestor = container.superview
    }
  }

  private func run() async {
    let items = extensionContext?.inputItems.compactMap { $0 as? NSExtensionItem } ?? []
    guard let item = await SharedItem.load(from: items) else { return end(.failed) }
    model.preview = await Self.preview(of: item, in: items)

    guard let session = SharedSession.read() else { return end(.signedOut) }
    // One id per share: the import's operation id and the saved item's, so the server runs it once.
    let shareId = UUID().uuidString.lowercased()
    let outcome = await ImportClient(session: session).send(item, operationId: shareId)
    guard outcome == .saved else { return end(outcome) }

    do {
      try ShareInbox.save(item, id: shareId, for: session)
      end(.saved)
    } catch {
      end(.failed)
    }
  }

  private func end(_ outcome: ShareOutcome) {
    model.phase = .ended(outcome)
    let feedback = UINotificationFeedbackGenerator()
    feedback.notificationOccurred(outcome == .sent ? .success : outcome == .saved ? .warning : .error)
    // Sent closes by itself; every other state waits for Close.
    if outcome == .sent {
      DispatchQueue.main.asyncAfter(deadline: .now() + Self.sentLinger) { [weak self] in self?.finish() }
    }
  }

  private func finish() {
    guard !finished else { return }
    finished = true
    extensionContext?.completeRequest(returningItems: nil)
  }

  private static func preview(of item: SharedItem, in items: [NSExtensionItem]) async -> ShareModel.Preview {
    switch item {
    case .link(let url):
      let title = items.lazy.compactMap { ($0.attributedContentText ?? $0.attributedTitle)?.string }
        .first { !$0.isEmpty && $0 != url.absoluteString }
      let host = url.host.map { $0.hasPrefix("www.") ? String($0.dropFirst(4)) : $0 }
      let image = await previewImage(items)
      return .init(
        title: title ?? host ?? url.absoluteString, subtitle: title == nil ? nil : host,
        thumbnails: image.map { [$0] } ?? [])
    case .text(let text):
      let first = text.split(whereSeparator: \.isNewline).first.map(String.init) ?? text
      return .init(title: first, subtitle: String(localized: "text"), symbol: "text.alignleft")
    case .images(let images):
      let title = String.localizedStringWithFormat(NSLocalizedString("photoCount", comment: ""), images.count)
      return .init(title: title, thumbnails: images.prefix(2).compactMap(UIImage.init(data:)), symbol: "photo")
    }
  }

  /// The page image Safari offers with a link, if any.
  private static func previewImage(_ items: [NSExtensionItem]) async -> UIImage? {
    guard let provider = items.flatMap({ $0.attachments ?? [] })
      .first(where: { $0.hasItemConformingToTypeIdentifier(UTType.url.identifier) })
    else { return nil }
    let options = [NSItemProviderPreferredImageSizeKey: NSValue(cgSize: previewImageSize)]

    return await withCheckedContinuation { continuation in
      provider.loadPreviewImage(options: options) { image, _ in
        continuation.resume(returning: image as? UIImage)
      }
    }
  }
}
