import Foundation

/// A Julian-day based comparison for civil Gregorian dates.
/// This calculation does not establish the date of a historical event.
public struct CivilDate: Equatable, Sendable {
    public let year: Int
    public let month: Int
    public let day: Int

    public init(year: Int, month: Int, day: Int) {
        self.year = year
        self.month = month
        self.day = day
    }
}

public enum CivilCalendars {
    public static func gregorianDate(from date: Date, timeZone: TimeZone = .current) -> CivilDate {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = timeZone
        let components = calendar.dateComponents([.year, .month, .day], from: date)
        return CivilDate(
            year: components.year ?? 1,
            month: components.month ?? 1,
            day: components.day ?? 1
        )
    }

    public static func julianEquivalent(of gregorian: CivilDate) -> CivilDate {
        let a = (14 - gregorian.month) / 12
        let y = gregorian.year + 4800 - a
        let m = gregorian.month + 12 * a - 3
        let jdn = gregorian.day + (153 * m + 2) / 5 + 365 * y + y / 4
            - y / 100 + y / 400 - 32045
        let c = jdn + 32082
        let d = (4 * c + 3) / 1461
        let e = c - (1461 * d) / 4
        let n = (5 * e + 2) / 153
        return CivilDate(
            year: d - 4800 + n / 10,
            month: n + 3 - 12 * (n / 10),
            day: e - (153 * n + 2) / 5 + 1
        )
    }
}
