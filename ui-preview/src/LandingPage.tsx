import { useState } from "react";
import guideMapLayers from "./assets/guide/guide-map-layers-bright.png";
import guideReport from "./assets/guide/guide-report-modal-bright.png";
import guideSimulation from "./assets/guide/guide-simulation-modal-bright.png";
import guideStatistics from "./assets/guide/guide-statistics-modal-bright.png";

type LandingPageProps = {
  onEnter: (view: "report" | "simulation" | "statistics") => void;
};

type FlowStep = {
  id: number;
  title: string;
  summary: string;
  detail: string;
  image: string;
  imageAlt: string;
  actionLabel: string;
  actionView: "report" | "simulation" | "statistics";
};

type GuideShot = {
  eyebrow: string;
  title: string;
  description: string;
  image: string;
  imageAlt: string;
  view: "report" | "simulation" | "statistics";
  imageClass?: string;
};

const flowSteps: FlowStep[] = [
  {
    id: 1,
    title: "학교 선택",
    summary: "분석할 학교를 고르면 주변 환경 정보가 연결됩니다.",
    detail:
      "지도에서 학교를 선택하면 도보 생활권, 직선 반경, 공원·놀이터, 재개발, 후보지 레이어가 같은 기준 좌표로 정렬됩니다.",
    image: guideMapLayers,
    imageAlt: "학교 선택 후 지도 레이어가 켜진 화면",
    actionLabel: "지도 레이어 보기",
    actionView: "report",
  },
  {
    id: 2,
    title: "실제 도보생활권",
    summary: "직선거리가 아니라 실제 보행 가능한 범위를 계산합니다.",
    detail:
      "case2처럼 겉으로는 접근 가능해 보이지만 녹지·활동 규모나 경로 조건을 함께 확인해야 하는 전형적 학교를 기준으로, 도보 500m 안의 실제 활동 환경을 먼저 읽습니다.",
    image: guideMapLayers,
    imageAlt: "case2 전형 학교 판단에 쓰는 지도 레이어 화면",
    actionLabel: "생활권 기준 확인",
    actionView: "report",
  },
  {
    id: 3,
    title: "환경 격차 진단",
    summary: "공원 거리, 녹지비율, 놀이터, 비교학교를 함께 봅니다.",
    detail:
      "상세 리포트는 현재 격차와 비교 기준을 분리해 보여줍니다. 정책 판단이 특정 숫자 하나에 묶이지 않도록 핵심 취약성, 시·구 기준, 유사학교 맥락을 같이 확인합니다.",
    image: guideReport,
    imageAlt: "대표 학교 상세 리포트 화면",
    actionLabel: "상세 리포트 열기",
    actionView: "report",
  },
  {
    id: 4,
    title: "미래 수요 반영",
    summary: "현재뿐 아니라 2029·2031년 잠재 수요를 함께 봅니다.",
    detail:
      "전체 통계 리포트에서 구별 격차와 잠재 수요 흐름을 확인합니다. 현재 부족 학교와 앞으로 수요가 커질 학교를 분리해 설명할 수 있습니다.",
    image: guideStatistics,
    imageAlt: "구조적 격차 분포와 전체 통계 화면",
    actionLabel: "전체 통계 보기",
    actionView: "statistics",
  },
  {
    id: 5,
    title: "AI 기반 견고 후보 추천",
    summary: "미래 수요, Pareto 후보군, 순위 안정성을 함께 봅니다.",
    detail:
      "후보지 추천은 자동 결정이 아니라 비교 시작점입니다. 후보 카드에서 Pareto 여부, Top5 안정성, 평균 순위, 추천 유형을 함께 확인합니다.",
    image: guideSimulation,
    imageAlt: "AI 기반 견고 후보 추천과 지도 중심 화면",
    actionLabel: "견고 추천 보기",
    actionView: "simulation",
  },
  {
    id: 6,
    title: "SHAP 진단과 기준 조정",
    summary: "예측 근거를 열어보고 정책 기준을 조정합니다.",
    detail:
      "SHAP 예측 근거 보기는 최종 추천 순위가 아니라 미래 수혜 아동 수 예측값의 변수별 근거를 보여줍니다. 사용자는 이 진단과 필터·가중치 변화를 함께 보며 현장 검토 대상을 좁힙니다.",
    image: guideSimulation,
    imageAlt: "SHAP 예측 근거와 기준 조정 화면",
    actionLabel: "SHAP 진단 열기",
    actionView: "simulation",
  },
];

