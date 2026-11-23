import ExpoModulesCore
import UIKit

struct NativeMenuItem: Record {
  @Field var id: String = ""
  @Field var title: String = ""
  @Field var systemImage: String?
  @Field var destructive: Bool = false
  @Field var tint: String?
}

public class NativeMenuModule: Module {
  public func definition() -> ModuleDefinition {
    Name("NativeMenu")

    View(NativeMenuView.self) {
      Events("onSelect", "onPress")

      Prop("items") { (view: NativeMenuView, items: [NativeMenuItem]) in
        view.items = items
      }
      Prop("longPress") { (view: NativeMenuView, longPress: Bool) in
        view.longPress = longPress
      }
      Prop("label") { (view: NativeMenuView, label: String) in
        view.button.accessibilityLabel = label
      }
      Prop("identifier") { (view: NativeMenuView, identifier: String) in
        view.button.accessibilityIdentifier = identifier
      }
    }
  }
}

/// A UIButton that reports UIKit's highlight, which is on while a finger is down on it.
class MenuButton: UIButton {
  var onHighlight: ((Bool) -> Void)?

  override var isHighlighted: Bool {
    didSet { if isHighlighted != oldValue { onHighlight?(isHighlighted) } }
  }
}

/// A clear UIButton over the React Native children that opens a UIMenu on tap, or with `longPress`
/// on a long press (the lifted view is the children) while a tap reports `onPress`. It is a plain
/// UIKit view in the scroll view, so it moves with its content before and after the menu opens.
class NativeMenuView: ExpoView, UIContextMenuInteractionDelegate {
  let button = MenuButton(type: .custom)
  let onSelect = EventDispatcher()
  let onPress = EventDispatcher()
  private var interaction: UIContextMenuInteraction?

  var items: [NativeMenuItem] = [] {
    didSet { applyTrigger() }
  }

  var longPress = false {
    didSet { applyTrigger() }
  }

  private func applyTrigger() {
    button.showsMenuAsPrimaryAction = !longPress
    button.menu = longPress ? nil : makeMenu()
    if longPress, interaction == nil {
      let added = UIContextMenuInteraction(delegate: self)
      addInteraction(added)
      interaction = added
    } else if !longPress, let added = interaction {
      removeInteraction(added)
      interaction = nil
    }
  }

  func contextMenuInteraction(
    _ interaction: UIContextMenuInteraction, configurationForMenuAtLocation location: CGPoint
  ) -> UIContextMenuConfiguration? {
    guard !items.isEmpty else { return nil }

    // UIKit snapshots this view for the lifted preview after this returns: undo the press dim first.
    for subview in subviews where subview !== button {
      subview.layer.removeAllAnimations()
      subview.alpha = 1
    }

    return UIContextMenuConfiguration(identifier: nil, previewProvider: nil) { [weak self] _ in
      self?.makeMenu()
    }
  }

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    button.showsMenuAsPrimaryAction = true
    button.addAction(UIAction { [weak self] _ in self?.onPress() }, for: .touchUpInside)
    button.onHighlight = { [weak self] pressed in self?.dim(pressed) }
    addSubview(button)
  }

  /// The pressed state: what React Native draws under the clear button dims while it is held.
  private func dim(_ pressed: Bool) {
    UIView.animate(withDuration: pressed ? 0.05 : 0.2) {
      for subview in self.subviews where subview !== self.button {
        subview.alpha = pressed ? 0.4 : 1
      }
    }
  }

  override func didAddSubview(_ subview: UIView) {
    super.didAddSubview(subview)
    // React Native mounts its children after the button: keep the button on top to take the tap.
    if subview !== button { bringSubviewToFront(button) }
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    button.frame = bounds
  }

  private func makeMenu() -> UIMenu {
    UIMenu(children: items.map { item in
      UIAction(
        title: item.title,
        image: item.systemImage.flatMap { UIImage(systemName: $0) }.map { image in
          item.tint.flatMap { UIColor(hex: $0) }.map {
            image.withTintColor($0, renderingMode: .alwaysOriginal)
          } ?? image
        },
        attributes: item.destructive ? .destructive : []
      ) { [weak self] _ in
        self?.onSelect(["id": item.id])
      }
    })
  }
}

extension UIColor {
  /// "#rrggbb" as a colour; nil when it is not one.
  convenience init?(hex: String) {
    var digits = hex
    if digits.hasPrefix("#") { digits.removeFirst() }
    guard digits.count == 6, let value = UInt32(digits, radix: 16) else { return nil }
    self.init(
      red: CGFloat((value >> 16) & 0xff) / 255, green: CGFloat((value >> 8) & 0xff) / 255,
      blue: CGFloat(value & 0xff) / 255, alpha: 1)
  }
}
