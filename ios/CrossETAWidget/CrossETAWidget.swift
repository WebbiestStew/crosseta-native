// Home-screen widget: wait times for the crossings the user starred in CrossETA.
//
// Data flow:
//   - The app writes a snapshot (starred crossings, preferred lane, language, optional server URL)
//     into the shared App Group via the SharedWaits native module.
//   - When a server URL is present the widget refreshes the waits itself from GET /v1/waits, so it
//     stays current even when the app has not been opened. Otherwise it shows the snapshot and
//     says how old it is.
import WidgetKit
import SwiftUI

private let appGroup = "group.com.diegovillarreal.crosseta"

// MARK: - Model

struct Item: Codable, Hashable {
    let id: String
    let name: String
    let flag: String
    var wait: Int?
    var sentri: Int?
    var ready: Int?
    var updatedAt: Double?   // ms since epoch of the reading itself (CBP's timestamp when known)
}

struct Snapshot: Codable {
    var savedAt: Double
    var lane: String         // standard | sentri | ready
    var lang: String         // en | es
    var apiUrl: String?
    var items: [Item]
}

struct ServerWait: Codable {
    let wait: Int?
    let sentri: Int?
    let ready: Int?
    let updatedAt: Double?
}

struct WaitsResponse: Codable {
    let waits: [String: ServerWait]
}

struct WaitEntry: TimelineEntry {
    let date: Date
    let snapshot: Snapshot?
}

// MARK: - Helpers

private func loadSnapshot() -> Snapshot? {
    guard let defaults = UserDefaults(suiteName: appGroup),
          let json = defaults.string(forKey: "snapshot"),
          let data = json.data(using: .utf8) else { return nil }
    return try? JSONDecoder().decode(Snapshot.self, from: data)
}

/// The wait for the user's preferred lane, falling back to standard when that lane has no reading.
func laneWait(_ item: Item, lane: String) -> Int? {
    switch lane {
    case "sentri": return item.sentri ?? item.wait
    case "ready": return item.ready ?? item.wait
    default: return item.wait
    }
}

func waitColor(_ minutes: Int?) -> Color {
    guard let m = minutes else { return .gray }
    if m <= 15 { return Color(red: 0.19, green: 0.82, blue: 0.35) }
    if m <= 40 { return Color(red: 1.0, green: 0.62, blue: 0.04) }
    return Color(red: 1.0, green: 0.27, blue: 0.23)
}

struct Strings {
    let min: String
    let noData: String
    let empty: String
    let updated: (String) -> String
    let ageMin: (Int) -> String
    let ageHour: (Int) -> String

    init(lang: String) {
        if lang == "es" {
            min = "min"; noData = "Sin datos"
            empty = "Marca un cruce con ⭐ en CrossETA"
            updated = { "Actualizado \($0)" }
            ageMin = { "hace \($0) min" }
            ageHour = { "hace \($0) h" }
        } else {
            min = "min"; noData = "No data"
            empty = "Star a crossing in CrossETA"
            updated = { "Updated \($0)" }
            ageMin = { "\($0)m ago" }
            ageHour = { "\($0)h ago" }
        }
    }

    func age(ofMillis ms: Double?, now: Date = Date()) -> String? {
        guard let ms else { return nil }
        let minutes = max(0, Int((now.timeIntervalSince1970 * 1000 - ms) / 60000))
        return updated(minutes < 60 ? ageMin(minutes) : ageHour(minutes / 60))
    }
}

// MARK: - Provider

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> WaitEntry {
        WaitEntry(date: Date(), snapshot: Snapshot(
            savedAt: Date().timeIntervalSince1970 * 1000, lane: "standard", lang: "en", apiUrl: nil,
            items: [
                Item(id: "A", name: "El Paso", flag: "🇲🇽", wait: 25, sentri: 5, ready: 15, updatedAt: nil),
                Item(id: "B", name: "Laredo", flag: "🇲🇽", wait: 10, sentri: 0, ready: 5, updatedAt: nil),
                Item(id: "C", name: "Blaine", flag: "🇨🇦", wait: 45, sentri: 10, ready: 30, updatedAt: nil),
            ]))
    }

    func getSnapshot(in context: Context, completion: @escaping (WaitEntry) -> Void) {
        if context.isPreview { completion(placeholder(in: context)); return }
        completion(WaitEntry(date: Date(), snapshot: loadSnapshot()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<WaitEntry>) -> Void) {
        let base = loadSnapshot()
        Task {
            let fresh = await refreshed(base)
            let entry = WaitEntry(date: Date(), snapshot: fresh)
            completion(Timeline(entries: [entry], policy: .after(Date().addingTimeInterval(15 * 60))))
        }
    }

    /// Update the snapshot's waits from the server when one is configured; on any failure keep the snapshot.
    private func refreshed(_ snapshot: Snapshot?) async -> Snapshot? {
        guard var snap = snapshot, !snap.items.isEmpty,
              let base = snap.apiUrl, !base.isEmpty else { return snapshot }
        let ids = snap.items.map(\.id).joined(separator: ",")
        guard let url = URL(string: base + "/v1/waits?ids=" + ids) else { return snapshot }
        var request = URLRequest(url: url)
        request.timeoutInterval = 8
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard (response as? HTTPURLResponse)?.statusCode == 200 else { return snapshot }
            let decoded = try JSONDecoder().decode(WaitsResponse.self, from: data)
            snap.items = snap.items.map { item in
                guard let w = decoded.waits[item.id] else { return item }
                var copy = item
                copy.wait = w.wait; copy.sentri = w.sentri; copy.ready = w.ready; copy.updatedAt = w.updatedAt
                return copy
            }
            snap.savedAt = Date().timeIntervalSince1970 * 1000
            return snap
        } catch {
            return snapshot
        }
    }
}

