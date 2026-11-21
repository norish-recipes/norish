import ExpoModulesCore
import UIKit

struct NativeMenuItem: Record {
  @Field var id: String = ""
  @Field var title: String = ""
  @Field var systemImage: String?
  @Field var destructive: Bool = false
}

public class NativeMenuModule: Module {
  public func definition() -> ModuleDefinition {
    Name("NativeMenu")

    View(NativeMenuView.self) {
      Events("onSelect")

      Prop("items") { (view: NativeMenuView, items: [NativeMenuItem]) in
        view.items = items
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

/// A clear UIButton over the React Native children that opens a UIMenu on tap. It is a plain
/// UIKit view in the scroll view, so it moves with its content before and after the menu opens.
class NativeMenuView: ExpoView {
  let button = MenuButton(type: .custom)
  let onSelect = EventDispatcher()

  var items: [NativeMenuItem] = [] {
    didSet { button.menu = makeMenu() }
  }

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    button.showsMenuAsPrimaryAction = true
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
        image: item.systemImage.flatMap { UIImage(systemName: $0) },
        attributes: item.destructive ? .destructive : []
      ) { [weak self] _ in
        self?.onSelect(["id": item.id])
      }
    })
  }
}
