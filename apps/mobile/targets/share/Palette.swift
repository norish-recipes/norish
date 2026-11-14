import SwiftUI

/// The app theme's tokens the sheet uses, converted from oklch to sRGB for light and dark.
enum Palette {
  static let surface = color(0xFFFFFF, 0x201E1A)
  static let fill = color(0xECE7DE, 0x292723)
  static let muted = color(0x6E6A63, 0xA7A29C)
  static let accent = color(0x336640, 0x336640)
  static let accentText = color(0x336640, 0x76BE86)
  static let accentForeground = color(0xFCFCFC, 0xFCFCFC)
  static let danger = color(0xDA2848, 0xD9385E)
  static let scrim = color(0x181611, 0x000000, lightAlpha: 0.28, darkAlpha: 0.45)
  static let dangerSoft = color(0xDA2848, 0xD9385E, lightAlpha: 0.12, darkAlpha: 0.2)

  private static func color(
    _ light: UInt32, _ dark: UInt32, lightAlpha: CGFloat = 1, darkAlpha: CGFloat = 1
  ) -> Color {
    Color(
      UIColor { traits in
        traits.userInterfaceStyle == .dark ? rgb(dark, darkAlpha) : rgb(light, lightAlpha)
      })
  }

  private static func rgb(_ hex: UInt32, _ alpha: CGFloat) -> UIColor {
    UIColor(
      red: CGFloat((hex >> 16) & 0xFF) / 255, green: CGFloat((hex >> 8) & 0xFF) / 255,
      blue: CGFloat(hex & 0xFF) / 255, alpha: alpha)
  }
}
