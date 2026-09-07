import { useMemo, useState } from "react";
import Disclosure from "./Disclosure";
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
import type {
  CityStatisticsData,
  StatisticsSchoolItem,
} from "./statisticsPreviewDataSafe";

interface StatisticsPageProps {
  data: CityStatisticsData;
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
          <span
            className="rounded-full border px-2.5 py-1 text-[11px] font-bold"
            style={{
              borderColor: `${CASE_COLORS[school.casePolicyLabel] ?? "#94A3B8"}66`,
              backgroundColor: `${CASE_COLORS[school.casePolicyLabel] ?? "#94A3B8"}22`,
              color: CASE_COLORS[school.casePolicyLabel] ?? "#94A3B8",
            }}
          >
            {school.casePolicyLabel}
          </span>
        </div>
        <p className="mt-1 text-sm text-slate-400">{school.caseStatusLabel}</p>
{!compact ? (
          <details className="mt-3 text-sm text-slate-300"><summary className="cursor-pointer text-forest-200">학교 지표 펼치기</summary><div className="mt-2 flex flex-wrap gap-3">
            <span>학생수 {formatNumber(school.currentStudentCount)}명</span>
            <span>2029 {formatNumber(school.potentialDemand2029)}명</span>
            <span>2031 {formatNumber(school.potentialDemand2031)}명</span>
            <span>공원 {formatDecimal(school.nearestParkDistanceM, 1)}m</span>
            <span>녹지 {formatDecimal(school.greenRatio, 1)}%</span>
            <span>놀이터 {formatNumber(school.playgroundCount)}개</span>
          </div></details>
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
      <p className="mt-1 text-sm font-medium text-slate-300">{school.districtName} · {school.caseStatusLabel}</p>
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

export default function StatisticsPageSafe({ data }: StatisticsPageProps) {
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

  const selectedTopPrioritySchools = useMemo(
    () => {
      const focusedSchools =
        districtPrioritySortMode === "students"
          ? selectedDistrict?.topPrioritySchoolsStudentFocused
          : selectedDistrict?.topPrioritySchoolsPlaygroundFocused;
      return rerankSchools((focusedSchools ?? selectedDistrict?.topPrioritySchools ?? []).filter(isSupportPrioritySchool));
    },
    [districtPrioritySortMode, selectedDistrict]
  );

  const cityCaseSummary = useMemo(
    () => [
      { label: "즉시 개선", value: data.summary.case1Count, color: "#dc2626" },
      { label: "우선 검토", value: data.summary.case2Count, color: "#f97316" },
      { label: "모니터링", value: data.summary.case3Count, color: "#eab308" },
      { label: "유지·관리", value: data.summary.case4Count, color: "#16a34a" },
      { label: "별도 묶음", value: data.summary.separateBundleCount, color: "#64748b" },
    ],
    [data.summary]
  );

  return (
    <div className="mx-auto flex max-w-[1380px] flex-col gap-8 px-4 py-8 lg:px-8">
      <section className="panel space-y-5 p-7">
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-forest-300">Overview</p>
          <h1 className="text-4xl font-black tracking-tight text-white lg:text-5xl">어디에 지원이 필요한가</h1>
          <p className="max-w-3xl text-base leading-7 text-slate-300">
            인천 초등학교의 현재 환경 격차를 비교하고, 구별 검토 학교를 좁혀보세요. 미래 수요는 별도 참고 지표입니다.
          </p>
        </div>
        <div className="reading-summary">
          <p className="text-sm font-semibold text-forest-200">현재 격차 · 학교 중심 500m 분석</p>
          <h2>{formatNumber(data.summary.schoolCount)}개교 중 {formatNumber(data.summary.case1Count + data.summary.case2Count)}개교가 개선·우선 검토 대상입니다</h2>
          <p>전체의 {formatDecimal(data.summary.schoolCount ? (data.summary.case1Count + data.summary.case2Count) / data.summary.schoolCount * 100 : 0)}% · 정책 분류에 따른 검토 대상이며, 예산 배분이나 사업 확정을 뜻하지 않습니다.</p>
          <div className="mt-5 flex h-4 overflow-hidden rounded-full" role="img" aria-label={cityCaseSummary.map(item => `${item.label} ${item.value}개교`).join(", ")}>
            {cityCaseSummary.map(item => <span key={item.label} style={{ width: `${data.summary.schoolCount ? item.value / data.summary.schoolCount * 100 : 0}%`, background: item.color }} />)}
          </div>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
            {cityCaseSummary.map(item => <span key={item.label}><span aria-hidden="true" style={{ color: item.color }}>● </span>{item.label} <strong>{item.value}개교</strong></span>)}
          </div>
        </div>
        <Disclosure title="통계 범위와 해석 기준" description="현재 분류, 미래 수요, 별도 정책 대상의 차이">
          <p className="text-sm leading-7 text-slate-300">{data.summary.districtCount}개 구·군, {data.summary.schoolCount}개교의 분석 산출물 기준입니다. 별도 묶음 {data.summary.separateBundleCount}개교는 전체 분모에 포함되며 일반 학교와 같은 기준으로 순위를 매기지 않습니다. 분류는 현재 환경을 나타내고, 2029·2031 수요 추정치는 미래 검토의 보조 근거입니다. 구별 학교 수가 다르므로 아래 막대의 크기를 구의 위험도나 지원 필요 비율로 해석하지 마세요.</p>
        </Disclosure>
      </section>

      <section className="grid gap-6">
        <div className="panel p-6">
          <SectionTitle
            eyebrow="District View"
            title={chartMode === "pressure" ? "어느 구에 검토 학교가 많은가" : "구별 정책 분류"}
            description={
              chartMode === "pressure"
                ? "즉시 개선(빨강)과 우선 검토(주황)의 학교 수를 비교합니다. 단위: 개교."
                : "학교 수 기준의 분포입니다. 구의 전체 학교 수 차이를 함께 고려하세요."
            }
          />
          <div className="mt-4 flex flex-wrap gap-2">
            {[
              { key: "pressure", label: "개선·검토 학교 수" },
              { key: "cases", label: "모든 정책 분류" },
            ].map((item) => {
              const active = chartMode === item.key;
              return (
                <button
                  key={item.key}
                  aria-pressed={active}
                  onClick={() => setChartMode(item.key as "pressure" | "cases")}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    active
                      ? "bg-forest-grad text-white shadow-glow"
                      : "border border-white/15 bg-navy-900/95 text-slate-200 hover:bg-white/10"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-300">{Object.entries(CASE_COLORS).filter(([label]) => chartMode === "cases" || SUPPORT_PRIORITY_LABELS.has(label)).map(([label, color]) => <span key={label}><span style={{ color }} aria-hidden="true">● </span>{label}</span>)}</div>
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

        <Disclosure title="녹지 환경 참고 사례" description="공원 200m 이내 · 녹지 분위·놀이터·거리 기준 · 학교 종합평가가 아닙니다">
          <SectionTitle
            eyebrow="City Best"
            title="녹지비율이 높은 참고 학교"
            description="최근접 공원 200m 이내 학교를 녹지 분위 → 놀이터 유무 → 녹지비율 → 거리 순으로 비교합니다. 실제 보행 부담과 활동 규모는 별도 확인하세요."
          />
          <div className="mt-5">
            <BestSchoolCard school={data.cityBestSchool} label="인천 녹지 환경 참고 학교" />
          </div>
        </Disclosure>
      </section>

      <section className="panel space-y-5 p-6">
        <SectionTitle
          eyebrow="District Detail"
          title="우리 구에서는 어느 학교부터 검토할까"
          description="구를 고르고 검토 기준을 선택하세요. 같은 정책 분류 안에서도 놀이공간 부족과 학생 규모에 따라 순서가 달라집니다."
        />
        <div className="flex flex-wrap gap-2">
          {data.districts.map((district) => {
            const active = district.districtName === selectedDistrict?.districtName;
            return (
              <button
                key={district.districtName}
                aria-pressed={active}
                onClick={() => setSelectedDistrictName(district.districtName)}
                className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                  active
                    ? "border-forest-400/60 bg-forest-grad text-white shadow-glow"
                    : "border-white/15 bg-navy-900/95 text-slate-200 hover:bg-white/10"
                }`}
              >
                {district.districtName}
              </button>
            );
          })}
        </div>

        {selectedDistrict ? (
          <div className="grid gap-6">
            <div className="space-y-5">
              <Disclosure title={`${selectedDistrict.districtName} 수치와 비교 사례`} description="학교 수 · 수요 추정 · 평균 공원 거리 · 녹지">
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
              <BestSchoolCard school={selectedDistrict.bestSchool} label={`${selectedDistrict.districtName} 녹지 환경 참고 학교`} />
              </Disclosure>
            </div>

            <div className="rounded-2xl border border-white/10 bg-navy-850/95 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-forest-300">Top 5</p>
                  <h3 className="mt-1 text-2xl font-black tracking-tight text-white">
                    {selectedDistrict.districtName} 우선 지원 대상 최대 5개
                  </h3>
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
                            active
                              ? "bg-forest-grad text-white shadow-glow"
                              : "border border-white/15 bg-navy-900/95 text-slate-200 hover:bg-white/10"
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
                {selectedTopPrioritySchools.length ? selectedTopPrioritySchools.map((school) => (
                  <SchoolRow key={`${selectedDistrict.districtName}-${school.rank}-${school.schoolName}`} school={school} />
                )) : (
                  <div className="rounded-2xl border border-white/10 bg-navy-900/95 p-5 text-sm leading-6 text-slate-300">
                    이 구에는 현재 기준의 즉시 개선 대상 또는 우선 검토 대상 학교가 없습니다.
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </section>

      <Disclosure title="인천 전체 검토 목록과 미래 수요" description="즉시 개선 대상 전체 목록 · 구별 2029 수요 추정">
      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <div className="panel p-6">
          <SectionTitle
            eyebrow="City Case 1"
            title={`즉시 개선 대상 검토 순서 ${formatNumber(cityCase1Schools.length)}개교`}
            description="같은 즉시 개선 대상 안에서도 무엇을 먼저 볼지 선택할 수 있습니다. 놀이공간 부족을 우선할지, 현재 학생 규모를 우선할지 바로 비교해 볼 수 있습니다."
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
                    active
                      ? "bg-forest-grad text-white shadow-glow"
                      : "border border-white/15 bg-navy-900/95 text-slate-200 hover:bg-white/10"
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
          <SectionTitle
            eyebrow="City Mix"
            title="구별 2029 잠재 수요"
            description="구 단위 총 잠재 수요 규모를 막대로 비교해 전체 배분 흐름을 빠르게 볼 수 있습니다."
          />
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
      </Disclosure>
    </div>
  );
}
