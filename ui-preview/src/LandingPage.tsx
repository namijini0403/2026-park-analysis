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
    title: "학교 선택(정책 단위)",
    summary: "정책이 닿아야 할 단위인 학교를 먼저 고릅니다.",
    detail:
      "정책 도달성은 인천 272개 초등학교를 단위로 진단합니다. 지도에서 학교를 선택하면 도보 도달권, 직선 반경, 공원·놀이터, 도서관, 재개발, 후보지 레이어가 같은 기준 좌표로 정렬됩니다.",
    image: guideMapLayers,
    imageAlt: "학교 선택 후 지도 레이어가 켜진 화면",
    actionLabel: "지도 레이어 보기",
    actionView: "report",
  },
  {
    id: 2,
    title: "실제 도보 도달권(외부 접근성)",
    summary: "직선 반경이 아니라 보행 네트워크로 도달권을 계산합니다.",
    detail:
      "외부 접근성은 OSM 보행 네트워크를 따라 계산한 도보 500m 도달권으로 봅니다. 직선 반경에서는 닿는 것처럼 보여도 실제 보행 경로로는 닿지 않는 학교가 있어, 두 기준을 같이 표시해 차이를 먼저 확인합니다.",
    image: guideMapLayers,
    imageAlt: "도보 도달권과 직선 반경을 비교하는 지도 레이어 화면",
    actionLabel: "도달권 기준 확인",
    actionView: "report",
  },
  {
    id: 3,
    title: "외부 접근성 × 내부 공급 격차 진단",
    summary: "학교 밖 도달 자원과 학교 안 공급을 함께 봅니다.",
    detail:
      "상세 리포트는 학교 밖 도달 자원(공원·녹지, 공공도서관 252관)과 학교 안 공급(학교도서관 장서·사서 등)을 분리해 보여줍니다. 정책 판단이 특정 숫자 하나에 묶이지 않도록 핵심 취약성, 시·구 기준, 유사학교(KNN k=4) 맥락을 같이 확인합니다.",
    image: guideReport,
    imageAlt: "대표 학교 상세 리포트 화면",
    actionLabel: "상세 리포트 열기",
    actionView: "report",
  },
  {
    id: 4,
    title: "미래 수요 반영",
    summary: "현재 학생 수와 2029·2031년 수요를 함께 봅니다.",
    detail:
      "수요 축은 학교 재학생 전망(가중 추세 + LightGBM 잔차 보정)과 250m 격자 아동 수요(cohort + Prophet + LightGBM)를 분리해 봅니다. 전체 통계에서 지금 부족한 학교와 앞으로 수요가 커질 학교를 나눠 설명할 수 있습니다.",
    image: guideStatistics,
    imageAlt: "도달성 격차 분포와 전체 통계 화면",
    actionLabel: "전체 통계 보기",
    actionView: "statistics",
  },
  {
    id: 5,
    title: "정책 행동 카드와 견고 후보",
    summary: "행동 카드와 견고 후보지를 사람이 확인하고 조정합니다.",
    detail:
      "진단은 7가지 정책 행동 유형을 바탕으로 우선 검토안 1개, 조건부 대안 1개, 핵심 근거 3개, 전환조건으로 이어집니다. 후보지 추천은 자동 결정이 아니라 비교 시작점이며, Pareto 여부·Top5 안정성·평균 순위를 함께 보고 담당자가 기준을 조정합니다.",
    image: guideSimulation,
    imageAlt: "정책 행동 카드와 견고 후보 추천 화면",
    actionLabel: "행동 카드·견고 추천 보기",
    actionView: "simulation",
  },
  {
    id: 6,
    title: "SHAP 근거와 기준 조정",
    summary: "후보지별 예측 근거를 열어보고 정책 기준을 조정합니다.",
    detail:
      "SHAP 후보 근거 보기는 최종 추천 순위나 학교 단위 미래수요 예측이 아니라, 후보지별 예상 수혜 아동 수를 높이거나 낮춘 변수별 근거를 보여줍니다. 담당자는 이 진단과 필터·가중치 변화를 함께 보며 현장 검토 대상을 좁힙니다.",
    image: guideSimulation,
    imageAlt: "SHAP 후보 근거와 기준 조정 화면",
    actionLabel: "SHAP 후보 진단 열기",
    actionView: "simulation",
  },
];

