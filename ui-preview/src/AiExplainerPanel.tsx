import { useMemo, useState } from "react";

type QuestionType =
  | "case_reason"
  | "candidate_reason"
  | "shap_interpretation"
  | "policy_check"
  | "limitations";

type EvidenceItem = {
  label: string;
  value: string;
  chunk_id: string;
};

type AiExplainerResponse = {
  answerable: boolean;
  summary: string | null;
  evidence: EvidenceItem[];
  interpretation: string | null;
  limitations: string | null;
  cannot_answer_reason: string | null;
  cited_chunk_ids: string[];
};

type SchoolContext = {
  school_name: string;
  district_name?: string;
  case_label?: string;
  case_status_label?: string;
  nearest_park_distance_m?: number;
  nearest_park_name?: string;
  green_ratio?: number;
  playground_count?: number;
  potential_demand_2029?: number;
  potential_demand_2031?: number;
};

type CandidateContext = {
  grid_id: string;
  candidate_label?: string;
  nearest_school_distance_m?: number;
  nearest_park_distance_m?: number;
  nearest_playground_distance_m?: number;
  walkshed_potential_2029?: number;
  walkshed_potential_2031?: number;
  resident_children_2029?: number;
  resident_children_2031?: number;
  final_score?: number;
  pareto_candidate?: boolean;
  top5_stability_score?: number;
  mean_rank?: number;
  recommendation_type?: string | null;
  shap_diagnostic_tag?: string | null;
  shap_explanation_text?: string | null;
  barrier_summary?: string;
  barrier_note?: string;
};

type Preset = {
  id: string;
  label: string;
  question: string;
  type: QuestionType;
  requiresCandidate?: boolean;
};

const PRESETS: Preset[] = [
  {
    id: "case_reason",
    label: "Case 판정 이유",
    question: "이 학교의 Case 판정 이유를 근거 지표 중심으로 설명해 주세요.",
    type: "case_reason",
  },
  {
    id: "candidate_reason",
    label: "후보지 추천 이유",
    question: "선택 후보지가 왜 검토 후보인지 수요, 접근성, 보행부담 기준으로 설명해 주세요.",
    type: "candidate_reason",
    requiresCandidate: true,
  },
  {
    id: "shap",
    label: "SHAP 해석",
    question: "선택 후보지의 SHAP 진단은 어떻게 해석해야 하나요?",
    type: "shap_interpretation",
    requiresCandidate: true,
  },
  {
    id: "policy_check",
    label: "정책 담당자 확인사항",
    question: "정책 담당자가 현장에서 추가로 확인해야 할 사항을 정리해 주세요.",
    type: "policy_check",
  },
  {
    id: "limitations",
    label: "한계와 주의점",
    question: "이 해석을 사용할 때 주의해야 할 한계를 설명해 주세요.",
    type: "limitations",
  },
];

function isEnabled() {
  return import.meta.env.VITE_AI_EXPLAINER_ENABLED === "true";
}

function isDisplayable(response: AiExplainerResponse) {
  if (!response.answerable) return true;
  return response.evidence.length > 0 && response.cited_chunk_ids.length > 0;
}

