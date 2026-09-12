"""Origin-safe residual selection and recursive horizon evaluation."""
import numpy as np
import pandas as pd
from lightgbm import LGBMRegressor
from scripts.forecasting.compare_school_enrollment_models import (
    make_history_features, weighted_slope, weighted_next_prediction, stabilize_future_prediction,
)


def contiguous(hist, origin):
    result = []
    while origin in hist:
        result.append(float(hist[origin])); origin -= 1
    return list(reversed(result))


def residual_model(rows):
    if len(rows) < 30:
        return None
    model = LGBMRegressor(n_estimators=100, max_depth=3, num_leaves=7, min_child_samples=15,
                         learning_rate=.04, random_state=42, n_jobs=1, verbosity=-1)
    model.fit(pd.DataFrame([r['features'] for r in rows]), [r['residual'] for r in rows])
    return model


def predict(values, horizon, model=None, weight=0):
    values = list(values)
    results = []
    for _ in range(horizon):
        value = weighted_next_prediction(values)
        if model is not None and weight:
            value += weight * float(model.predict(pd.DataFrame([make_history_features(values)]))[0])
        value = stabilize_future_prediction(values[-1], max(0, value))
        values.append(value); results.append(value)
    return results


def fit_at(rows, origin):
    available = [r for r in rows if r['year'] <= origin]
    if not available:
        return None, 0., None
    tuning_year = max(r['year'] for r in available)
    train = [r for r in available if r['year'] < tuning_year]
    tuning = [r for r in available if r['year'] == tuning_year]
    model = residual_model(train)
    weight = 0.
    if model is not None and len(tuning) >= 20:
        errors = {w: np.mean([abs(r['actual'] - predict(r['values'], 1, model, w)[0]) for r in tuning])
                  for w in [0., .25, .5, 1.]}
        best = min(errors, key=errors.get)
        weight = best if errors[best] < .95 * errors[0.] else 0.
    return residual_model(available) if weight else None, weight, tuning_year


def build(enrollment, registry):
    output, validation = {}, {}
    for level, group in registry.groupby('학교급구분'):
        histories = {sid: enrollment.get(sid, {}) for sid in group['학교ID']}
        latest = max((y for h in histories.values() for y in h), default=0)
        training = []
        for sid, hist in histories.items():
            for year, actual in sorted(hist.items()):
                values = contiguous(hist, year-1)
                if len(values) >= 3:
                    training.append(dict(sid=sid, year=year, actual=actual, values=values,
                                         features=make_history_features(values),
                                         residual=actual-weighted_next_prediction(values)))
        cache = {}
        def fitted(origin):
            if origin not in cache:
                cache[origin] = fit_at(training, origin)
            return cache[origin]
        tests = []
        for horizon in [1, 3, 5]:
            origin = latest-horizon
            model, weight, tuning_year = fitted(origin)
            for sid, hist in histories.items():
                values = contiguous(hist, origin)
                if latest not in hist or len(values) < 3:
                    continue
                estimate = predict(values, horizon, model, weight)[-1]
                baseline = predict(values, horizon)[-1]
                tests.append(dict(school_id=sid, origin=origin, target=latest, horizon=horizon,
                                  actual=hist[latest], prediction=estimate, baseline=baseline,
                                  last_observed=values[-1], selection_max_year=tuning_year,
                                  training_max_year=max((r['year'] for r in training if r['year'] <= origin), default=None)))
        summaries = []
        for horizon in [1, 3, 5]:
            subset = [r for r in tests if r['horizon'] == horizon]
            total = sum(r['actual'] for r in subset)
            error = sum(abs(r['actual']-r['prediction']) for r in subset)
            summaries.append(dict(horizon=horizon, n=len(subset),
                                  mae=error/len(subset) if subset else None,
                                  baseline_mae=float(np.mean([abs(r['actual']-r['baseline']) for r in subset])) if subset else None,
                                  wape=error/total if total else None,
                                  direction_accuracy=float(np.mean([np.sign(r['prediction']-r['last_observed']) == np.sign(r['actual']-r['last_observed']) for r in subset])) if subset else None))
        validation[level] = {'validation_year': latest, 'summary': summaries, 'rows': tests,
                             'note': '각 원점 이전 자료만으로 가중치 선택·재학습. 마지막 관측연도 별도 평가. 미관측 선행기간은 n=0, 오차 미산출.'}
        for sid, hist in histories.items():
            origin = max(hist, default=0)
            values = contiguous(hist, origin)
            result = {'history': [{'year': y, 'students': v} for y, v in sorted(hist.items())],
                      'model_history_years': list(range(origin-len(values)+1, origin+1)),
                      'forecast': [], 'model_status': 'insufficient_history', 'model_version': 'origin_safe_residual_v2',
                      'validation': {'year': latest, 'school_level': level, 'summary': summaries},
                      'limitations': '학구·입주·전입전출을 직접 예측한 모형이 아님. 미검증 장기 결과는 지원 시나리오.'}
            if len(values) >= 3:
                model, weight, selected_year = fitted(origin)
                result.update(model_status='weighted_trend_lightgbm' if weight else 'weighted_trend',
                              student_slope=weighted_slope(values), residual_weight=weight,
                              selection_max_year=selected_year)
                result['forecast'] = [{'year': origin+h, 'students': round(v), 'horizon': h}
                                      for h, v in enumerate(predict(values, max(0, 2031-origin), model, weight), 1)]
            elif len(values) == 2:
                result['student_slope'] = values[-1]-values[0]
            output[sid] = result
    return output, validation
