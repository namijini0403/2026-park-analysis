import * as React from "react";
import {
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// 백분위 방향 규칙
// nearestParkDistance: share_ge 기준 -> 낮을수록 불리 (10% = 상위 10% 불리 = 위험)
// greenRatio: share_le 기준 -> 높을수록 불리 (88% = 하위 88% = 위험)
// playgroundCount: share_le 기준 -> 높을수록 불리
// currentStudentCount: share_ge 기준 -> 높을수록 수혜 대상 많음 (우선순위 가중)

type StatusTone = "danger" | "warning" | "caution" | "positive";

type StudentTrendPoint = {
  year: string;
  value: number;
};

type SimilarSchoolItem = {
  schoolName: string;
  districtName: string;
  nearestParkDistanceM: number;
  greenRatio: number;
  playgroundCount: number;
  rank?: number;
  similarityDistance?: number;
};

type BenchmarkSchoolItem = SimilarSchoolItem;

type RedevelopmentProject = {
  name: string;
  distanceM: number;
  stage: string;
  location: string;
};

export const CASE_LABELS = {
  1: { policy: "즉시 개선 대상", status: "공원 접근 불가" },
  2: { policy: "우선 검토 대상", status: "공원 접근 가능 · 녹지 부족" },
  3: { policy: "모니터링 대상", status: "공원 접근 가능 · 녹지 비율 양호" },
  4: { policy: "유지·관리 대상", status: "공원 접근 양호 · 녹지 충분" },
  99: { policy: "별도 정책 필요", status: "도서·분교 등 별도 기준 검토" },
} as const;

export type SchoolDetailReportProps = {
  schoolName: string;
  districtName: string;
  casePolicyLabel: string;
  caseStatusLabel: string;
  statusSummary?: string;
  nearestParkDistanceM: number;
  nearestParkName?: string;
  nearestParkAccessNote?: string;
  nearestParkDistanceCityAvg: number;
  nearestParkDistanceDistrictAvg: number;
  nearestParkDistanceCityPercentile?: number;
  nearestParkDistanceDistrictPercentile?: number;
  greenRatio: number;
  greenRatioCityAvg: number;
  greenRatioDistrictAvg: number;
  greenRatioCityPercentile?: number;
  greenRatioDistrictPercentile?: number;
  greenRatioCityPercentile_lt?: number;
  greenRatioDistrictPercentile_lt?: number;
  greenRatioCityZeroShare?: number;
  greenRatioDistrictZeroShare?: number;
  greenRatioCityNonZeroPercentile?: number;
  greenRatioDistrictNonZeroPercentile?: number;
  greenRatioCityNonZeroAvg?: number;
  greenRatioDistrictNonZeroAvg?: number;
  playgroundCount: number;
  straightLinePlaygroundCount?: number | null;
  playgroundCountCityAvg: number;
  playgroundCountDistrictAvg: number;
  playgroundCountCityPercentile?: number;
  playgroundCountDistrictPercentile?: number;
  playgroundCountCityPercentile_lt?: number;
  playgroundCountDistrictPercentile_lt?: number;
  playgroundCountCityZeroShare?: number;
  playgroundCountDistrictZeroShare?: number;
  playgroundCountCityNonZeroPercentile?: number;
  playgroundCountDistrictNonZeroPercentile?: number;
  playgroundCountCityNonZeroAvg?: number;
  playgroundCountDistrictNonZeroAvg?: number;
  noParkWithin500m?: boolean;
  accessibilityRatio?: number;
  parkShortageVsAvg?: number;
  studentTrend: StudentTrendPoint[];
  studentTrendChangePct?: number;
  studentTrendCityAvg: number;
  studentTrendDistrictAvg: number;
  currentStudentCount2025?: number;
  currentStudentCountCityPercentile?: number;
  currentStudentCountDistrictPercentile?: number;
  potentialDemand2029: number;
  potentialDemand2031: number;
  problemTags: string[];
  contextTags: string[];
  redevelopmentPlanYear?: string;
  redevelopmentType?: string;
  hasLargeApartmentComplexNearby?: boolean;
  similarityK?: number;
  similaritySelectionFeatures?: string;
  similarityComparisonFeatures?: string;
  similarityCommonPoints?: string;
  similarityStrengthsText?: string;
  similarityWeaknessesText?: string;
  similarityPeerAvgNearestParkDistanceM?: number;
  similarityPeerAvgGreenRatio?: number;
  similarityPeerAvgPlaygroundCount?: number;
  similarSchools?: SimilarSchoolItem[];
  cityBestEnvironmentSchool?: BenchmarkSchoolItem;
  districtBestEnvironmentSchool?: BenchmarkSchoolItem;
  redevelopmentProjects?: RedevelopmentProject[];
  onSimulationClick?: () => void;
};

type MetricCardProps = {
  title: string;
  icon: string;
  value: string;
  unit: string;
  tone: StatusTone;
  headline: string;
  emphasisLine?: string;
  comparisonLines?: string[];
  comparisonVisual?: React.ReactNode;
  footer?: React.ReactNode;
};

type PositionPoint = {
  id: string;
  label: string;
  schoolName: string;
  districtName: string;
  nearestParkDistanceM: number;
  greenRatio: number;
  playgroundCount: number;
  rankLabel?: string;
  pointType: "current" | "similar" | "cityBest" | "districtBest" | "sharedBest";
};

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("ko-KR").format(value);
}

function formatDecimal(value: number, digits = 1) {
  return new Intl.NumberFormat("ko-KR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

function formatWholeNumber(value: number) {
  return formatNumber(Math.round(value));
}

function formatWholePercent(value: number) {
  return `${formatWholeNumber(value)}%`;
}

function formatSignedPercent(value: number) {
  return `${value > 0 ? "+" : ""}${formatDecimal(value, 1)}%`;
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value));
}

function getDisplayPercentile(value: number, percentileLe?: number, percentileLt?: number) {
  if (percentileLe == null) return undefined;
  if (percentileLt == null) return Math.round(percentileLe * 10) / 10;
  if (value === 0) return Math.max(1, Math.round((percentileLt + 1) * 10) / 10);
  return Math.round((percentileLt + 1) * 10) / 10;
}

type ZeroInflatedDisplayModel = {
  isZero: boolean;
  zeroShare?: number;
  nonZeroPercentile?: number;
  nonZeroAvg?: number;
  comparisonDisabled: boolean;
  emphasisLine?: string;
  percentileLabel: string;
  avgLabel?: string;
  currentRatio?: number;
  avgRatio?: number;
  directionLabel: string;
};

function getRelativeLevelText(tone: StatusTone, kind: "park" | "green" | "playground" | "demand") {
  if (kind === "park") {
    if (tone === "positive") return "비교적 좋은 편입니다.";
    if (tone === "caution") return "보통 수준입니다.";
    if (tone === "warning") return "다소 불리한 편입니다.";
    return "가장 불리한 그룹에 가깝습니다.";
  }
  if (kind === "demand") {
    if (tone === "positive") return "비교적 큰 편입니다.";
    if (tone === "caution") return "보통 수준입니다.";
    if (tone === "warning") return "다소 작은 편입니다.";
    return "작은 편에 가깝습니다.";
  }
  if (tone === "positive") return "비교적 좋은 편입니다.";
  if (tone === "caution") return "보통 수준입니다.";
  if (tone === "warning") return "다소 부족한 편입니다.";
  return "가장 부족한 그룹에 가깝습니다.";
}

function getParkHeadline(distanceM: number) {
  if (distanceM <= 150) return "가까운 공원을 바로 이용할 수 있는 학교입니다.";
  if (distanceM <= 300) return "가까운 공원이 있는 편입니다.";
  if (distanceM <= 500) return "공원 접근성은 보통 수준입니다.";
  if (distanceM <= 800) return "가까운 공원이 다소 부족한 학교입니다.";
  return "가까운 공원 접근성이 불리한 학교입니다.";
}

function getParkDetail(distanceM: number) {
  if (distanceM <= 150) return "학교 주변에서 공원 접근성이 매우 좋은 편입니다.";
  if (distanceM <= 300) return "일상적으로 이용 가능한 공원이 비교적 가까이에 있습니다.";
  if (distanceM <= 500) return "가까운 공원이 없는 것은 아니지만, 바로 인접한 수준은 아닙니다.";
  if (distanceM <= 800) return "공원은 접근 가능하지만, 일상적으로 바로 이용하기에는 거리가 있는 편입니다.";
  return "가까운 생활권 안에서 바로 이용할 수 있는 공원이 부족합니다.";
}

