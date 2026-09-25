// Ruum Ruum — Design Tokens v1.0 (Swift)
// Fuente: design-system/tokens/tokens.json
// Uso: Text("Hola").font(.ruumBody).foregroundColor(.ruumNavy)
import SwiftUI

public extension Color {
    static let ruumNavy = Color(hex: "0A2342")
    static let ruumTeal = Color(hex: "00D1D1")
    static let ruumTealDeep = Color(hex: "008B8B")
    static let ruumAction = Color(hex: "0066FF")
    static let ruumSurface = Color(hex: "E8EEF4")
    static let ruumMuted = Color(hex: "566889")
    static let ruumBorderInput = Color(hex: "7A8DAE")
    static let ruumBorder = Color(hex: "E6F0FF")
    static let ruumWarning = Color(hex: "F5B400")
    static let ruumWarningBg = Color(hex: "FFF4D6")
    static let ruumWarningText = Color(hex: "7A4F00")
    static let ruumSuccess = Color(hex: "16805A")
    static let ruumSuccessBg = Color(hex: "E6F6EE")
    static let ruumSuccessText = Color(hex: "0F6B48")
    static let ruumError = Color(hex: "C23648")
    static let ruumErrorBg = Color(hex: "FDECEF")
    static let ruumEmergency = Color(hex: "B3261E")
    static let ruumNeutralBg = Color(hex: "EEF2F8")
    static let ruumActionBg = Color(hex: "E8F0FE")

    init(hex: String) {
        var h = hex.trimmingCharacters(in: .whitespacesAndNewlines).replacingOccurrences(of: "#", with: "")
        if h.count == 6 { h += "FF" }
        var v: UInt64 = 0
        Scanner(string: h).scanHexInt64(&v)
        self.init(
            .sRGB,
            red: Double((v & 0xFF000000) >> 24) / 255,
            green: Double((v & 0x00FF0000) >> 16) / 255,
            blue: Double((v & 0x0000FF00) >> 8) / 255,
            opacity: Double(v & 0x000000FF) / 255
        )
    }
}

public enum RuumTokens {
    public static let touch: CGFloat = 44
    public static let touchStreet: CGFloat = 56
    public static let buttonHeight: CGFloat = 52
    public static let buttonHeightStreet: CGFloat = 56
    public static let inputHeight: CGFloat = 48
    public static let radiusSM: CGFloat = 8
    public static let radiusMD: CGFloat = 12
    public static let radiusLG: CGFloat = 16
    public static let radiusXL: CGFloat = 24
}
