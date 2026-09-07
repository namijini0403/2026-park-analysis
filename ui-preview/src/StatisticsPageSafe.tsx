import { Fragment, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  INSIGHT_THRESHOLDS,
  LAYER_FLAG_META,
  LAYER_FLAG_ORDER,
  METHOD_NOTES,
  type CityStatisticsData,
  type InsightData,
  type InsightHeadline,
  type InsightSchool,
  type LayerFlag,
  type StatisticsSchoolItem,
} from "./statisticsLive";

interface StatisticsPageProps {
  data: CityStatisticsData;
  insight: InsightData;
}

const CASE_COLORS: Record<string, string> = {
  "즉시 개선 대상": "#F87171",
  "우선 검토 대상": "#FB923C",
  "모니터링 대상": "#FBBF24",
  "유지·관리 대상": "#10B981",
  "별도 정책 적용": "#94A3B8",
};

const CHART_GRID = "rgba(255,255,255,0.08)";
const CHART_TICK = "#94A3B8";
const CHART_CURSOR = "rgba(16,185,129,0.07)";
const TOOLTIP_STYLE = {
  backgroundColor: "rgba(16,27,45,0.96)",
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: 12,
  color: "#F8FAFC",
};
const SUPPORT_PRIORITY_LABELS = new Set(["즉시 개선 대상", "우선 검토 대상"]);

function formatNumber(value: number) {
  return new Intl.NumberFormat("ko-KR").format(value);
}