// MARK: - Views

struct WaitPill: View {
    let minutes: Int?
    let noData: String
    var body: some View {
        Text(minutes.map { "\($0)" } ?? "—")
            .font(.system(size: 34, weight: .heavy, design: .rounded))
            .foregroundColor(waitColor(minutes))
            .minimumScaleFactor(0.6)
            .lineLimit(1)
            .accessibilityLabel(minutes.map { "\($0) minutes" } ?? noData)
    }
}

struct SmallView: View {
    let snapshot: Snapshot
    let strings: Strings
    var body: some View {
        let item = snapshot.items[0]
        let minutes = laneWait(item, lane: snapshot.lane)
        VStack(alignment: .leading, spacing: 2) {
            Text("\(item.flag) \(item.name)")
                .font(.system(size: 13, weight: .bold))
                .lineLimit(1)
            Spacer(minLength: 0)
            HStack(alignment: .firstTextBaseline, spacing: 3) {
                WaitPill(minutes: minutes, noData: strings.noData)
                if minutes != nil { Text(strings.min).font(.system(size: 13, weight: .semibold)).foregroundColor(.secondary) }
            }
            if let age = strings.age(ofMillis: item.updatedAt ?? snapshot.savedAt) {
                Text(age).font(.system(size: 10)).foregroundColor(.secondary).lineLimit(1)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    }
}

struct MediumView: View {
    let snapshot: Snapshot
    let strings: Strings
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            ForEach(Array(snapshot.items.prefix(3)), id: \.id) { item in
                let minutes = laneWait(item, lane: snapshot.lane)
                HStack {
                    Text("\(item.flag) \(item.name)")
                        .font(.system(size: 14, weight: .semibold))
                        .lineLimit(1)
                    Spacer()
                    Text(minutes.map { "\($0) \(strings.min)" } ?? strings.noData)
                        .font(.system(size: 15, weight: .heavy, design: .rounded))
                        .foregroundColor(waitColor(minutes))
                }
            }
            Spacer(minLength: 0)
            if let age = strings.age(ofMillis: snapshot.savedAt) {
                Text(age).font(.system(size: 10)).foregroundColor(.secondary)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}

struct WaitsView: View {
    @Environment(\.widgetFamily) private var family
    let entry: WaitEntry

    var body: some View {
        let lang = entry.snapshot?.lang ?? "en"
        let strings = Strings(lang: lang)
        Group {
            if let snap = entry.snapshot, !snap.items.isEmpty {
                if family == .systemSmall { SmallView(snapshot: snap, strings: strings) }
                else { MediumView(snapshot: snap, strings: strings) }
            } else {
                Text(strings.empty)
                    .font(.system(size: 13, weight: .semibold))
                    .multilineTextAlignment(.center)
                    .foregroundColor(.secondary)
            }
        }
        .widgetBackground()
    }
}

extension View {
    @ViewBuilder func widgetBackground() -> some View {
        if #available(iOS 17.0, *) {
            self.containerBackground(.fill.tertiary, for: .widget)
        } else {
            self.padding().background(Color(.secondarySystemBackground))
        }
    }
}

// MARK: - Widget

struct CrossETAWaitsWidget: Widget {
    let kind = "CrossETAWaitsWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            WaitsView(entry: entry)
        }
        .configurationDisplayName("Border Waits")
        .description("Wait times for your starred crossings.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

@main
struct CrossETAWidgetBundle: WidgetBundle {
    var body: some Widget {
        CrossETAWaitsWidget()
    }
}
