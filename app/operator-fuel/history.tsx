import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Print from "expo-print";
import { useTheme } from "../../hooks/useTheme";
import { Spacing } from "../../constants/theme";
import { fetchFuelRecords } from "../../services/api";
import { formatEAT } from "../../utils/helpers";
import { buildCsvContent, shareCsvAsFile } from "../../utils/exportData";
import {
  DataCard,
  DetailRow,
  EmptyState,
  PageShell,
  SearchField,
  SectionTitle,
  FilterRail,
} from "../../components/EnterpriseUI";

// ─── Helpers for cross‑platform printing ──────────────────────────

const escapeHtml = (str: string | null | undefined): string => {
  if (!str) return "";
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return str.replace(/[&<>"']/g, (m) => map[m]);
};

const printHtmlOnWeb = (html: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    try {
      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "none";
      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc) {
        reject(new Error("Unable to access iframe document"));
        return;
      }
      iframeDoc.open();
      iframeDoc.write(html);
      iframeDoc.close();

      iframe.onload = () => {
        iframe.contentWindow?.print();
        setTimeout(() => {
          if (document.body.contains(iframe)) document.body.removeChild(iframe);
          resolve();
        }, 1000);
      };

      setTimeout(() => {
        if (document.body.contains(iframe)) {
          iframe.contentWindow?.print();
          setTimeout(() => {
            if (document.body.contains(iframe)) document.body.removeChild(iframe);
            resolve();
          }, 1000);
        }
      }, 500);
    } catch (error) {
      reject(error);
    }
  });
};

// ─── Time filters ──────────────────────────────────────────────────

const TIME_FILTERS = [
  { key: "all", label: "All" },
  { key: "daily", label: "Daily" },
  { key: "monthly", label: "Monthly" },
  { key: "yearly", label: "Yearly" },
];

function getTimeFilterRange(filter: string): { start: Date; end: Date } | null {
  const now = new Date();
  switch (filter) {
    case "daily": {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      return { start, end };
    }
    case "monthly": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      return { start, end };
    }
    case "yearly": {
      const start = new Date(now.getFullYear(), 0, 1);
      const end = new Date(now.getFullYear() + 1, 0, 1);
      return { start, end };
    }
    default:
      return null;
  }
}

