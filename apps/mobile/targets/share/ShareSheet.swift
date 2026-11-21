import SwiftUI

/// What the sheet shows of the shared item, and how far the share got.
@MainActor
final class ShareModel: ObservableObject {
  enum Phase: Equatable { case sending, ended(ShareOutcome) }

  struct Preview {
    var title: String
    var subtitle: String?
    var thumbnails: [UIImage] = []
    var symbol = "link"
  }

  @Published var phase = Phase.sending
  @Published var preview: Preview?
  var close: () -> Void = {}
}

/// A glass card at the bottom, as tall as its content, over a scrim.
struct ShareSheet: View {
  @ObservedObject var model: ShareModel

  // A swipe down is the system sheet's own dismissal, which the card sits in.
  var body: some View {
    ZStack(alignment: .bottom) {
      Palette.scrim.ignoresSafeArea().onTapGesture(perform: model.close)
      card.glassCard().padding(.horizontal, 8).padding(.bottom, 8)
    }
    .ignoresSafeArea(edges: .bottom)
  }

  private var card: some View {
    VStack(spacing: 0) {
      Capsule().fill(Palette.muted.opacity(0.4)).frame(width: 36, height: 5).padding(.bottom, 12)

      HStack {
        Image("Logo").resizable().scaledToFit().frame(height: 26).accessibilityLabel(appName)
        Spacer()
        GlassCloseButton(action: model.close)
      }
      .frame(height: 40)
      .padding(.leading, 8)
      .padding(.trailing, 4)

      if let preview = model.preview { ItemRow(preview: preview).padding(.top, 14) }

      StatusView(phase: model.phase)
        .frame(maxWidth: .infinity, minHeight: 150, alignment: .top)
        .padding(.top, 26)
        .padding(.horizontal, 12)
        .padding(.bottom, 8)

      if case .ended(let outcome) = model.phase, outcome != .sent {
        Button(action: model.close) {
          Text(closeLabel)
            .font(.system(size: 16, weight: .semibold))
            .foregroundStyle(.primary)
            .frame(maxWidth: .infinity, minHeight: 50)
            .background(Palette.surface, in: Capsule())
        }
        .buttonStyle(.plain)
        .padding(.top, 14)
        .accessibilityIdentifier("share-close")
      }
    }
    .padding(.horizontal, 16)
    .padding(.top, 8)
    .padding(.bottom, 24)
    .animation(.easeOut(duration: 0.25), value: model.phase)
  }
}

private let closeLabel = String(localized: "close")
// The extension's display name, which its target config takes from the app's.
private let appName = Bundle.main.object(forInfoDictionaryKey: "CFBundleDisplayName") as? String ?? ""

private extension View {
  /// The card's only fill is glass: Liquid Glass from iOS 26, the thick material before it.
  @ViewBuilder func glassCard() -> some View {
    let shape = RoundedRectangle(cornerRadius: 44, style: .continuous)
    if #available(iOS 26.0, *) {
      glassEffect(.regular, in: shape)
    } else {
      background(.thickMaterial, in: shape)
    }
  }
}

private struct GlassCloseButton: View {
  let action: () -> Void

  var body: some View {
    let button = Button(action: action) {
      Image(systemName: "xmark").font(.system(size: 16, weight: .semibold)).frame(width: 40, height: 40)
    }
    .accessibilityLabel(closeLabel)
    .accessibilityIdentifier("share-dismiss")

    if #available(iOS 26.0, *) {
      button.buttonStyle(.glass).buttonBorderShape(.circle)
    } else {
      button.buttonStyle(.bordered).buttonBorderShape(.capsule).tint(.primary)
    }
  }
}

private struct ItemRow: View {
  let preview: ShareModel.Preview

