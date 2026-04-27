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
BENEFICIARY_V2_CSV = OUTPUT / 'beneficiary_forecast_v2.csv'

MODEL_2029_PKL = OUTPUT / 'model2_xgboost_2029_v2.pkl'
MODEL_2031_PKL = OUTPUT / 'model2_xgboost_2031_v2.pkl'
SCORES_JSON = OUTPUT / 'model2_cv_scores_v2.json'
SHAP_2029_PNG = OUTPUT / 'shap_model2_2029_v2_summary.png'
SHAP_2031_PNG = OUTPUT / 'shap_model2_2031_v2_summary.png'

BASE_FEATURES = [
    'gu_avg_grid_total_pop',
    'redev_완료수',
    'redev_진행중수',
    'redev_예정수',
    'nearest_park_dist_m',
    'iso_park_area',
    'buf_park_area',
    'student_slope',
    'is_new_school',
    '위도',
    '경도',
    'iso_park_area_ratio',
]


def load_model_frame() -> pd.DataFrame:
    priority = pd.read_csv(PRIORITY_CSV, encoding='utf-8-sig')
    schools = pd.read_csv(SCHOOLS_CSV, encoding='utf-8-sig')[['학교ID', '위도', '경도']]
    beneficiary = pd.read_csv(BENEFICIARY_CSV, encoding='utf-8-sig')[['학교ID', 'gu_avg_grid_total_pop', 'cohort_change_2029', 'cohort_change_2031']]

    df = priority.merge(schools, on='학교ID', how='left')
    df = df.merge(beneficiary, on='학교ID', how='left')

    if df[['위도', '경도', 'gu_avg_grid_total_pop', 'cohort_change_2029', 'cohort_change_2031']].isna().any().any():
        raise ValueError('좌표 또는 cohort_change 조인에 결측이 있습니다.')

    df['iso_park_area_ratio'] = df['iso_park_area'] / (df['iso_park_area'] + 1.0)
    df['target_2029'] = df['iso_child_total'] * df['cohort_change_2029']
    df['target_2031'] = df['iso_child_total'] * df['cohort_change_2031']
    return df


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


def fit_final_model(X: pd.DataFrame, y: pd.Series | np.ndarray, model_path: Path, shap_path: Path) -> tuple[XGBRegressor, list[dict[str, float]]]:
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


def main() -> None:
    df = load_model_frame()

    # 작업 1: 위치-only 베이스라인
    X_loc = df[['위도', '경도']].copy()
    folds_loc_2029, _ = kfold_metrics(X_loc, df['target_2029'])
    folds_loc_2031, _ = kfold_metrics(X_loc, df['target_2031'])
    loc_2029 = mean_scores(folds_loc_2029)
    loc_2031 = mean_scores(folds_loc_2031)

    # 작업 2: 보강 모델
    gu_dummies = pd.get_dummies(df['gu'], prefix='gu', drop_first=True, dtype=int)
    X_base = pd.concat([df[BASE_FEATURES].copy(), gu_dummies], axis=1)

    X_2029 = pd.concat([X_base, df[['cohort_change_2029']]], axis=1)
    X_2031 = pd.concat([X_base, df[['cohort_change_2031']]], axis=1)

    folds_2029, _ = kfold_metrics(X_2029, df['target_2029'])
    folds_2031, _ = kfold_metrics(X_2031, df['target_2031'])
    agg_2029 = mean_scores(folds_2029)
    agg_2031 = mean_scores(folds_2031)

    model_2029, top5_2029 = fit_final_model(X_2029, df['target_2029'], MODEL_2029_PKL, SHAP_2029_PNG)
    model_2031, top5_2031 = fit_final_model(X_2031, df['target_2031'], MODEL_2031_PKL, SHAP_2031_PNG)

    # 작업 3: 산출물 저장
    export_df = pd.read_csv(BENEFICIARY_V2_CSV, encoding='utf-8-sig')
    export_df = export_df.drop(columns=['predicted_2029', 'predicted_2031'], errors='ignore')
    export_df['predicted_2029'] = np.clip(model_2029.predict(X_2029), 0, None).round().astype(int)
    export_df['predicted_2031'] = np.clip(model_2031.predict(X_2031), 0, None).round().astype(int)
    export_df.to_csv(BENEFICIARY_V2_CSV, index=False, encoding='utf-8-sig')

    scores = {
        'position_only': {
            '2029': {'fold_scores': folds_loc_2029, **loc_2029},
            '2031': {'fold_scores': folds_loc_2031, **loc_2031},
        },
        'enhanced': {
            '2029': {'fold_scores': folds_2029, **agg_2029, 'top5_shap_features': top5_2029},
            '2031': {'fold_scores': folds_2031, **agg_2031, 'top5_shap_features': top5_2031},
        },
    }
    SCORES_JSON.write_text(json.dumps(scores, ensure_ascii=False, indent=2), encoding='utf-8')

    updated = pd.read_csv(BENEFICIARY_V2_CSV, encoding='utf-8-sig')
    print('작업1:')
    print(f"  위치-only 2029 R²: {loc_2029['r2_mean']:.4f}")
    print(f"  위치-only 2031 R²: {loc_2031['r2_mean']:.4f}")
    print('작업2:')
    print(f"  보강 후 2029 R² / MAE: {agg_2029['r2_mean']:.4f} / {agg_2029['mae_mean']:.4f}")
    print(f"  보강 후 2031 R² / MAE: {agg_2031['r2_mean']:.4f} / {agg_2031['mae_mean']:.4f}")
    print('  SHAP 상위 5개 (2029):')
    for item in top5_2029:
        print(f"    {item['feature']}: {item['mean_abs_shap']:.4f}")
    print('작업3:')
    print(f"  beneficiary_forecast_v2.csv 행 수: {len(updated)}")
    print(f"  predicted_2029 null 수: {int(updated['predicted_2029'].isna().sum())}")
    print(f"  predicted_2031 null 수: {int(updated['predicted_2031'].isna().sum())}")


if __name__ == '__main__':
    main()