const guideShots: GuideShot[] = [
  {
    eyebrow: "Representative School Report",
    title: "대표학교 상세 리포트",
    description:
      "학교별 현재 격차, 시·구 기준 해석, 유사학교 비교를 한 화면에서 검토합니다.",
    image: guideReport,
    imageAlt: "대표학교 상세 리포트 캡처",
    view: "report",
  },
  {
    eyebrow: "Candidate Recommendation",
    title: "견고 후보 추천과 SHAP 진단",
    description:
      "카드에서 Pareto 후보, Top5 안정성, 평균 순위를 확인하고 SHAP 예측 근거 보기로 미래 수요 예측 근거를 펼칩니다.",
    image: guideSimulation,
    imageAlt: "견고 후보 추천과 SHAP 진단 캡처",
    view: "simulation",
    imageClass: "object-[center_72%]",
  },
  {
    eyebrow: "Structural Gap View",
    title: "구조적 격차 분포 확인",
    description:
      "전체 학교의 case 분포와 잠재 수요 흐름을 확인해 지원 우선순위를 설명합니다.",
    image: guideStatistics,
    imageAlt: "구조적 격차 분포 확인 캡처",
    view: "statistics",
  },
];

export default function LandingPage({ onEnter }: LandingPageProps) {
  const [activeStepId, setActiveStepId] = useState(2);
  const logoSrc = `${import.meta.env.BASE_URL}logo.png`;
  const activeStep = flowSteps.find((step) => step.id === activeStepId) ?? flowSteps[1];

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-forest-400/30 to-transparent" />

      <div className="relative mx-auto flex max-w-[1280px] flex-col px-5 py-8 lg:px-8 lg:py-10">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/95 p-1.5 shadow-soft">
              <img src={logoSrc} alt="ParkLens" className="h-full w-full object-contain" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-forest-300">
                Interactive System Flowmap
              </p>
              <p className="text-base font-bold text-white">반경 너머, 도달 가능성으로</p>
            </div>
          </div>
          <div className="hidden flex-wrap gap-2 sm:flex">
            <button type="button" onClick={() => onEnter("report")} className="btn-primary">
              학교 진단
            </button>
            <button type="button" onClick={() => onEnter("simulation")} className="btn-ghost">
              시뮬레이션
            </button>
            <button type="button" onClick={() => onEnter("statistics")} className="btn-ghost">
              전체 통계
            </button>
          </div>
        </div>

        <section className="mt-8 grid gap-8 rounded-2xl border border-white/10 bg-navy-800/90 p-5 shadow-card lg:grid-cols-[0.84fr_1.16fr] lg:p-7">
          <div className="flex flex-col justify-between gap-8">
            <div>
              <span className="eyebrow">Policy Decision Support</span>
              <h1 className="mt-4 text-4xl font-black leading-[1.14] tracking-tight text-white sm:text-[46px] lg:text-[50px]">
                <span className="block">반경 너머,</span>
                <span className="block">도달 가능성으로</span>
              </h1>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-300 sm:text-lg">
                도보 네트워크·보행 부담·활동규모 기준을 반영해 초등학교 야외활동 환경을 진단하고,
                <span className="font-semibold text-forest-300"> 견고한 후보지와 SHAP 진단</span>을 제안합니다.
              </p>
            </div>

            <div className="rounded-2xl border border-forest-400/50 bg-navy-950/80 p-5 shadow-glow">
              <p className="text-[56px] font-black leading-none tracking-tight text-white">10.3%</p>
              <p className="mt-1 text-lg font-black text-forest-300">28 / 272개교</p>
              <p className="mt-4 max-w-sm text-sm font-semibold leading-relaxed text-slate-200">
                직선 500m 안에 공원이 잡혀도 실제 도보 500m 생활권에서는 공원이 0개인 학교가 있습니다.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {["실제 도보생활권", "활동규모 기준", "학교별 환경 진단", "견고 후보 추천", "SHAP 후보 진단", "Human-in-the-loop"].map((item) => (
                <span key={item} className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold text-slate-100">
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/10 bg-navy-950/80">
            <img
              src={guideMapLayers}
              alt="도보권 지도와 학교별 진단 패널"
              className="h-[360px] w-full object-cover object-center brightness-[1.04] saturate-[1.08] sm:h-[430px] lg:h-[500px]"
            />
            <div className="grid gap-3 border-t border-white/10 p-4 sm:grid-cols-5">
              <HeroMetric label="도보 생활권 공원" value="0개" />
              <HeroMetric label="직선 500m 공원" value="1개" />
              <HeroMetric label="놀이터" value="0개" />
              <HeroMetric label="녹지 비율" value="0%" />
              <HeroMetric label="우선 검토 점수" value="4" />
            </div>
          </div>
        </section>

        <section className="mt-10">
          <div className="flex flex-col justify-between gap-3 border-t border-white/10 pt-8 lg:flex-row lg:items-end">
            <div>
              <span className="eyebrow">Screen Guide</span>
              <h2 className="mt-2 text-2xl font-black text-white">주요 화면 사용 설명서</h2>
            </div>
            <p className="max-w-xl text-sm leading-relaxed text-slate-400">
              후보 카드는 Pareto 여부와 Top5 안정성을 먼저 보여주고, SHAP 버튼은 최종 추천이 아니라 미래 수요 예측 근거를 펼칩니다.
            </p>
          </div>

          <div className="mt-5 grid gap-6">
            {guideShots.map((shot) => (
              <article
                key={shot.title}
                className="grid overflow-hidden rounded-2xl border border-white/10 bg-card-grad shadow-card lg:grid-cols-[340px_minmax(0,1fr)]"
              >
                <div className="flex flex-col justify-between gap-5 p-5 lg:p-6">
                  <div>
                    <span className="eyebrow">{shot.eyebrow}</span>
                    <h3 className="mt-2 text-xl font-black text-white">{shot.title}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-slate-300">{shot.description}</p>
                  </div>
                  <button type="button" onClick={() => onEnter(shot.view)} className="btn-outline w-fit">
                    화면 열기
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => onEnter(shot.view)}
                  className="block w-full border-t border-white/10 bg-navy-950/55 p-4 text-left transition hover:bg-navy-900 lg:border-l lg:border-t-0"
                >
                  <img
                    src={shot.image}
                    alt={shot.imageAlt}
                    className={`h-[360px] w-full rounded-xl border border-white/10 bg-navy-900 object-contain brightness-[1.07] saturate-[1.08] sm:h-[480px] lg:h-[560px] ${shot.imageClass ?? ""}`}
                  />
                </button>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-12">
          <div className="grid gap-4 lg:grid-cols-[0.78fr_1.22fr] lg:items-end">
            <div>
              <span className="eyebrow">Policy Flow</span>
              <h2 className="mt-2 text-2xl font-black text-white">정책 판단 흐름도</h2>
            </div>
            <p className="text-sm leading-relaxed text-slate-400">
              각 단계를 누르면 아래에 판단 설명과 관련 화면 캡처가 함께 표시됩니다. case2 단계는 봉화초 단일 사례가 아니라 전형적 검토 학교 흐름으로 읽히도록 지도 레이어 화면을 붙였습니다.
            </p>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-6">
            {flowSteps.map((step) => {
              const active = step.id === activeStep.id;
              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => setActiveStepId(step.id)}
                  className={`min-h-[160px] rounded-2xl border p-4 text-left transition ${
                    active
                      ? "border-forest-400/70 bg-forest-500/95 text-white shadow-glow"
                      : "border-white/10 bg-white/95 text-slate-950 hover:border-forest-300/60 hover:bg-forest-50"
                  }`}
                >
                  <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-black ${active ? "bg-white/20 text-white" : "bg-forest-100 text-forest-800"}`}>
                    {String(step.id).padStart(2, "0")}
                  </span>
                  <h3 className="mt-4 text-base font-black">{step.title}</h3>
                  <p className={`mt-2 text-xs font-semibold leading-relaxed ${active ? "text-forest-50" : "text-slate-600"}`}>
                    {step.summary}
                  </p>
                </button>
              );
            })}
          </div>

          <div className="mt-5 grid overflow-hidden rounded-2xl border border-white/10 bg-navy-850/95 shadow-card lg:grid-cols-[0.82fr_1.18fr]">
            <div className="p-6 lg:p-7">
              <span className="inline-flex rounded-full border border-forest-400/45 bg-forest-500/10 px-3 py-1 text-xs font-black text-forest-200">
                STEP {String(activeStep.id).padStart(2, "0")}
              </span>
              <h3 className="mt-4 text-2xl font-black text-white">{activeStep.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-slate-300">{activeStep.detail}</p>
              <button type="button" onClick={() => onEnter(activeStep.actionView)} className="btn-outline mt-6">
                {activeStep.actionLabel}
              </button>
            </div>
            <div className="border-t border-white/10 bg-navy-950/70 p-4 lg:border-l lg:border-t-0">
              <img
                src={activeStep.image}
                alt={activeStep.imageAlt}
                className="h-[520px] w-full rounded-xl border border-white/10 bg-navy-900 object-contain brightness-[1.08] saturate-[1.08]"
              />
            </div>
          </div>
        </section>

        <p className="mt-12 text-center text-[11px] tracking-[0.24em] text-slate-500">
          DATA · 2026 인천 학생수 시계열 / Valhalla isochrone / 인천시 공원·놀이터 공공데이터 / OSM
        </p>
      </div>
    </div>
  );
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3">
      <p className="text-[11px] font-bold text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-black text-white">{value}</p>
    </div>
  );
}
