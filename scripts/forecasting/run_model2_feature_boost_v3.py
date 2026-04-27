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
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.model_selection import KFold
from xgboost import XGBRegressor

ROOT = Path(r'c:\2026_data_analysis_park')
DATA = ROOT / 'data_processed'
OUTPUT = ROOT / 'output'

PRIORITY_CSV = DATA / 'school_priority.csv'
SCHOOLS_CSV = DATA / 'schools.csv'
BENEFICIARY_CSV = DATA / 'beneficiary_forecast.csv'

MODEL_2029_PKL = OUTPUT / 'model2_xgboost_2029_v3.pkl'
MODEL_2031_PKL = OUTPUT / 'model2_xgboost_2031_v3.pkl'
SCORES_JSON = OUTPUT / 'model2_cv_scores_v3.json'
SHAP_2029_PNG = OUTPUT / 'shap_model2_2029_v3_summary.png'
SHAP_2031_PNG = OUTPUT / 'shap_model2_2031_v3_summary.png'
BENEFICIARY_V3_CSV = DATA / 'beneficiary_forecast_v3.csv'

BASE_FEATURES = [
    'gu_avg_grid_total_pop',
    'redev_완료수',
    'redev_진행중수',
    'redev_예정수',
    'nearest_park_dist_m',
    'iso_park_area',
    'buf_park_area',
    'is_new_school',
    '위도',
    '경도',
]

FORBIDDEN_FEATURES = {
    'student_slope',
    'case_type',
    'case_label',
    'priority_score',
    'priority_rank',
    'is_low_access_tag',
    'is_case_conflict_tag',
    'is_separate_bundle_tag',
}


def load_model_frame() -> pd.DataFrame:
    priority = pd.read_csv(PRIORITY_CSV, encoding='utf-8-sig')
    schools = pd.read_csv(SCHOOLS_CSV, encoding='utf-8-sig')[['학교ID', '위도', '경도']]
    beneficiary = pd.read_csv(BENEFICIARY_CSV, encoding='utf-8-sig')[['학교ID', 'gu_avg_grid_total_pop']]

    df = priority.merge(schools, on='학교ID', how='left')
    df = df.merge(beneficiary, on='학교ID', how='left')

    required = [
        '학교ID',
        '학교명',
        'gu',
        'iso_child_total',
        'gu_avg_grid_total_pop',
        'redev_완료수',
        'redev_진행중수',
        'redev_예정수',
        'nearest_park_dist_m',
        'iso_park_area',
        'buf_park_area',
        'is_new_school',
        '위도',
        '경도',
        'cohort_change_2029_prophet',
        'cohort_change_2031_prophet',
    ]
    missing_cols = [col for col in required if col not in df.columns]
    if missing_cols:
        raise ValueError(f'필수 컬럼 누락: {missing_cols}')

    strict_non_null = [
        '학교ID',
        '학교명',
        'gu',
        'iso_child_total',
        'gu_avg_grid_total_pop',
        'redev_완료수',
        'redev_진행중수',
        'redev_예정수',
        'nearest_park_dist_m',
        'iso_park_area',
        'buf_park_area',
        'is_new_school',
        '위도',
        '경도',
        'cohort_change_2029_prophet',
        'cohort_change_2031_prophet',
    ]
    null_counts = df[strict_non_null].isna().sum()
    null_counts = {k: int(v) for k, v in null_counts.items() if int(v) > 0}
    if null_counts:
        raise ValueError(f'학습용 필수 컬럼 결측 발견: {null_counts}')

    df['target_2029'] = df['iso_child_total'] * df['cohort_change_2029_prophet']
    df['target_2031'] = df['iso_child_total'] * df['cohort_change_2031_prophet']
    return df


def build_feature_frame(df: pd.DataFrame, cohort_col: str) -> pd.DataFrame:
    gu_dummies = pd.get_dummies(df['gu'], prefix='gu', drop_first=True, dtype=int)
    X = pd.concat([df[BASE_FEATURES].copy(), gu_dummies, df[[cohort_col]].copy()], axis=1)
    forbidden_used = sorted(FORBIDDEN_FEATURES.intersection(X.columns))
    if forbidden_used:
        raise ValueError(f'금지 피처가 학습 프레임에 포함됨: {forbidden_used}')
    return X


def kfold_metrics(X: pd.DataFrame, y: pd.Series | np.ndarray) -> tuple[list[dict[str, float]], np.ndarray]:
    kf = KFold(n_splits=5, shuffle=True, random_state=42)
    y_arr = np.asarray(y, dtype=float)
    oof = np.zeros(len(X), dtype=float)
    fold_scores: list[dict[str, float]] = []

    for fold, (train_idx, valid_idx) in enumerate(kf.split(X), start=1):
        model = XGBRegressor(random_state=42)
        model.fit(X.iloc[train_idx], y_arr[train_idx])
        pred = model.predict(X.iloc[valid_idx])
        oof[valid_idx] = pred
        fold_scores.append({
            'fold': fold,
            'mae': float(mean_absolute_error(y_arr[valid_idx], pred)),
            'r2': float(r2_score(y_arr[valid_idx], pred)),
        })
    return fold_scores, oof