function formatDecimal(value: number, digits = 1) {
  return new Intl.NumberFormat("ko-KR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

function pct(n: number, d: number) {
  return d ? Math.round((n / d) * 100) : 0;
}

function isSupportPrioritySchool(school: StatisticsSchoolItem) {
  return SUPPORT_PRIORITY_LABELS.has(school.casePolicyLabel);
}

function rerankSchools(schools: StatisticsSchoolItem[]) {
  return schools.map((school, index) => ({ ...school, rank: index + 1 }));
}

function SectionTitle({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-forest-300">{eyebrow}</p>
      <h2 className="text-2xl font-black tracking-tight text-white">{title}</h2>
      {description ? <p className="max-w-3xl text-sm leading-6 text-slate-300">{description}</p> : null}
    </div>
  );
}

function SummaryCard({ title, value, helper }: { title: string; value: string; helper: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-card-grad p-5 shadow-card">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-forest-300">{title}</p>
      <p className="mt-3 text-4xl font-black tracking-tight text-white">{value}</p>
      <p className="mt-2 text-sm text-slate-300">{helper}</p>
    </div>
  );
}

function CaseChip({ label }: { label: string }) {
  const color = CASE_COLORS[label] ?? "#94A3B8";
  return (
    <span
      className="rounded-full border px-2.5 py-1 text-[11px] font-bold"
      style={{ borderColor: `${color}66`, backgroundColor: `${color}22`, color }}
    >
      {label}
    </span>
  );
}

function FlagChip({ flag, muted = false }: { flag: LayerFlag; muted?: boolean }) {
  const meta = LAYER_FLAG_META[flag];
  return (
    <span
      title={meta.label}
      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold"
      style={{
        borderColor: muted ? "rgba(255,255,255,0.10)" : `${meta.color}66`,
        backgroundColor: muted ? "rgba(255,255,255,0.03)" : `${meta.color}22`,
        color: muted ? "#475569" : meta.color,
      }}
    >
      <span aria-hidden>{meta.icon}</span>
      {meta.short}
    </span>
  );
}

function SchoolRow({ school, compact = false }: { school: StatisticsSchoolItem; compact?: boolean }) {
  return (
    <div className="grid gap-3 rounded-2xl border border-white/10 bg-navy-850/95 p-4 sm:grid-cols-[auto_1fr_auto] sm:items-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-forest-grad text-sm font-black text-white shadow-glow">
        {school.rank}
      </div>
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-base font-bold text-white">{school.schoolName}</p>
          <span className="rounded-full border border-white/10 bg-navy-900/95 px-2.5 py-1 text-[11px] font-semibold text-slate-300">
            {school.districtName}
          </span>
          <CaseChip label={school.casePolicyLabel} />
        </div>
        <p className="mt-1 text-sm text-slate-400">{school.caseStatusLabel}</p>
        {!compact ? (
          <div className="mt-3 flex flex-wrap gap-3 text-sm text-slate-300">
            <span>학생수 {formatNumber(school.currentStudentCount)}명</span>
            <span>2029 {formatNumber(school.potentialDemand2029)}명</span>
            <span>2031 {formatNumber(school.potentialDemand2031)}명</span>
            <span>공원 {formatDecimal(school.nearestParkDistanceM, 1)}m</span>
            <span>녹지 {formatDecimal(school.greenRatio, 1)}%</span>
            <span>놀이터 {formatNumber(school.playgroundCount)}개</span>
          </div>
        ) : null}
      </div>
      <div className="rounded-2xl border border-white/10 bg-navy-900/95 px-4 py-3 text-right">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-forest-300">2029 잠재 수요</p>
        <p className="mt-1 text-2xl font-black tracking-tight text-white">{formatNumber(school.potentialDemand2029)}명</p>
      </div>
    </div>
  );
}

function BestSchoolCard({ school, label }: { school: StatisticsSchoolItem; label: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-navy-850/95 p-5 shadow-card">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-forest-300">{label}</p>
      <h3 className="mt-3 text-2xl font-black tracking-tight text-white">{school.schoolName}</h3>
      <p className="mt-1 text-sm font-medium text-slate-300">
        {school.districtName} · {school.caseStatusLabel}
      </p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-navy-900/95 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">최근접 공원</p>
          <p className="mt-1 text-2xl font-black text-white">{formatDecimal(school.nearestParkDistanceM, 1)}m</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-navy-900/95 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">표시 녹지 비율</p>
          <p className="mt-1 text-2xl font-black text-white">{formatDecimal(school.greenRatio, 1)}%</p>
        </div>
      </div>
    </div>
  );
}

// ── 레이어 교차 인사이트 컴포넌트 ──────────────────────────────────────

function HeadlineCard({ item }: { item: InsightHeadline }) {
  const [a, b] = item.flags.map((f) => LAYER_FLAG_META[f]);
  const share = pct(item.count, item.base);
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-card-grad p-5 shadow-card">
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-1.5"
        style={{ background: `linear-gradient(180deg, ${a.color}, ${b.color})` }}
      />
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-forest-300">{item.title}</p>
        <div className="flex gap-1">
          {item.flags.map((f) => (
            <FlagChip key={f} flag={f} />
          ))}
        </div>
      </div>
      <div className="mt-3 flex items-end gap-2">
        <p className="text-5xl font-black leading-none tracking-tight text-white">{formatNumber(item.count)}</p>
        <p className="pb-1 text-sm font-semibold text-slate-400">
          교 <span className="text-slate-500">/ {formatNumber(item.base)}교 중 {share}%</span>
        </p>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full" style={{ width: `${share}%`, background: `linear-gradient(90deg, ${a.color}, ${b.color})` }} />
      </div>
      <p className="mt-3 text-sm font-bold text-white">{item.meaning}</p>
      <p className="mt-1 text-xs leading-5 text-slate-400">{item.detail}</p>
      {item.coverageNote ? (
        <p className="mt-2 inline-block rounded-md border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold text-amber-200">
          {item.coverageNote}
        </p>
      ) : null}
    </div>
  );
}

function OverlapRow({ school, rank }: { school: InsightSchool; rank: number }) {
  const active = new Set(school.flags);
  const extras: string[] = [];
  if (active.has("night")) extras.push(`유흥 ${school.nightlifeWithin300}건↑(300m)`);
  if (active.has("constr") && school.constructionOpen !== null) extras.push(`미완료 착공 ${school.constructionOpen}건`);
  if (active.has("grow")) extras.push(`학생 ${formatNumber(Math.round(school.currentStudents))}→${formatNumber(Math.round(school.forecast2029))}`);
  if (active.has("nodesig")) extras.push("2026 지정 0건");
  if (!active.has("nodesig") && school.designationPrograms.length) extras.push(school.designationPrograms.slice(0, 2).join("·"));
  return (
    <div className="grid gap-3 rounded-2xl border border-white/10 bg-navy-850/95 p-4 sm:grid-cols-[auto_1fr_auto] sm:items-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-forest-grad text-sm font-black text-white shadow-glow">{rank}</div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-base font-bold text-white">{school.schoolName}</p>
          <span className="rounded-full border border-white/10 bg-navy-900/95 px-2.5 py-1 text-[11px] font-semibold text-slate-300">{school.districtName}</span>
          <CaseChip label={school.casePolicyLabel} />
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {LAYER_FLAG_ORDER.map((f) => (
            <FlagChip key={f} flag={f} muted={!active.has(f)} />
          ))}
        </div>
        {extras.length ? <p className="mt-2 text-xs text-slate-400">{extras.join(" · ")}</p> : null}
      </div>
      <div className="rounded-2xl border border-white/10 bg-navy-900/95 px-4 py-3 text-right">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-forest-300">겹침</p>
        <p className="mt-1 text-2xl font-black tracking-tight text-white">
          {school.flags.length}
          <span className="text-sm font-semibold text-slate-400">/{LAYER_FLAG_ORDER.length}</span>
        </p>
      </div>
    </div>
  );
}

function NeedMatrix({ insight }: { insight: InsightData }) {
  const max = Math.max(1, ...insight.needMatrix.map((c) => c.count));
  const levels = [3, 2, 1, 0];
  const levelLabel = ["없음", "낮음", "중간", "높음"];
  const cell = (p: number, r: number) => insight.needMatrix.find((c) => c.parkNeed === p && c.readingNeed === r);
  const bothHigh = insight.needMatrix.filter((c) => c.parkNeed >= 2 && c.readingNeed >= 2).reduce((a, c) => a + c.count, 0);
  const total = insight.needMatrix.reduce((a, c) => a + c.count, 0);
  return (
    <div>
      <div className="grid grid-cols-[auto_repeat(4,minmax(0,1fr))] gap-1.5">
        <div />
        {levels
          .slice()
          .reverse()
          .map((r) => (
            <div key={`h${r}`} className="pb-1 text-center text-[10px] font-bold uppercase tracking-wide text-amber-300/90">
              📚 {levelLabel[r]}
            </div>
          ))}
        {levels.map((p) => (
          <Fragment key={`row${p}`}>
            <div className="flex items-center justify-end pr-2 text-[10px] font-bold uppercase tracking-wide text-forest-300">
              🌳 {levelLabel[p]}
            </div>
            {levels
              .slice()
              .reverse()
              .map((r) => {
                const c = cell(p, r);
                const n = c?.count ?? 0;
                const alpha = n ? 0.14 + 0.72 * (n / max) : 0.04;
                const hot = p >= 2 && r >= 2;
                return (
                  <div
                    key={`c${p}${r}`}
                    title={`공원 수요 ${levelLabel[p]} × 독서 수요 ${levelLabel[r]}: ${n}교 (공원 우선대상 ${c?.priorityCount ?? 0}교)`}
                    className="flex aspect-[1.6] flex-col items-center justify-center rounded-xl border"
                    style={{
                      backgroundColor: hot ? `rgba(244,63,94,${alpha})` : `rgba(16,185,129,${alpha})`,
                      borderColor: hot && n ? "rgba(244,63,94,0.45)" : "rgba(255,255,255,0.08)",
                    }}
                  >
                    <span className={`text-xl font-black ${n ? "text-white" : "text-slate-600"}`}>{n}</span>
                    {c?.priorityCount ? <span className="text-[10px] font-semibold text-slate-300">우선 {c.priorityCount}</span> : null}
                  </div>
                );
              })}
          </Fragment>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-300">
        <span className="rounded-full border border-rose-400/40 bg-rose-500/15 px-3 py-1 font-bold text-rose-200">
          두 수요 모두 중간 이상 {formatNumber(bothHigh)}교 ({pct(bothHigh, total)}%)
        </span>
        <span className="text-slate-500">
          판정 보류 {formatNumber(insight.needMatrixUnknown)}교(별도 트랙·자료 공백) · 행=공원 수요, 열=독서 수요
        </span>
      </div>
    </div>
  );
}

function DesignationChart({ insight }: { insight: InsightData }) {
  const rows = insight.designationByCase.map((r) => ({
    ...r,
    total: r.withDesignation + r.withoutDesignation,
    withoutPct: pct(r.withoutDesignation, r.withDesignation + r.withoutDesignation),
  }));
  const urgent = rows[0];
  const maintain = rows[3];
  return (
    <div>
      <div className="h-[230px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
            <CartesianGrid stroke={CHART_GRID} strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11, fill: CHART_TICK }} axisLine={false} tickLine={false} />
            <YAxis dataKey="caseLabel" type="category" width={72} tick={{ fontSize: 12, fill: "#CBD5E1", fontWeight: 600 }} axisLine={false} tickLine={false} />
            <Tooltip
              cursor={{ fill: CHART_CURSOR }}
              contentStyle={TOOLTIP_STYLE}
              formatter={(value: number, name: string) => [
                `${formatNumber(value)}교`,
                name === "withDesignation" ? "지정사업 1건 이상" : "지정사업 없음",
              ]}
            />
            <Bar dataKey="withDesignation" stackId="d" fill="#A78BFA" radius={[6, 0, 0, 6]} />
            <Bar dataKey="withoutDesignation" stackId="d" fill="rgba(148,163,184,0.35)" radius={[0, 6, 6, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-navy-900/95 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">즉시 개선 학교의 지정 공백</p>
          <p className="mt-1 text-2xl font-black text-white">
            {urgent.withoutPct}% <span className="text-sm font-semibold text-slate-400">({urgent.withoutDesignation}/{urgent.total}교)</span>
          </p>
          <p className="text-[11px] text-slate-500">유지·관리 학교는 {maintain.withoutPct}% → 도달성이 나쁠수록 지정 공백이 크다</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-navy-900/95 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">교육복지우선지원 배분</p>
          <p className="mt-1 text-2xl font-black text-white">
            {formatNumber(rows[0].welfare + rows[1].welfare)}
            <span className="text-sm font-semibold text-slate-400">
              {" "}
              / {formatNumber(rows.reduce((a, r) => a + r.welfare, 0))}교가 공원 우선대상
            </span>
          </p>
          <p className="text-[11px] text-slate-500">사회경제 지원과 물리적 도달성 결핍이 다른 학교에 배분되는 구간이 존재</p>
        </div>
      </div>
    </div>
  );
}

function PctBar({ value, color, unknown = false }: { value: number; color: string; unknown?: boolean }) {
  if (unknown) return <span className="text-[11px] font-semibold text-slate-500">미수집</span>;
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full" style={{ width: `${value}%`, backgroundColor: color }} />
      </div>
      <span className="w-9 text-right text-xs font-bold text-white">{value}%</span>
    </div>
  );
}

function DistrictProfileTable({
  insight,
  selected,
  onSelect,
}: {
  insight: InsightData;
  selected: string;
  onSelect: (name: string) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-separate border-spacing-y-1.5 text-sm">
        <thead>
          <tr className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
            <th className="px-3 text-left">구·군</th>
            <th className="px-3 text-left">🌳 공원 결핍</th>
            <th className="px-3 text-left">📚 독서 결핍</th>
            <th className="px-3 text-left">🍺 유흥 노출(300m)</th>
            <th className="px-3 text-left">🎓 지정 커버</th>
            <th className="px-3 text-center">🏗 공사기록</th>
            <th className="px-3 text-right">겹침 3+</th>
          </tr>
        </thead>
        <tbody>
          {insight.districtProfiles.map((d) => {
            const active = d.districtName === selected;
            return (
              <tr
                key={d.districtName}
                onClick={() => onSelect(d.districtName)}
                className={`cursor-pointer rounded-xl transition ${active ? "bg-forest-500/15" : "bg-navy-850/95 hover:bg-white/5"}`}
              >
                <td className="rounded-l-xl px-3 py-2.5 font-bold text-white">
                  {d.districtName} <span className="text-[11px] font-medium text-slate-500">{d.schoolCount}교</span>
                </td>
                <td className="px-3 py-2.5"><PctBar value={d.parkPct} color={LAYER_FLAG_META.park.color} /></td>
                <td className="px-3 py-2.5"><PctBar value={d.readPct} color={LAYER_FLAG_META.read.color} /></td>
                <td className="px-3 py-2.5"><PctBar value={d.nightPct} color={LAYER_FLAG_META.night.color} /></td>
                <td className="px-3 py-2.5"><PctBar value={d.designationPct} color={LAYER_FLAG_META.nodesig.color} /></td>
                <td className="px-3 py-2.5 text-center">
                  {d.constructionCovered ? (
                    <span className="rounded-full border border-slate-400/40 bg-slate-400/15 px-2 py-0.5 text-[11px] font-bold text-slate-200">수집</span>
                  ) : (
                    <span className="text-[11px] font-semibold text-slate-500">미수집</span>
                  )}
                </td>
                <td className="rounded-r-xl px-3 py-2.5 text-right text-lg font-black text-white">{d.overlap3Plus}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function StatisticsPageSafe({ data, insight }: StatisticsPageProps) {
  const [selectedDistrictName, setSelectedDistrictName] = useState(data.districts[0]?.districtName ?? "");
  const [chartMode, setChartMode] = useState<"pressure" | "cases">("pressure");
  const [districtPrioritySortMode, setDistrictPrioritySortMode] = useState<"playground" | "students">("playground");
  const [cityCase1SortMode, setCityCase1SortMode] = useState<"playground" | "students">("playground");

  const selectedDistrict = useMemo(
    () => data.districts.find((district) => district.districtName === selectedDistrictName) ?? data.districts[0],
    [data.districts, selectedDistrictName]
  );

  const districtChartData = useMemo(
    () =>
      data.districts.map((district) => ({
        districtName: district.districtName,
        urgentSupportCount: district.case1Count,
        priorityReviewCount: district.case2Count,
        totalPotentialDemand2029: district.totalPotentialDemand2029,
      })),
    [data.districts]
  );

  const districtCaseChartData = useMemo(
    () =>
      data.districts.map((district) => ({
        districtName: district.districtName,
        urgentSupportCount: district.case1Count,
        priorityReviewCount: district.case2Count,
        monitoringCount: district.case3Count,
        maintainCount: district.case4Count,
        specialPolicyCount: district.specialPolicyCount,
      })),
    [data.districts]
  );

  const cityCase1Schools = useMemo(
    () =>
      cityCase1SortMode === "students"
        ? data.cityTopPrioritySchoolsStudentFocused
        : data.cityTopPrioritySchoolsPlaygroundFocused,
    [cityCase1SortMode, data.cityTopPrioritySchoolsPlaygroundFocused, data.cityTopPrioritySchoolsStudentFocused]
  );

  const selectedTopPrioritySchools = useMemo(() => {
    const focusedSchools =
      districtPrioritySortMode === "students"
        ? selectedDistrict?.topPrioritySchoolsStudentFocused
        : selectedDistrict?.topPrioritySchoolsPlaygroundFocused;
    return rerankSchools((focusedSchools ?? selectedDistrict?.topPrioritySchools ?? []).filter(isSupportPrioritySchool));
  }, [districtPrioritySortMode, selectedDistrict]);

  const cityCaseSummary = useMemo(
    () => [
      { label: "case1", value: data.summary.case1Count, color: "#dc2626" },
      { label: "case2", value: data.summary.case2Count, color: "#f97316" },
      { label: "case3", value: data.summary.case3Count, color: "#eab308" },
      { label: "case4", value: data.summary.case4Count, color: "#16a34a" },
      { label: "별도 묶음", value: data.summary.separateBundleCount, color: "#64748b" },
    ],
    [data.summary]
  );

  const priorityTotal = data.summary.case1Count + data.summary.case2Count;
  const overlap3Plus = insight.overlapHistogram.filter((h) => h.flagCount >= 3).reduce((a, h) => a + h.schools, 0);
  const histMax = Math.max(1, ...insight.overlapHistogram.map((h) => h.schools));

  return (
    <div className="mx-auto flex max-w-[1380px] flex-col gap-8 px-4 py-8 lg:px-8">
      <section className="panel space-y-5 p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-forest-300">Reachability Overview</p>
            <h1 className="text-4xl font-black tracking-tight text-white lg:text-5xl">인천 학교 전체 정책 도달성 통계</h1>
            <p className="max-w-3xl text-base leading-7 text-slate-300">
              공원·독서·지정사업·유흥 인허가·착공기록·학생 전망, 여섯 레이어를 한 학교 위에 겹쳐 봅니다. 먼저 겹침에서 드러나는 학교를
              확인하고, 이어서 시 → 구 → 학교 순으로 좁혀 봅니다.
            </p>
          </div>
          <div className="rounded-2xl border border-forest-400/30 bg-forest-500/10 px-4 py-3 text-right">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-forest-300">Live</p>
            <p className="mt-1 text-sm font-bold text-white">화면을 열 때마다 최신 데이터로 재계산</p>
            <p className="text-[11px] text-slate-400">맥락 레이어 기준일 {insight.dataAsOf ?? "—"}</p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            title="전체 학교"
            value={`${formatNumber(data.summary.schoolCount)}개교`}
            helper={`${formatNumber(data.summary.districtCount)}개 구·군 · 별도 ${formatNumber(data.summary.separateBundleCount)}개`}
          />
          <SummaryCard
            title="즉시 개선 대상"
            value={`${formatNumber(data.summary.case1Count)}개교`}
            helper={`case2 ${formatNumber(data.summary.case2Count)} · case3 ${formatNumber(data.summary.case3Count)} · case4 ${formatNumber(data.summary.case4Count)}`}
          />
          <SummaryCard
            title="레이어 3개 이상 겹침"
            value={`${formatNumber(overlap3Plus)}개교`}
            helper={`공원 우선대상 ${formatNumber(priorityTotal)}교 중 ${pct(overlap3Plus, priorityTotal)}%`}
          />
          <SummaryCard
            title="2029 잠재 수요"
            value={`${formatNumber(data.summary.totalPotentialDemand2029)}명`}
            helper={`단지보정 후보 ${formatNumber(data.summary.apartmentAdjustmentCandidateCount)}개교`}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-5">
          {cityCaseSummary.map((item) => (
            <div key={item.label} className="rounded-2xl border border-white/10 bg-navy-850/95 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">{item.label}</p>
              </div>
              <p className="mt-2 text-2xl font-black tracking-tight text-white">{formatNumber(item.value)}개교</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── 레이어 교차 인사이트 ─────────────────────────────────────── */}
      <section className="panel space-y-5 p-6">
        <SectionTitle
          eyebrow="Cross-layer Insight"
          title="레이어를 겹치면 보이는 학교"
          description="한 레이어만 보면 '공원이 부족한 학교'지만, 겹쳐 보면 '공원도 도서관도 없고, 유흥업소는 밀집하고, 학생은 늘어나는데, 어떤 지정사업도 닿지 않은 학교'가 드러납니다."
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {insight.headlines.map((item) => (
            <HeadlineCard key={item.key} item={item} />
          ))}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="panel p-6">
          <SectionTitle
            eyebrow="Integrated Priority"
            title="통합 우선 학교 Top 10"
            description="공원 우선대상 중 겹치는 레이어가 많은 순서입니다. 켜진 칩이 그 학교에 실제로 겹친 레이어, 흐린 칩은 해당 없음(또는 미수집)입니다."
          />
          <div className="mt-5 space-y-3">
            {insight.topOverlap.map((school, index) => (
              <OverlapRow key={school.schoolId} school={school} rank={index + 1} />
            ))}
          </div>
        </div>
        <div className="space-y-6">
          <div className="panel p-6">
            <SectionTitle eyebrow="Overlap" title="겹침 수 분포" description={`공원 우선대상 ${formatNumber(priorityTotal)}교가 몇 개 레이어에 동시에 걸리는지.`} />
            <div className="mt-5 space-y-2">
              {insight.overlapHistogram.map((h) => (
                <div key={h.flagCount} className="grid grid-cols-[52px_1fr_44px] items-center gap-3">
                  <span className="text-xs font-bold text-slate-300">{h.flagCount}개 겹침</span>
                  <div className="h-3 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(h.schools / histMax) * 100}%`,
                        background: h.flagCount >= 3 ? "linear-gradient(90deg,#F43F5E,#FB923C)" : "linear-gradient(90deg,#047857,#10B981)",
                      }}
                    />
                  </div>
                  <span className="text-right text-sm font-black text-white">{h.schools}교</span>
                </div>
              ))}
            </div>
          </div>
          <div className="panel p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-forest-300">Layers</p>
            <div className="mt-3 space-y-2">
              {LAYER_FLAG_ORDER.map((f) => (
                <div key={f} className="flex items-center gap-3">
                  <FlagChip flag={f} />
                  <span className="text-xs text-slate-300">{LAYER_FLAG_META[f].label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="panel p-6">
          <SectionTitle
            eyebrow="Park × Reading"
            title="공원 수요 × 독서 수요 매트릭스"
            description="정책 행동 카드가 매긴 두 수요 등급을 교차한 것입니다. 붉은 구역이 두 정책을 한 부지·한 예산에서 함께 다룰 후보입니다."
          />
          <div className="mt-5">
            <NeedMatrix insight={insight} />
          </div>
        </div>
        <div className="panel p-6">
          <SectionTitle
            eyebrow="Designation × Reachability"
            title="지정사업은 도달성 결핍 학교에 닿고 있나"
            description="2026학년도 지정·연구·선도학교 공고와 공원 도달성 case를 교차했습니다. 도달성이 나쁜 학교일수록 지정 공백이 크면, 기존 지원 채널만으로는 격차를 좁히기 어렵습니다."
          />
          <div className="mt-5">
            <DesignationChart insight={insight} />
          </div>
        </div>
      </section>

      <section className="panel space-y-5 p-6">
        <SectionTitle
          eyebrow="District Layer Profile"
          title="구별 레이어 프로파일"
          description="각 구 초등학교 중 레이어별 해당 비율입니다. 행을 누르면 아래 구별 상세가 그 구로 바뀝니다. 미수집 레이어는 0%가 아니라 '미수집'으로 남깁니다."
        />
        <DistrictProfileTable insight={insight} selected={selectedDistrict?.districtName ?? ""} onSelect={setSelectedDistrictName} />
      </section>

      {/* ── 기존 시·구 통계 (실시간 재계산) ───────────────────────────── */}
      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="panel p-6">
          <SectionTitle
            eyebrow="District View"
            title={chartMode === "pressure" ? "구별 우선 지원 압력" : "구별 전체 case 분포"}
            description={
              chartMode === "pressure"
                ? "즉시 개선 대상과 우선 검토 대상을 함께 쌓아 보여주는 비교 차트입니다."
                : "구별 학교가 어떤 case에 얼마나 분포하는지 한 번에 비교할 수 있는 차트입니다."
            }
          />
          <div className="mt-4 flex flex-wrap gap-2">
            {[
              { key: "pressure", label: "우선지원 압력" },
              { key: "cases", label: "전체 case 수" },
            ].map((item) => {
              const active = chartMode === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => setChartMode(item.key as "pressure" | "cases")}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    active ? "bg-forest-grad text-white shadow-glow" : "border border-white/15 bg-navy-900/95 text-slate-200 hover:bg-white/10"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
          <div className="mt-5 h-[360px]">
            <ResponsiveContainer width="100%" height="100%">
              {chartMode === "pressure" ? (
                <BarChart data={districtChartData} layout="vertical" margin={{ left: 8, right: 10, top: 8, bottom: 8 }}>
                  <CartesianGrid stroke={CHART_GRID} strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: CHART_TICK }} axisLine={false} tickLine={false} />
                  <YAxis dataKey="districtName" type="category" width={84} tick={{ fontSize: 12, fill: "#CBD5E1", fontWeight: 600 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    cursor={{ fill: CHART_CURSOR }}
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(value: number, name: string) => {
                      if (name === "urgentSupportCount") return [`${formatNumber(value)}개교`, "즉시 개선"];
                      if (name === "priorityReviewCount") return [`${formatNumber(value)}개교`, "우선 검토"];
                      return [formatNumber(value), name];
                    }}
                  />
                  <Bar dataKey="urgentSupportCount" stackId="district" fill={CASE_COLORS["즉시 개선 대상"]} radius={[6, 0, 0, 6]} />
                  <Bar dataKey="priorityReviewCount" stackId="district" fill={CASE_COLORS["우선 검토 대상"]} radius={[0, 6, 6, 0]} />
                </BarChart>
              ) : (
                <BarChart data={districtCaseChartData} layout="vertical" margin={{ left: 8, right: 10, top: 8, bottom: 8 }}>
                  <CartesianGrid stroke={CHART_GRID} strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: CHART_TICK }} axisLine={false} tickLine={false} />
                  <YAxis dataKey="districtName" type="category" width={84} tick={{ fontSize: 12, fill: "#CBD5E1", fontWeight: 600 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    cursor={{ fill: CHART_CURSOR }}
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(value: number, name: string) => {
                      const labels: Record<string, string> = {
                        urgentSupportCount: "즉시 개선 대상",
                        priorityReviewCount: "우선 검토 대상",
                        monitoringCount: "모니터링 대상",
                        maintainCount: "유지·관리 대상",
                        specialPolicyCount: "별도 정책 적용",
                      };
                      return [`${formatNumber(value)}개교`, labels[name] ?? name];
                    }}
                  />
                  <Bar dataKey="urgentSupportCount" stackId="district" fill={CASE_COLORS["즉시 개선 대상"]} radius={[6, 0, 0, 6]} />
                  <Bar dataKey="priorityReviewCount" stackId="district" fill={CASE_COLORS["우선 검토 대상"]} />
                  <Bar dataKey="monitoringCount" stackId="district" fill={CASE_COLORS["모니터링 대상"]} />
                  <Bar dataKey="maintainCount" stackId="district" fill={CASE_COLORS["유지·관리 대상"]} />
                  <Bar dataKey="specialPolicyCount" stackId="district" fill={CASE_COLORS["별도 정책 적용"]} radius={[0, 6, 6, 0]} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel p-6">
          <SectionTitle eyebrow="City Best" title="시 전체 최우수 학교" description="외부 접근성 벤치마크 역할을 하는 학교 1개를 표시 녹지비율 기준으로 보여줍니다." />
          <div className="mt-5">
            <BestSchoolCard school={data.cityBestSchool} label="인천시 최우수 학교" />
          </div>
        </div>
      </section>

      <section className="panel space-y-5 p-6">
        <SectionTitle
          eyebrow="District Detail"
          title="구별 상세 통계"
          description="구를 선택하면 해당 구의 도달성 지표와 우선 지원 학교 Top 5, 구 최우수 학교 1개를 함께 확인할 수 있습니다."
        />
        <div className="flex flex-wrap gap-2">
          {data.districts.map((district) => {
            const active = district.districtName === selectedDistrict?.districtName;
            return (
              <button
                key={district.districtName}
                onClick={() => setSelectedDistrictName(district.districtName)}
                className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                  active ? "border-forest-400/60 bg-forest-grad text-white shadow-glow" : "border-white/15 bg-navy-900/95 text-slate-200 hover:bg-white/10"
                }`}
              >
                {district.districtName}
              </button>
            );
          })}
        </div>

        {selectedDistrict ? (
          <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <SummaryCard
                  title={`${selectedDistrict.districtName} 전체 학교`}
                  value={`${formatNumber(selectedDistrict.schoolCount)}개교`}
                  helper={`즉시 ${formatNumber(selectedDistrict.case1Count)}개 · 검토 ${formatNumber(selectedDistrict.case2Count)}개`}
                />
                <SummaryCard
                  title="2029 잠재 수요"
                  value={`${formatNumber(selectedDistrict.totalPotentialDemand2029)}명`}
                  helper={`2031 ${formatNumber(selectedDistrict.totalPotentialDemand2031)}명`}
                />
                <SummaryCard
                  title="평균 최근접 공원"
                  value={`${formatDecimal(selectedDistrict.avgNearestParkDistanceM, 1)}m`}
                  helper={`평균 표시 녹지 ${formatDecimal(selectedDistrict.avgGreenRatio, 1)}%`}
                />
                <SummaryCard
                  title="평균 도보권 놀이터"
                  value={`${formatDecimal(selectedDistrict.avgPlaygroundCount, 2)}개`}
                  helper={`우선 검토 ${formatNumber(selectedDistrict.priorityReviewCount)}개교`}
                />
              </div>
              <BestSchoolCard school={selectedDistrict.bestSchool} label={`${selectedDistrict.districtName} 최우수 학교`} />
            </div>

            <div className="rounded-2xl border border-white/10 bg-navy-850/95 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-forest-300">Top 5</p>
                  <h3 className="mt-1 text-2xl font-black tracking-tight text-white">{selectedDistrict.districtName} 우선 지원 대상 최대 5개</h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {[
                      { key: "playground", label: "놀이공간 부족 우선" },
                      { key: "students", label: "학생수 우선" },
                    ].map((item) => {
                      const active = districtPrioritySortMode === item.key;
                      return (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => setDistrictPrioritySortMode(item.key as "playground" | "students")}
                          className={`rounded-full px-3.5 py-2 text-xs font-semibold transition ${
                            active ? "bg-forest-grad text-white shadow-glow" : "border border-white/15 bg-navy-900/95 text-slate-200 hover:bg-white/10"
                          }`}
                        >
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-navy-900/95 px-4 py-3 text-right">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">구 총 잠재 수요</p>
                  <p className="mt-1 text-2xl font-black text-white">{formatNumber(selectedDistrict.totalPotentialDemand2029)}명</p>
                </div>
              </div>
              <div className="mt-4 space-y-3">
                {selectedTopPrioritySchools.length ? (
                  selectedTopPrioritySchools.map((school) => (
                    <SchoolRow key={`${selectedDistrict.districtName}-${school.rank}-${school.schoolName}`} school={school} />
                  ))
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-navy-900/95 p-5 text-sm leading-6 text-slate-300">
                    이 구에는 현재 기준의 즉시 개선 대상 또는 우선 검토 대상 학교가 없습니다.
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <div className="panel p-6">
          <SectionTitle
            eyebrow="City Case 1"
            title={`시 전체 case1 우선순위 ${formatNumber(cityCase1Schools.length)}개교`}
            description="같은 case1 안에서도 무엇을 먼저 볼지 선택할 수 있습니다. 놀이공간 부족을 우선할지, 현재 학생 규모를 우선할지 바로 비교해 볼 수 있습니다."
          />
          <div className="mt-4 flex flex-wrap gap-2">
            {[
              { key: "playground", label: "놀이공간 부족 우선" },
              { key: "students", label: "학생수 우선" },
            ].map((item) => {
              const active = cityCase1SortMode === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setCityCase1SortMode(item.key as "playground" | "students")}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    active ? "bg-forest-grad text-white shadow-glow" : "border border-white/15 bg-navy-900/95 text-slate-200 hover:bg-white/10"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
          <div className="mt-5 space-y-3">
            {cityCase1Schools.map((school) => (
              <SchoolRow key={`city-${school.rank}-${school.schoolName}`} school={school} />
            ))}
          </div>
        </div>

        <div className="panel p-6">
          <SectionTitle eyebrow="City Mix" title="구별 2029 잠재 수요" description="구 단위 총 잠재 수요 규모를 막대로 비교해, 수요가 커지는 방향을 빠르게 볼 수 있습니다." />
          <div className="mt-5 h-[560px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={districtChartData} margin={{ top: 8, right: 10, bottom: 40, left: 0 }}>
                <CartesianGrid stroke={CHART_GRID} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="districtName" angle={-35} textAnchor="end" height={72} tick={{ fontSize: 11, fill: CHART_TICK }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: CHART_TICK }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: CHART_CURSOR }} formatter={(value: number) => [`${formatNumber(value)}명`, "2029 잠재 수요"]} />
                <Bar dataKey="totalPotentialDemand2029" radius={[8, 8, 0, 0]}>
                  {districtChartData.map((entry) => (
                    <Cell key={entry.districtName} fill={entry.districtName === selectedDistrict?.districtName ? "#10B981" : "rgba(167,243,208,0.32)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* ── 정의·출처(접힘) ───────────────────────────────────────────── */}
      <details className="group rounded-2xl border border-white/10 bg-navy-900/60 px-5 py-3 text-[11px] leading-5 text-slate-400">
        <summary className="cursor-pointer select-none text-xs font-semibold text-slate-300 marker:text-forest-400">
          계산 정의 · 임계값 · 데이터 출처 보기
        </summary>
        <div className="mt-3 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <ol className="list-decimal space-y-1 pl-4">
            {METHOD_NOTES.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ol>
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">맥락 레이어 수집 상태</p>
            {insight.layerStatus.map((layer) => (
              <div key={layer.key} className="flex flex-wrap items-center gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-1.5">
                <span className="font-semibold text-slate-300">{layer.label}</span>
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                  style={{
                    backgroundColor: layer.status === "available" ? "rgba(16,185,129,0.15)" : "rgba(245,158,11,0.15)",
                    color: layer.status === "available" ? "#6EE7B7" : "#FCD34D",
                  }}
                >
                  {layer.statusLabel}
                </span>
                <span className="text-slate-500">{layer.note}</span>
              </div>
            ))}
            <p className="pt-1 text-[10px] text-slate-500">
              임계값: 유흥 반경 {INSIGHT_THRESHOLDS.nightlifeRadiusM}m · {INSIGHT_THRESHOLDS.nightlifeMinCount}건, 착공 미완료 {INSIGHT_THRESHOLDS.constructionMinOpen}건.
              모든 맥락 지표는 참고 맥락이며 자동 안전 등급·지원 자격 판정에 쓰지 않습니다.
            </p>
          </div>
        </div>
      </details>
    </div>
  );
}
