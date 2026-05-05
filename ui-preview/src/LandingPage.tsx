type LandingPageProps = {
  onEnter: (view: "report" | "simulation" | "statistics") => void;
};

export default function LandingPage({ onEnter }: LandingPageProps) {
  const logoSrc = `${import.meta.env.BASE_URL}logo.png`;

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-forest-400/30 to-transparent" />

      <div className="relative mx-auto flex max-w-[1180px] flex-col px-6 py-10 lg:px-10 lg:py-14">
        {/* Top brand bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/95 p-1.5 shadow-soft">
              <img src={logoSrc} alt="ParkLens" className="h-full w-full object-contain" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-forest-300">
                Incheon Outdoor-Access Lens
              </p>
              <p className="text-base font-bold text-white">ParkLens · 인천 초등 야외활동 환경 분석</p>
            </div>
          </div>
          <span className="hidden rounded-full border border-white/15 bg-navy-850/95 px-3 py-1.5 text-[11px] font-semibold tracking-wide text-slate-200 lg:inline-flex">
            v2026.05 · 발표 데모
          </span>
        </div>

        {/* Hero */}
        <section className="mt-12 grid items-center gap-12 lg:mt-16 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <span className="eyebrow">Policy Decision Support</span>
            <h1 className="mt-4 text-4xl font-black leading-[1.15] tracking-tight text-white sm:text-5xl lg:text-[56px]">
              <span className="block">"걸어서 갈 수 있는</span>
              <span className="block">
                공원<span className="text-forest-300">,</span> 데이터로 다시 보다."
              </span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-300 sm:text-lg">
              인천 272개 초등학교의 야외활동 환경을
              <span className="font-semibold text-white"> 직선 500m</span>가 아니라
              <span className="font-semibold text-forest-300"> 실제 도보 500m</span>로 다시 측정합니다.
              임의 종합점수 대신 <span className="font-semibold text-white">분류·필터·시뮬레이션</span>으로
              정책 의사결정을 설명가능하게 지원하는 웹 시스템입니다.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <button onClick={() => onEnter("report")} className="btn-primary">
                학교 상세 리포트 열기
                <span aria-hidden>→</span>
              </button>
              <button onClick={() => onEnter("simulation")} className="btn-outline">
                후보지 시뮬레이션
              </button>
              <button onClick={() => onEnter("statistics")} className="btn-ghost">
                전체 통계
              </button>
            </div>

            <div className="mt-10 grid grid-cols-3 gap-3 sm:max-w-md">
              <Stat value="272" unit="개교" label="분석 대상" />
              <Stat value="40.16" unit="%" label="도보/직선 면적비" tone="forest" />
              <Stat value="115" unit="개교" label="행정 착시" tone="amber" />
            </div>
          </div>

          {/* Logo emblem */}
          <div className="relative mx-auto w-full max-w-md">
            <div className="absolute inset-x-10 inset-y-6 -z-10 rounded-[32px] bg-navy-800/40 opacity-70" />
            <div className="relative rounded-[36px] border border-white/10 bg-card-grad p-8 shadow-card">
              <div className="absolute inset-x-8 -top-px h-px bg-gradient-to-r from-transparent via-forest-400/60 to-transparent" />
              <div className="mx-auto flex h-56 w-56 items-center justify-center rounded-full bg-white/95 p-6 shadow-soft sm:h-64 sm:w-64">
                <img src={logoSrc} alt="ParkLens emblem" className="h-full w-full object-contain" />
              </div>
              <div className="mt-6 text-center">
                <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-forest-300">
                  Walkable. Equitable. Explainable.
                </p>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">
                  학교에서 출발하는 보행권 분석으로, 정책의 사각지대를 가시화합니다.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Three pillars */}
        <section className="mt-16 grid gap-4 lg:grid-cols-3">
          <Pillar
            tag="Pillar 1"
            title="도보 500m 측정"
            description="Valhalla isochrone으로 학교에서 실제 걸어 도달 가능한 권역을 산출. 직선 500m와 비교하면 평균 면적 60% 이상 줄어듭니다."
            metric="평균 도보/직선 = 40.16%"
          />
          <Pillar
            tag="Pillar 2"
            title="설명가능한 분류"
            description="case 1~4 + 별도묶음. 4개 변수의 명시적 임계 규칙으로 분류하고, 같은 case 내부는 사전식 우선순위로만 정렬합니다."
            metric="case1 17 · case2 68 · case3 77 · case4 80"
          />
          <Pillar
            tag="Pillar 3"
            title="사용자 조정 시뮬"
            description="단절요소는 점수 감점이 아닌 필터로. AI 추천은 시작점일 뿐, 사용자가 슬라이더로 즉시 재계산합니다."
            metric="Human-in-the-loop"
          />
        </section>

        <p className="mt-12 text-center text-[11px] tracking-[0.24em] text-slate-500">
          DATA · 2026 인천 학생수 시계열 / Valhalla isochrone / 인천시 공원·놀이터 공공데이터 / OSM
        </p>
      </div>
    </div>
  );
}

function Stat({
  value,
  unit,
  label,
  tone = "white",
}: {
  value: string;
  unit: string;
  label: string;
  tone?: "white" | "forest" | "amber";
}) {
  const toneClass =
    tone === "forest"
      ? "text-forest-300"
      : tone === "amber"
      ? "text-signal-warn"
      : "text-white";
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3">
      <p className={`text-2xl font-extrabold tracking-tight ${toneClass}`}>
        {value}
        <span className="ml-0.5 text-sm font-bold text-slate-300">{unit}</span>
      </p>
      <p className="mt-1 text-[11px] font-semibold tracking-wide text-slate-400">{label}</p>
    </div>
  );
}

function Pillar({
  tag,
  title,
  description,
  metric,
}: {
  tag: string;
  title: string;
  description: string;
  metric: string;
}) {
  return (
    <div className="panel accent-forest p-6">
      <span className="eyebrow">{tag}</span>
      <h3 className="mt-2 text-xl font-bold text-white">{title}</h3>
      <p className="mt-3 text-sm leading-relaxed text-slate-300">{description}</p>
      <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-forest-500/40 bg-forest-700/25 px-3 py-1.5 text-[11px] font-semibold text-forest-200">
        {metric}
      </div>
    </div>
  );
}