function getGreenHeadline(tone: StatusTone, value: number) {
  if (value === 0) return "보행권 안 녹지 환경이 매우 부족한 학교입니다.";
  if (tone === "positive") return "보행권 안 녹지 환경이 매우 좋은 학교입니다.";
  if (tone === "caution") return "녹지 환경은 보통 수준입니다.";
  if (tone === "warning") return "녹지 환경이 부족한 편입니다.";
  return "보행권 안 녹지 환경이 매우 부족한 학교입니다.";
}

function getGreenDetail(tone: StatusTone, value: number) {
  if (value === 0) return "학교 주변 보행권 안에 체감 가능한 녹지 공간이 거의 없습니다.";
  if (tone === "positive") return "학교 주변에서 머물며 이용할 수 있는 녹지 공간이 충분합니다.";
  if (tone === "caution") return "체류형 녹지 공간이 아주 풍부하지는 않지만 기본 수준은 갖추고 있습니다.";
  if (tone === "warning") return "학교 주변에서 머물며 이용할 수 있는 녹지 공간이 넉넉하지 않습니다.";
  return "학교 주변 보행권 안에 체감 가능한 녹지 공간이 거의 없습니다.";
}

function getPlaygroundHeadline(tone: StatusTone, count: number) {
  if (count === 0) return "놀이터 접근성이 불리한 학교입니다.";
  if (tone === "positive") return "가까운 놀이터 이용 환경이 매우 좋은 학교입니다.";
  if (tone === "caution") return "놀이터 접근성은 보통 수준입니다.";
  if (tone === "warning") return "가까운 놀이터가 다소 부족한 학교입니다.";
  return "놀이터 접근성이 불리한 학교입니다.";
}

function getPlaygroundDetail(tone: StatusTone, count: number) {
  if (count === 0) return "생활권 안에서 바로 이용할 수 있는 놀이터가 부족합니다.";
  if (tone === "positive") return "아이들이 걸어서 이용할 수 있는 놀이터가 충분한 편입니다.";
  if (tone === "caution") return "기본적인 이용은 가능하지만 매우 풍부한 수준은 아닙니다.";
  if (tone === "warning") return "이용 가능한 놀이터는 있으나 선택지가 넉넉하지 않습니다.";
  return "생활권 안에서 바로 이용할 수 있는 놀이터가 부족합니다.";
}

function getStudentDemandTone(currentStudentCount: number, percentile?: number): StatusTone {
  if (percentile != null) {
    if (percentile <= 20) return "positive";
    if (percentile <= 50) return "caution";
    if (percentile <= 75) return "warning";
    return "danger";
  }
  if (currentStudentCount >= 700) return "positive";
  if (currentStudentCount >= 400) return "caution";
  if (currentStudentCount >= 200) return "warning";
  return "danger";
}

function getStudentHeadline(tone: StatusTone) {
  if (tone === "positive") return "주변 학생 수요가 매우 큰 학교입니다.";
  if (tone === "caution") return "주변 학생 수요는 보통 수준입니다.";
  if (tone === "warning") return "주변 학생 수요가 다소 적은 편입니다.";
  return "주변 학생 수요가 작은 학교입니다.";
}

function getStudentDetail(tone: StatusTone) {
  if (tone === "positive") return "시설 설치 시 수혜 규모가 크게 나타날 가능성이 있습니다.";
  if (tone === "caution") return "시설 설치 시 평균적인 수혜 규모가 예상됩니다.";
  if (tone === "warning") return "설치 효과는 제한적일 수 있습니다.";
  return "시설 설치 시 직접적인 수혜 규모는 크지 않을 수 있습니다.";
}

function buildZeroInflatedDisplayModel({
  value,
  zeroShare,
  nonZeroPercentile,
  nonZeroAvg,
  basisLabel,
  zeroMessage,
  nonZeroMessage,
  directionLabel,
  scaleMax,
}: {
  value: number;
  zeroShare?: number;
  nonZeroPercentile?: number;
  nonZeroAvg?: number;
  basisLabel: string;
  zeroMessage: string;
  nonZeroMessage: string;
  directionLabel: string;
  scaleMax: number;
}): ZeroInflatedDisplayModel {
  if (!Number.isFinite(value)) {
    return {
      isZero: false,
      comparisonDisabled: true,
      percentileLabel: "비교 불가",
      directionLabel,
      emphasisLine: `${basisLabel} 비교에 필요한 값이 없습니다.`,
    };
  }

  if (value === 0) {
    return {
      isZero: true,
      zeroShare,
      comparisonDisabled: true,
      percentileLabel: "현재 값 해석",
      directionLabel,
      emphasisLine: `${zeroMessage} ${basisLabel} 기준으로도 매우 부족한 편입니다.`,
    };
  }

  const clamp = (target: number) => clampPercent((target / Math.max(scaleMax, 1)) * 100);

  return {
    isZero: false,
    zeroShare,
    nonZeroPercentile,
    nonZeroAvg,
    comparisonDisabled: false,
    percentileLabel: "현재 값 해석",
    directionLabel,
    avgLabel: nonZeroAvg != null ? `${formatWholeNumber(nonZeroAvg)}` : undefined,
    currentRatio: clamp(value),
    avgRatio: nonZeroAvg != null ? clamp(nonZeroAvg) : undefined,
    emphasisLine:
      nonZeroPercentile != null
        ? `${basisLabel} 기준으로 현재 수준을 비교해 볼 수 있습니다.`
        : `${basisLabel} 기준 비교 가능한 학교 수가 충분하지 않습니다.`,
  };
}

function getToneMeta(tone: StatusTone) {
  switch (tone) {
    case "danger":
      return { badge: "위험", accent: "text-red-700", soft: "bg-red-50", border: "border-red-200" };
    case "warning":
      return { badge: "경고", accent: "text-orange-700", soft: "bg-orange-50", border: "border-orange-200" };
    case "caution":
      return { badge: "주의", accent: "text-yellow-700", soft: "bg-yellow-50", border: "border-yellow-200" };
    default:
      return { badge: "양호", accent: "text-green-700", soft: "bg-green-50", border: "border-green-200" };
  }
}

function toneFromComparison(current: number, city: number, district: number, higherIsBetter: boolean): StatusTone {
  const cityGap = higherIsBetter ? current - city : city - current;
  const districtGap = higherIsBetter ? current - district : district - current;
  const avgGap = (cityGap + districtGap) / 2;
  if (avgGap <= -2.5) return "danger";
  if (avgGap <= -1.2) return "warning";
  if (avgGap < 0) return "caution";
  return "positive";
}

function buildTrendTone(points: StudentTrendPoint[]): StatusTone {
  const first = points[0]?.value ?? 0;
  const last = points[points.length - 1]?.value ?? 0;
  if (!first) return "caution";
  const change = ((last - first) / first) * 100;
  if (change <= -18) return "danger";
  if (change <= -10) return "warning";
  if (change < -3) return "caution";
  return "positive";
}

// nearestParkDistance: share_ge 기준 — percentile 낮을수록 불리(거리 긴 학교가 적다 = 이 학교가 나쁨)
function parkToneFromPercentile(percentile: number | undefined): StatusTone {
  if (percentile == null) return "caution";
  if (percentile <= 25) return "danger";
  if (percentile <= 50) return "warning";
  if (percentile <= 70) return "caution";
  return "positive";
}

// 백분위 없을 때 거리 직접 비교로 tone 산출
function parkToneFromDistance(distanceM: number, cityAvg: number): StatusTone {
  if (distanceM <= cityAvg * 0.45) return "positive";  // 시 평균의 절반 이하 → 양호
  if (distanceM <= cityAvg) return "caution";
  if (distanceM <= cityAvg * 1.6) return "warning";
  return "danger";
}

// greenRatio: share_le 기준 — percentile 높을수록 불리(녹지 낮은 학교가 많다 = 이 학교가 나쁨)
function greenToneFromPercentile(percentile: number | undefined): StatusTone {
  if (percentile == null) return "caution";
  if (percentile >= 80) return "danger";
  if (percentile >= 60) return "warning";
  if (percentile >= 40) return "caution";
  return "positive";
}

function greenToneFromValue(value: number, cityAvg: number): StatusTone {
  if (value >= cityAvg * 1.2) return "positive";
  if (value >= cityAvg * 0.5) return "caution";
  if (value > 0) return "warning";
  return "danger";
}

