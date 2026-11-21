import ExpoModulesCore
import UIKit

public class TabAccessoryPlacementModule: Module {
  public func definition() -> ModuleDefinition {
    Name("TabAccessoryPlacement")

    View(TabAccessoryPlacementView.self) {
      Events("onPlacementChange")
    }
  }
}

/// Mounted inside the tab bar's bottom accessory, it reads the accessory's environment trait,
/// which UIKit sets as the bar minimises or expands, and reports each change.
class TabAccessoryPlacementView: ExpoView {
  let onPlacementChange = EventDispatcher()
  private var reported: String?

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    isUserInteractionEnabled = false
    if #available(iOS 26.0, *) {
      registerForTraitChanges([UITraitTabAccessoryEnvironment.self]) { (view: Self, _) in
        view.report()
      }
    }
  }

  override func didMoveToWindow() {
    super.didMoveToWindow()
    report()
  }

  private func report() {
    guard #available(iOS 26.0, *) else { return }
    let placement: String
    switch traitCollection.tabAccessoryEnvironment {
    case .inline: placement = "inline"
    case .regular: placement = "expanded"
    default: return
    }
    guard placement != reported else { return }
    reported = placement
    onPlacementChange(["placement": placement])
  }
}
