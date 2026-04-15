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
  "즉시 개선 대상": "#dc2626",
  "우선 검토 대상": "#ea580c",
  "모니터링 대상": "#ca8a04",
  "유지·관리 대상": "#16a34a",
  "별도 정책 적용": "#64748b",
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("ko-KR").format(value);
}

function formatDecimal(value: number, digits = 1) {
  return new Intl.NumberFormat("ko-KR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
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
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{eyebrow}</p>
      <h2 className="text-2xl font-black tracking-tight text-slate-950">{title}</h2>
      {description ? <p className="max-w-3xl text-sm leading-6 text-slate-600">{description}</p> : null}
    </div>
  );
}

function SummaryCard({ title, value, helper }: { title: string; value: string; helper: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{title}</p>
      <p className="mt-3 text-4xl font-black tracking-tight text-slate-950">{value}</p>
      <p className="mt-2 text-sm text-slate-600">{helper}</p>
    </div>
  );
}

function SchoolRow({ school, compact = false }: { school: StatisticsSchoolItem; compact?: boolean }) {
  return (
    <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-[auto_1fr_auto] sm:items-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-sm font-black text-white">
        {school.rank}
      </div>
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-base font-bold text-slate-950">{school.schoolName}</p>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
            {school.districtName}
          </span>
          <span
            className="rounded-full px-2.5 py-1 text-[11px] font-bold text-white"
            style={{ backgroundColor: CASE_COLORS[school.casePolicyLabel] ?? "#64748b" }}
          >
            {school.casePolicyLabel}
          </span>
        </div>
        <p className="mt-1 text-sm text-slate-600">{school.caseStatusLabel}</p>
        {!compact ? (
          <div className="mt-3 flex flex-wrap gap-3 text-sm text-slate-600">
            <span>2029 {formatNumber(school.potentialDemand2029)}명</span>
            <span>2031 {formatNumber(school.potentialDemand2031)}명</span>
            <span>공원 {formatDecimal(school.nearestParkDistanceM, 1)}m</span>
            <span>녹지 {formatDecimal(school.greenRatio, 1)}%</span>
            <span>놀이터 {formatNumber(school.playgroundCount)}개</span>
          </div>
        ) : null}
      </div>
      <div className="rounded-2xl bg-slate-50 px-4 py-3 text-right">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">2029 잠재 수요</p>
        <p className="mt-1 text-2xl font-black tracking-tight text-slate-950">{formatNumber(school.potentialDemand2029)}명</p>
      </div>
    </div>
  );
}

function BestSchoolCard({ school, label }: { school: StatisticsSchoolItem; label: string }) {
  return (
    <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">{label}</p>
      <h3 className="mt-3 text-2xl font-black tracking-tight text-slate-950">{school.schoolName}</h3>
      <p className="mt-1 text-sm font-medium text-slate-600">{school.districtName} · {school.caseStatusLabel}</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-white/80 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">최근접 공원</p>
          <p className="mt-1 text-2xl font-black text-slate-950">{formatDecimal(school.nearestParkDistanceM, 1)}m</p>
        </div>
        <div className="rounded-2xl bg-white/80 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">녹지 비율</p>
          <p className="mt-1 text-2xl font-black text-slate-950">{formatDecimal(school.greenRatio, 1)}%</p>
        </div>
      </div>
    </div>
  );
}

