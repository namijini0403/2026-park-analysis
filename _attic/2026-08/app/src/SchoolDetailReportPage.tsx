"use client";

import * as React from "react";
import {
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CITY_SHORT_NAME } from "./config/regionConfig";

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
};

type BenchmarkSchoolItem = {
  schoolName: string;
  districtName: string;
  nearestParkDistanceM: number;
  greenRatio: number;
  playgroundCount: number;
};

type RedevelopmentProject = {
  name: string;
  distanceM: number;
  stage: string;
  location: string;
};

export type SchoolDetailReportProps = {
  schoolName: string;
  districtName: string;
  caseLabel: string;
  accessStatusLabel?: string;
  statusSummary?: string;
  nearestParkDistanceM: number;
  nearestParkName?: string;
  nearestParkDistanceCityAvg: number;
  nearestParkDistanceDistrictAvg: number;
  greenRatio: number;
  greenRatioCityAvg: number;
  greenRatioDistrictAvg: number;
  playgroundCount: number;
  straightLinePlaygroundCount?: number | null;
  playgroundCountCityAvg: number;
  playgroundCountDistrictAvg: number;
  noParkWithin500m?: boolean;
  accessibilityRatio?: number;
  parkShortageVsAvg?: number;
  studentTrend: StudentTrendPoint[];
  studentTrendCityAvg: number;
  studentTrendDistrictAvg: number;
  potentialDemand2029: number;
  potentialDemand2031: number;
  problemTags: string[];
  contextTags: string[];
  redevelopmentPlanYear?: string;
  redevelopmentType?: string;
  hasLargeApartmentComplexNearby?: boolean;
  similarSchools?: SimilarSchoolItem[];
  cityBestEnvironmentSchool?: BenchmarkSchoolItem;
  districtBestEnvironmentSchool?: BenchmarkSchoolItem;
  redevelopmentProjects?: RedevelopmentProject[];
  onSimulationClick?: () => void;
};

type MetricCardProps = {
  title: string;
  value: string;
  description: string;
  alertTitle: string;
  alertDetail: string;
  cityLabel: string;
  cityValue: number;
  districtLabel: string;
  districtValue: number;
  currentValue: number;
  tone: StatusTone;
  higherIsBetter?: boolean;
  footer?: React.ReactNode;
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

function formatSignedPercent(value: number) {
  return `${value > 0 ? "+" : ""}${formatDecimal(value, 1)}%`;
}

function safePercentDelta(base: number, current: number) {
  if (!Number.isFinite(base) || base === 0) return 0;
  return ((current - base) / base) * 100;
}

function getToneMeta(tone: StatusTone) {
  switch (tone) {
    case "danger":
      return {
        badge: "위험",
        text: "text-red-700",
        ring: "ring-red-200",
        soft: "bg-red-50",
        bar: "bg-red-500",
      };
    case "warning":
      return {
        badge: "경고",
        text: "text-orange-700",
        ring: "ring-orange-200",
        soft: "bg-orange-50",
        bar: "bg-orange-500",
      };
    case "caution":
      return {
        badge: "주의",
        text: "text-yellow-700",
        ring: "ring-yellow-200",
        soft: "bg-yellow-50",
        bar: "bg-yellow-500",
      };
    case "positive":
    default:
      return {
        badge: "양호",
        text: "text-green-700",
        ring: "ring-green-200",
        soft: "bg-green-50",
        bar: "bg-green-500",
      };
  }
}

function scoreToneFromComparisons(args: {
  current: number;
  cityAvg: number;
  districtAvg: number;
  higherIsBetter?: boolean;
}) {
  const { current, cityAvg, districtAvg, higherIsBetter = true } = args;
  const cityGap = safePercentDelta(cityAvg, current);
  const districtGap = safePercentDelta(districtAvg, current);
  const avgGap = (cityGap + districtGap) / 2;
  const adjustedGap = higherIsBetter ? avgGap : -avgGap;

  if (adjustedGap <= -25) return "danger";
  if (adjustedGap <= -12) return "warning";
  if (adjustedGap <= -4) return "caution";
  return "positive";
}

function getRelativeLabel(deltaPercent: number, higherIsBetter = true) {
  const adjustedDelta = higherIsBetter ? deltaPercent : -deltaPercent;
  if (adjustedDelta <= -25) return "큰 격차";
  if (adjustedDelta <= -12) return "낮은 편";
  if (adjustedDelta <= -4) return "다소 불리";
  if (adjustedDelta < 4) return "유사";
  if (adjustedDelta < 12) return "다소 우위";
  return "우위";
}

function getLineToneFromDemand(demand2031: number): StatusTone {
  if (demand2031 >= 250) return "danger";
  if (demand2031 >= 160) return "warning";
  if (demand2031 >= 80) return "caution";
  return "positive";
}

function getToneRank(tone: StatusTone) {
  switch (tone) {
    case "danger":
      return 4;
    case "warning":
      return 3;
    case "caution":
      return 2;
    case "positive":
    default:
      return 1;
  }
}

function getMaxTone(tones: StatusTone[]): StatusTone {
  return tones.reduce<StatusTone>((highest, current) => {
    return getToneRank(current) > getToneRank(highest) ? current : highest;
  }, "positive");
}

function buildRedevelopmentNotice(year?: string, projectType?: string) {
  if (!year || !projectType) return null;
  return `이 지역은 ${year}년 ${projectType}이 예정되어 있어, 향후 생활환경과 아동 인구 흐름이 변동할 수 있습니다.`;
}

function formatGap(value: number, unit: string, digits = 1) {
  return `${formatDecimal(Math.abs(value), digits)}${unit}`;
}

function getTrendChangePercent(studentTrend: StudentTrendPoint[]) {
  const first = studentTrend[0]?.value ?? 0;
  const last = studentTrend[studentTrend.length - 1]?.value ?? 0;
  if (!first) return 0;
  return ((last - first) / first) * 100;
}

function getSimilarityPercent(distance: number) {
  return Math.max(1, Math.min(99, Math.round(100 / (1 + distance))));
}

function Card(props: React.HTMLAttributes<HTMLDivElement>) {
  const { className, ...rest } = props;
  return (
    <div
      className={cx(
        "rounded-2xl border border-slate-200 bg-white shadow-sm",
        className,
      )}
      {...rest}
    />
  );
}

function Badge({
  tone,
  children,
  className,
}: {
  tone: StatusTone;
  children: React.ReactNode;
  className?: string;
}) {
  const meta = getToneMeta(tone);

  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset",
        meta.soft,
        meta.text,
        meta.ring,
        className,
      )}
    >
      {children}
    </span>
  );
}

function StatPill({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: string;
  tone?: "slate" | "yellow" | "red";
}) {
  const toneClass =
    tone === "yellow"
      ? "border-yellow-200 bg-yellow-50 text-yellow-800"
      : tone === "red"
        ? "border-red-200 bg-red-50 text-red-800"
        : "border-slate-200 bg-slate-50 text-slate-700";

  return (
    <div className={cx("rounded-2xl border px-3 py-2", toneClass)}>
      <p className="text-[11px] font-medium uppercase tracking-[0.16em] opacity-70">{label}</p>
      <p className="mt-1 text-base font-bold">{value}</p>
    </div>
  );
}