def fit_final_model(
    X: pd.DataFrame,
    y: pd.Series | np.ndarray,
    model_path: Path,
    shap_path: Path,
) -> tuple[XGBRegressor, list[dict[str, float]]]:
    model = XGBRegressor(random_state=42)
    model.fit(X, np.asarray(y, dtype=float))
    joblib.dump(model, model_path)

    explainer = shap.TreeExplainer(model)
    shap_values = explainer(X)
    plt.figure(figsize=(10, 6))
    shap.summary_plot(shap_values, X, show=False)
    plt.tight_layout()
    plt.savefig(shap_path, dpi=180, bbox_inches='tight')
    plt.close()

    top5 = (
        pd.DataFrame({
            'feature': X.columns,
            'mean_abs_shap': np.abs(shap_values.values).mean(axis=0),
        })
        .sort_values('mean_abs_shap', ascending=False)
        .head(5)
        .to_dict('records')
    )
    return model, top5


def mean_scores(folds: list[dict[str, float]]) -> dict[str, float]:
    return {
        'mae_mean': float(np.mean([x['mae'] for x in folds])),
        'r2_mean': float(np.mean([x['r2'] for x in folds])),
    }


def validate_export(df: pd.DataFrame) -> dict[str, object]:
    if len(df) != 272:
        raise ValueError(f'beneficiary_forecast_v3.csv 행 수가 272가 아닙니다: {len(df)}')

    null_2029 = int(df['predicted_2029'].isna().sum())
    null_2031 = int(df['predicted_2031'].isna().sum())
    neg_2029 = int((df['predicted_2029'] < 0).sum())
    neg_2031 = int((df['predicted_2031'] < 0).sum())
    if null_2029 or null_2031 or neg_2029 or neg_2031:
        raise ValueError(
            '예측 검증 실패: '
            f'predicted_2029 null={null_2029}, negative={neg_2029}, '
            f'predicted_2031 null={null_2031}, negative={neg_2031}'
        )

    return {
        'row_count': int(len(df)),
        'predicted_2029_null': null_2029,
        'predicted_2029_negative': neg_2029,
        'predicted_2031_null': null_2031,
        'predicted_2031_negative': neg_2031,
    }


def main() -> None:
    df = load_model_frame()

    X_2029 = build_feature_frame(df, 'cohort_change_2029_prophet')
    X_2031 = build_feature_frame(df, 'cohort_change_2031_prophet')

    folds_2029, _ = kfold_metrics(X_2029, df['target_2029'])
    folds_2031, _ = kfold_metrics(X_2031, df['target_2031'])
    agg_2029 = mean_scores(folds_2029)
    agg_2031 = mean_scores(folds_2031)

    model_2029, top5_2029 = fit_final_model(X_2029, df['target_2029'], MODEL_2029_PKL, SHAP_2029_PNG)
    model_2031, top5_2031 = fit_final_model(X_2031, df['target_2031'], MODEL_2031_PKL, SHAP_2031_PNG)

    export_df = df[
        [
            '학교ID',
            '학교명',
            'gu',
            'iso_child_total',
            'target_2029',
            'target_2031',
            'cohort_change_2029_prophet',
            'cohort_change_2031_prophet',
            'is_new_school',
        ]
    ].copy()
    export_df['predicted_2029'] = np.clip(model_2029.predict(X_2029), 0, None)
    export_df['predicted_2031'] = np.clip(model_2031.predict(X_2031), 0, None)
    export_df = export_df[
        [
            '학교ID',
            '학교명',
            'gu',
            'iso_child_total',
            'target_2029',
            'target_2031',
            'predicted_2029',
            'predicted_2031',
            'cohort_change_2029_prophet',
            'cohort_change_2031_prophet',
            'is_new_school',
        ]
    ]
    export_df.to_csv(BENEFICIARY_V3_CSV, index=False, encoding='utf-8-sig')

    scores = {
        'model_2029': {
            'target': 'target_2029',
            'cohort_feature': 'cohort_change_2029_prophet',
            'features': list(X_2029.columns),
            'base_features': BASE_FEATURES,
            'forbidden_features_checked': sorted(FORBIDDEN_FEATURES),
            'fold_scores': folds_2029,
            **agg_2029,
            'top5_shap_features': top5_2029,
        },
        'model_2031': {
            'target': 'target_2031',
            'cohort_feature': 'cohort_change_2031_prophet',
            'features': list(X_2031.columns),
            'base_features': BASE_FEATURES,
            'forbidden_features_checked': sorted(FORBIDDEN_FEATURES),
            'fold_scores': folds_2031,
            **agg_2031,
            'top5_shap_features': top5_2031,
        },
    }
    SCORES_JSON.write_text(json.dumps(scores, ensure_ascii=False, indent=2), encoding='utf-8')

    validation = validate_export(export_df)

    print('작업2:')
    print(f"  2029 모델 5-fold R² / MAE: {agg_2029['r2_mean']:.4f} / {agg_2029['mae_mean']:.4f}")
    print(f"  2031 모델 5-fold R² / MAE: {agg_2031['r2_mean']:.4f} / {agg_2031['mae_mean']:.4f}")
    print('  SHAP 상위 5개 (2029):')
    for item in top5_2029:
        print(f"    {item['feature']}: {item['mean_abs_shap']:.4f}")
    print('  SHAP 상위 5개 (2031):')
    for item in top5_2031:
        print(f"    {item['feature']}: {item['mean_abs_shap']:.4f}")

    print('작업3:')
    print(f"  beneficiary_forecast_v3.csv 행 수: {validation['row_count']}")
    print(
        '  predicted_2029 null/음수: '
        f"{validation['predicted_2029_null']} / {validation['predicted_2029_negative']}"
    )
    print(
        '  predicted_2031 null/음수: '
        f"{validation['predicted_2031_null']} / {validation['predicted_2031_negative']}"
    )


if __name__ == '__main__':
    main()
