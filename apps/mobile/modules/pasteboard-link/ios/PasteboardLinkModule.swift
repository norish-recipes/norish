import ExpoModulesCore
import UIKit

public class PasteboardLinkModule: Module {
  public func definition() -> ModuleDefinition {
    Name("PasteboardLink")

    // detectPatterns reads the pasteboard's shape, so it raises no paste prompt.
    AsyncFunction("hasProbableWebUrl") { (promise: Promise) in
      UIPasteboard.general.detectPatterns(for: [.probableWebURL]) { result in
        switch result {
        case .success(let patterns): promise.resolve(patterns.contains(.probableWebURL))
        case .failure: promise.resolve(false)
        }
      }
    }

    // detectValues reads the content, so it raises the paste prompt like a string read.
    AsyncFunction("probableWebUrl") { (promise: Promise) in
      UIPasteboard.general.detectValues(for: [.probableWebURL]) { result in
        switch result {
        case .success(let values): promise.resolve(values[.probableWebURL] as? String)
        case .failure(let error): promise.reject("ERR_PASTEBOARD_READ", error.localizedDescription)
        }
      }
    }
  }
}