// playgroundCount: share_le 기준 — percentile 높을수록 불리
function playgroundToneFromPercentile(percentile: number | undefined): StatusTone {
  if (percentile == null) return "caution";
  if (percentile >= 80) return "danger";
  if (percentile >= 60) return "warning";
  if (percentile >= 40) return "caution";
  return "positive";
}

function playgroundToneFromValue(count: number, cityAvg: number): StatusTone {
  if (count >= cityAvg * 1.5) return "positive";
  if (count >= cityAvg) return "caution";
  if (count > 0) return "warning";
  return "danger";
}

function trendToneFromChange(changePercent: number): StatusTone {
  if (changePercent > 0) return "caution";
  if (changePercent <= -18) return "danger";
  if (changePercent <= -10) return "warning";
  return "caution";
}

function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("rounded-3xl border border-slate-200 bg-white shadow-sm", className)} {...props} />;
}

function Badge({ tone, children }: { tone: StatusTone; children: React.ReactNode }) {
  const meta = getToneMeta(tone);
  return <span className={cx("inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold", meta.soft, meta.border, meta.accent)}>{children}</span>;
}

function Button({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={cx("inline-flex items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800", className)} {...props} />;
}

function SectionShell({ kicker, title, children }: { kicker: string; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">{kicker}</p>
        <h2 className="text-2xl font-bold tracking-tight text-slate-950">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function SectionChip({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700">{children}</span>;
}

function DarkChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700">
      {children}
    </span>
  );
}

function MetricCard({ title, icon, value, unit, tone, headline, emphasisLine, comparisonLines, comparisonVisual, footer }: MetricCardProps) {
  const meta = getToneMeta(tone);
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{icon} {title}</p>
          <div className="mt-3 flex items-end gap-2">
            <p className="text-4xl font-bold tracking-tight text-slate-950">{value}</p>
            <p className="pb-1 text-sm font-medium text-slate-500">{unit}</p>
          </div>
        </div>
        <Badge tone={tone}>{meta.badge}</Badge>
      </div>
      <div className={cx("mt-4 rounded-2xl border p-4", meta.soft, meta.border)}>
        <p className={cx("text-sm font-semibold", meta.accent)}>{headline}</p>
        {emphasisLine ? (
          <p className="mt-2 text-base font-bold tracking-tight text-slate-950">{emphasisLine}</p>
        ) : null}
        {comparisonVisual ? comparisonVisual : null}
        {comparisonLines?.length ? (
          <div className="mt-2 space-y-1 text-sm text-slate-700">
            {comparisonLines.map((line) => <p key={line}>{line}</p>)}
          </div>
        ) : null}
      </div>
      {footer ? <div className="mt-4">{footer}</div> : null}
    </Card>
  );
}

function ComparisonBar({
  label,
  percentile,
  percentileLabel,
  currentRatio,
  avgRatio,
  currentLabel,
  avgLabel,
  avgTitle,
  directionLabel,
  disabled,
  disabledMessage,
}: {
  label: string;
  percentile?: number;
  percentileLabel: string;
  currentRatio?: number;
  avgRatio?: number;
  currentLabel: string;
  avgLabel: string;
  avgTitle: string;
  directionLabel: string;
  disabled?: boolean;
  disabledMessage?: string;
}) {
  const marker = (value: number) => `${clampPercent(value)}%`;

  return (
    <div className="mt-3 space-y-3">
      <div className="rounded-2xl bg-white/80 px-3 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
        <div className="mt-2 flex items-end justify-between gap-3">
          <p className="text-2xl font-black tracking-tight text-slate-950">
            {percentile == null ? "-" : formatWholePercent(percentile)}
          </p>
          <p className="text-xs font-medium text-slate-500">
            {percentile == null ? "비교 분포 계산 중" : percentileLabel}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-[11px] font-medium text-slate-500">
          <span>불리</span>
          <span>{directionLabel}</span>
          <span>유리</span>
        </div>
        <div className={cx("relative h-3 rounded-full ring-1 ring-slate-200", disabled ? "bg-slate-100" : "bg-white/90")}>
          <div
            className={cx(
              "absolute inset-y-0 left-0 rounded-full",
              disabled ? "bg-slate-300" : "bg-gradient-to-r from-red-200 via-yellow-200 to-green-200",
            )}
            style={{ width: "100%" }}
          />
          {!disabled && avgRatio != null ? (
            <div className="absolute top-1/2 h-5 w-[2px] -translate-y-1/2 bg-slate-500" style={{ left: marker(avgRatio) }} />
          ) : null}
          {!disabled && currentRatio != null ? (
            <div className="absolute top-1/2 h-6 w-6 -translate-y-1/2 -translate-x-1/2 rounded-full border-2 border-white bg-slate-950 shadow-sm" style={{ left: marker(currentRatio) }} />
          ) : null}
        </div>
        {disabled && disabledMessage ? <p className="text-[11px] text-slate-500">{disabledMessage}</p> : null}
        <div className="grid gap-2 text-xs text-slate-700">
          <div className="flex items-center justify-between rounded-xl bg-white/70 px-3 py-2">
            <span className="font-semibold text-slate-500">현재</span>
            <span className="font-semibold text-slate-950">{currentLabel}</span>
          </div>
          <div className="flex items-center justify-between rounded-xl bg-white/60 px-3 py-2">
            <span className="font-semibold text-slate-500">{avgTitle}</span>
            <span>{avgLabel}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function StudentTrendMini({ data }: { data: StudentTrendPoint[] }) {
  return (
    <div className="h-36 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 12, right: 10, left: -24, bottom: 0 }}>
          <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="year" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#64748b" }} />
          <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#64748b" }} width={40} />
          <Tooltip contentStyle={{ borderRadius: 16, borderColor: "#e2e8f0" }} formatter={(value: number) => [`${formatNumber(value)}명`, "학생 수"]} />
          <Line type="monotone" dataKey="value" stroke="#0f172a" strokeWidth={2.5} dot={{ r: 3, fill: "#0f172a" }} activeDot={{ r: 5 }}>
            <LabelList dataKey="value" position="top" formatter={(value: number) => formatNumber(value)} style={{ fill: "#64748b", fontSize: 10 }} />
          </Line>
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function SchoolHeader({ schoolName, districtName, casePolicyLabel, caseStatusLabel, statusSummary, noParkWithin500m, nearestParkDistanceM, greenRatio, playgroundCount }: Pick<SchoolDetailReportProps, "schoolName" | "districtName" | "casePolicyLabel" | "caseStatusLabel" | "statusSummary" | "noParkWithin500m" | "nearestParkDistanceM" | "greenRatio" | "playgroundCount">) {
  return (
    <Card className="overflow-hidden">
      <div className="space-y-5 p-7">
        <div className="flex flex-wrap gap-2">
          <span className="case-policy-label rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-bold tracking-[0.08em] text-red-700">{casePolicyLabel}</span>
          <span className="case-status-label rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-500">{caseStatusLabel}</span>
        </div>
        <div>
          <h1 className="text-4xl font-black tracking-tight text-slate-950 lg:text-5xl">{schoolName}</h1>
          <p className="mt-2 text-base font-semibold text-slate-600">{districtName}</p>
          {statusSummary ? <p className="mt-4 max-w-3xl text-base leading-7 font-medium text-slate-700">{statusSummary}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <DarkChip>🌳 최근접 공원 {formatNumber(nearestParkDistanceM)}m</DarkChip>
          <DarkChip>🌿 녹지 {formatWholePercent(greenRatio)}</DarkChip>
          <DarkChip>🛝 놀이터 {formatNumber(playgroundCount)}개</DarkChip>
          {noParkWithin500m ? <DarkChip>🔴 500m 내 공원 없음</DarkChip> : null}
        </div>
      </div>
    </Card>
  );
}

function SchoolProfileGrid(props: Pick<SchoolDetailReportProps, "nearestParkDistanceM" | "nearestParkDistanceCityAvg" | "nearestParkDistanceDistrictAvg" | "nearestParkDistanceCityPercentile" | "nearestParkDistanceDistrictPercentile" | "greenRatio" | "greenRatioCityAvg" | "greenRatioDistrictAvg" | "greenRatioCityPercentile" | "greenRatioDistrictPercentile" | "greenRatioCityPercentile_lt" | "greenRatioDistrictPercentile_lt" | "greenRatioCityZeroShare" | "greenRatioDistrictZeroShare" | "greenRatioCityNonZeroPercentile" | "greenRatioDistrictNonZeroPercentile" | "greenRatioCityNonZeroAvg" | "greenRatioDistrictNonZeroAvg" | "playgroundCount" | "playgroundCountCityAvg" | "playgroundCountDistrictAvg" | "playgroundCountCityPercentile" | "playgroundCountDistrictPercentile" | "playgroundCountCityPercentile_lt" | "playgroundCountDistrictPercentile_lt" | "playgroundCountCityZeroShare" | "playgroundCountDistrictZeroShare" | "playgroundCountCityNonZeroPercentile" | "playgroundCountDistrictNonZeroPercentile" | "playgroundCountCityNonZeroAvg" | "playgroundCountDistrictNonZeroAvg" | "studentTrend" | "studentTrendChangePct" | "studentTrendCityAvg" | "studentTrendDistrictAvg" | "currentStudentCount2025" | "currentStudentCountCityPercentile" | "currentStudentCountDistrictPercentile" | "nearestParkName" | "straightLinePlaygroundCount" | "noParkWithin500m" | "accessibilityRatio" | "parkShortageVsAvg">) {
  const [comparisonBasis, setComparisonBasis] = React.useState<"city" | "district">("city");
  const parkPercentile = comparisonBasis === "city" ? props.nearestParkDistanceCityPercentile : props.nearestParkDistanceDistrictPercentile;
  const basisLabel = comparisonBasis === "city" ? "인천시 기준" : "구 기준";
  const parkAvg = comparisonBasis === "city" ? props.nearestParkDistanceCityAvg : props.nearestParkDistanceDistrictAvg;
  const parkTone = parkPercentile != null
    ? parkToneFromPercentile(parkPercentile)
    : parkToneFromDistance(props.nearestParkDistanceM, parkAvg);
  const greenZeroShare = comparisonBasis === "city" ? props.greenRatioCityZeroShare : props.greenRatioDistrictZeroShare;
  const greenNonZeroPercentile = comparisonBasis === "city" ? props.greenRatioCityNonZeroPercentile : props.greenRatioDistrictNonZeroPercentile;
  const greenNonZeroAvg = comparisonBasis === "city" ? props.greenRatioCityNonZeroAvg : props.greenRatioDistrictNonZeroAvg;
  const playgroundZeroShare = comparisonBasis === "city" ? props.playgroundCountCityZeroShare : props.playgroundCountDistrictZeroShare;
  const playgroundNonZeroPercentile = comparisonBasis === "city" ? props.playgroundCountCityNonZeroPercentile : props.playgroundCountDistrictNonZeroPercentile;
  const playgroundNonZeroAvg = comparisonBasis === "city" ? props.playgroundCountCityNonZeroAvg : props.playgroundCountDistrictNonZeroAvg;
  const greenAvg = comparisonBasis === "city" ? props.greenRatioCityAvg : props.greenRatioDistrictAvg;
  const playgroundAvg = comparisonBasis === "city" ? props.playgroundCountCityAvg : props.playgroundCountDistrictAvg;
  const first = props.studentTrend[0]?.value ?? 0;
  const last = props.studentTrend[props.studentTrend.length - 1]?.value ?? 0;
  const changePercent = props.studentTrendChangePct ?? (first ? ((last - first) / first) * 100 : 0);
  const trendTone = trendToneFromChange(changePercent);
  const currentStudentCount = props.currentStudentCount2025 ?? last;
  const studentDemandTone = getStudentDemandTone(currentStudentCount, comparisonBasis === "city" ? props.currentStudentCountCityPercentile : props.currentStudentCountDistrictPercentile);
  const parkScaleMax = Math.max(1200, props.nearestParkDistanceM, parkAvg, props.nearestParkDistanceDistrictAvg, props.nearestParkDistanceCityAvg);
  const greenScaleMax = Math.max(12, props.greenRatio, greenAvg, greenNonZeroAvg ?? 0);
  const playgroundScaleMax = Math.max(3, props.playgroundCount + 1, playgroundAvg * 3, (playgroundNonZeroAvg ?? 0) * 3);
  const scaleToRatio = (value: number, max: number, higherIsBetter: boolean) => {
    if (max <= 0) return higherIsBetter ? 100 : 0;
    const normalized = clampPercent((value / max) * 100);
    return higherIsBetter ? normalized : 100 - normalized;
  };
  const greenDisplayModel = buildZeroInflatedDisplayModel({
    value: props.greenRatio,
    zeroShare: greenZeroShare,
    nonZeroPercentile: greenNonZeroPercentile,
    nonZeroAvg: greenNonZeroAvg,
    basisLabel,
    zeroMessage: "보행권 안에 체감 가능한 녹지 공간이 거의 없습니다.",
    nonZeroMessage: "현재 수준",
    directionLabel: "녹지 많을수록 유리",
    scaleMax: greenScaleMax,
  });
  const playgroundDisplayModel = buildZeroInflatedDisplayModel({
    value: props.playgroundCount,
    zeroShare: playgroundZeroShare,
    nonZeroPercentile: playgroundNonZeroPercentile,
    nonZeroAvg: playgroundNonZeroAvg,
    basisLabel,
    zeroMessage: "생활권 안에서 바로 이용할 수 있는 놀이터가 부족합니다.",
    nonZeroMessage: "현재 수준",
    directionLabel: "놀이터 많을수록 유리",
    scaleMax: playgroundScaleMax,
  });
  const displayedGreenPercentile = greenDisplayModel.nonZeroPercentile;
  const displayedPlaygroundPercentile = playgroundDisplayModel.nonZeroPercentile;
  const greenTone = displayedGreenPercentile != null
    ? greenToneFromPercentile(displayedGreenPercentile)
    : greenToneFromValue(props.greenRatio, greenAvg);
  const playgroundTone = displayedPlaygroundPercentile != null
    ? playgroundToneFromPercentile(displayedPlaygroundPercentile)
    : playgroundToneFromValue(props.playgroundCount, playgroundAvg);

  return (
    <SectionShell kicker="Profile" title="핵심 취약성·현황">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setComparisonBasis("city")}
          className={cx(
            "rounded-full px-4 py-2 text-sm font-semibold transition",
            comparisonBasis === "city"
              ? "bg-slate-950 text-white"
              : "border border-slate-200 bg-white text-slate-600",
          )}
        >
          인천시 기준
        </button>
        <button
          type="button"
          onClick={() => setComparisonBasis("district")}
          className={cx(
            "rounded-full px-4 py-2 text-sm font-semibold transition",
            comparisonBasis === "district"
              ? "bg-slate-950 text-white"
              : "border border-slate-200 bg-white text-slate-600",
          )}
        >
          구 기준
        </button>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <MetricCard
          title="최근접 공원 거리"
          icon="🌳"
          value={formatNumber(props.nearestParkDistanceM)}
          unit="m"
          tone={parkTone}
          headline={getParkHeadline(props.nearestParkDistanceM)}
          emphasisLine={getParkDetail(props.nearestParkDistanceM)}
          comparisonLines={[
            `${basisLabel.replace(" 기준", "")}에서도 공원 접근성은 ${getRelativeLevelText(parkTone, "park")}`,
          ]}
          comparisonVisual={
            <ComparisonBar
              label={`${basisLabel} 해석`}
              percentile={parkPercentile}
              percentileLabel="공원 거리가 먼 편 상위"
              currentRatio={scaleToRatio(props.nearestParkDistanceM, parkScaleMax, false)}
              avgRatio={scaleToRatio(parkAvg, parkScaleMax, false)}
              currentLabel={`${formatNumber(props.nearestParkDistanceM)}m`}
              avgLabel={`${formatNumber(parkAvg)}m`}
              avgTitle={comparisonBasis === "city" ? "인천시 평균" : "구 평균"}
              directionLabel="거리 짧을수록 유리"
            />
          }
          footer={
            props.nearestParkName || props.nearestParkAccessNote ? (
              <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                {props.nearestParkName ? <div>가장 가까운 공원: {props.nearestParkName}</div> : null}
                {props.nearestParkAccessNote ? (
                  <div className={cx("leading-6", props.nearestParkName ? "mt-2 border-t border-slate-200 pt-2" : "")}>
                    {props.nearestParkAccessNote}
                  </div>
                ) : null}
              </div>
            ) : null
          }
        />
        <MetricCard
          title="녹지 비율"
          icon="🌿"
          value={formatWholeNumber(props.greenRatio)}
          unit="%"
          tone={greenTone}
          headline={getGreenHeadline(greenTone, props.greenRatio)}
          emphasisLine={getGreenDetail(greenTone, props.greenRatio)}
          comparisonLines={[
            `${basisLabel.replace(" 기준", "")}에서도 녹지 환경은 ${getRelativeLevelText(greenTone, "green")}`,
          ]}
          comparisonVisual={
            <ComparisonBar
              label={`${basisLabel} 해석`}
              percentile={displayedGreenPercentile}
              percentileLabel={greenDisplayModel.percentileLabel}
              currentRatio={greenDisplayModel.currentRatio}
              avgRatio={greenDisplayModel.avgRatio}
              currentLabel={formatWholePercent(props.greenRatio)}
              avgLabel={greenDisplayModel.avgLabel ? `${greenDisplayModel.avgLabel}%` : "-"}
              avgTitle={comparisonBasis === "city" ? "녹지가 있는 학교 평균" : "구 내 녹지가 있는 학교 평균"}
              directionLabel={greenDisplayModel.directionLabel}
              disabled={greenDisplayModel.comparisonDisabled}
              disabledMessage="현재 값 기준으로만 비교선을 표시했습니다."
            />
          }
        />
        <MetricCard
          title="도보권 놀이터"
          icon="🛝"
          value={formatNumber(props.playgroundCount)}
          unit="개"
          tone={playgroundTone}
          headline={getPlaygroundHeadline(playgroundTone, props.playgroundCount)}
          emphasisLine={getPlaygroundDetail(playgroundTone, props.playgroundCount)}
          comparisonLines={[
            `${basisLabel.replace(" 기준", "")}에서도 놀이터 접근성은 ${getRelativeLevelText(playgroundTone, "playground")}`,
          ]}
          comparisonVisual={
            <ComparisonBar
              label={`${basisLabel} 해석`}
              percentile={displayedPlaygroundPercentile}
              percentileLabel={playgroundDisplayModel.percentileLabel}
              currentRatio={playgroundDisplayModel.currentRatio}
              avgRatio={playgroundDisplayModel.avgRatio}
              currentLabel={`${formatNumber(props.playgroundCount)}개`}
              avgLabel={playgroundDisplayModel.avgLabel ? `${playgroundDisplayModel.avgLabel}개` : "-"}
              avgTitle={comparisonBasis === "city" ? "놀이터가 있는 학교 평균" : "구 내 놀이터가 있는 학교 평균"}
              directionLabel={playgroundDisplayModel.directionLabel}
              disabled={playgroundDisplayModel.comparisonDisabled}
              disabledMessage="현재 값 기준으로만 비교선을 표시했습니다."
            />
          }
          footer={props.straightLinePlaygroundCount != null ? <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">500m 직선거리 반경 안에는 놀이터가 {formatNumber(props.straightLinePlaygroundCount)}개 있지만, 실제 도보 이동 500m 이내 놀이터는 {formatNumber(props.playgroundCount)}개입니다.</div> : null}
        />
        <MetricCard
          title="학생 수 추세"
          icon="📉"
          value={formatSignedPercent(changePercent)}
          unit="6년 변화"
          tone={trendTone}
          headline={getStudentHeadline(studentDemandTone)}
          emphasisLine={getStudentDetail(studentDemandTone)}
          comparisonLines={[
            `현재 학생 규모는 ${formatNumber(currentStudentCount)}명으로, ${basisLabel.replace(" 기준", "")}에서는 ${getRelativeLevelText(studentDemandTone, "demand")}`,
            changePercent > props.studentTrendDistrictAvg
              ? "최근 학생 수 흐름은 평균보다 조금 더 유지되는 편입니다."
              : "최근 학생 수 흐름은 평균보다 조금 더 감소하는 편입니다.",
          ]}
          footer={<StudentTrendMini data={props.studentTrend} />}
        />
      </div>
      <Card className="p-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-sm font-medium text-slate-500">500m 내 공원</p><p className="mt-2 text-2xl font-bold text-slate-950">{props.noParkWithin500m ? "없음" : "있음"}</p></div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-sm font-medium text-slate-500">접근성 비율</p><p className="mt-2 text-2xl font-bold text-slate-950">{props.accessibilityRatio != null ? `${formatDecimal(props.accessibilityRatio, 1)}%` : "-"}</p></div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-sm font-medium text-slate-500">평균 대비 공원 부족</p><p className="mt-2 text-2xl font-bold text-slate-950">{props.parkShortageVsAvg != null ? `${formatDecimal(props.parkShortageVsAvg, 1)}개` : "-"}</p></div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-sm font-medium text-slate-500">직선 반경 놀이터</p><p className="mt-2 text-2xl font-bold text-slate-950">{props.straightLinePlaygroundCount != null ? `${formatNumber(props.straightLinePlaygroundCount)}개` : "-"}</p></div>
        </div>
      </Card>
    </SectionShell>
  );
}

function ProblemSection({
  problemTags,
  studentTrend,
  studentTrendChangePct,
  noParkWithin500m,
  nearestParkDistanceM,
  greenRatio,
  playgroundCount,
  potentialDemand2029,
}: Pick<
  SchoolDetailReportProps,
  "problemTags" | "studentTrend" | "studentTrendChangePct" | "noParkWithin500m" | "nearestParkDistanceM" | "greenRatio" | "playgroundCount" | "potentialDemand2029"
>) {
  const first = studentTrend[0]?.value ?? 0;
  const last = studentTrend[studentTrend.length - 1]?.value ?? 0;
  const changePercent = studentTrendChangePct ?? (first ? ((last - first) / first) * 100 : 0);
  const hasNoWalkablePark = noParkWithin500m ?? nearestParkDistanceM >= 500;
  const lowGreen = greenRatio <= 0;
  const noPlayground = playgroundCount <= 0;
  const highDemand = potentialDemand2029 >= 400;
  const mediumDemand = potentialDemand2029 >= 220;

  let decisionText = "";
  if (hasNoWalkablePark && lowGreen && noPlayground) {
    decisionText =
      highDemand
        ? "공원 접근성과 녹지 환경이 모두 불리한 학교입니다. 가까운 공원이 부족하고, 학교 주변에서 체감할 수 있는 녹지 공간과 놀이터도 적어 개선 시 수혜 효과가 크게 나타날 가능성이 있습니다."
        : "공원 접근성과 녹지 환경이 모두 불리한 학교입니다. 가까운 공원이 부족하고, 학교 주변에서 체감할 수 있는 녹지 공간과 놀이터도 적습니다.";
  } else if (hasNoWalkablePark && lowGreen) {
    decisionText =
      highDemand
        ? "시설 접근성은 불리하지만, 주변 학생 수요는 큰 학교입니다. 가까운 공원과 체감 가능한 녹지 공간이 부족해 개선 필요성이 높은 편입니다."
        : "가까운 공원 접근성은 불리하고, 녹지 환경도 매우 약한 학교입니다. 생활권 안에서 바로 이용할 수 있는 야외공간 보완이 필요합니다.";
  } else if (hasNoWalkablePark) {
    decisionText =
      mediumDemand
        ? "녹지 환경은 일부 갖추고 있으나, 가까운 공원 접근성은 다소 불리한 학교입니다. 바로 이용 가능한 공원이 부족해 접근성 개선의 우선순위가 있습니다."
        : "공원 접근성은 다소 불리한 학교입니다. 머무를 수 있는 환경은 일부 있지만 바로 이용 가능한 공원은 부족한 편입니다.";
  } else if (lowGreen || noPlayground) {
    decisionText =
      highDemand
        ? "가까운 시설은 있지만, 주변 녹지나 놀이환경은 부족한 학교입니다. 접근성 자체는 나쁘지 않지만 체류형 야외환경의 질은 약한 편입니다."
        : "가까운 시설은 있지만, 주변 녹지나 놀이터 선택지는 넉넉하지 않은 학교입니다. 생활권 환경의 질을 보완할 필요가 있습니다.";
  } else {
    decisionText =
      highDemand
        ? "가까운 시설과 녹지 환경이 모두 비교적 양호한 학교입니다. 공원 접근성과 주변 환경이 전반적으로 안정적이며 수요 규모도 큰 편입니다."
        : "가까운 시설과 녹지 환경이 모두 비교적 양호한 학교입니다. 공원 접근성과 주변 환경이 전반적으로 안정적인 편입니다.";
  }
  return (
    <SectionShell kicker="Decision" title="핵심 판단">
      <Card className="p-5">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Decision Signal</p>
        <p className="mt-2 text-base font-semibold text-slate-950">{decisionText}</p>
      </Card>
    </SectionShell>
  );
}

function ContextSection({
  contextTags,
  hasLargeApartmentComplexNearby,
  noParkWithin500m,
  nearestParkDistanceM,
}: Pick<
  SchoolDetailReportProps,
  "contextTags" | "hasLargeApartmentComplexNearby" | "noParkWithin500m" | "nearestParkDistanceM"
>) {
  return (
    <SectionShell kicker="Context" title="지역 맥락">
      <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <Card className="p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">생활권 해석</p>
          <div className="mt-4 space-y-3">
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-4">
              <p className="text-sm font-semibold text-red-700">
                {noParkWithin500m
                  ? "학교에서 도보 이동으로 바로 접근할 수 있는 공원이 없습니다."
                  : "도보권 공원 접근은 가능하지만 평균 대비 불리한 편입니다."}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-sm font-medium text-slate-800">
                가장 가까운 공원도 약 {formatNumber(nearestParkDistanceM)}m 떨어져 있어, 일상적 이용에 거리 부담이 있습니다.
              </p>
            </div>
            {hasLargeApartmentComplexNearby ? (
              <div className="rounded-2xl border border-yellow-200 bg-yellow-50 px-4 py-4">
                <p className="text-sm font-medium text-yellow-800">
                  근처 500세대 이상 대단지 아파트가 있어, 미집계 녹지·놀이터가 일부 존재할 가능성이 있습니다.
                </p>
              </div>
            ) : null}
          </div>
        </Card>
        <Card className="p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">주변 조건</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {contextTags.map((tag) => (
              <SectionChip key={tag}>
                {tag === "학교 주변에서 바로 대체할 수 있는 공원 선택지가 없습니다"
                  ? "학교 주변에 바로 접근 가능한 녹지나 놀이터가 부족합니다"
                  : tag}
              </SectionChip>
            ))}
            {hasLargeApartmentComplexNearby ? <SectionChip>🏢 500세대 이상 대단지 아파트 인접</SectionChip> : null}
          </div>
        </Card>
      </div>
    </SectionShell>
  );
}

function SimilarSchoolsSection({
  schoolName,
  districtName,
  nearestParkDistanceM,
  greenRatio,
  playgroundCount,
  similarSchools,
  cityBestEnvironmentSchool,
  districtBestEnvironmentSchool,
  similarityK,
  similaritySelectionFeatures,
  similarityComparisonFeatures,
  similarityCommonPoints,
  similarityStrengthsText,
  similarityWeaknessesText,
  similarityPeerAvgNearestParkDistanceM,
  similarityPeerAvgGreenRatio,
  similarityPeerAvgPlaygroundCount,
}: Pick<
  SchoolDetailReportProps,
  | "schoolName"
  | "districtName"
  | "nearestParkDistanceM"
  | "greenRatio"
  | "playgroundCount"
  | "similarSchools"
  | "cityBestEnvironmentSchool"
  | "districtBestEnvironmentSchool"
  | "similarityK"
  | "similaritySelectionFeatures"
  | "similarityComparisonFeatures"
  | "similarityCommonPoints"
  | "similarityStrengthsText"
  | "similarityWeaknessesText"
  | "similarityPeerAvgNearestParkDistanceM"
  | "similarityPeerAvgGreenRatio"
  | "similarityPeerAvgPlaygroundCount"
>) {
  const [hoveredPointId, setHoveredPointId] = React.useState<string | null>(null);
  if (!similarSchools?.length) return null;

  const currentPoint: PositionPoint = { id: "current", label: "현재 학교", schoolName, districtName, nearestParkDistanceM, greenRatio, playgroundCount, pointType: "current" };
  const sharedBenchmark = cityBestEnvironmentSchool && districtBestEnvironmentSchool && cityBestEnvironmentSchool.schoolName === districtBestEnvironmentSchool.schoolName && cityBestEnvironmentSchool.districtName === districtBestEnvironmentSchool.districtName;
  const benchmarkPoints: PositionPoint[] = sharedBenchmark ? [{ id: "shared-best", label: "시·구 공통 기준학교", schoolName: cityBestEnvironmentSchool.schoolName, districtName: cityBestEnvironmentSchool.districtName, nearestParkDistanceM: cityBestEnvironmentSchool.nearestParkDistanceM, greenRatio: cityBestEnvironmentSchool.greenRatio, playgroundCount: cityBestEnvironmentSchool.playgroundCount, pointType: "sharedBest" }] : [ ...(cityBestEnvironmentSchool ? [{ id: "city-best", label: "인천시 최우수", schoolName: cityBestEnvironmentSchool.schoolName, districtName: cityBestEnvironmentSchool.districtName, nearestParkDistanceM: cityBestEnvironmentSchool.nearestParkDistanceM, greenRatio: cityBestEnvironmentSchool.greenRatio, playgroundCount: cityBestEnvironmentSchool.playgroundCount, pointType: "cityBest" as const }] : []), ...(districtBestEnvironmentSchool ? [{ id: "district-best", label: "구 최우수", schoolName: districtBestEnvironmentSchool.schoolName, districtName: districtBestEnvironmentSchool.districtName, nearestParkDistanceM: districtBestEnvironmentSchool.nearestParkDistanceM, greenRatio: districtBestEnvironmentSchool.greenRatio, playgroundCount: districtBestEnvironmentSchool.playgroundCount, pointType: "districtBest" as const }] : []) ];
  const similarPoints: PositionPoint[] = similarSchools.map((school, index) => ({
    id: `similar-${index}`,
    label: school.schoolName,
    schoolName: school.schoolName,
    districtName: school.districtName,
    nearestParkDistanceM: school.nearestParkDistanceM,
    greenRatio: school.greenRatio,
    playgroundCount: school.playgroundCount,
    rankLabel: `K${school.rank ?? index + 1}`,
    pointType: "similar",
  }));
  const plotPoints = [currentPoint, ...similarPoints, ...benchmarkPoints];
  const xDomainMin = 0;
  const xDomainMax = 1200;
  const yDomainMin = 0;
  const yDomainMax = 24;
  const parkThreshold = 500;
  const greenThreshold = 5;
  const xTicks = [0, 300, 600, 900, 1200];
  const yTicks = [0, 5, 10, 15, 20, 24];
  const svgWidth = 760;
  const svgHeight = 420;
  const margin = { top: 26, right: 28, bottom: 54, left: 62 };
  const chartWidth = svgWidth - margin.left - margin.right;
  const chartHeight = svgHeight - margin.top - margin.bottom;
  const scaleX = (value: number) => {
    const safeValue = Math.min(Math.max(value, xDomainMin), xDomainMax);
    return margin.left + ((safeValue - xDomainMin) / (xDomainMax - xDomainMin)) * chartWidth;
  };
  const scaleY = (value: number) => {
    const safeValue = Math.min(Math.max(value, yDomainMin), yDomainMax);
    return margin.top + chartHeight - ((safeValue - yDomainMin) / (yDomainMax - yDomainMin)) * chartHeight;
  };
  const positionedPoints = plotPoints.map((point) => ({ ...point, x: scaleX(point.nearestParkDistanceM), y: scaleY(point.greenRatio) }));
  const hoveredPoint = positionedPoints.find((point) => point.id === hoveredPointId) ?? null;
  const avgSimilarPark =
    similarityPeerAvgNearestParkDistanceM ??
    similarPoints.reduce((sum, point) => sum + point.nearestParkDistanceM, 0) / similarPoints.length;
  const avgSimilarGreen =
    similarityPeerAvgGreenRatio ??
    similarPoints.reduce((sum, point) => sum + point.greenRatio, 0) / similarPoints.length;
  const avgSimilarPlayground =
    similarityPeerAvgPlaygroundCount ??
    similarPoints.reduce((sum, point) => sum + point.playgroundCount, 0) / similarPoints.length;
  const strengthLines = similarityStrengthsText
    ? similarityStrengthsText.split("|").map((item) => item.trim()).filter(Boolean)
    : [];
  const weaknessLines = similarityWeaknessesText
    ? similarityWeaknessesText.split("|").map((item) => item.trim()).filter(Boolean)
    : [];
  const fallbackStrength =
    nearestParkDistanceM < avgSimilarPark
      ? `KNN 비교군 평균보다 최근접 공원 거리가 ${formatWholeNumber(avgSimilarPark - nearestParkDistanceM)}m 더 가깝습니다.`
      : greenRatio > avgSimilarGreen
        ? `KNN 비교군 평균보다 녹지 비율이 ${formatDecimal(greenRatio - avgSimilarGreen, 1)}%p 더 높습니다.`
        : playgroundCount > avgSimilarPlayground
          ? `KNN 비교군 평균보다 도보권 놀이터가 ${formatWholeNumber(playgroundCount - avgSimilarPlayground)}개 더 많습니다.`
          : "KNN 비교군 평균 대비 두드러진 상대 강점은 크지 않습니다.";
  const fallbackWeakness =
    nearestParkDistanceM > avgSimilarPark
      ? `KNN 비교군 평균보다 최근접 공원 거리가 ${formatWholeNumber(nearestParkDistanceM - avgSimilarPark)}m 더 멉니다.`
      : greenRatio < avgSimilarGreen
        ? `KNN 비교군 평균보다 녹지 비율이 ${formatDecimal(avgSimilarGreen - greenRatio, 1)}%p 더 낮습니다.`
        : playgroundCount < avgSimilarPlayground
          ? `KNN 비교군 평균보다 도보권 놀이터가 ${formatWholeNumber(avgSimilarPlayground - playgroundCount)}개 더 적습니다.`
          : "KNN 비교군 평균 대비 두드러진 상대 약점은 크지 않습니다.";
  const comparisonMetricLines = [
    `KNN 비교군 평균 공원 거리 ${formatWholeNumber(avgSimilarPark)}m`,
    `KNN 비교군 평균 녹지 비율 ${formatDecimal(avgSimilarGreen, 1)}%`,
    `KNN 비교군 평균 놀이터 ${formatDecimal(avgSimilarPlayground, 1)}개`,
  ];
  const similarityMethodText =
    "유사학교는 학생 규모와 학생 수 변화 흐름, 주변 아동 규모, 주거 밀도, 재개발 여부 같은 생활권 맥락을 AI가 종합적으로 분석해 도출한 비교군입니다.";

  function renderMarker(point: (typeof positionedPoints)[number]) {
    if (point.pointType === "current") return <g><circle cx={point.x} cy={point.y} r={16} fill="#ef4444" opacity={0.18} /><circle cx={point.x} cy={point.y} r={9} fill="#dc2626" stroke="#ffffff" strokeWidth={3} /></g>;
    if (point.pointType === "cityBest") {
      const s = 11;
      const pts = [[point.x, point.y - s], [point.x + 3.5, point.y - 3.5], [point.x + s, point.y - 3.5], [point.x + 5, point.y + 1.5], [point.x + 7, point.y + s], [point.x, point.y + 5], [point.x - 7, point.y + s], [point.x - 5, point.y + 1.5], [point.x - s, point.y - 3.5], [point.x - 3.5, point.y - 3.5]].map(([x, y]) => `${x},${y}`).join(" ");
      return <polygon points={pts} fill="#eab308" stroke="#ffffff" strokeWidth={2.5} />;
    }
    if (point.pointType === "districtBest") return <path d={`M ${point.x} ${point.y - 10} L ${point.x + 10} ${point.y} L ${point.x} ${point.y + 10} L ${point.x - 10} ${point.y} Z`} fill="#0ea5e9" stroke="#ffffff" strokeWidth={2.5} />;
    if (point.pointType === "sharedBest") return <g><circle cx={point.x} cy={point.y} r={12} fill="#111827" stroke="#ffffff" strokeWidth={2.5} /><text x={point.x} y={point.y + 4} textAnchor="middle" fontSize={10} fontWeight={700} fill="#f8fafc">시·구</text></g>;
    return (
      <g>
        <circle cx={point.x} cy={point.y} r={11} fill="#475569" stroke="#ffffff" strokeWidth={2.5} />
        <text x={point.x} y={point.y + 4} textAnchor="middle" fontSize={9} fontWeight={800} fill="#f8fafc">
          {point.rankLabel ?? "K"}
        </text>
      </g>
    );
  }

  const clippedCount = plotPoints.filter((point) => point.nearestParkDistanceM > xDomainMax).length;

  return (
    <SectionShell kicker="Benchmark" title="KNN 비교군 및 기준학교 포지션">
      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="p-6">
          <p className="text-sm text-slate-600">
            현재 학교와 환경 맥락이 비슷한 학교를 KNN으로 묶고, 그 안에서 공원 거리와 녹지 비율이 어디에 놓이는지 비교했습니다.
            {similarityK ? ` 이번 비교는 K=${similarityK} 기준입니다.` : ""}
          </p>
          <div className="mt-4 flex flex-wrap gap-2"><SectionChip>현재 학교</SectionChip><SectionChip>KNN 비교군</SectionChip><SectionChip>인천시 최우수</SectionChip><SectionChip>구 최우수</SectionChip></div>
          <p className="mt-4 text-xs leading-6 text-slate-500">{similarityMethodText}</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2"><div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">좋은 방향은 왼쪽 위입니다. 공원 거리는 500m 안쪽일수록, 녹지 비율은 5% 이상일수록 유리합니다.</div><div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">배경 사분면은 인천시 평균이 아니라 생활권 판단선 기준으로 나뉩니다.</div></div>
          {clippedCount > 0 ? <p className="mt-3 text-xs text-slate-500">가독성을 위해 최근접 공원 거리 축은 1,200m까지 표시했고, 이를 넘는 점 {clippedCount}개는 우측 경계에 맞춰 표시했습니다.</p> : null}
          <div className="mt-5"><div className="relative overflow-visible rounded-2xl border border-slate-200 bg-white"><svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="h-[420px] w-full"><rect x="0" y="0" width={svgWidth} height={svgHeight} fill="#ffffff" /><rect x={margin.left} y={margin.top} width={scaleX(parkThreshold) - margin.left} height={scaleY(greenThreshold) - margin.top} fill="#ecfdf5" /><rect x={scaleX(parkThreshold)} y={margin.top} width={scaleX(xDomainMax) - scaleX(parkThreshold)} height={scaleY(greenThreshold) - margin.top} fill="#fff7ed" /><rect x={margin.left} y={scaleY(greenThreshold)} width={scaleX(parkThreshold) - margin.left} height={margin.top + chartHeight - scaleY(greenThreshold)} fill="#fefce8" /><rect x={scaleX(parkThreshold)} y={scaleY(greenThreshold)} width={scaleX(xDomainMax) - scaleX(parkThreshold)} height={margin.top + chartHeight - scaleY(greenThreshold)} fill="#fef2f2" />{xTicks.map((tick) => <g key={`x-${tick}`}><line x1={scaleX(tick)} x2={scaleX(tick)} y1={margin.top} y2={margin.top + chartHeight} stroke="#e2e8f0" strokeDasharray="3 3" /><text x={scaleX(tick)} y={svgHeight - 18} textAnchor="middle" fontSize="11" fill="#64748b">{tick}</text></g>)}{yTicks.map((tick) => <g key={`y-${tick}`}><line x1={margin.left} x2={margin.left + chartWidth} y1={scaleY(tick)} y2={scaleY(tick)} stroke="#e2e8f0" strokeDasharray="3 3" /><text x={margin.left - 12} y={scaleY(tick) + 4} textAnchor="end" fontSize="11" fill="#64748b">{tick}</text></g>)}<line x1={scaleX(parkThreshold)} x2={scaleX(parkThreshold)} y1={margin.top} y2={margin.top + chartHeight} stroke="#94a3b8" strokeDasharray="6 5" /><line x1={margin.left} x2={margin.left + chartWidth} y1={scaleY(greenThreshold)} y2={scaleY(greenThreshold)} stroke="#94a3b8" strokeDasharray="6 5" /><text x={scaleX(parkThreshold) + 8} y={margin.top + chartHeight + 22} fontSize="11" fontWeight="700" fill="#64748b">500m 판단선</text><text x={margin.left + 8} y={scaleY(greenThreshold) - 10} fontSize="11" fontWeight="700" fill="#64748b">녹지 5% 판단선</text><text x={margin.left + 10} y={margin.top + 18} fontSize="12" fontWeight="700" fill="#047857">생활환경 양호</text><text x={margin.left + chartWidth - 110} y={margin.top + 18} fontSize="12" fontWeight="700" fill="#c2410c">공원 접근 불리</text><text x={margin.left + 10} y={margin.top + chartHeight - 12} fontSize="12" fontWeight="700" fill="#a16207">녹지 부족</text><text x={margin.left + chartWidth - 76} y={margin.top + chartHeight - 12} fontSize="12" fontWeight="700" fill="#b91c1c">이중 취약</text><text x={margin.left + chartWidth / 2} y={svgHeight - 2} textAnchor="middle" fontSize="12" fill="#475569">최근접 공원 거리 (m)</text><text transform={`translate(18 ${margin.top + chartHeight / 2}) rotate(-90)`} textAnchor="middle" fontSize="12" fill="#475569">녹지 비율 (%)</text>{positionedPoints.map((point) => <g key={point.id} onMouseEnter={() => setHoveredPointId(point.id)} onMouseLeave={() => setHoveredPointId((current) => current === point.id ? null : current)} style={{ cursor: "pointer" }}>{renderMarker(point)}{point.pointType !== "similar" && point.pointType !== "current" ? <g transform={`translate(${point.x + 12},${point.y - 26})`}><rect width={Math.max(92, point.label.length * 8)} height="24" rx="12" fill="#ffffff" stroke="#cbd5e1" /><text x="12" y="16" fontSize="11" fontWeight={700} fill="#0f172a">{point.label}</text></g> : null}</g>)}</svg>{hoveredPoint ? <div className="pointer-events-none absolute z-20 w-56 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl" style={{ left: `${Math.min(Math.max((hoveredPoint.x / svgWidth) * 100, 8), 92)}%`, top: `${Math.min(Math.max((hoveredPoint.y / svgHeight) * 100 - 14, 6), 88)}%`, transform: "translate(-50%, -100%)" }}><p className="text-sm font-bold text-slate-950">{hoveredPoint.pointType === "current" ? "현재 학교" : hoveredPoint.schoolName}</p><p className="text-xs text-slate-500">{hoveredPoint.pointType === "current" ? `${hoveredPoint.schoolName} · ${hoveredPoint.districtName}` : hoveredPoint.districtName}</p><div className="mt-2 space-y-1 text-xs text-slate-700"><p>최근접 공원 거리 {formatNumber(hoveredPoint.nearestParkDistanceM)}m</p><p>녹지 비율 {formatWholePercent(hoveredPoint.greenRatio)}</p><p>놀이터 수 {formatNumber(hoveredPoint.playgroundCount)}개</p></div></div> : null}</div></div>
        </Card>
        <div className="grid gap-4">
          <Card className="p-5">
            <p className="text-sm font-medium text-slate-500">기준학교 정보</p>
            <div className="mt-4 space-y-3">
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
                <p className="text-sm font-semibold text-slate-900">현재 학교</p>
                <p className="mt-1 text-xs text-slate-600">{schoolName} · 공원 {formatNumber(nearestParkDistanceM)}m · 녹지 {formatDecimal(greenRatio, 1)}% · 놀이터 {formatNumber(playgroundCount)}개</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">KNN 비교군 평균</p>
                <p className="mt-1 text-xs text-slate-600">
                  공원 {formatWholeNumber(avgSimilarPark)}m · 녹지 {formatDecimal(avgSimilarGreen, 1)}% · 놀이터 {formatDecimal(avgSimilarPlayground, 1)}개
                </p>
              </div>
              {benchmarkPoints.map((point) => <div key={point.id} className={cx("rounded-2xl border p-4", point.pointType === "cityBest" ? "border-yellow-200 bg-yellow-50" : point.pointType === "districtBest" ? "border-sky-200 bg-sky-50" : "border-slate-200 bg-slate-50")}><p className="text-sm font-semibold text-slate-900">{point.label}</p><p className="mt-1 text-xs text-slate-600">{point.schoolName} · 공원 {formatNumber(point.nearestParkDistanceM)}m · 녹지 {formatDecimal(point.greenRatio, 1)}% · 놀이터 {formatNumber(point.playgroundCount)}개</p></div>)}
            </div>
          </Card>
          <Card className="p-5">
            <p className="text-sm font-medium text-slate-500">KNN 비교군 해석</p>
            <div className="mt-4 space-y-3">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">상대 우위</p>
                <div className="mt-2 space-y-2 text-sm text-emerald-900">
                  {(strengthLines.length ? strengthLines : [fallbackStrength]).map((line) => <p key={line}>{line}</p>)}
                </div>
              </div>
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-700">상대 열위</p>
                <div className="mt-2 space-y-2 text-sm text-rose-900">
                  {(weaknessLines.length ? weaknessLines : [fallbackWeakness]).map((line) => <p key={line}>{line}</p>)}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">비교 기준값</p>
                <div className="mt-2 space-y-1 text-sm text-slate-700">
                  {comparisonMetricLines.map((line) => <p key={line}>{line}</p>)}
                </div>
              </div>
            </div>
          </Card>
          <Card className="p-5">
            <p className="text-sm font-medium text-slate-500">KNN 비교군 목록</p>
            <div className="mt-4 space-y-3">
              {similarSchools.map((school, index) => (
                <div key={`${school.schoolName}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{`K${school.rank ?? index + 1}`} · {school.schoolName}</p>
                      <p className="text-xs text-slate-500">{school.districtName}</p>
                    </div>
                    {school.similarityDistance != null ? (
                      <span className="rounded-full bg-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                        거리 {formatDecimal(school.similarityDistance, 2)}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-xs text-slate-600">
                    공원 {formatWholeNumber(school.nearestParkDistanceM)}m · 녹지 {formatDecimal(school.greenRatio, 1)}% · 놀이터 {formatNumber(school.playgroundCount)}개
                  </p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </SectionShell>
  );
}

function RedevelopmentNotice({ redevelopmentPlanYear, redevelopmentType, redevelopmentProjects }: Pick<SchoolDetailReportProps, "redevelopmentPlanYear" | "redevelopmentType" | "redevelopmentProjects">) {
  if (!redevelopmentPlanYear || !redevelopmentType) return null;
  return (
    <section>
      <Card className="p-5">
        <div className="space-y-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-500">Change Risk</p>
            <p className="mt-2 text-base font-semibold text-slate-950">
              이 지역은 {redevelopmentPlanYear}년에 {redevelopmentType}이 예정되어 있어, 향후 생활환경과 아동 인구 흐름이 변동할 수 있습니다.
            </p>
          </div>
          {redevelopmentProjects?.length ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {redevelopmentProjects.map((project) => (
                <div
                  key={`${project.name}-${project.distanceM}`}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <p className="text-sm font-semibold text-slate-950">{project.name}</p>
                  <p className="mt-1 text-xs text-slate-500">{formatNumber(project.distanceM)}m</p>
                  <p className="mt-2 inline-flex rounded-full bg-yellow-100 px-2.5 py-1 text-xs font-semibold text-yellow-800">
                    {project.stage}
                  </p>
                  <p className="mt-2 text-xs text-slate-600">{project.location}</p>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </Card>
    </section>
  );
}

function SimulationEntry({
  onSimulationClick,
  potentialDemand2029,
  potentialDemand2031,
}: Pick<SchoolDetailReportProps, "onSimulationClick" | "potentialDemand2029" | "potentialDemand2031">) {
  return (
    <SectionShell kicker="Action" title="다음 액션">
      <Card className="p-6">
        <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <p className="text-lg font-semibold text-slate-950">학교 기준 예상 학생수</p>
            <p className="mt-1 text-sm text-slate-500">학교 학생수 예측 모델을 바탕으로 산출한 예상 학생 규모입니다. 학교 내부 설치 검토 시 참고값으로 활용할 수 있습니다.</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">2029년 예상 학생수</p>
                <p className="mt-2 text-3xl font-bold text-slate-950">{formatNumber(potentialDemand2029)}명</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">2031년 예상 학생수</p>
                <p className="mt-2 text-3xl font-bold text-slate-950">{formatNumber(potentialDemand2031)}명</p>
              </div>
            </div>
          </div>
          {onSimulationClick ? (
            <div className="flex justify-start lg:justify-end">
              <Button onClick={onSimulationClick}>후보지 시뮬레이션 열기</Button>
            </div>
          ) : null}
        </div>
      </Card>
    </SectionShell>
  );
}

export default function SchoolDetailReportPage(props: SchoolDetailReportProps) {
  return <div className="mx-auto flex max-w-[1280px] flex-col gap-8 px-4 py-8 lg:px-8"><SchoolHeader {...props} /><SchoolProfileGrid {...props} /><ProblemSection {...props} /><ContextSection {...props} /><SimilarSchoolsSection {...props} /><RedevelopmentNotice {...props} /><SimulationEntry {...props} /></div>;
}
