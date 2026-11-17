import AppKit
import SwiftUI
import TimeCore

@main
struct YugatNeoTimeApp: App {
    var body: some Scene {
        WindowGroup(id: "main") { MainWindow() }
            .defaultSize(width: 920, height: 650)
        MenuBarExtra("YUGATNeoTIME", systemImage: "clock") {
            MenuClock()
        }
    }
}

private struct MenuClock: View {
    @Environment(\.openWindow) private var openWindow

    var body: some View {
        TimelineView(.periodic(from: .now, by: 1)) { timeline in
            Text(timeline.date.formatted(date: .abbreviated, time: .standard))
        }
        Divider()
        Button("Открыть YUGATNeoTIME") {
            openWindow(id: "main")
            NSApp.activate(ignoringOtherApps: true)
        }
        Button("Завершить") { NSApp.terminate(nil) }
    }
}

private struct MainWindow: View {
    var body: some View {
        TabView {
            ClocksView().tabItem { Label("Время", systemImage: "clock") }
            LifeClockView().tabItem { Label("Часы жизни", systemImage: "hourglass") }
            CalendarsView().tabItem { Label("Календари", systemImage: "calendar") }
            AboutView().tabItem { Label("О проекте", systemImage: "info.circle") }
        }
        .padding(18)
        .frame(minWidth: 740, minHeight: 550)
    }
}

private struct PlaceClock: Identifiable {
    let id: String
    let label: String
    let zoneID: String

    static var all: [PlaceClock] {
        [
            .init(id: "local", label: "Местное время", zoneID: TimeZone.current.identifier),
            .init(id: "stockholm", label: "Стокгольм", zoneID: "Europe/Stockholm"),
            .init(id: "moscow", label: "Москва", zoneID: "Europe/Moscow"),
            .init(id: "danang", label: "Дананг", zoneID: "Asia/Ho_Chi_Minh"),
            .init(id: "bangkok", label: "Бангкок", zoneID: "Asia/Bangkok"),
            .init(id: "tokyo", label: "Токио", zoneID: "Asia/Tokyo"),
            .init(id: "newyork", label: "Нью-Йорк", zoneID: "America/New_York"),
            .init(id: "utc", label: "UTC", zoneID: "Etc/UTC")
        ]
    }
}

private func timeString(_ date: Date, zone: String) -> String {
    let formatter = DateFormatter()
    formatter.locale = Locale(identifier: "ru_RU")
    formatter.timeZone = TimeZone(identifier: zone) ?? .current
    formatter.dateFormat = "HH:mm:ss"
    return formatter.string(from: date)
}

private struct ClocksView: View {
    private let columns = [GridItem(.adaptive(minimum: 205), spacing: 14)]

    var body: some View {
        TimelineView(.periodic(from: .now, by: 1)) { timeline in
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    Text("YUGATNeoTIME").font(.largeTitle.bold())
                    Text("Время — одно. Системы его описания различны.")
                        .foregroundStyle(.secondary)
                    VStack(alignment: .leading, spacing: 9) {
                        Text("Сейчас").foregroundStyle(.secondary)
                        Text(timeString(timeline.date, zone: TimeZone.current.identifier))
                            .font(.system(size: 62, weight: .light, design: .monospaced))
                            .monospacedDigit()
                        Text(timeline.date.formatted(.dateTime.weekday(.wide).day().month(.wide).year()))
                            .font(.title3)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(22)
                    .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 18))

                    Text("Часовые пояса").font(.title2.bold())
                    LazyVGrid(columns: columns, spacing: 14) {
                        ForEach(PlaceClock.all) { clock in
                            VStack(alignment: .leading, spacing: 8) {
                                Text(clock.label).foregroundStyle(.secondary)
                                Text(timeString(timeline.date, zone: clock.zoneID))
                                    .font(.system(.title2, design: .monospaced))
                                    .monospacedDigit()
                                Text(clock.zoneID).font(.caption).foregroundStyle(.tertiary)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(16)
                            .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 14))
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }
}

private struct LifeClockView: View {
    @AppStorage("life.birthIsSaved") private var birthIsSaved = false
    @AppStorage("life.birthISO") private var birthISO = ""
    @AppStorage("life.referenceYears") private var referenceYears = 100.0
    @State private var draftBirth = Date(timeIntervalSince1970: 946684800)

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                Text("Часы жизни").font(.largeTitle.bold())
                Text("Два встречных счётчика относительно добровольно выбранного ориентира.")
                    .foregroundStyle(.secondary)
                VStack(alignment: .leading, spacing: 14) {
                    DatePicker("Дата рождения", selection: $draftBirth,
                               in: ...Date(), displayedComponents: .date)
                    HStack(spacing: 12) {
                        Button("Сохранить дату только на этом Mac") {
                            birthISO = BirthDateCodec.encode(draftBirth)
                            birthIsSaved = true
                        }
                        if birthIsSaved {
                            Button("Удалить дату", role: .destructive) {
                                birthIsSaved = false
                                birthISO = ""
                                UserDefaults.standard.removeObject(forKey: "life.birthISO")
                                UserDefaults.standard.removeObject(forKey: "life.birthTimestamp")
                                UserDefaults.standard.removeObject(forKey: "life.birthIsSaved")
                            }
                        }
                    }
                    HStack {
                        Text("Условный ориентир")
                        Spacer()
                        Stepper("\(Int(referenceYears.isFinite && (1...250).contains(referenceYears) ? referenceYears : 100)) лет", value: $referenceYears,
                                in: 1...250, step: 1)
                            .frame(width: 170)
                    }
                    Text("Выбранный возраст — масштаб визуализации, а не прогноз смерти.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
                .padding(20)
                .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 18))

