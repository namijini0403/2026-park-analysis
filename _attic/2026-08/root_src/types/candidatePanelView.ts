import type { CandidateType } from "./candidatePanel";

export type BadgeTone = "info" | "neutral" | "positive" | "warning" | "danger";

export interface BadgeItem {
  key: string;
  label: string;
  tone: BadgeTone;
}

export interface InfoCard {
  key: string;
  label: string;
  value: string;
  note: string | null;
}

export interface LabeledValue {
  key: string;
  label: string;
  value: string;
}

export interface StrategySectionView {
  title: string;
  primary_label: string;
  primary_value: string;
  secondary_label: string;
  secondary_value: string | null;
  secondary_visible: boolean;
}

export interface ExplanationSectionView {
  title: string;
  summary: string;
  tags: string[];
  note: string | null;
  tags_visible: boolean;
}

export interface LinkedSchoolListItem {
  school_id: string;
  school_name: string;
  display_name: string;
  case_label: string | null;
}

export interface LinkedSchoolSectionView {
  title: string;
  count_label: string;
  names: string[];
  ids: string[];
  items: LinkedSchoolListItem[];
  empty_message: string | null;
}

export interface WarningFlag {
  key: string;
  label: string;
  tone: Exclude<BadgeTone, "info" | "positive">;
}

export interface CandidatePanelViewModel {
  panel_kind: CandidateType;
  title: string;
  subtitle: string;
  badges: BadgeItem[];
  demand_cards: InfoCard[];
  accessibility_items: LabeledValue[];
  strategy_section: StrategySectionView;
  explanation_section: ExplanationSectionView;
  linked_school_section: LinkedSchoolSectionView;
  warning_flags: WarningFlag[];
}