function ThresholdBar({
  current,
  max,
  thresholds,
  invert = false,
}: {
  current: number;
  max: number;
  thresholds: Array<{ value: number; label: string }>;
  invert?: boolean;
}) {
  const ratio = Math.max(0, Math.min(100, (current / max) * 100));
  return (
    <div className="space-y-2">
      <div className="relative h-2.5 rounded-full bg-slate-100">
        <div
          className={cx(
            "h-2.5 rounded-full",
            invert ? "bg-red-500" : "bg-slate-900",
          )}
          style={{ width: `${ratio}%` }}
        />
        {thresholds.map((threshold) => (
          <span
            key={`${threshold.label}-${threshold.value}`}
            className="absolute top-1/2 h-4 w-0.5 -translate-y-1/2 bg-slate-300"
            style={{ left: `${Math.max(0, Math.min(100, (threshold.value / max) * 100))}%` }}
            aria-hidden="true"
          />
        ))}
      </div>
      <div className="flex items-center justify-between text-[11px] text-slate-500">
        <span>0</span>
        {thresholds.map((threshold) => (
          <span key={threshold.label}>
            {threshold.label} {formatNumber(threshold.value)}
          </span>
        ))}
        <span>{formatNumber(max)}</span>
      </div>
    </div>
  );
}

function DotCount({
  active,
  total,
  activeClassName,
}: {
  active: number;
  total: number;
  activeClassName: string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {Array.from({ length: total }).map((_, index) => (
        <span
          key={index}
          className={cx(
            "h-3 w-3 rounded-full border border-slate-200",
            index < active ? activeClassName : "bg-white",
          )}
        />
      ))}
    </div>
  );
}