                if birthIsSaved {
                    TimelineView(.periodic(from: .now, by: 1)) { timeline in
                        if let storedBirth = try? BirthDateCodec.decode(birthISO),
                           let progress = try? LifeClock.calculate(
                            birthDate: storedBirth,
                            at: timeline.date,
                            referenceYears: referenceYears,
                            calendar: Calendar(identifier: .gregorian)
                        ) {
                            VStack(alignment: .leading, spacing: 20) {
                                HStack(alignment: .top) {
                                    VStack(alignment: .leading, spacing: 6) {
                                        Text("Прожито").foregroundStyle(.secondary)
                                        Text(progress.elapsedPercent.formatted(.number.precision(.fractionLength(4))) + " %")
                                            .font(.system(size: 32, weight: .semibold, design: .rounded))
                                    }
                                    Spacer()
                                    VStack(alignment: .trailing, spacing: 6) {
                                        Text("До ориентира").foregroundStyle(.secondary)
                                        Text(progress.remainingPercent.formatted(.number.precision(.fractionLength(4))) + " %")
                                            .font(.system(size: 32, weight: .semibold, design: .rounded))
                                    }
                                }
                                ProgressView(value: progress.elapsedPercent, total: 100)
                                    .controlSize(.large)
                                Text("\(progress.ageYears) полных лет • \(progress.elapsedDays) прожитых суток")
                                Text("\(progress.remainingDays) суток до условного ориентира")
                                if progress.exceededReference {
                                    Text("Ориентир пройден. Отсчёт и жизнь продолжаются.")
                                        .foregroundStyle(.secondary)
                                }
                            }
                            .padding(22)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 18))
                        } else {
                            Text("Не удалось вычислить время: проверьте параметры.")
                                .foregroundStyle(.red)
                        }
                    }
                } else {
                    ContentUnavailableView("Дата не сохранена", systemImage: "hourglass",
                        description: Text("Выберите дату и сохраните её на Mac, чтобы включить счётчики."))
                }
                Text("Дата рождения хранится локально. Облачная синхронизация не включена.")
                    .font(.footnote).foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .onAppear {
                // Migrate v0.1 timestamp-based storage only once. A civil date
                // survives later changes of time zone without shifting its day.
                if birthIsSaved && birthISO.isEmpty {
                    let defaults = UserDefaults.standard
                    if defaults.object(forKey: "life.birthTimestamp") != nil {
                        let old = defaults.double(forKey: "life.birthTimestamp")
                        if old.isFinite {
                            birthISO = BirthDateCodec.encode(Date(timeIntervalSince1970: old))
                        }
                        defaults.removeObject(forKey: "life.birthTimestamp")
                    }
                }
                if !referenceYears.isFinite ||
                    !(1...250).contains(referenceYears) {
                    referenceYears = 100
                }
                if birthIsSaved, let savedDate = try? BirthDateCodec.decode(birthISO) {
                    draftBirth = savedDate
                } else if birthIsSaved {
                    birthIsSaved = false
                }
            }
        }
    }
}

private struct CalendarsView: View {
    var body: some View {
        TimelineView(.periodic(from: .now, by: 60)) { timeline in
            let gregorian = CivilCalendars.gregorianDate(from: timeline.date)
            let julian = CivilCalendars.julianEquivalent(of: gregorian)
            VStack(alignment: .leading, spacing: 18) {
                Text("Календарные системы").font(.largeTitle.bold())
                Text("Два способа обозначить один календарный день.")
                    .foregroundStyle(.secondary)
                HStack(spacing: 14) {
                    dateTile("Григорианский", value: gregorian)
                    dateTile("Юлианский", value: julian)
                }
                Text("Это математическое соответствие дат. Исторические реформы и местные переходы требуют отдельной проверки.")
                    .foregroundStyle(.secondary)
                Link("Открыть полный Атлас времени",
                     destination: URL(string: "https://yugatn.github.io/YUGATNeoTIME/")!)
                Text("Дополнительные разделы веб-атласа открываются в браузере и требуют интернета.")
                    .font(.footnote).foregroundStyle(.secondary)
                Spacer()
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private func dateTile(_ title: String, value: CivilDate) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title).font(.headline)
            Text("\(value.day).\(value.month).\(value.year)")
                .font(.system(.title, design: .monospaced))
            Text("Календарная дата").font(.caption).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(20)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 18))
    }
}

private struct AboutView: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("О YUGATNeoTIME").font(.largeTitle.bold())
            Text("Автор концепции: Югатн (Yugatn).")
            Text("Нативное приложение для macOS: текущее и мировое время, календари, персональные часы относительно добровольно выбранного временного ориентира.")
            Text("Часы жизни не являются медицинским инструментом и не вычисляют ожидаемую дату смерти. Персональная дата сохраняется локально после явного действия пользователя.")
                .foregroundStyle(.secondary)
            Link("GitHub, документация и лицензия",
                 destination: URL(string: "https://github.com/Yugatn/YUGATNeoTIME")!)
            Text("© 2026 Yugatn. Применяются условия LICENSE репозитория. Полный исторический атлас доступен отдельно в веб-версии.")
                .font(.footnote).foregroundStyle(.secondary)
            Spacer()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}
