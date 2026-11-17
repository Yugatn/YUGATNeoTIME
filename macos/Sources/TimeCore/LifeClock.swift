import Foundation

public enum LifeClockError: Error, Equatable {
    case invalidReference
    case birthInFuture
    case invalidDate
}

public struct LifeProgress: Equatable {
    public let birthDate: Date
    public let referenceDate: Date
    public let referenceYears: Double
    public let ageYears: Int
    public let elapsedDays: Int
    public let remainingDays: Int
    public let elapsedPercent: Double
    public let remainingPercent: Double
    public let exceededReference: Bool

    public init(
        birthDate: Date, referenceDate: Date, referenceYears: Double,
        ageYears: Int, elapsedDays: Int, remainingDays: Int,
        elapsedPercent: Double, remainingPercent: Double,
        exceededReference: Bool
    ) {
        self.birthDate = birthDate
        self.referenceDate = referenceDate
        self.referenceYears = referenceYears
        self.ageYears = ageYears
        self.elapsedDays = elapsedDays
        self.remainingDays = remainingDays
        self.elapsedPercent = elapsedPercent
        self.remainingPercent = remainingPercent
        self.exceededReference = exceededReference
    }
}

public enum LifeClock {
    private static let daySeconds = 86_400.0
    private static let meanYearDays = 365.2425

    private static func isLeapYear(_ year: Int) -> Bool {
        (year % 4 == 0) && (year % 100 != 0 || year % 400 == 0)
    }

    /// Anniversary is March 1 after February 29 if the target year is not a leap year.
    /// This convention matches the existing YUGATNeoTIME web application.
    private static func anniversary(
        of birth: Date, years: Int, calendar: Calendar
    ) throws -> Date {
        let values = calendar.dateComponents([.year, .month, .day], from: birth)
        guard let originalYear = values.year, let month = values.month,
              let day = values.day else { throw LifeClockError.invalidDate }
        let year = originalYear + years
        let leapAdjustment = month == 2 && day == 29 && !isLeapYear(year)
        let components = DateComponents(
            year: year, month: leapAdjustment ? 3 : month,
            day: leapAdjustment ? 1 : day
        )
        guard let date = calendar.date(from: components) else {
            throw LifeClockError.invalidDate
        }
        return date
    }

    public static func calculate(
        birthDate: Date,
        at currentDate: Date = Date(),
        referenceYears: Double,
        calendar requestedCalendar: Calendar = Calendar(identifier: .gregorian)
    ) throws -> LifeProgress {
        guard referenceYears.isFinite && (1...250).contains(referenceYears) else {
            throw LifeClockError.invalidReference
        }
        // Birth-date arithmetic is Gregorian even when the user's preferred
        // display calendar is Buddhist or another calendar. Preserve the
        // requested time zone, not a different set of leap-year rules.
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = requestedCalendar.timeZone
        let start = calendar.startOfDay(for: birthDate)
        guard currentDate >= start else { throw LifeClockError.birthInFuture }

        let fullYears = Int(floor(referenceYears))
        let fractionalYears = referenceYears - Double(fullYears)
        let base = try anniversary(of: start, years: fullYears, calendar: calendar)
        let reference = base.addingTimeInterval(fractionalYears * meanYearDays * daySeconds)
        let span = reference.timeIntervalSince(start)
        guard span.isFinite && span > 0 else { throw LifeClockError.invalidDate }

        let raw = 100.0 * currentDate.timeIntervalSince(start) / span
        let elapsed = min(100, max(0, raw))
        let candidateAge = calendar.component(.year, from: currentDate) - calendar.component(.year, from: start)
        let thisAnniversary = try anniversary(of: start, years: candidateAge, calendar: calendar)
        let age = candidateAge - (currentDate < thisAnniversary ? 1 : 0)

        return LifeProgress(
            birthDate: start,
            referenceDate: reference,
            referenceYears: referenceYears,
            ageYears: age,
            elapsedDays: Int(floor(currentDate.timeIntervalSince(start) / daySeconds)),
            remainingDays: max(0, Int(ceil(reference.timeIntervalSince(currentDate) / daySeconds))),
            elapsedPercent: elapsed,
            remainingPercent: 100.0 - elapsed,
            exceededReference: raw > 100
        )
    }
}