export default function StatisticsPageSafe({ data }: StatisticsPageProps) {
  const [selectedDistrictName, setSelectedDistrictName] = useState(data.districts[0]?.districtName ?? "");
  const [chartMode, setChartMode] = useState<"pressure" | "cases">("pressure");

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

  return (
    <div className="mx-auto flex max-w-[1380px] flex-col gap-8 px-4 py-8 lg:px-8">
      <section className="space-y-5 rounded-[32px] border border-slate-200 bg-white p-7 shadow-sm">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Overview</p>
          <h1 className="text-4xl font-black tracking-tight text-slate-950 lg:text-5xl">인천 학교 전체 통계 리포트</h1>
          <p className="max-w-3xl text-base leading-7 text-slate-600">
            시 전체 우선 지원 흐름을 먼저 보고, 이어서 구별 상위 5개 학교와 각 구 최우수 학교 1개를 내려보는 구조의 통계 프리뷰입니다.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard title="전체 학교" value={`${formatNumber(data.summary.schoolCount)}개교`} helper={`${formatNumber(data.summary.districtCount)}개 구·군`} />
          <SummaryCard title="즉시 개선 대상" value={`${formatNumber(data.summary.urgentSupportCount)}개교`} helper="공원 접근 불가 중심" />
          <SummaryCard title="우선 검토 대상" value={`${formatNumber(data.summary.priorityReviewCount)}개교`} helper="공원 접근 가능 · 녹지 부족 포함" />
          <SummaryCard title="2029 잠재 수요" value={`${formatNumber(data.summary.totalPotentialDemand2029)}명`} helper={`2031 ${formatNumber(data.summary.totalPotentialDemand2031)}명`} />
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
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
                      ? "bg-slate-950 text-white"
                      : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
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
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: "#64748b" }} />
                  <YAxis dataKey="districtName" type="category" width={84} tick={{ fontSize: 12, fill: "#334155", fontWeight: 600 }} />
                  <Tooltip
                    cursor={{ fill: "#f8fafc" }}
                    formatter={(value: number, name: string) => {
                      if (name === "urgentSupportCount") return [`${formatNumber(value)}개교`, "즉시 개선"];
                      if (name === "priorityReviewCount") return [`${formatNumber(value)}개교`, "우선 검토"];
                      return [formatNumber(value), name];
                    }}
                  />
                  <Bar dataKey="urgentSupportCount" stackId="district" fill="#dc2626" radius={[6, 0, 0, 6]} />
                  <Bar dataKey="priorityReviewCount" stackId="district" fill="#f97316" radius={[0, 6, 6, 0]} />
                </BarChart>
              ) : (
                <BarChart data={districtCaseChartData} layout="vertical" margin={{ left: 8, right: 10, top: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: "#64748b" }} />
                  <YAxis dataKey="districtName" type="category" width={84} tick={{ fontSize: 12, fill: "#334155", fontWeight: 600 }} />
                  <Tooltip
                    cursor={{ fill: "#f8fafc" }}
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
                  <Bar dataKey="urgentSupportCount" stackId="district" fill="#dc2626" radius={[6, 0, 0, 6]} />
                  <Bar dataKey="priorityReviewCount" stackId="district" fill="#f97316" />
                  <Bar dataKey="monitoringCount" stackId="district" fill="#eab308" />
                  <Bar dataKey="maintainCount" stackId="district" fill="#16a34a" />
                  <Bar dataKey="specialPolicyCount" stackId="district" fill="#64748b" radius={[0, 6, 6, 0]} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
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

      <section className="space-y-5 rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
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
                    ? "border-slate-950 bg-slate-950 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
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

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Top 5</p>
                  <h3 className="mt-1 text-2xl font-black tracking-tight text-slate-950">
                    {selectedDistrict.districtName} 우선 지원 학교 상위 5개
                  </h3>
                </div>
                <div className="rounded-2xl bg-white px-4 py-3 text-right shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">구 총 잠재 수요</p>
                  <p className="mt-1 text-2xl font-black text-slate-950">{formatNumber(selectedDistrict.totalPotentialDemand2029)}명</p>
                </div>
              </div>
              <div className="mt-4 space-y-3">
                {selectedDistrict.topPrioritySchools.map((school) => (
                  <SchoolRow key={`${selectedDistrict.districtName}-${school.rank}-${school.schoolName}`} school={school} />
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
          <SectionTitle
            eyebrow="City Top 10"
            title="시 전체 우선 지원 학교 상위 10개"
            description="시 단위에서 가장 먼저 검토해야 하는 학교를 한 장에 모아 보여주는 영역입니다."
          />
          <div className="mt-5 space-y-3">
            {data.cityTopPrioritySchools.map((school) => (
              <SchoolRow key={`city-${school.rank}-${school.schoolName}`} school={school} compact />
            ))}
          </div>
        </div>

        <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
          <SectionTitle
            eyebrow="City Mix"
            title="구별 2029 잠재 수요"
            description="구 단위 총 잠재 수요 규모를 막대로 비교해 전체 배분 흐름을 빠르게 볼 수 있습니다."
          />
          <div className="mt-5 h-[560px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={districtChartData} margin={{ top: 8, right: 10, bottom: 40, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="districtName" angle={-35} textAnchor="end" height={72} tick={{ fontSize: 11, fill: "#64748b" }} />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
                <Tooltip formatter={(value: number) => [`${formatNumber(value)}명`, "2029 잠재 수요"]} />
                <Bar dataKey="totalPotentialDemand2029" radius={[8, 8, 0, 0]}>
                  {districtChartData.map((entry) => (
                    <Cell key={entry.districtName} fill={entry.districtName === selectedDistrict?.districtName ? "#0f172a" : "#94a3b8"} />
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