export default function AiExplainerPanel({
  schoolContext,
  candidateContext = null,
  title = "AI 근거 해설",
  description = "선택된 학교·후보지 지표와 봉인된 근거 문서 안에서만 답변합니다.",
}: {
  schoolContext: SchoolContext;
  candidateContext?: CandidateContext | null;
  title?: string;
  description?: string;
}) {
  const [customQuestion, setCustomQuestion] = useState("");
  const [response, setResponse] = useState<AiExplainerResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const presets = useMemo(
    () => PRESETS.filter((preset) => !preset.requiresCandidate || candidateContext),
    [candidateContext],
  );

  if (!isEnabled()) return null;

  async function ask(question: string, questionType: QuestionType, loadingKey: string) {
    const trimmed = question.trim();
    if (!trimmed) return;
    setError(null);
    setResponse(null);
    setLoadingId(loadingKey);

    try {
      const res = await fetch("/api/ai-explainer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "identified_school_explainer",
          question: trimmed,
          question_type: questionType,
          school_context: schoolContext,
          candidate_context: candidateContext,
        }),
      });
      const data = (await res.json()) as AiExplainerResponse;
      if (!isDisplayable(data)) {
        setError("근거 chunk가 없는 답변은 표시하지 않았습니다.");
        return;
      }
      setResponse(data);
    } catch {
      setError("AI 해설을 불러오지 못했습니다.");
    } finally {
      setLoadingId(null);
    }
  }

  const askCustom = () => {
    const type: QuestionType = candidateContext ? "candidate_reason" : "case_reason";
    void ask(customQuestion, type, "custom");
  };

  return (
    <section className="space-y-4">
      <div className="rounded-3xl border border-white/10 bg-navy-900/95 p-5 shadow-2xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-forest-300">RAG Explainer</p>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-white">{title}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">{description}</p>
          </div>
          <span className="inline-flex w-fit rounded-full border border-forest-400/40 bg-forest-500/15 px-3 py-1 text-xs font-semibold text-forest-200">
            cited chunk 필수
          </span>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {presets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => void ask(preset.question, preset.type, preset.id)}
              disabled={loadingId !== null}
              className="rounded-full border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loadingId === preset.id ? "생성 중..." : preset.label}
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            value={customQuestion}
            onChange={(event) => setCustomQuestion(event.target.value.slice(0, 180))}
            onKeyDown={(event) => {
              if (event.key === "Enter") askCustom();
            }}
            placeholder="짧은 질문 입력"
            className="min-h-11 flex-1 rounded-2xl border border-white/15 bg-navy-850/95 px-4 py-2 text-sm text-white outline-none placeholder:text-slate-500 focus:border-forest-300/70"
          />
          <button
            type="button"
            onClick={askCustom}
            disabled={loadingId !== null || customQuestion.trim().length === 0}
            className="rounded-2xl bg-forest-grad px-5 py-2 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loadingId === "custom" ? "생성 중..." : "질문"}
          </button>
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm font-medium text-rose-100">
            {error}
          </div>
        ) : null}

        {response ? (
          <div className="mt-5 space-y-3">
            {!response.answerable ? (
              <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm font-medium text-amber-100">
                {response.cannot_answer_reason ?? "제공된 근거 문서 안에서 확인할 수 없습니다."}
              </div>
            ) : (
              <>
                <ExplainerBlock title="요약">{response.summary}</ExplainerBlock>
                <div className="rounded-2xl border border-white/10 bg-navy-850/95 p-4">
                  <p className="text-sm font-bold text-white">근거</p>
                  <div className="mt-3 grid gap-2">
                    {response.evidence.map((item) => (
                      <div key={`${item.chunk_id}-${item.label}`} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold text-forest-200">{item.label}</span>
                          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-slate-300">
                            {item.chunk_id}
                          </span>
                        </div>
                        <p className="mt-1 text-sm leading-6 text-slate-200">{item.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <ExplainerBlock title="해석">{response.interpretation}</ExplainerBlock>
                <ExplainerBlock title="주의사항">{response.limitations}</ExplainerBlock>
                <details className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-300">
                  <summary className="cursor-pointer font-bold text-slate-100">출처 chunk</summary>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {response.cited_chunk_ids.map((chunkId) => (
                      <span key={chunkId} className="rounded-full bg-white/10 px-2 py-1 text-xs font-semibold">
                        {chunkId}
                      </span>
                    ))}
                  </div>
                </details>
              </>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function ExplainerBlock({ title, children }: { title: string; children: string | null }) {
  if (!children) return null;
  return (
    <div className="rounded-2xl border border-white/10 bg-navy-850/95 p-4">
      <p className="text-sm font-bold text-white">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-200">{children}</p>
    </div>
  );
}
