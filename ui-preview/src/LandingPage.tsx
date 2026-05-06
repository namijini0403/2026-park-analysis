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
              <p className="text-base font-bold text-white">반경 너머, 도달 가능성으로</p>
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
              <span className="block">반경 너머,</span>
              <span className="block">도달 가능성으로</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-300 sm:text-lg">
              도보 네트워크·보행 부담·활동 가능 면적을 반영한 초등학교 야외활동 환경 진단 및
              <span className="font-semibold text-forest-300"> XAI 우선지원 의사결정 시스템</span>입니다.
              공식 공원 존재와 실제 활동공간 기능성을 분리해 정책 판단 근거를 보여줍니다.
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
            title="활동 가능 면적"
            description="공식 공원 여부를 부정하지 않고, 1,500㎡·10,000㎡ 법정 기준과 3,000㎡ 운영 기준으로 공간 기능성을 분리합니다."
            metric="3,000㎡는 분석상 운영 기준"
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