function Button({
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cx(
        "inline-flex items-center justify-center rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

function ComparisonMeter({
  label,
  benchmark,
  currentValue,
  higherIsBetter = true,
}: {
  label: string;
  benchmark: number;
  currentValue: number;
  higherIsBetter?: boolean;
}) {
  const delta = safePercentDelta(benchmark, currentValue);
  const relativeLabel = getRelativeLabel(delta, higherIsBetter);
  const tone = scoreToneFromComparisons({
    current: currentValue,
    cityAvg: benchmark,
    districtAvg: benchmark,
    higherIsBetter,
  });
  const meta = getToneMeta(tone);

  const fillRatio = Math.max(
    8,
    Math.min(100, (Math.min(currentValue, benchmark * 1.6) / (benchmark * 1.6 || 1)) * 100),
  );
  const benchmarkPosition = Math.max(
    8,
    Math.min(100, (benchmark / (benchmark * 1.6 || 1)) * 100),
  );

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="font-medium text-slate-500">{label}</span>
        <span className={cx("font-semibold", meta.text)}>
          {formatSignedPercent(delta)} · {relativeLabel}
        </span>
      </div>
      <div className="relative h-2.5 rounded-full bg-slate-100">
        <div
          className={cx("h-2.5 rounded-full", meta.bar)}
          style={{ width: `${fillRatio}%` }}
        />
        <span
          className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-slate-400 shadow-sm"
          style={{ left: `${benchmarkPosition}%` }}
          aria-hidden="true"
        />
      </div>
      <div className="flex items-center justify-between text-[11px] text-slate-500">
        <span>현재 {formatDecimal(currentValue, 1)}</span>
        <span>평균 {formatDecimal(benchmark, 1)}</span>
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  description,
  alertTitle,
  alertDetail,
  cityLabel,
  cityValue,
  districtLabel,
  districtValue,
  currentValue,
  tone,
  higherIsBetter = true,
  footer,
}: MetricCardProps) {
  const meta = getToneMeta(tone);

  return (
    <Card className="flex h-full flex-col p-5">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          <p className="text-xs text-slate-500">{description}</p>
        </div>
        <Badge tone={tone}>{meta.badge}</Badge>
      </div>

      <div className={cx("mb-5 rounded-2xl px-4 py-3", meta.soft)}>
        <p className={cx("text-sm font-bold", meta.text)}>{alertTitle}</p>
        <p className="mt-1 text-xs text-slate-700">{alertDetail}</p>
      </div>

      <div className="mb-5">
        <div className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
          {value}
        </div>
      </div>

      <div className="space-y-4">
        <ComparisonMeter
          label={cityLabel}
          benchmark={cityValue}
          currentValue={currentValue}
          higherIsBetter={higherIsBetter}
        />
        <ComparisonMeter
          label={districtLabel}
          benchmark={districtValue}
          currentValue={currentValue}
          higherIsBetter={higherIsBetter}
        />
      </div>

      {footer ? <div className="mt-5 border-t border-slate-100 pt-4">{footer}</div> : null}
    </Card>
  );
}

function SectionShell({
  title,
  kicker,
  children,
}: {
  title: string;
  kicker: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          {kicker}
        </p>
        <h2 className="text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

function SchoolHeader({
  schoolName,
  districtName,
  caseLabel,
  accessStatusLabel,
  statusSummary,
  nearestParkDistanceM,
  playgroundCount,
  greenRatio,
  noParkWithin500m,
  tone,
}: {
  schoolName: string;
  districtName: string;
  caseLabel: string;
  accessStatusLabel?: string;
  statusSummary?: string;
  nearestParkDistanceM: number;
  playgroundCount: number;
  greenRatio: number;
  noParkWithin500m?: boolean;
  tone: StatusTone;
}) {
  const meta = getToneMeta(tone);

  return (
    <Card className={cx("overflow-hidden", meta.soft)}>
      <div className="border-b border-white/60 px-6 py-4 backdrop-blur sm:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-600">{districtName}</p>
            <div className="space-y-1">
              <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
                {schoolName}
              </h1>
              <p className="text-sm text-slate-600">
                정책 검토가 필요한 학교 단위 상세 리포트
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700">
                  🌳 공원 {formatNumber(nearestParkDistanceM)}m
                </span>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700">
                  🛝 놀이터 {formatNumber(playgroundCount)}개
                </span>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700">
                  🌿 녹지 {formatDecimal(greenRatio, 1)}%
                </span>
                {noParkWithin500m ? (
                  <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700">
                    🔴 500m 내 공원 없음
                  </span>
                ) : null}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={tone}>{meta.badge}</Badge>
            <Badge tone="caution">{caseLabel}</Badge>
          </div>
        </div>
      </div>

      <div className="grid gap-4 px-6 py-5 sm:grid-cols-1 sm:px-8">
        <div>
          <p className="text-xs font-medium text-slate-500">
            {accessStatusLabel ?? "현재 판단"}
          </p>
          <p className="mt-1 text-base font-semibold text-slate-900">
            {statusSummary ?? "학교 주변 녹지·놀이 접근성 보완 검토 필요"}
          </p>
        </div>
      </div>
    </Card>
  );
}

function AccessOverviewSection({
  nearestParkName,
  nearestParkDistanceM,
  noParkWithin500m,
  playgroundCount,
  straightLinePlaygroundCount,
  greenRatio,
  accessibilityRatio,
  parkShortageVsAvg,
}: Pick<
  SchoolDetailReportProps,
  | "nearestParkName"
  | "nearestParkDistanceM"
  | "noParkWithin500m"
  | "playgroundCount"
  | "straightLinePlaygroundCount"
  | "greenRatio"
  | "accessibilityRatio"
  | "parkShortageVsAvg"
>) {
  const items = [
    {
      label: "가장 가까운 공원",
      value: `약 ${formatNumber(nearestParkDistanceM)}m`,
      note: nearestParkName ?? "공원명 정보 없음",
    },
    {
      label: "500m 내 공원",
      value: noParkWithin500m ? "없음" : "있음",
      note: noParkWithin500m ? "도보 생활권 공원 공백" : "도보 생활권 접근 가능",
    },
    {
      label: "도보권 놀이터",
      value: `${formatNumber(playgroundCount)}개`,
      note:
        straightLinePlaygroundCount == null
          ? "직선 반경 정보 없음"
          : `직선 반경 ${formatNumber(straightLinePlaygroundCount)}개`,
    },
    {
      label: "500m 내 녹지 비율",
      value: `${formatDecimal(greenRatio, 1)}%`,
      note: "학교 반경 내 녹지 체감",
    },
    {
      label: "접근성 비율",
      value:
        accessibilityRatio == null
          ? "집계 없음"
          : `${formatDecimal(accessibilityRatio, 1)}%`,
      note: "도보/직선 기준 비교",
    },
    {
      label: "공원 부족",
      value:
        parkShortageVsAvg == null
          ? "집계 없음"
          : `${parkShortageVsAvg > 0 ? "+" : ""}${formatDecimal(parkShortageVsAvg, 2)}개`,
      note: "평균 대비 부족 규모",
    },
  ];

  return (
      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="text-sm font-medium text-slate-500">가장 가까운 공원</p>
              <p className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
                {formatNumber(nearestParkDistanceM)}m
              </p>
              <p className="mt-1 text-sm text-slate-600">{nearestParkName ?? "공원명 정보 없음"}</p>
              <div className="mt-4">
                <ThresholdBar
                  current={nearestParkDistanceM}
                  max={1200}
                  invert
                  thresholds={[
                    { value: 500, label: "생활권" },
                    { value: 1000, label: "원거리" },
                  ]}
                />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="text-sm font-medium text-slate-500">공원 접근성</p>
              <div className="mt-3 flex items-end justify-between gap-3">
                <div className="text-3xl font-bold tracking-tight text-slate-950">
                  {accessibilityRatio == null ? "집계 없음" : `${formatDecimal(accessibilityRatio, 1)}%`}
                </div>
                <Badge tone={noParkWithin500m ? "danger" : "positive"}>
                  {noParkWithin500m ? "500m 내 공원 없음" : "500m 내 공원 있음"}
                </Badge>
              </div>
              <div className="mt-4">
                <ThresholdBar
                  current={accessibilityRatio ?? 0}
                  max={100}
                  thresholds={[
                    { value: 50, label: "50%" },
                    { value: 100, label: "100%" },
                  ]}
                />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="text-sm font-medium text-slate-500">도보권 놀이터</p>
              <div className="mt-3 flex items-end justify-between gap-3">
                <p className="text-3xl font-bold tracking-tight text-slate-950">
                  {formatNumber(playgroundCount)}개
                </p>
                <p className="text-sm text-slate-500">
                  직선 반경 {straightLinePlaygroundCount == null ? "-" : formatNumber(straightLinePlaygroundCount)}개
                </p>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">
                    도보권
                  </p>
                  <DotCount active={Math.min(playgroundCount, 6)} total={6} activeClassName="bg-red-500" />
                </div>
                <div>
                  <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">
                    직선 반경
                  </p>
                  <DotCount
                    active={Math.min(straightLinePlaygroundCount ?? 0, 6)}
                    total={6}
                    activeClassName="bg-slate-900"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="text-sm font-medium text-slate-500">녹지·부족 규모</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <StatPill label="500m 내 녹지 비율" value={`${formatDecimal(greenRatio, 1)}%`} />
                <StatPill
                  label="공원 부족"
                  value={
                    parkShortageVsAvg == null
                      ? "집계 없음"
                      : `${parkShortageVsAvg > 0 ? "+" : ""}${formatDecimal(parkShortageVsAvg, 2)}개`
                  }
                  tone={parkShortageVsAvg != null && parkShortageVsAvg < 0 ? "red" : "slate"}
                />
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <p className="text-sm font-medium text-slate-500">핵심 현황 요약</p>
          <div className="mt-4 grid gap-3">
            {items.map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                  <p className="text-xs text-slate-500">{item.note}</p>
                </div>
                <div className="text-right text-sm font-bold text-slate-900">{item.value}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
  );
}

function ParkDistanceCard(
  props: Omit<
    MetricCardProps,
    "title" | "description" | "higherIsBetter" | "alertTitle" | "alertDetail"
  > & { districtName: string },
) {
  const districtGap = props.currentValue - props.districtValue;
  const cityGap = props.currentValue - props.cityValue;
  const alertTitle =
    props.tone === "danger" || props.tone === "warning"
      ? "위험! 공원이 너무 멀어요."
      : "주의! 공원 접근성이 아쉬워요.";
  const alertDetail = `${props.districtName} 평균보다 ${formatGap(districtGap, "m")} 더 멀고, ${CITY_SHORT_NAME} 평균보다 ${formatGap(cityGap, "m")} 더 멉니다.`;

  return (
    <MetricCard
      title="최근접 공원 거리"
      description="가까운 공원 접근성이 충분한지 확인"
      alertTitle={alertTitle}
      alertDetail={alertDetail}
      higherIsBetter={false}
      {...props}
    />
  );
}

function GreenRatioCard(
  props: Omit<MetricCardProps, "title" | "description" | "alertTitle" | "alertDetail"> & {
    districtName: string;
  },
) {
  const districtGap = props.districtValue - props.currentValue;
  const cityGap = props.cityValue - props.currentValue;
  const alertTitle =
    props.tone === "danger" || props.tone === "warning"
      ? "위험! 녹지가 부족한 편이에요."
      : "주의! 녹지 여건이 낮은 편이에요.";
  const alertDetail = `${props.districtName} 평균보다 ${formatGap(districtGap, "%p")} 낮고, ${CITY_SHORT_NAME} 평균보다 ${formatGap(cityGap, "%p")} 낮습니다.`;

  return (
    <MetricCard
      title="주변 녹지 비율"
      description="생활권 내 녹지 체감 여건"
      alertTitle={alertTitle}
      alertDetail={alertDetail}
      {...props}
    />
  );
}

function PlaygroundCard(
  props: Omit<MetricCardProps, "title" | "description" | "alertTitle" | "alertDetail"> & {
    districtName: string;
  },
) {
  const districtGap = props.districtValue - props.currentValue;
  const cityGap = props.cityValue - props.currentValue;
  const alertTitle =
    props.tone === "danger" || props.tone === "warning"
      ? "위험! 놀이터가 부족한 편이에요."
      : "주의! 놀이터 선택지가 적어요.";
  const alertDetail = `${props.districtName} 평균보다 ${formatGap(districtGap, "개")} 부족하고, ${CITY_SHORT_NAME} 평균보다 ${formatGap(cityGap, "개")} 부족합니다.`;

  return (
    <MetricCard
      title="주변 놀이터 수"
      description="학교 인근 대체 놀이시설 분포"
      alertTitle={alertTitle}
      alertDetail={alertDetail}
      {...props}
    />
  );
}

function StudentTrendCard({
  districtName,
  studentTrend,
  cityAvg,
  districtAvg,
}: {
  districtName: string;
  studentTrend: StudentTrendPoint[];
  cityAvg: number;
  districtAvg: number;
}) {
  const latestValue = studentTrend[studentTrend.length - 1]?.value ?? 0;
  const tone = scoreToneFromComparisons({
    current: latestValue,
    cityAvg,
    districtAvg,
    higherIsBetter: true,
  });
  const cityDelta = safePercentDelta(cityAvg, latestValue);
  const trendDelta = latestValue - (studentTrend[0]?.value ?? latestValue);
  const schoolDeclineRate = Math.abs(getTrendChangePercent(studentTrend));
  const districtBaseline = studentTrend[0]?.value ?? districtAvg;
  const cityBaseline = studentTrend[0]?.value ?? cityAvg;
  const districtDeclineRate = Math.abs(safePercentDelta(districtBaseline, districtAvg));
  const cityDeclineRate = Math.abs(safePercentDelta(cityBaseline, cityAvg));
  const alertTitle =
    trendDelta <= -120 ? "주의! 학생수가 빠르게 감소 중이에요." : "주의! 학생수가 감소 흐름이에요.";
  const alertDetail = `${districtName} 평균보다 ${formatGap(schoolDeclineRate - districtDeclineRate, "%p")} 빠르게 감소 중이고, ${CITY_SHORT_NAME} 평균보다 ${formatGap(schoolDeclineRate - cityDeclineRate, "%p")} 빠르게 감소 중입니다.`;

  return (
    <MetricCard
      title="학생수 추세"
      description="최근 6년 학생수 흐름"
      alertTitle={alertTitle}
      alertDetail={alertDetail}
      value={`${formatNumber(latestValue)}명`}
      currentValue={latestValue}
      cityLabel={`${CITY_SHORT_NAME} 평균 대비`}
      cityValue={cityAvg}
      districtLabel="구 평균 대비"
      districtValue={districtAvg}
      tone={tone}
      footer={
        <div className="space-y-3">
          <div className="h-40 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={studentTrend} margin={{ top: 12, right: 18, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                <XAxis
                  dataKey="year"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "#64748b" }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  width={42}
                />
                <Tooltip
                  cursor={{ stroke: "#cbd5e1", strokeWidth: 1 }}
                  contentStyle={{
                    borderRadius: 12,
                    borderColor: "#e2e8f0",
                    fontSize: 12,
                  }}
                  formatter={(value: number) => [`${formatNumber(value)}명`, "학생수"]}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#0f172a"
                  strokeWidth={2.5}
                  dot={{ fill: "#0f172a", r: 3 }}
                  activeDot={{ r: 5 }}
                >
                  <LabelList
                    dataKey="value"
                    position="top"
                    formatter={(value: number) => formatNumber(value)}
                    style={{ fill: "#475569", fontSize: 10 }}
                  />
                </Line>
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-slate-600">
            최근 기준 학생수는 {CITY_SHORT_NAME} 평균 대비{" "}
            <span className={cx("font-semibold", cityDelta >= 0 ? "text-green-700" : "text-red-700")}>
              {formatSignedPercent(cityDelta)}
            </span>
            입니다.
          </p>
        </div>
      }
    />
  );
}

function SchoolProfileGrid(props: SchoolDetailReportProps) {
  const parkTone = scoreToneFromComparisons({
    current: props.nearestParkDistanceM,
    cityAvg: props.nearestParkDistanceCityAvg,
    districtAvg: props.nearestParkDistanceDistrictAvg,
    higherIsBetter: false,
  });
  const greenTone = scoreToneFromComparisons({
    current: props.greenRatio,
    cityAvg: props.greenRatioCityAvg,
    districtAvg: props.greenRatioDistrictAvg,
  });
  const playgroundTone = scoreToneFromComparisons({
    current: props.playgroundCount,
    cityAvg: props.playgroundCountCityAvg,
    districtAvg: props.playgroundCountDistrictAvg,
  });

  return (
    <SectionShell kicker="Profile" title="핵심 취약성·현황">
      <div className="grid gap-4 lg:grid-cols-2">
        <ParkDistanceCard
          districtName={props.districtName}
          value={`${formatNumber(props.nearestParkDistanceM)}m`}
          currentValue={props.nearestParkDistanceM}
          cityLabel={`${CITY_SHORT_NAME} 평균 대비`}
          cityValue={props.nearestParkDistanceCityAvg}
          districtLabel="구 평균 대비"
          districtValue={props.nearestParkDistanceDistrictAvg}
          tone={parkTone}
        />
        <GreenRatioCard
          districtName={props.districtName}
          value={`${formatDecimal(props.greenRatio, 1)}%`}
          currentValue={props.greenRatio}
          cityLabel={`${CITY_SHORT_NAME} 평균 대비`}
          cityValue={props.greenRatioCityAvg}
          districtLabel="구 평균 대비"
          districtValue={props.greenRatioDistrictAvg}
          tone={greenTone}
        />
        <PlaygroundCard
          districtName={props.districtName}
          value={`${formatNumber(props.playgroundCount)}개`}
          currentValue={props.playgroundCount}
          cityLabel={`${CITY_SHORT_NAME} 평균 대비`}
          cityValue={props.playgroundCountCityAvg}
          districtLabel="구 평균 대비"
          districtValue={props.playgroundCountDistrictAvg}
          tone={playgroundTone}
        />
        <StudentTrendCard
          districtName={props.districtName}
          studentTrend={props.studentTrend}
          cityAvg={props.studentTrendCityAvg}
          districtAvg={props.studentTrendDistrictAvg}
        />
      </div>
      <AccessOverviewSection
        nearestParkName={props.nearestParkName}
        nearestParkDistanceM={props.nearestParkDistanceM}
        noParkWithin500m={props.noParkWithin500m}
        playgroundCount={props.playgroundCount}
        straightLinePlaygroundCount={props.straightLinePlaygroundCount}
        greenRatio={props.greenRatio}
        accessibilityRatio={props.accessibilityRatio}
        parkShortageVsAvg={props.parkShortageVsAvg}
      />
    </SectionShell>
  );
}

function ProblemSection({
  tone,
  problemTags,
}: {
  tone: StatusTone;
  problemTags: string[];
}) {
  const meta = getToneMeta(tone);

  return (
    <SectionShell kicker="Problem" title="핵심 판단">
      <Card className="p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl space-y-2">
            <div className="rounded-2xl bg-slate-950 px-5 py-4">
              <p className="text-lg font-bold tracking-tight text-white sm:text-xl">
              시 평균과 구 평균 대비 핵심 생활권 지표가 동시에 밀리는 학교입니다.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {problemTags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700"
            >
              {tag}
            </span>
          ))}
        </div>
      </Card>
    </SectionShell>
  );
}

function ImpactSection({
  potentialDemand2029,
  potentialDemand2031,
}: Pick<SchoolDetailReportProps, "potentialDemand2029" | "potentialDemand2031">) {
  const demandTone = getLineToneFromDemand(potentialDemand2031);
  const meta = getToneMeta(demandTone);

  return (
    <SectionShell kicker="Impact" title="잠재 수요 추정 규모">
      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="p-6">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm font-medium text-slate-500">2029 잠재 수요 추정</p>
              <p className="mt-3 text-4xl font-bold tracking-tight text-slate-950">
                {formatNumber(potentialDemand2029)}
              </p>
              <p className="mt-1 text-sm text-slate-600">영향 가능 아동 규모</p>
            </div>
            <div className={cx("rounded-2xl border p-5", meta.soft, meta.ring, "ring-1")}>
              <p className="text-sm font-medium text-slate-500">2031 잠재 수요 추정</p>
              <p className="mt-3 text-4xl font-bold tracking-tight text-slate-950">
                {formatNumber(potentialDemand2031)}
              </p>
              <p className={cx("mt-1 text-sm font-semibold", meta.text)}>중기 검토 우선도 반영 수치</p>
            </div>
          </div>
        </Card>

        <Card className="flex flex-col justify-between p-6">
          <div>
            <p className="text-sm font-medium text-slate-500">해석</p>
            <p className="mt-2 text-lg font-semibold text-slate-950">
              현재 접근성 취약 지점이 유지될 경우, 향후 수요 대응 부담이 커질 수 있습니다.
            </p>
          </div>
          <Badge tone={demandTone} className="mt-5 w-fit">
            잠재 수요 기반 판단
          </Badge>
        </Card>
      </div>
    </SectionShell>
  );
}

function ContextSection({
  contextTags,
  hasLargeApartmentComplexNearby,
  nearestParkDistanceM,
  nearestParkDistanceCityAvg,
  nearestParkDistanceDistrictAvg,
  greenRatio,
  greenRatioCityAvg,
  greenRatioDistrictAvg,
}: Pick<
  SchoolDetailReportProps,
  | "contextTags"
  | "hasLargeApartmentComplexNearby"
  | "nearestParkDistanceM"
  | "nearestParkDistanceCityAvg"
  | "nearestParkDistanceDistrictAvg"
  | "greenRatio"
  | "greenRatioCityAvg"
  | "greenRatioDistrictAvg"
>) {
  const parkDeltaCity = safePercentDelta(nearestParkDistanceCityAvg, nearestParkDistanceM);
  const parkDeltaDistrict = safePercentDelta(
    nearestParkDistanceDistrictAvg,
    nearestParkDistanceM,
  );
  const greenDeltaCity = safePercentDelta(greenRatioCityAvg, greenRatio);
  const greenDeltaDistrict = safePercentDelta(greenRatioDistrictAvg, greenRatio);

  return (
    <SectionShell kicker="Context" title="주변 맥락과 상대 비교">
      <div className="grid gap-4">
        <Card className="p-6">
          <p className="text-sm font-medium text-slate-500">지역 맥락</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {contextTags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700"
              >
                {tag}
              </span>
            ))}
            {hasLargeApartmentComplexNearby ? (
              <span className="rounded-full border border-slate-200 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-800">
                근처 500세대 이상 대단지 아파트로 미집계 녹지·놀이터 가능성
              </span>
            ) : null}
          </div>
          {hasLargeApartmentComplexNearby ? (
            <p className="mt-3 text-sm text-slate-600">
              근처 500세대 이상 대단지 아파트가 있어 미집계 녹지나 놀이터가 일부 존재할 가능성이 있습니다.
            </p>
          ) : null}
        </Card>
      </div>
    </SectionShell>
  );
}