export default function FuelHistoryScreen() {
  const colors = useTheme();
  const [records, setRecords] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [timeFilter, setTimeFilter] = useState("all");
  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadData = useCallback(async () => {
    setRefreshing(true);
    try {
      const data = (await fetchFuelRecords()) || [];
      setRecords(data);
    } catch {
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    autoRefreshRef.current = setInterval(loadData, 24 * 60 * 60 * 1000);
    return () => {
      if (autoRefreshRef.current) {
        clearInterval(autoRefreshRef.current);
        autoRefreshRef.current = null;
      }
    };
  }, [loadData]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const range = getTimeFilterRange(timeFilter);

    let result = records.filter((r) => {
      if (
        q &&
        ![r.jobId, r.driverName, r.plateNumber, r.vendorName].some((v) =>
          String(v || "").toLowerCase().includes(q)
        )
      ) {
        return false;
      }

      if (range) {
        const dispensedAt = new Date(r.dispensedAt || r.createdAt);
        if (dispensedAt < range.start || dispensedAt >= range.end) {
          return false;
        }
      }
      return true;
    });
    return result;
  }, [records, search, timeFilter]);

  const stats = useMemo(() => {
    const totalLiters = filtered.reduce((s, r) => s + (r.fuelAmount || 0), 0);
    const totalCost = filtered.reduce((s, r) => s + (r.totalCost || 0), 0);
    return { totalLiters, totalCost, count: filtered.length };
  }, [filtered]);

  // ─── Export columns (removed Price/L and Total) ──────────────

  const exportHeaders = [
    "Fuel ID",
    "Driver",
    "Plate",
    "Vendor",
    "Fuel (L)",
    "Auth Code",
    "Dispensed At",
    "Completed",
  ];

  const exportRows = useMemo(() => {
    return filtered.map((item) => [
      item.fuelId || item.id || item.jobId || "",
      item.driverName || "N/A",
      item.plateNumber || "N/A",
      item.vendorName || "N/A",
      item.fuelAmount != null ? item.fuelAmount.toFixed(1) : "0.0",
      item.authorizationCode || item.authorizationId || "",
      item.dispensedAt || item.createdAt || "",
      item.completed ? "Yes" : "No",
    ]);
  }, [filtered]);

  // ─── Export states ──────────────────────────────────────────────

  const [exporting, setExporting] = useState<"csv" | "pdf" | null>(null);

  const handleDownloadCSV = async () => {
    setExporting("csv");
    try {
      const csvContent = buildCsvContent(exportHeaders, exportRows);
      await shareCsvAsFile("Fuel_Records", csvContent);
    } catch {} finally {
      setExporting(null);
    }
  };

  const handlePrintPDF = async () => {
    setExporting("pdf");
    try {
      const title = "Fuel Records";
      const e = escapeHtml;

      // Build table header
      const headerCells = exportHeaders
        .map((h) => `<th style="padding:10px 14px; background:#1B2A4A; color:#fff; font-weight:700; text-align:left; border:1px solid #ddd;">${e(h)}</th>`)
        .join("");

      // Build table rows
      const bodyRows = exportRows
        .map((row, i) => {
          const bg = i % 2 === 0 ? "#FFFFFF" : "#F8FAFC";
          const cells = row
            .map((cell) => `<td style="padding:8px 14px; border:1px solid #ddd;">${e(cell) || "—"}</td>`)
            .join("");
          return `<tr style="background:${bg};">${cells}</tr>`;
        })
        .join("");

      const html = `
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
              * { box-sizing: border-box; }
              body { font-family: -apple-system, Helvetica, Arial, sans-serif; padding: 24px; color: #1E293B; }
              h1 { color: #1B2A4A; margin-bottom: 4px; }
              h2 { color: #475569; font-size: 18px; margin-top: 0; margin-bottom: 4px; }
              .subtitle { color: #94A3B8; font-size: 12px; }
              table { width:100%; border-collapse:collapse; font-size:13px; margin-top:12px; }
              th, td { padding: 8px 14px; border: 1px solid #ddd; text-align: left; }
              th { background: #1B2A4A; color: #fff; font-weight: 700; }
              .footer { color: #94A3B8; font-size: 10px; margin-top: 32px; text-align: center; }
              @page { size: auto; margin: 15mm 10mm; }
            </style>
          </head>
          <body>
            <h1>Trucks Sphere</h1>
            <h2>${e(title)}</h2>
            <p class="subtitle">Total Records: ${filtered.length} | Total Fuel: ${stats.totalLiters.toFixed(1)} L</p>
            <p class="subtitle">Exported on ${new Date().toLocaleString("en-KE", { timeZone: "Africa/Nairobi" })}</p>
            <table>
              <thead><tr>${headerCells}</tr></thead>
              <tbody>${bodyRows}</tbody>
            </table>
            <p class="footer">Generated by Trucks Sphere</p>
          </body>
        </html>
      `;

      if (Platform.OS === "web") {
        await printHtmlOnWeb(html);
      } else {
        const { uri } = await Print.printToFileAsync({ html });
        await Print.printAsync({ uri });
      }
    } catch (error: any) {
      Alert.alert("Print Error", error?.message || "Failed to print");
    } finally {
      setExporting(null);
    }
  };

  // ─── Render ──────────────────────────────────────────────────────

  return (
    <PageShell
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={loadData}
          tintColor={colors.primary}
        />
      }
    >
      <FilterRail
        options={TIME_FILTERS}
        value={timeFilter}
        onChange={setTimeFilter}
      />

      {filtered.length > 0 && (
        <View style={styles.statsRow}>
          <View
            style={[
              styles.statCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Ionicons name="water" size={16} color="#F59E0B" />
            <Text style={[styles.statValue, { color: colors.text }]}>
              {stats.totalLiters.toFixed(1)} L
            </Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>
              Fuel
            </Text>
          </View>
          <View
            style={[
              styles.statCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Ionicons name="receipt-outline" size={16} color="#10B981" />
            <Text style={[styles.statValue, { color: colors.text }]}>
              {stats.count}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>
              Records
            </Text>
          </View>
          {stats.totalCost > 0 && (
            <View
              style={[
                styles.statCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Ionicons name="cash-outline" size={16} color="#8B5CF6" />
              <Text
                style={[styles.statValue, { color: colors.text, fontSize: 13 }]}
              >
                KES {stats.totalCost.toLocaleString()}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>
                Cost
              </Text>
            </View>
          )}
        </View>
      )}

      {filtered.length > 0 && (
        <View style={styles.exportRow}>
          <TouchableOpacity
            style={[styles.exportBtn, { backgroundColor: "#2563EB" }]}
            onPress={handleDownloadCSV}
            disabled={exporting !== null}
          >
            {exporting === "csv" ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="document-text-outline" size={16} color="#FFFFFF" />
            )}
            <Text style={styles.exportBtnText}>CSV</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.exportBtn, { backgroundColor: "#1B2A4A" }]}
            onPress={handlePrintPDF}
            disabled={exporting !== null}
          >
            {exporting === "pdf" ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="print-outline" size={16} color="#FFFFFF" />
            )}
            <Text style={styles.exportBtnText}>Print</Text>
          </TouchableOpacity>
        </View>
      )}

      <SearchField
        value={search}
        onChangeText={setSearch}
        placeholder="Search job, driver, plate..."
      />
      <SectionTitle title={`Fuel Records (${filtered.length})`} />

      {loading ? (
        <DataCard>
          <Text style={{ fontSize: 14, color: colors.textMuted }}>Loading...</Text>
        </DataCard>
      ) : filtered.length ? (
        filtered.map((item) => {
          const isComplete = item.completed === true;
          const authCode = item.authorizationCode || item.authorizationId || "";
          return (
            <DataCard key={item.id}>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 2,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: "800",
                      color: isComplete ? "#10B981" : "#F59E0B",
                    }}
                  >
                    {item.fuelId || item.id || item.jobId}
                  </Text>
                  {authCode ? (
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 4,
                        marginTop: 2,
                      }}
                    >
                      <Ionicons name="key-outline" size={11} color="#8B5CF6" />
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: "600",
                          color: "#8B5CF6",
                          fontFamily: "monospace",
                        }}
                      >
                        Auth PIN: {authCode}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <View
                  style={{
                    flexDirection: "column",
                    alignItems: "flex-end",
                    gap: 4,
                  }}
                >
                  {item.fuelAmount > 0 ? (
                    <View
                      style={[
                        styles.fuelBadge,
                        { backgroundColor: "#F59E0B15" },
                      ]}
                    >
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: "800",
                          color: "#F59E0B",
                        }}
                      >
                        {item.fuelAmount?.toFixed(1)} L
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
              <DetailRow
                icon="person-outline"
                value={`${item.driverName || "N/A"} · ${item.plateNumber || "N/A"}`}
              />
              <DetailRow
                icon="business-outline"
                value={`Vendor: ${item.vendorName || "N/A"}`}
              />
              <Text
                style={{
                  fontSize: 12,
                  color: colors.textTertiary,
                  marginTop: Spacing.sm,
                }}
              >
                Dispensed: {formatEAT(item.dispensedAt || item.createdAt)}
              </Text>
            </DataCard>
          );
        })
      ) : (
        <EmptyState
          icon="water-outline"
          title="No fuel records"
          subtitle={
            timeFilter !== "all"
              ? "No fuel records found for the selected time period."
              : "No fuel records found."
          }
        />
      )}
    </PageShell>
  );
}

const styles = StyleSheet.create({
  statsRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  statCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    padding: Spacing.md,
    alignItems: "center",
    gap: 4,
  },
  statValue: { fontSize: 16, fontWeight: "800" },
  statLabel: { fontSize: 11, fontWeight: "600" },
  fuelBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  exportRow: { flexDirection: "row", gap: Spacing.sm, marginBottom: Spacing.md },
  exportBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  exportBtnText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },
});