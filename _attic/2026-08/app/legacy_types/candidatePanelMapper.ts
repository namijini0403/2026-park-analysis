import type {
  CandidatePanelResponse,
  ExternalGridCandidatePanel,
  LandFeasibilityLevel,
  LinkedSchoolSummary,
  SchoolInternalCandidatePanel
} from "../types/candidatePanel";
import type {
  BadgeItem,
  BadgeTone,
  CandidatePanelViewModel,
  ExplanationSectionView,
  InfoCard,
  LabeledValue,
  LinkedSchoolListItem,
  LinkedSchoolSectionView,
  StrategySectionView,
  WarningFlag
} from "../types/candidatePanelView";

const CANDIDATE_TYPE_LABELS = {
  external_grid: "외부 후보지",
  school_internal: "학교 내부 대안"
} as const;

const LAND_FEASIBILITY_LABELS: Record<LandFeasibilityLevel, string> = {
  high: "실행 가능성 높음",
  medium: "현장 검토 필요",
  low: "외부 설치 어려움"
};

const LAND_FEASIBILITY_TONES: Record<LandFeasibilityLevel, BadgeTone> = {
  high: "positive",
  medium: "warning",
  low: "danger"
};

const DEFAULT_EMPTY_TAGS_MESSAGE = "설명 태그 없음";
const DEFAULT_EMPTY_LINKED_SCHOOLS_MESSAGE = "도보 500m 내 학교 정보 없음";
const DEFAULT_NO_SECONDARY_OPTION = "보조 대안 없음";

function formatNumber(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "정보 없음";
  const hasFraction = Math.abs(value % 1) > 0;
  return value.toLocaleString("ko-KR", {
    maximumFractionDigits: hasFraction ? 1 : 0,
    minimumFractionDigits: 0
  });
}

function formatPotentialDemand(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "추정값 없음";
  return formatNumber(value);
}

function formatDistanceMeters(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "정보 없음";
  return `${formatNumber(value)}m`;
}

function formatCount(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "정보 없음";
  return formatNumber(value);
}

function formatBooleanLabel(value: boolean | null, truthyLabel: string, falsyLabel: string): string {
  if (value === null) return "정보 없음";
  return value ? truthyLabel : falsyLabel;
}

function getCandidateTypeLabel(type: CandidatePanelResponse["candidate_meta"]["candidate_type"]): string {
  return CANDIDATE_TYPE_LABELS[type];
}

function getLandFeasibilityLabel(level: LandFeasibilityLevel | null): string {
  if (!level) return "실행 가능성 정보 없음";
  return LAND_FEASIBILITY_LABELS[level];
}

function getLandFeasibilityTone(level: LandFeasibilityLevel | null): BadgeTone {
  if (!level) return "neutral";
  return LAND_FEASIBILITY_TONES[level];
}

function buildLinkedSchoolItems(schools: LinkedSchoolSummary[]): LinkedSchoolListItem[] {
  return schools.map((school) => ({
    school_id: school.school_id,
    school_name: school.school_name,
    display_name: school.school_name || school.school_id,
    case_label: school.case_label
  }));
}

function buildLinkedSchoolSection(
  linkedSchoolCount: number,
  linkedSchoolNames: string[],
  linkedSchoolIds: string[],
  schools: LinkedSchoolSummary[]
): LinkedSchoolSectionView {
  const resolvedNames = linkedSchoolNames.length ? linkedSchoolNames : linkedSchoolIds;
  const items = buildLinkedSchoolItems(schools);

  return {
    title: "도보 500m 내 학교",
    count_label: `도보 500m 내 학교 ${linkedSchoolCount}개`,
    names: resolvedNames,
    ids: linkedSchoolIds,
    items,
    empty_message: linkedSchoolCount > 0 ? null : DEFAULT_EMPTY_LINKED_SCHOOLS_MESSAGE
  };
}

function buildStrategySection(
  primaryRecommendation: string,
  secondaryOption: string | null
): StrategySectionView {
  return {
    title: "설치 전략 제안",
    primary_label: "우선 권장",
    primary_value: primaryRecommendation,
    secondary_label: "보조 대안",
    secondary_value: secondaryOption,
    secondary_visible: Boolean(secondaryOption)
  };
}