type PositionPoint = {
  label: string;
  schoolName: string;
  districtName: string;
  nearestParkDistanceM: number;
  greenRatio: number;
  playgroundCount: number;
  pointType: "current" | "similar" | "cityBest" | "districtBest" | "sharedBest";
};

function PositionTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: PositionPoint }>;
}) {
  if (!active || !payload?.length) return null;

  const point = payload[0]?.payload;
  if (!point) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-lg">
      <p className="text-sm font-bold text-slate-950">{point.schoolName}</p>
      <p className="text-xs text-slate-500">{point.districtName}</p>
      <div className="mt-2 space-y-1 text-xs text-slate-700">
        <p>최근접 공원 거리 {formatNumber(point.nearestParkDistanceM)}m</p>
        <p>녹지 비율 {formatDecimal(point.greenRatio, 1)}%</p>
        <p>놀이터 수 {formatNumber(point.playgroundCount)}개</p>
      </div>
    </div>
  );
}

function ScatterPointLabel({
  x,
  y,
  value,
  colorClassName = "fill-slate-700",
}: {
  x?: number;
  y?: number;
  value?: string;
  colorClassName?: string;
}) {
  if (x == null || y == null || !value) return null;

  return (
    <g transform={`translate(${x},${y})`}>
      <rect
        x={10}
        y={-24}
        width={Math.max(72, value.length * 7.5)}
        height={22}
        rx={11}
        fill="white"
        stroke="#cbd5e1"
      />
      <text x={18} y={-9} fontSize={11} fontWeight={700} className={colorClassName}>
        {value}
      </text>
    </g>
  );
}