  var body: some View {
    HStack(spacing: 12) {
      thumbnail.frame(width: 52, height: 52)
      VStack(alignment: .leading, spacing: 2) {
        Text(preview.title).font(.system(size: 16, weight: .semibold)).lineLimit(1)
        if let subtitle = preview.subtitle {
          Text(subtitle).font(.system(size: 14)).foregroundStyle(Palette.muted).lineLimit(1)
        }
      }
      Spacer(minLength: 0)
    }
    .padding(10)
    .background(Palette.surface, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
  }

  @ViewBuilder private var thumbnail: some View {
    switch preview.thumbnails.count {
    case 0:
      Image(systemName: preview.symbol)
        .font(.system(size: 20, weight: .medium))
        .foregroundStyle(Palette.muted)
        .frame(width: 52, height: 52)
        .background(Palette.fill, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    case 1:
      tile(preview.thumbnails[0], size: 52, radius: 14)
    default:
      // The first two photos, fanned.
      ZStack(alignment: .topLeading) {
        tile(preview.thumbnails[0], size: 40, radius: 11).rotationEffect(.degrees(-8)).offset(y: 6)
        tile(preview.thumbnails[1], size: 40, radius: 11).offset(x: 12, y: 6)
      }
      .frame(width: 52, height: 52, alignment: .topLeading)
    }
  }

  private func tile(_ image: UIImage, size: CGFloat, radius: CGFloat) -> some View {
    Image(uiImage: image).resizable().scaledToFill().frame(width: size, height: size)
      .clipShape(RoundedRectangle(cornerRadius: radius, style: .continuous))
      .overlay(RoundedRectangle(cornerRadius: radius, style: .continuous).stroke(Palette.surface, lineWidth: 2))
  }
}

private struct StatusView: View {
  let phase: ShareModel.Phase
  @Environment(\.accessibilityReduceMotion) private var reduceMotion
  @State private var shake: CGFloat = 0

  var body: some View {
    VStack(spacing: 6) {
      switch phase {
      case .sending:
        badge(fill: Palette.fill) { ProgressView().tint(Palette.accentText).controlSize(.large) }
        title(String(localized: "sending"))
      case .ended(.sent):
        badge(fill: Palette.accent) {
          Image(systemName: "checkmark").font(.system(size: 26, weight: .bold)).foregroundStyle(Palette.accentForeground)
        }
        title(String(localized: "sentTitle"))
        line(String(localized: "sentBody"))
      case .ended(.saved):
        badge(fill: Palette.fill) {
          Image(systemName: "icloud.slash").font(.system(size: 24, weight: .medium)).foregroundStyle(Palette.muted)
        }
        title(String(localized: "savedTitle"))
        line(String(localized: "savedBody"))
      case .ended(let outcome):
        badge(fill: Palette.dangerSoft) {
          Image(systemName: "exclamationmark.circle").font(.system(size: 26, weight: .medium))
            .foregroundStyle(Palette.danger).offset(x: shake)
        }
        Text(Self.failureLine(outcome))
          .font(.system(size: 17, weight: .medium))
          .multilineTextAlignment(.center)
          .accessibilityIdentifier("share-failure")
          .onAppear(perform: playShake)
      }
    }
    .transition(.opacity)
  }

  static func failureLine(_ outcome: ShareOutcome) -> String {
    switch outcome {
    case .signedOut: String(localized: "signedOut")
    case .tooOld: String(localized: "tooOld")
    case .noAi: String(localized: "noAi")
    default: String(localized: "failed")
    }
  }

  /// One shake on a failure; none under Reduce Motion.
  private func playShake() {
    guard !reduceMotion else { return }
    for (index, offset) in [-3.0, 3, -2, 2, 0].enumerated() {
      withAnimation(.easeInOut(duration: 0.08).delay(0.1 + Double(index) * 0.08)) { shake = offset }
    }
  }

  private func badge<Content: View>(fill: Color, @ViewBuilder content: () -> Content) -> some View {
    content().frame(width: 60, height: 60).background(fill, in: Circle()).padding(.bottom, 8)
  }

  private func title(_ text: String) -> some View {
    Text(text).font(.system(size: 20, weight: .semibold)).tracking(-0.44).multilineTextAlignment(.center)
  }

  private func line(_ text: String) -> some View {
    Text(text).font(.system(size: 15)).foregroundStyle(Palette.muted).multilineTextAlignment(.center)
  }
}