function buildExplanationSection(
  summary: string,
  tags: string[],
  note: string | null
): ExplanationSectionView {
  return {
    title: "판단 근거",
    summary,
    tags,
    note,
    tags_visible: tags.length > 0
  };
}

function buildWarningFlags(
  requiresFieldReview: boolean,
  landFeasibilityLevel: LandFeasibilityLevel | null
): WarningFlag[] {
  const warnings: WarningFlag[] = [];

  if (requiresFieldReview) {
    warnings.push({
      key: "requires_field_review",
      label: "현장 검토 필요",
      tone: "warning"
    });
  }

  if (landFeasibilityLevel === "low") {
    warnings.push({
      key: "external_low_feasibility",
      label: "외부 설치 어려움",
      tone: "danger"
    });
  }

  return warnings;
}

function mapExternalBadges(panel: ExternalGridCandidatePanel): BadgeItem[] {
  return [
    {
      key: "candidate_type",
      label: getCandidateTypeLabel(panel.candidate_meta.candidate_type),
      tone: "info"
    },
    {
      key: "land_feasibility_level",
      label: getLandFeasibilityLabel(panel.accessibility_summary.land_feasibility_level),
      tone: getLandFeasibilityTone(panel.accessibility_summary.land_feasibility_level)
    }
  ];
}

function mapInternalBadges(panel: SchoolInternalCandidatePanel): BadgeItem[] {
  const badges: BadgeItem[] = [
    {
      key: "candidate_type",
      label: getCandidateTypeLabel(panel.candidate_meta.candidate_type),
      tone: "info"
    }
  ];

  if (panel.ui_flags.requires_field_review) {
    badges.push({
      key: "requires_field_review",
      label: "현장 검토 필요",
      tone: "warning"
    });
  }

  return badges;
}

function mapExternalDemandCards(panel: ExternalGridCandidatePanel): InfoCard[] {
  if (!panel.ui_flags.show_demand_cards) return [];

  return [
    {
      key: "predicted_2029",
      label: "2029 잠재 수요",
      value: formatPotentialDemand(panel.demand_summary.predicted_2029),
      note: panel.demand_summary.demand_note
    },
    {
      key: "predicted_2031",
      label: "2031 잠재 수요",
      value: formatPotentialDemand(panel.demand_summary.predicted_2031),
      note: panel.demand_summary.demand_note
    }
  ];
}

function mapInternalDemandCards(panel: SchoolInternalCandidatePanel): InfoCard[] {
  if (!panel.ui_flags.show_demand_cards) return [];

  return [
    {
      key: "predicted_2029",
      label: "2029 잠재 수요",
      value: formatPotentialDemand(panel.demand_summary.predicted_2029),
      note: panel.demand_summary.demand_note
    },
    {
      key: "predicted_2031",
      label: "2031 잠재 수요",
      value: formatPotentialDemand(panel.demand_summary.predicted_2031),
      note: panel.demand_summary.demand_note
    }
  ];
}

function mapExternalAccessibilityItems(panel: ExternalGridCandidatePanel): LabeledValue[] {
  if (!panel.ui_flags.show_accessibility_metrics) return [];

  return [
    {
      key: "nearby_park_count",
      label: "등시권 내 공원 수",
      value: formatCount(panel.accessibility_summary.nearby_park_count)
    },
    {
      key: "nearby_playground_count",
      label: "등시권 내 놀이터 수",
      value: formatCount(panel.accessibility_summary.nearby_playground_count)
    },
    {
      key: "nearest_park_dist_m",
      label: "최근접 공원 거리",
      value: formatDistanceMeters(panel.accessibility_summary.nearest_park_dist_m)
    },
    {
      key: "has_large_apt",
      label: "대단지 여부",
      value: formatBooleanLabel(
        panel.accessibility_summary.has_large_apt,
        "대단지 있음",
        "대단지 없음"
      )
    },
    {
      key: "redev_status_simple",
      label: "재개발 상태",
      value: panel.accessibility_summary.redev_status_simple ?? "정보 없음"
    }
  ];
}