function renderScatterLabel(
  colorClassName: string,
): (props: { x?: number; y?: number; value?: string | number }) => React.ReactNode {
  return ({ x, y, value }) => {
    if (typeof x !== "number" || typeof y !== "number") return null;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

    const safeValue = typeof value === "string" ? value : String(value ?? "");
    if (!safeValue) return null;

    return (
      <ScatterPointLabel
        x={x}
        y={y}
        value={safeValue}
        colorClassName={colorClassName}
      />
    );
  };
}

function CurrentSchoolShape(props: { cx?: number; cy?: number }) {
  const { cx = 0, cy = 0 } = props;
  return (
    <g>
      <circle cx={cx} cy={cy} r={13} fill="#ef4444" opacity={0.22} />
      <circle cx={cx} cy={cy} r={8.5} fill="#dc2626" stroke="#ffffff" strokeWidth={2.5} />
    </g>
  );
}

function SimilarSchoolShape(props: { cx?: number; cy?: number }) {
  const { cx = 0, cy = 0 } = props;
  return <circle cx={cx} cy={cy} r={5.5} fill="#64748b" stroke="#ffffff" strokeWidth={1.5} />;
}

function DiamondShape(props: { cx?: number; cy?: number; fill: string }) {
  const { cx = 0, cy = 0, fill } = props;
  return (
    <path
      d={`M ${cx} ${cy - 9} L ${cx + 9} ${cy} L ${cx} ${cy + 9} L ${cx - 9} ${cy} Z`}
      fill={fill}
      stroke="#ffffff"
      strokeWidth={2}
    />
  );
}

function StarShape(props: { cx?: number; cy?: number; fill: string }) {
  const { cx = 0, cy = 0, fill } = props;
  const points = [
    [cx, cy - 10],
    [cx + 3, cy - 3],
    [cx + 10, cy - 3],
    [cx + 5, cy + 2],
    [cx + 7, cy + 10],
    [cx, cy + 5],
    [cx - 7, cy + 10],
    [cx - 5, cy + 2],
    [cx - 10, cy - 3],
    [cx - 3, cy - 3],
  ]
    .map(([x, y]) => `${x},${y}`)
    .join(" ");

  return <polygon points={points} fill={fill} stroke="#ffffff" strokeWidth={2} />;
}

function SharedBestShape(props: { cx?: number; cy?: number }) {
  const { cx = 0, cy = 0 } = props;
  return (
    <g>
      <StarShape cx={cx} cy={cy} fill="#eab308" />
      <DiamondShape cx={cx} cy={cy} fill="#0ea5e9" />
    </g>
  );
}

function OverlayPoint({
  cx,
  cy,
  label,
  children,
  labelColor,
}: {
  cx: number;
  cy: number;
  label: string;
  children: React.ReactNode;
  labelColor: string;
}) {
  return (
    <g>
      {children}
      <rect
        x={cx + 10}
        y={cy - 24}
        width={Math.max(76, label.length * 7.5)}
        height={22}
        rx={11}
        fill="white"
        stroke="#cbd5e1"
      />
      <text x={cx + 18} y={cy - 9} fontSize={11} fontWeight={700} fill={labelColor}>
        {label}
      </text>
    </g>
  );
}

