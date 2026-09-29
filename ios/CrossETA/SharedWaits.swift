// Hands the user's starred crossings to the home-screen widget through the shared App Group,
// and asks WidgetKit to redraw. JS side: sharedWaits.js. (Exposed to React Native by SharedWaits.m,
// because WidgetCenter is Swift-only.)
import Foundation
import WidgetKit

@objc(SharedWaits)
final class SharedWaits: NSObject {
  private static let appGroup = "group.com.diegovillarreal.crosseta"
  private static let snapshotKey = "snapshot"

  @objc static func requiresMainQueueSetup() -> Bool { false }

  @objc(save:)
  func save(_ json: String) {
    guard let defaults = UserDefaults(suiteName: SharedWaits.appGroup) else { return }
    defaults.set(json, forKey: SharedWaits.snapshotKey)
    if #available(iOS 14.0, *) {
      WidgetCenter.shared.reloadAllTimelines()
    }
  }
}