function mapInternalAccessibilityItems(panel: SchoolInternalCandidatePanel): LabeledValue[] {
  return [
    {
      key: "install_option",
      label: "설치 검토 옵션",
      value: panel.accessibility_summary.install_option
    },
    {
      key: "space_constraint_level",
      label: "공간 제약 수준",
      value: panel.accessibility_summary.space_constraint_level ?? "정보 없음"
    },
    {
      key: "expected_benefit_scope",
      label: "기대 효과 범위",
      value: panel.accessibility_summary.expected_benefit_scope ?? "정보 없음"
    },
    {
      key: "land_feasibility_note",
      label: "현장 검토 메모",
      value: panel.accessibility_summary.land_feasibility_note ?? "정보 없음"
    }
  ];
}

function mapExternalPanel(panel: ExternalGridCandidatePanel): CandidatePanelViewModel {
  const areaLabel = [panel.candidate_meta.gu, panel.candidate_meta.dong].filter(Boolean).join(" ");

  return {
    panel_kind: panel.candidate_meta.candidate_type,
    title: `${areaLabel} ${getCandidateTypeLabel(panel.candidate_meta.candidate_type)}`.trim(),
    subtitle: `지역 기반 잠재 수요 요약 · 도보 500m 내 학교 ${panel.linked_schools.linked_school_count}개`,
    badges: mapExternalBadges(panel),
    demand_cards: mapExternalDemandCards(panel),
    accessibility_items: mapExternalAccessibilityItems(panel),
    strategy_section: buildStrategySection(
      panel.strategy_recommendation.primary_recommendation,
      panel.strategy_recommendation.secondary_option
    ),
    explanation_section: buildExplanationSection(
      panel.explanation.recommendation_reason_summary,
      panel.explanation.explanation_tags,
      panel.accessibility_summary.land_feasibility_note
    ),
    linked_school_section: buildLinkedSchoolSection(
      panel.linked_schools.linked_school_count,
      panel.linked_schools.linked_school_names,
      panel.linked_schools.linked_school_ids,
      panel.linked_schools.schools
    ),
    warning_flags: buildWarningFlags(
      panel.ui_flags.requires_field_review,
      panel.accessibility_summary.land_feasibility_level
    )
  };
}

function mapInternalPanel(panel: SchoolInternalCandidatePanel): CandidatePanelViewModel {
  return {
    panel_kind: panel.candidate_meta.candidate_type,
    title: `${panel.candidate_meta.school_name} ${getCandidateTypeLabel(panel.candidate_meta.candidate_type)}`,
    subtitle: "학교 내부 대안 기준 잠재 수요 요약",
    badges: mapInternalBadges(panel),
    demand_cards: mapInternalDemandCards(panel),
    accessibility_items: mapInternalAccessibilityItems(panel),
    strategy_section: buildStrategySection(
      panel.strategy_recommendation.primary_recommendation,
      panel.strategy_recommendation.secondary_option
    ),
    explanation_section: buildExplanationSection(
      panel.explanation.recommendation_reason_summary,
      panel.explanation.explanation_tags,
      panel.accessibility_summary.land_feasibility_note
    ),
    linked_school_section: buildLinkedSchoolSection(
      panel.linked_schools.linked_school_count,
      panel.linked_schools.linked_school_names,
      panel.linked_schools.linked_school_ids,
      panel.linked_schools.schools
    ),
    warning_flags: buildWarningFlags(panel.ui_flags.requires_field_review, null)
  };
}

export function mapCandidatePanelToViewModel(
  panel: CandidatePanelResponse
): CandidatePanelViewModel {
  if (panel.candidate_meta.candidate_type === "external_grid") {
    return mapExternalPanel(panel);
  }

  return mapInternalPanel(panel);
}

export function mapCandidatePanelsToViewModels(
  panels: CandidatePanelResponse[]
): CandidatePanelViewModel[] {
  return panels.map(mapCandidatePanelToViewModel);
}

export function getSecondaryOptionDisplayValue(secondaryOption: string | null): string {
  return secondaryOption ?? DEFAULT_NO_SECONDARY_OPTION;
}

export function getExplanationTagsDisplay(tags: string[]): string[] {
  return tags.length > 0 ? tags : [DEFAULT_EMPTY_TAGS_MESSAGE];
}

/*
Usage example:

import examples from "../../data/examples/candidate_panel_examples.json";
import { mapCandidatePanelsToViewModels } from "../utils/candidatePanelMapper";
import type { CandidatePanelResponse } from "../types/candidatePanel";

const viewModels = mapCandidatePanelsToViewModels(
  examples as CandidatePanelResponse[]
);
*/