function SimilarSchoolsSection({
  schoolName,
  districtName,
  nearestParkDistanceM,
  greenRatio,
  playgroundCount,
  nearestParkDistanceCityAvg,
  greenRatioCityAvg,
  similarSchools,
  cityBestEnvironmentSchool,
  districtBestEnvironmentSchool,
}: Pick<
  SchoolDetailReportProps,
  | "schoolName"
  | "districtName"
  | "nearestParkDistanceM"
  | "greenRatio"
  | "playgroundCount"
  | "nearestParkDistanceCityAvg"
  | "greenRatioCityAvg"
  | "similarSchools"
  | "cityBestEnvironmentSchool"
  | "districtBestEnvironmentSchool"
>) {
  const [hoveredPointId, setHoveredPointId] = React.useState<string | null>(null);

  if (!similarSchools?.length) return null;

  const currentPoint: PositionPoint = {
    label: "?? ??",
    schoolName,
    districtName,
    nearestParkDistanceM,
    greenRatio,
    playgroundCount,
    pointType: "current",
  };

  const sharedBenchmark =
    cityBestEnvironmentSchool &&
    districtBestEnvironmentSchool &&
    cityBestEnvironmentSchool.schoolName === districtBestEnvironmentSchool.schoolName &&
    cityBestEnvironmentSchool.districtName === districtBestEnvironmentSchool.districtName;

  const benchmarkPoints: PositionPoint[] = sharedBenchmark
    ? [
        {
          label: "??? ?? ????",
          schoolName: cityBestEnvironmentSchool.schoolName,
          districtName: cityBestEnvironmentSchool.districtName,
          nearestParkDistanceM: cityBestEnvironmentSchool.nearestParkDistanceM,
          greenRatio: cityBestEnvironmentSchool.greenRatio,
          playgroundCount: cityBestEnvironmentSchool.playgroundCount,
          pointType: "sharedBest",
        },
      ]
    : [
        ...(cityBestEnvironmentSchool
          ? [
              {
                label: "??? ???",
                schoolName: cityBestEnvironmentSchool.schoolName,
                districtName: cityBestEnvironmentSchool.districtName,
                nearestParkDistanceM: cityBestEnvironmentSchool.nearestParkDistanceM,
                greenRatio: cityBestEnvironmentSchool.greenRatio,
                playgroundCount: cityBestEnvironmentSchool.playgroundCount,
                pointType: "cityBest" as const,
              },
            ]
          : []),
        ...(districtBestEnvironmentSchool
          ? [
              {
                label: "? ???",
                schoolName: districtBestEnvironmentSchool.schoolName,
                districtName: districtBestEnvironmentSchool.districtName,
                nearestParkDistanceM: districtBestEnvironmentSchool.nearestParkDistanceM,
                greenRatio: districtBestEnvironmentSchool.greenRatio,
                playgroundCount: districtBestEnvironmentSchool.playgroundCount,
                pointType: "districtBest" as const,
              },
            ]
          : []),
      ];

  const similarPoints: PositionPoint[] = similarSchools.map((school) => ({
    label: school.schoolName,
    schoolName: school.schoolName,
    districtName: school.districtName,
    nearestParkDistanceM: school.nearestParkDistanceM,
    greenRatio: school.greenRatio,
    playgroundCount: school.playgroundCount,
    pointType: "similar",
  }));

  const plotPoints = [currentPoint, ...similarPoints, ...benchmarkPoints];
  const xTicks = [0, 300, 600, 900, 1200, 1500, 1800];
  const yTicks = [0, 6, 12, 18, 24];
  const xDomainMin = 0;
  const xDomainMax = 1800;
  const yDomainMin = 0;
  const yDomainMax = 24;

  const svgWidth = 760;
  const svgHeight = 420;
  const margin = { top: 26, right: 28, bottom: 54, left: 62 };
  const chartWidth = svgWidth - margin.left - margin.right;
  const chartHeight = svgHeight - margin.top - margin.bottom;

  const scaleX = (value: number) =>
    margin.left + ((value - xDomainMin) / (xDomainMax - xDomainMin)) * chartWidth;
  const scaleY = (value: number) =>
    margin.top + chartHeight - ((value - yDomainMin) / (yDomainMax - yDomainMin)) * chartHeight;

  const plotRows = plotPoints.map((point, index) => ({
    ...point,
    id: `${point.pointType}-${index}`,
    x: scaleX(point.nearestParkDistanceM),
    y: scaleY(point.greenRatio),
  }));

  const hoveredPoint = plotRows.find((point) => point.id === hoveredPointId) ?? null;

  const avgSimilarParkDistance =
    similarPoints.reduce((sum, point) => sum + point.nearestParkDistanceM, 0) / similarPoints.length;

  const insights = [
    currentPoint.nearestParkDistanceM > avgSimilarParkDistance
      ? "?? ??? ????? ?? ?? ???? ??? ??? ????."
      : "?? ??? ????? ?? ?? ???? ????? ??? ????.",
    districtBestEnvironmentSchool
      ? `? ??? ????? ???? ?? ?? ??? ${formatGap(
          districtBestEnvironmentSchool.greenRatio - currentPoint.greenRatio,
          "%p",
        )}???.`
      : "? ??? ???? ??? ?? ???? ?????.",
    cityBestEnvironmentSchool
      ? "??? ??? ????? ?? ???? ??? ???."
      : "??? ??? ???? ??? ?? ???? ?????.",
  ];

  const renderMarker = (point: (typeof plotRows)[number]) => {
    if (point.pointType === "current") {
      return (
        <g>
          <circle cx={point.x} cy={point.y} r={15} fill="#ef4444" opacity={0.18} />
          <circle cx={point.x} cy={point.y} r={9} fill="#dc2626" stroke="#ffffff" strokeWidth={3} />
        </g>
      );
    }

    if (point.pointType === "cityBest") {
      const size = 11;
      const pts = [
        [point.x, point.y - size],
        [point.x + 3.5, point.y - 3.5],
        [point.x + size, point.y - 3.5],
        [point.x + 5, point.y + 1.5],
        [point.x + 7, point.y + size],
        [point.x, point.y + 5],
        [point.x - 7, point.y + size],
        [point.x - 5, point.y + 1.5],
        [point.x - size, point.y - 3.5],
        [point.x - 3.5, point.y - 3.5],
      ]
        .map(([x, y]) => `${x},${y}`)
        .join(" ");

      return <polygon points={pts} fill="#eab308" stroke="#ffffff" strokeWidth={2.5} />;
    }

    if (point.pointType === "districtBest") {
      return (
        <path
          d={`M ${point.x} ${point.y - 10} L ${point.x + 10} ${point.y} L ${point.x} ${point.y + 10} L ${point.x - 10} ${point.y} Z`}
          fill="#0ea5e9"
          stroke="#ffffff"
          strokeWidth={2.5}
        />
      );
    }

    if (point.pointType === "sharedBest") {
      return (
        <g>
          <circle cx={point.x} cy={point.y} r={11} fill="#111827" stroke="#ffffff" strokeWidth={2.5} />
          <text
            x={point.x}
            y={point.y + 4}
            textAnchor="middle"
            fontSize={10}
            fontWeight={700}
            fill="#f8fafc"
          >
            ???
          </text>
        </g>
      );
    }

    return <circle cx={point.x} cy={point.y} r={6} fill="#64748b" stroke="#ffffff" strokeWidth={2} />;
  };

  return (
    <SectionShell kicker="Benchmark" title="AI ???? ?? ? ???? ???">
      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="p-6">
          <p className="text-sm text-slate-600">
            ????? ???, ?? ??, ??? ??, ?? ?? ?? ??? ??? KNN??
            ?????, ?? ???? ?? ???? ?? ???? ????.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-red-700">?? ??</p>
              <p className="mt-2 text-sm font-bold text-slate-900">{schoolName}</p>
              <p className="mt-1 text-xs text-slate-600">
                ?? {formatNumber(nearestParkDistanceM)}m ? ?? {formatDecimal(greenRatio, 1)}% ? ??? {formatNumber(playgroundCount)}?
              </p>
            </div>
            {benchmarkPoints.map((point) => (
              <div
                key={`top-${point.label}`}
                className={cx(
                  "rounded-2xl border p-4",
                  point.pointType === "cityBest"
                    ? "border-yellow-200 bg-yellow-50"
                    : point.pointType === "districtBest"
                      ? "border-sky-200 bg-sky-50"
                      : "border-slate-200 bg-slate-50",
                )}
              >
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-700">
                  {point.label}
                </p>
                <p className="mt-2 text-sm font-bold text-slate-900">{point.schoolName}</p>
                <p className="mt-1 text-xs text-slate-600">
                  ?? {formatNumber(point.nearestParkDistanceM)}m ? ?? {formatDecimal(point.greenRatio, 1)}% ? ??? {formatNumber(point.playgroundCount)}?
                </p>
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700">?? ??</span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700">????</span>
            <span className="rounded-full border border-yellow-200 bg-yellow-50 px-3 py-1.5 text-sm font-medium text-yellow-800">??? ???</span>
            <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-sm font-medium text-sky-700">? ???</span>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
              ?? ??? ?? ????. ?? ??? ????, ?? ??? ???? ?????.
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
              ??? ??? ??? ?? ??? ?? ??? ??? ??? ?????.
            </div>
          </div>

          <div className="mt-5">
            <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="h-[420px] w-full">
                <rect x="0" y="0" width={svgWidth} height={svgHeight} fill="#ffffff" />
                <rect
                  x={margin.left}
                  y={margin.top}
                  width={scaleX(nearestParkDistanceCityAvg) - margin.left}
                  height={scaleY(greenRatioCityAvg) - margin.top}
                  fill="#ecfdf5"
                />
                <rect
                  x={scaleX(nearestParkDistanceCityAvg)}
                  y={margin.top}
                  width={scaleX(xDomainMax) - scaleX(nearestParkDistanceCityAvg)}
                  height={scaleY(greenRatioCityAvg) - margin.top}
                  fill="#fff7ed"
                />
                <rect
                  x={margin.left}
                  y={scaleY(greenRatioCityAvg)}
                  width={scaleX(nearestParkDistanceCityAvg) - margin.left}
                  height={margin.top + chartHeight - scaleY(greenRatioCityAvg)}
                  fill="#fefce8"
                />
                <rect
                  x={scaleX(nearestParkDistanceCityAvg)}
                  y={scaleY(greenRatioCityAvg)}
                  width={scaleX(xDomainMax) - scaleX(nearestParkDistanceCityAvg)}
                  height={margin.top + chartHeight - scaleY(greenRatioCityAvg)}
                  fill="#fef2f2"
                />

                {xTicks.map((tick) => (
                  <g key={`x-${tick}`}>
                    <line
                      x1={scaleX(tick)}
                      x2={scaleX(tick)}
                      y1={margin.top}
                      y2={margin.top + chartHeight}
                      stroke="#e2e8f0"
                      strokeDasharray="3 3"
                    />
                    <text x={scaleX(tick)} y={svgHeight - 18} textAnchor="middle" fontSize="11" fill="#64748b">
                      {tick}
                    </text>
                  </g>
                ))}

                {yTicks.map((tick) => (
                  <g key={`y-${tick}`}>
                    <line
                      x1={margin.left}
                      x2={margin.left + chartWidth}
                      y1={scaleY(tick)}
                      y2={scaleY(tick)}
                      stroke="#e2e8f0"
                      strokeDasharray="3 3"
                    />
                    <text x={margin.left - 12} y={scaleY(tick) + 4} textAnchor="end" fontSize="11" fill="#64748b">
                      {tick}
                    </text>
                  </g>
                ))}

                <line
                  x1={scaleX(nearestParkDistanceCityAvg)}
                  x2={scaleX(nearestParkDistanceCityAvg)}
                  y1={margin.top}
                  y2={margin.top + chartHeight}
                  stroke="#94a3b8"
                  strokeDasharray="6 5"
                />
                <line
                  x1={margin.left}
                  x2={margin.left + chartWidth}
                  y1={scaleY(greenRatioCityAvg)}
                  y2={scaleY(greenRatioCityAvg)}
                  stroke="#94a3b8"
                  strokeDasharray="6 5"
                />

                <text x={margin.left + 10} y={margin.top + 18} fontSize="12" fontWeight="700" fill="#047857">???? ??</text>
                <text x={margin.left + chartWidth - 110} y={margin.top + 18} fontSize="12" fontWeight="700" fill="#c2410c">?? ?? ??</text>
                <text x={margin.left + 10} y={margin.top + chartHeight - 12} fontSize="12" fontWeight="700" fill="#a16207">?? ??</text>
                <text x={margin.left + chartWidth - 76} y={margin.top + chartHeight - 12} fontSize="12" fontWeight="700" fill="#b91c1c">?? ??</text>

                <text x={margin.left + chartWidth / 2} y={svgHeight - 2} textAnchor="middle" fontSize="12" fill="#475569">??? ?? ?? (m)</text>
                <text transform={`translate(18 ${margin.top + chartHeight / 2}) rotate(-90)`} textAnchor="middle" fontSize="12" fill="#475569">?? ?? (%)</text>

                {plotRows.map((point) => (
                  <g
                    key={point.id}
                    onMouseEnter={() => setHoveredPointId(point.id)}
                    onMouseLeave={() => setHoveredPointId((current) => (current === point.id ? null : current))}
                    style={{ cursor: "pointer" }}
                  >
                    {renderMarker(point)}
                    {point.pointType !== "similar" && (
                      <g transform={`translate(${point.x + 12},${point.y - 26})`}>
                        <rect width={Math.max(88, point.label.length * 8)} height="24" rx="12" fill="#ffffff" stroke="#cbd5e1" />
                        <text x="12" y="16" fontSize="11" fontWeight="700" fill="#0f172a">{point.label}</text>
                      </g>
                    )}
                  </g>
                ))}
              </svg>

              {hoveredPoint && (
                <div
                  className="pointer-events-none absolute z-10 w-56 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl"
                  style={{
                    left: `${Math.min(Math.max((hoveredPoint.x / svgWidth) * 100, 8), 72)}%`,
                    top: `${Math.min(Math.max((hoveredPoint.y / svgHeight) * 100 - 16, 6), 72)}%`,
                    transform: "translate(-50%, -100%)",
                  }}
                >
                  <p className="text-sm font-bold text-slate-950">{hoveredPoint.schoolName}</p>
                  <p className="text-xs text-slate-500">{hoveredPoint.districtName}</p>
                  <div className="mt-2 space-y-1 text-xs text-slate-700">
                    <p>??? ?? ?? {formatNumber(hoveredPoint.nearestParkDistanceM)}m</p>
                    <p>?? ?? {formatDecimal(hoveredPoint.greenRatio, 1)}%</p>
                    <p>??? ? {formatNumber(hoveredPoint.playgroundCount)}?</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <StatPill label="?? ??" value="???? ??" />
            <StatPill label="?? ??" value="?? ?? ??" tone="yellow" />
            <StatPill label="?? ??" value="?? ??" tone="yellow" />
            <StatPill label="?? ??" value="?? ??" tone="red" />
          </div>
        </Card>

        <div className="grid gap-4">
          <Card className="p-5">
            <p className="text-sm font-medium text-slate-500">???? ??</p>
            <div className="mt-4 space-y-3">
              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="text-sm font-semibold text-slate-900">?? ??</p>
                <p className="mt-1 text-xs text-slate-500">
                  {schoolName} ? ?? {formatNumber(nearestParkDistanceM)}m ? ?? {formatDecimal(greenRatio, 1)}%
                </p>
              </div>
              {benchmarkPoints.map((point) => (
                <div
                  key={point.label}
                  className={cx(
                    "rounded-2xl border p-4",
                    point.pointType === "cityBest"
                      ? "border-yellow-200 bg-yellow-50"
                      : point.pointType === "districtBest"
                        ? "border-sky-200 bg-sky-50"
                        : "border-slate-200 bg-slate-50",
                  )}
                >
                  <p className="text-sm font-semibold text-slate-900">{point.label}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {point.schoolName} ? ?? {formatNumber(point.nearestParkDistanceM)}m ? ?? {formatDecimal(point.greenRatio, 1)}%
                  </p>
                  <p className="mt-1 text-xs text-slate-500">??? {formatNumber(point.playgroundCount)}?</p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <p className="text-sm font-medium text-slate-500">??</p>
            <div className="mt-4 space-y-3">
              {insights.map((insight) => (
                <div key={insight} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  {insight}
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </SectionShell>
  );
}

function RedevelopmentNotice({
  redevelopmentPlanYear,
  redevelopmentType,
  redevelopmentProjects,
}: Pick<
  SchoolDetailReportProps,
  "redevelopmentPlanYear" | "redevelopmentType" | "redevelopmentProjects"
>) {
  const notice = buildRedevelopmentNotice(redevelopmentPlanYear, redevelopmentType);

  if (!notice) return null;

  return (
    <section>
      <Card className="!border-slate-950 !bg-slate-950 p-5 !text-white">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-yellow-300">
              Change Risk
            </p>
            <p className="text-lg font-bold text-white">{notice}</p>
          </div>
          <div className="rounded-2xl border border-yellow-300/60 bg-white/10 px-4 py-3 text-sm font-semibold text-yellow-200">
            재개발·정비사업으로 인한 변동 가능성
          </div>
        </div>
        {redevelopmentProjects?.length ? (
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {redevelopmentProjects.map((project) => (
              <div
                key={`${project.name}-${project.distanceM}`}
                className="rounded-2xl border border-white/15 bg-white/10 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-base font-semibold text-white">{project.name}</p>
                  <Badge tone="warning" className="shrink-0 bg-yellow-300/10 text-yellow-200 ring-yellow-300/30">
                    {formatNumber(project.distanceM)}m
                  </Badge>
                </div>
                <p className="mt-2 text-sm font-medium text-yellow-200">{project.stage}</p>
                <p className="mt-2 text-sm text-slate-300">{project.location}</p>
              </div>
            ))}
          </div>
        ) : null}
      </Card>
    </section>
  );
}

function SimulationEntry({
  schoolName,
  onSimulationClick,
}: Pick<SchoolDetailReportProps, "schoolName" | "onSimulationClick">) {
  return (
    <section>
      <Card className="border-slate-900 bg-slate-950 p-6 text-white sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Next Action
            </p>
            <h2 className="text-2xl font-bold tracking-tight">
              {schoolName} 기준으로 설치 시뮬레이션 검토
            </h2>
            <p className="max-w-2xl text-sm text-slate-300">
              후보지 시뮬레이션으로 넘어가면 도보권, 잠재 수요, 주변 대체시설을 기준으로 설치 검토를 이어갈 수 있습니다.
            </p>
          </div>
          <Button
            type="button"
            onClick={onSimulationClick}
            className="bg-white text-slate-950 hover:bg-slate-100"
          >
            이 위치 기준으로 설치 시뮬레이션 검토
          </Button>
        </div>
      </Card>
    </section>
  );
}

export default function SchoolDetailReportPage(props: SchoolDetailReportProps) {
  const overallTone = getMaxTone([
    getLineToneFromDemand(props.potentialDemand2031),
    scoreToneFromComparisons({
      current: props.nearestParkDistanceM,
      cityAvg: props.nearestParkDistanceCityAvg,
      districtAvg: props.nearestParkDistanceDistrictAvg,
      higherIsBetter: false,
    }),
    scoreToneFromComparisons({
      current: props.greenRatio,
      cityAvg: props.greenRatioCityAvg,
      districtAvg: props.greenRatioDistrictAvg,
    }),
    scoreToneFromComparisons({
      current: props.playgroundCount,
      cityAvg: props.playgroundCountCityAvg,
      districtAvg: props.playgroundCountDistrictAvg,
    }),
    scoreToneFromComparisons({
      current: props.studentTrend[props.studentTrend.length - 1]?.value ?? 0,
      cityAvg: props.studentTrendCityAvg,
      districtAvg: props.studentTrendDistrictAvg,
    }),
  ]);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <SchoolHeader
          schoolName={props.schoolName}
          districtName={props.districtName}
          caseLabel={props.caseLabel}
          accessStatusLabel={props.accessStatusLabel}
          statusSummary={props.statusSummary}
          nearestParkDistanceM={props.nearestParkDistanceM}
          playgroundCount={props.playgroundCount}
          greenRatio={props.greenRatio}
          noParkWithin500m={props.noParkWithin500m}
          tone={overallTone}
        />
        <SchoolProfileGrid {...props} />
        <ProblemSection tone={overallTone} problemTags={props.problemTags} />
        <ImpactSection
          potentialDemand2029={props.potentialDemand2029}
          potentialDemand2031={props.potentialDemand2031}
        />
        <ContextSection
          contextTags={props.contextTags}
          hasLargeApartmentComplexNearby={props.hasLargeApartmentComplexNearby}
          nearestParkDistanceM={props.nearestParkDistanceM}
          nearestParkDistanceCityAvg={props.nearestParkDistanceCityAvg}
          nearestParkDistanceDistrictAvg={props.nearestParkDistanceDistrictAvg}
          greenRatio={props.greenRatio}
          greenRatioCityAvg={props.greenRatioCityAvg}
          greenRatioDistrictAvg={props.greenRatioDistrictAvg}
        />
        <SimilarSchoolsSection
          similarSchools={props.similarSchools}
          similarityCommonPoints={props.similarityCommonPoints}
          relativeStrengths={props.relativeStrengths}
          relativeWeaknesses={props.relativeWeaknesses}
        />
        <RedevelopmentNotice
          redevelopmentPlanYear={props.redevelopmentPlanYear}
          redevelopmentType={props.redevelopmentType}
          redevelopmentProjects={props.redevelopmentProjects}
        />
        <SimulationEntry
          schoolName={props.schoolName}
          onSimulationClick={props.onSimulationClick}
        />
      </div>
    </main>
  );
}
