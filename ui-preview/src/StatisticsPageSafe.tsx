import { useMemo, useState } from "react";
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
      <p className="mt-1 text-sm font-medium text-slate-300">{school.districtName} · {school.caseStatusLabel}</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-navy-900/95 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">최근접 공원</p>
          <p className="mt-1 text-2xl font-black text-white">{formatDecimal(school.nearestParkDistanceM, 1)}m</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-navy-900/95 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">녹지 비율</p>
          <p className="mt-1 text-2xl font-black text-white">{formatDecimal(school.greenRatio, 1)}%</p>
        </div>
      </div>
    </div>
  );
}

export default function StatisticsPageSafe({ data }: StatisticsPageProps) {
  const [selectedDistrictName, setSelectedDistrictName] = useState(data.districts[0]?.districtName ?? "");
  const [chartMode, setChartMode] = useState<"pressure" | "cases">("pressure");
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
    () => rerankSchools((selectedDistrict?.topPrioritySchools ?? []).filter(isSupportPrioritySchool)),
    [selectedDistrict]
  );

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

  return (
    <div className="mx-auto flex max-w-[1380px] flex-col gap-8 px-4 py-8 lg:px-8">
      <section className="panel space-y-5 p-7">
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-forest-300">Overview</p>
          <h1 className="text-4xl font-black tracking-tight text-white lg:text-5xl">인천 학교 전체 통계 리포트</h1>
          <p className="max-w-3xl text-base leading-7 text-slate-300">
            시 전체 우선 지원 흐름을 먼저 보고, 이어서 구별 상위 5개 학교와 각 구 최우수 학교 1개를 내려보는 구조의 통계 프리뷰입니다.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard title="전체 학교" value={`${formatNumber(data.summary.schoolCount)}개교`} helper={`${formatNumber(data.summary.districtCount)}개 구·군 · 별도 ${formatNumber(data.summary.separateBundleCount)}개`} />
          <SummaryCard title="즉시 개선 대상" value={`${formatNumber(data.summary.case1Count)}개교`} helper={`case2 ${formatNumber(data.summary.case2Count)} · case3 ${formatNumber(data.summary.case3Count)} · case4 ${formatNumber(data.summary.case4Count)}`} />
          <SummaryCard title="우선 검토 대상" value={`${formatNumber(data.summary.priorityReviewCount)}개교`} helper="공원 접근 가능 · 녹지 부족 포함" />
          <SummaryCard title="2029 잠재 수요" value={`${formatNumber(data.summary.totalPotentialDemand2029)}명`} helper={`단지보정 후보 ${formatNumber(data.summary.apartmentAdjustmentCandidateCount)}개교`} />
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
          <SectionTitle
            eyebrow="City Best"
            title="시 전체 최우수 학교"
            description="생활환경 벤치마크 역할을 하는 학교 1개를 따로 떼어 보여줍니다."
          />
          <div className="mt-5">
            <BestSchoolCard school={data.cityBestSchool} label="인천시 최우수 학교" />
          </div>
        </div>
      </section>

      <section className="panel space-y-5 p-6">
        <SectionTitle
          eyebrow="District Detail"
          title="구별 상세 통계"
          description="구를 선택하면 해당 구의 전체 지표와 우선 지원 학교 Top 5, 구 최우수 학교 1개를 함께 확인할 수 있습니다."
        />
        <div className="flex flex-wrap gap-2">
          {data.districts.map((district) => {
            const active = district.districtName === selectedDistrict?.districtName;
            return (
              <button
                key={district.districtName}
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
                  helper={`평균 녹지 ${formatDecimal(selectedDistrict.avgGreenRatio, 1)}%`}
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
                  <h3 className="mt-1 text-2xl font-black tracking-tight text-white">
                    {selectedDistrict.districtName} 우선 지원 대상 최대 5개
                  </h3>
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
              { key: "students", label: "학생 규모 우선" },
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
    </div>
  );
}
