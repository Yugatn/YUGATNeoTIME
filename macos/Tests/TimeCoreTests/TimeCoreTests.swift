import XCTest
@testable import TimeCore

final class TimeCoreTests: XCTestCase {
    private var utcCalendar: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(secondsFromGMT: 0)!
        return calendar
    }

    private func date(_ year: Int, _ month: Int, _ day: Int) -> Date {
        utcCalendar.date(from: DateComponents(year: year, month: month, day: day))!
    }

    func testLifeClocksBeginAtZeroAndComplementToOneHundred() throws {
        let birth = date(2000, 1, 1)
        let atBirth = try LifeClock.calculate(
            birthDate: birth, at: birth, referenceYears: 100, calendar: utcCalendar
        )
        XCTAssertEqual(atBirth.elapsedPercent, 0)
        XCTAssertEqual(atBirth.remainingPercent, 100)
        XCTAssertEqual(atBirth.ageYears, 0)

        let midway = try LifeClock.calculate(
            birthDate: birth, at: date(2050, 1, 1),
            referenceYears: 100, calendar: utcCalendar
        )
        XCTAssertEqual(midway.elapsedPercent + midway.remainingPercent, 100, accuracy: 0.000001)
        XCTAssertEqual(midway.ageYears, 50)
    }

    func testExceedingReferenceDoesNotPredictDeath() throws {
        let progress = try LifeClock.calculate(
            birthDate: date(1900, 1, 1), at: date(2026, 11, 17),
            referenceYears: 80, calendar: utcCalendar
        )
        XCTAssertEqual(progress.elapsedPercent, 100)
        XCTAssertEqual(progress.remainingPercent, 0)
        XCTAssertTrue(progress.exceededReference)
        XCTAssertEqual(progress.remainingDays, 0)
    }

    func testLeapDayAnniversaryIsMarchFirst() throws {
        let birth = date(2000, 2, 29)
        let before = try LifeClock.calculate(
            birthDate: birth, at: date(2021, 2, 28),
            referenceYears: 100, calendar: utcCalendar
        )
        let after = try LifeClock.calculate(
            birthDate: birth, at: date(2021, 3, 1),
            referenceYears: 100, calendar: utcCalendar
        )
        XCTAssertEqual(before.ageYears, 20)
        XCTAssertEqual(after.ageYears, 21)
    }

    func testInvalidReferencesAndFutureBirthAreRejected() {
        for years in [0, -2, 251, Double.nan, Double.infinity] {
            XCTAssertThrowsError(try LifeClock.calculate(
                birthDate: date(2000, 1, 1), at: date(2026, 1, 1),
                referenceYears: years, calendar: utcCalendar
            ))
        }
        XCTAssertThrowsError(try LifeClock.calculate(
            birthDate: date(2100, 1, 1), at: date(2026, 1, 1),
            referenceYears: 100, calendar: utcCalendar
        ))
    }

    func testJulianAndGregorianDateComparison() {
        let gregorian = CivilDate(year: 2026, month: 11, day: 17)
        XCTAssertEqual(
            CivilCalendars.julianEquivalent(of: gregorian),
            CivilDate(year: 2026, month: 11, day: 4)
        )
        XCTAssertEqual(
            CivilCalendars.julianEquivalent(of: CivilDate(year: 2000, month: 1, day: 1)),
            CivilDate(year: 1999, month: 12, day: 19)
        )
    }
}
