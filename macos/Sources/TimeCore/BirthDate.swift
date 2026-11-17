import Foundation

/// Stores a date of birth as a civil Gregorian date, not as an absolute instant.
///
/// Persisting Unix seconds for midnight can shift the displayed birthday when
/// the user changes time zones. This codec preserves the selected calendar day.
public enum BirthDateCodec {
    private static func calendar(in zone: TimeZone) -> Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = zone
        return calendar
    }

    public static func encode(_ date: Date, timeZone: TimeZone = .current) -> String {
        let parts = calendar(in: timeZone).dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d",
                      parts.year ?? 0, parts.month ?? 0, parts.day ?? 0)
    }

    public static func decode(
        _ value: String,
        timeZone: TimeZone = .current
    ) throws -> Date {
        // Four-digit year, two-digit month and day. Never parse as UTC midnight.
        let segments = value.split(separator: "-", omittingEmptySubsequences: false)
        guard segments.count == 3,
              segments[0].count == 4,
              segments[1].count == 2,
              segments[2].count == 2,
              segments.allSatisfy({ $0.allSatisfy(\.isNumber) }),
              let year = Int(segments[0]), let month = Int(segments[1]),
              let day = Int(segments[2]), (1...9999).contains(year),
              (1...12).contains(month), (1...31).contains(day)
        else {
            throw LifeClockError.invalidDate
        }

        let calendar = calendar(in: timeZone)
        guard let date = calendar.date(from: DateComponents(
            year: year, month: month, day: day
        )) else { throw LifeClockError.invalidDate }

        let check = calendar.dateComponents([.year, .month, .day], from: date)
        guard check.year == year, check.month == month, check.day == day else {
            throw LifeClockError.invalidDate
        }
        return date
    }
}
