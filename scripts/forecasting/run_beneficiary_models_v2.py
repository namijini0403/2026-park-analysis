# -*- coding: utf-8 -*-
from __future__ import annotations

import json
from pathlib import Path

import joblib
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import shap
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.model_selection import KFold
from xgboost import XGBRegressor

ROOT = Path(r'c:\2026_data_analysis_park')
DATA = ROOT / 'data_processed'
OUTPUT = ROOT / 'output'

SCHOOL_PRIORITY_CSV = DATA / 'school_priority.csv'
STUDENT_TREND_CSV = DATA / 'student_trend.csv'
CASE1_V2_CSV = OUTPUT / 'case1_priority_v2.csv'
BENEFICIARY_CSV = DATA / 'beneficiary_forecast.csv'

MODEL1_PKL = OUTPUT / 'model1_xgboost.pkl'
MODEL2_2029_PKL = OUTPUT / 'model2_xgboost_2029.pkl'
MODEL2_2031_PKL = OUTPUT / 'model2_xgboost_2031.pkl'
MODEL1_SHAP = OUTPUT / 'shap_model1_summary.png'
MODEL2_2029_SHAP = OUTPUT / 'shap_model2_2029_summary.png'
MODEL2_2031_SHAP = OUTPUT / 'shap_model2_2031_summary.png'
MODEL1_SCORES_JSON = OUTPUT / 'model1_cv_scores.json'
MODEL2_SCORES_JSON = OUTPUT / 'model2_cv_scores.json'
BENEFICIARY_V2_CSV = OUTPUT / 'beneficiary_forecast_v2.csv'

FEATURES_MODEL1 = [
    'gu_avg_grid_total_pop',
    'redev_완료수',
    'redev_진행중수',
    'redev_예정수',
    'nearest_park_dist_m',
    'iso_park_area',
    'buf_park_area',
    'student_slope',
    'is_new_school',
]


def fit_slope(group: pd.DataFrame) -> tuple[float | None, int]:
    years = group['연도'].nunique()
    if years >= 4:
        model = LinearRegression()
        x = group[['연도']].to_numpy(dtype=float)
        y = group['학생수'].to_numpy(dtype=float)
        model.fit(x, y)
        return float(model.coef_[0]), 0
    return np.nan, 1


def update_student_slope() -> dict[str, object]:
    priority = pd.read_csv(SCHOOL_PRIORITY_CSV, encoding='utf-8-sig')
    trend = pd.read_csv(STUDENT_TREND_CSV, encoding='utf-8-sig')

    grouped_rows = []
    for school_id, group in trend.groupby('학교ID', sort=False):
        school_name = group['학교명'].iloc[0]
        slope, is_new_school = fit_slope(group.sort_values('연도'))
        grouped_rows.append({
            '학교ID': school_id,
            '학교명': school_name,
            'student_slope': slope,
            'is_new_school': int(is_new_school),
            'year_count': int(group['연도'].nunique()),
        })

    slope_df = pd.DataFrame(grouped_rows)
    priority = priority.drop(columns=['student_slope', 'is_new_school'], errors='ignore')
    priority = priority.merge(slope_df[['학교ID', 'student_slope', 'is_new_school']], on='학교ID', how='left')

    missing_mask = priority['student_slope'].isna()
    priority.loc[missing_mask, 'is_new_school'] = 1
    priority['is_new_school'] = priority['is_new_school'].fillna(0).astype(int)
    priority.to_csv(SCHOOL_PRIORITY_CSV, index=False, encoding='utf-8-sig')

    case1 = pd.read_csv(CASE1_V2_CSV, encoding='utf-8-sig')[['학교ID', 'student_slope']].rename(columns={'student_slope': 'old_student_slope'})
    cmp_df = priority[['학교ID', 'student_slope']].merge(case1, on='학교ID', how='inner')

    def within_tol(row: pd.Series) -> bool:
        old = row['old_student_slope']
        new = row['student_slope']
        if pd.isna(old) or pd.isna(new):
            return False
        if old == 0:
            return abs(new) <= 1e-9
        return abs((new - old) / old) <= 0.05

    if not cmp_df.empty:
        cmp_df['within_tol'] = cmp_df.apply(within_tol, axis=1)
        case1_ok = bool(cmp_df['within_tol'].all())
        mismatch_count = int((~cmp_df['within_tol']).sum())
    else:
        case1_ok = False
        mismatch_count = 0

    return {
        'student_slope_non_null': int(priority['student_slope'].notna().sum()),
        'is_new_school_count': int((priority['is_new_school'] == 1).sum()),
        'case1_within_tolerance': case1_ok,
        'case1_mismatch_count': mismatch_count,
    }


def build_base_frame() -> pd.DataFrame:
    priority = pd.read_csv(SCHOOL_PRIORITY_CSV, encoding='utf-8-sig')
    forecast = pd.read_csv(BENEFICIARY_CSV, encoding='utf-8-sig')

    join_cols = [
        '학교ID',
        'gu_avg_grid_total_pop',
        'cohort_change_2029',
        'cohort_change_2031',
    ]
    merged = priority.merge(forecast[join_cols], on='학교ID', how='left')
    if merged[join_cols[1:]].isna().any().any():
        missing = merged.loc[merged['gu_avg_grid_total_pop'].isna(), ['학교ID', '학교명']]
        raise ValueError(f'beneficiary_forecast 조인 누락: {missing.head().to_dict("records")}')
    return merged


