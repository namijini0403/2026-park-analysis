export type CandidateType = "external_grid" | "school_internal";

export type LandFeasibilityLevel = "high" | "medium" | "low";

export interface StrategyRecommendation {
  primary_recommendation: string;
  secondary_option: string | null;
}

export interface LinkedSchoolSummary {
  school_id: string;
  school_name: string;
  case_label: string | null;
  predicted_2029: number | null;
  predicted_2031: number | null;
}

export interface LinkedSchoolsSection {
  linked_school_count: number;
  linked_school_ids: string[];
  linked_school_names: string[];
  schools: LinkedSchoolSummary[];
}

export interface ExplanationSection {
  recommendation_reason_summary: string;
  explanation_tags: string[];
}

export interface UIFLags {
  requires_field_review: boolean;
  show_demand_cards: boolean;
  show_accessibility_metrics: boolean;
  show_linked_schools: boolean;
  show_coordinates: boolean;
  show_land_feasibility_badge: boolean;
  show_internal_note: boolean;
}

export interface ExternalGridCandidateMeta {
  candidate_id: string;
  candidate_type: "external_grid";
  center_x: number;
  center_y: number;
  gu: string;
  dong: string | null;
}

export interface SchoolInternalCandidateMeta {
  candidate_id: string;
  candidate_type: "school_internal";
  school_id: string;
  school_name: string;
  gu: string;
  dong: string | null;
}

export type CandidateMeta = ExternalGridCandidateMeta | SchoolInternalCandidateMeta;

export interface ExternalGridDemandSummary {
  nearby_child_total: number | null;
  predicted_2029: number | null;
  predicted_2031: number | null;
  demand_label: string;
  demand_note: string;
}

export interface SchoolInternalDemandSummary {
  predicted_2029: number | null;
  predicted_2031: number | null;
  demand_label: string;
  demand_note: string;
}

export type DemandSummary = ExternalGridDemandSummary | SchoolInternalDemandSummary;

export interface ExternalGridAccessibilitySummary {
  nearest_park_dist_m: number | null;
  nearby_park_count: number | null;
  nearby_playground_count: number | null;
  has_large_apt: boolean | null;
  redev_status_simple: string | null;
  land_feasibility_level: LandFeasibilityLevel | null;
  land_feasibility_note: string | null;
}

export interface SchoolInternalAccessibilitySummary {
  install_option: string;
  space_constraint_level: string | null;
  expected_benefit_scope: string | null;
  land_feasibility_note: string | null;
  external_candidate_available: boolean | null;
}

export type AccessibilitySummary =
  | ExternalGridAccessibilitySummary
  | SchoolInternalAccessibilitySummary;

export interface ExternalGridCandidatePanel {
  candidate_meta: ExternalGridCandidateMeta;
  demand_summary: ExternalGridDemandSummary;
  accessibility_summary: ExternalGridAccessibilitySummary;
  strategy_recommendation: StrategyRecommendation;
  explanation: ExplanationSection;
  linked_schools: LinkedSchoolsSection;
  ui_flags: UIFLags;
}

export interface SchoolInternalCandidatePanel {
  candidate_meta: SchoolInternalCandidateMeta;
  demand_summary: SchoolInternalDemandSummary;
  accessibility_summary: SchoolInternalAccessibilitySummary;
  strategy_recommendation: StrategyRecommendation;
  explanation: ExplanationSection;
  linked_schools: LinkedSchoolsSection;
  ui_flags: UIFLags;
}

export type CandidatePanelResponse =
  | ExternalGridCandidatePanel
  | SchoolInternalCandidatePanel;