const guideShots: GuideShot[] = [
  {
    eyebrow: "School Reachability Report",
    title: "학교별 정책 도달성 리포트",
    description:
      "외부 접근성(도보 도달권 공원·도서관), 내부 공급(학교 안 자원), 수요를 한 화면에서 검토하고 시·구 기준과 유사학교 비교로 맥락을 확인합니다.",
    image: guideReport,
    imageAlt: "학교별 정책 도달성 리포트 캡처",
    view: "report",
  },
  {
    eyebrow: "Candidate Recommendation",
    title: "견고 후보 추천과 SHAP 후보 진단",
    description:
      "카드에서 Pareto 후보, Top5 안정성, 평균 순위를 확인하고 SHAP 후보 근거 보기로 후보지별 예상 수혜 아동 수의 설명 근거를 펼칩니다.",
    image: guideSimulation,
    imageAlt: "견고 후보 추천과 SHAP 후보 진단 캡처",
    view: "simulation",
    imageClass: "object-[center_72%]",
  },
  {
    eyebrow: "Reachability Gap View",
    title: "도달성 격차 분포 확인",
    description:
      "전체 학교의 case 분포와 미래 수요 흐름을 확인해 어디부터 정책이 닿아야 하는지 설명합니다.",
    image: guideStatistics,
    imageAlt: "도달성 격차 분포 확인 캡처",
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
              <img src={logoSrc} alt="반경 너머, 정책 도달성으로" className="h-full w-full object-contain" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-forest-300">
                Interactive System Flowmap
              </p>
              <p className="text-base font-bold text-white">반경 너머, 정책 도달성으로</p>
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
                <span className="block">정책 도달성으로</span>
              </h1>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-300 sm:text-lg">
                외부 접근성(도보 네트워크 기준 도달권) × 내부 공급(학교 안 자원) × 수요(현재·미래 학생 수)를 학교 단위로 함께 보아 정책이 실제로 아이에게 닿는지 진단하고,
                <span className="font-semibold text-forest-300"> 설명 가능한 정책 행동 카드와 견고 후보</span>로 연결합니다.
              </p>
            </div>

            <div className="rounded-2xl border border-forest-400/50 bg-navy-950/80 p-5 shadow-glow">
              <p className="text-[56px] font-black leading-none tracking-tight text-white">10.3%</p>
              <p className="mt-1 text-lg font-black text-forest-300">28 / 272개교</p>
              <p className="mt-4 max-w-sm text-sm font-semibold leading-relaxed text-slate-200">
                직선 500m 안에 공원이 잡혀도 실제 도보 500m 도달권에서는 공원이 0개인 학교가 있습니다.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {["외부 접근성", "내부 공급", "현재·미래 수요", "정책 행동 카드", "SHAP 후보 진단", "Human-in-the-loop"].map((item) => (
                <span key={item} className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold text-slate-100">
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/10 bg-navy-950/80">
            <img
              src={guideMapLayers}
              alt="도보 도달권 지도와 학교별 정책 도달성 진단 패널"
              className="h-[360px] w-full object-cover object-center brightness-[1.04] saturate-[1.08] sm:h-[430px] lg:h-[500px]"
            />
            <div className="grid gap-3 border-t border-white/10 p-4 sm:grid-cols-5">
              <HeroMetric label="도보 도달권 공원" value="0개" />
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
              세 화면은 외부 접근성·내부 공급·수요를 각각 다른 각도에서 보여줍니다. 후보 카드는 Pareto 여부와 Top5 안정성을 먼저 보여주고, SHAP 버튼은 최종 추천이 아니라 후보지별 예상 수혜 아동 수의 설명 근거를 펼칩니다.
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
              <span className="eyebrow">Policy Reachability Flow</span>
              <h2 className="mt-2 text-2xl font-black text-white">정책 도달성 판단 흐름도</h2>
            </div>
            <p className="text-sm leading-relaxed text-slate-400">
              학교 선택 → 외부 접근성 → 내부 공급 → 수요 → 행동 카드 → 근거 확인 순서로, 정책이 학교에 닿기까지의 경로를 따라 읽는 흐름입니다. 각 단계를 누르면 아래에 판단 설명과 관련 화면 캡처가 함께 표시됩니다.
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

        <p className="mx-auto mt-12 max-w-3xl text-center text-sm leading-relaxed text-slate-400">
          진단 근거는 고정된 스냅샷이 아닙니다. 학교 맥락 레이어(지정·연구학교 명단, 유흥·단란주점 인허가 관측치, 공사장 행정기록)는 참고용 맥락으로 함께 두고, 공공데이터 업데이트 센터가 변경 감지 → 품질검사 → 담당자 승인 → 버전 반영·롤백 절차로 근거를 최신 상태로 유지합니다.
        </p>

        <p className="mt-6 text-center text-[11px] tracking-[0.24em] text-slate-500">
          DATA · 2026 인천 학생수 시계열 / OSM 보행 네트워크 도보 도달권 / 인천시 공원·놀이터 공공데이터 / 전국 도서관 표준데이터
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