def run_cv_model(df: pd.DataFrame, features: list[str], target_col: str, model_path: Path, shap_path: Path) -> tuple[dict[str, object], np.ndarray, list[dict[str, float]]]:
    X = df[features].copy()
    y = df[target_col].to_numpy(dtype=float)
    kf = KFold(n_splits=5, shuffle=True, random_state=42)

    oof_pred = np.zeros(len(df), dtype=float)
    fold_scores: list[dict[str, float]] = []

    for fold, (train_idx, valid_idx) in enumerate(kf.split(X), start=1):
        model = XGBRegressor(random_state=42)
        model.fit(X.iloc[train_idx], y[train_idx])
        pred = model.predict(X.iloc[valid_idx])
        oof_pred[valid_idx] = pred
        fold_scores.append({
            'fold': fold,
            'mae': float(mean_absolute_error(y[valid_idx], pred)),
            'r2': float(r2_score(y[valid_idx], pred)),
        })

    final_model = XGBRegressor(random_state=42)
    final_model.fit(X, y)
    joblib.dump(final_model, model_path)

    explainer = shap.TreeExplainer(final_model)
    shap_values = explainer(X)
    plt.figure(figsize=(10, 6))
    shap.summary_plot(shap_values, X, show=False)
    plt.tight_layout()
    plt.savefig(shap_path, dpi=180, bbox_inches='tight')
    plt.close()

    mean_abs = np.abs(shap_values.values).mean(axis=0)
    top_features = (
        pd.DataFrame({'feature': X.columns, 'mean_abs_shap': mean_abs})
        .sort_values('mean_abs_shap', ascending=False)
        .head(5)
        .to_dict('records')
    )

    metrics = {
        'features': features,
        'target': target_col,
        'fold_scores': fold_scores,
        'mae_mean': float(np.mean([x['mae'] for x in fold_scores])),
        'r2_mean': float(np.mean([x['r2'] for x in fold_scores])),
        'top5_shap_features': top_features,
    }
    return metrics, final_model.predict(X), fold_scores


def run_model1(base_df: pd.DataFrame) -> dict[str, object]:
    metrics, _, _ = run_cv_model(
        base_df,
        FEATURES_MODEL1,
        'iso_child_total',
        MODEL1_PKL,
        MODEL1_SHAP,
    )
    MODEL1_SCORES_JSON.write_text(json.dumps(metrics, ensure_ascii=False, indent=2), encoding='utf-8')
    return metrics


def run_model2(base_df: pd.DataFrame) -> dict[str, object]:
    df = base_df.copy()
    df['target_2029'] = df['iso_child_total'] * df['cohort_change_2029']
    df['target_2031'] = df['iso_child_total'] * df['cohort_change_2031']

    features_2029 = FEATURES_MODEL1 + ['cohort_change_2029']
    features_2031 = FEATURES_MODEL1 + ['cohort_change_2031']

    metrics_2029, pred_2029, _ = run_cv_model(df, features_2029, 'target_2029', MODEL2_2029_PKL, MODEL2_2029_SHAP)
    metrics_2031, pred_2031, _ = run_cv_model(df, features_2031, 'target_2031', MODEL2_2031_PKL, MODEL2_2031_SHAP)

    model2_metrics = {
        'model_2029': metrics_2029,
        'model_2031': metrics_2031,
    }
    MODEL2_SCORES_JSON.write_text(json.dumps(model2_metrics, ensure_ascii=False, indent=2), encoding='utf-8')

    export_df = df[['학교ID', '학교명', 'gu', 'iso_child_total', 'target_2029', 'target_2031', 'is_new_school']].copy()
    export_df['predicted_2029'] = np.clip(pred_2029, 0, None).round().astype(int)
    export_df['predicted_2031'] = np.clip(pred_2031, 0, None).round().astype(int)
    export_df['target_2029'] = export_df['target_2029'].round().astype(int)
    export_df['target_2031'] = export_df['target_2031'].round().astype(int)
    export_df = export_df[['학교ID', '학교명', 'gu', 'iso_child_total', 'predicted_2029', 'predicted_2031', 'target_2029', 'target_2031', 'is_new_school']]
    export_df.to_csv(BENEFICIARY_V2_CSV, index=False, encoding='utf-8-sig')

    model2_metrics['beneficiary_forecast_v2_rows'] = int(len(export_df))
    return model2_metrics


def main() -> None:
    task1 = update_student_slope()
    base_df = build_base_frame()
    task2 = run_model1(base_df)
    task3 = run_model2(base_df)

    print('작업1 완료:')
    print(f"  student_slope non-null 학교 수: {task1['student_slope_non_null']}개")
    print(f"  is_new_school == 1 학교 수: {task1['is_new_school_count']}개")
    print(f"  case1 slope 오차 범위 내 여부: {task1['case1_within_tolerance']} (mismatch {task1['case1_mismatch_count']}개)")

    print('작업2 완료 (모델 1):')
    print(f"  5-fold CV MAE 평균: {task2['mae_mean']:.4f}")
    print(f"  5-fold CV R² 평균: {task2['r2_mean']:.4f}")
    print('  SHAP 피처 중요도 상위 5개:')
    for item in task2['top5_shap_features']:
        print(f"    {item['feature']}: {item['mean_abs_shap']:.4f}")

    print('작업3 완료 (모델 2):')
    print(f"  2029 모델 - 5-fold CV MAE 평균 / R² 평균: {task3['model_2029']['mae_mean']:.4f} / {task3['model_2029']['r2_mean']:.4f}")
    print(f"  2031 모델 - 5-fold CV MAE 평균 / R² 평균: {task3['model_2031']['mae_mean']:.4f} / {task3['model_2031']['r2_mean']:.4f}")
    print(f"  beneficiary_forecast_v2.csv 행 수: {task3['beneficiary_forecast_v2_rows']}개")


if __name__ == '__main__':
    main()

