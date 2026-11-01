from datetime import date, timedelta
import json
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from corridor_ml.data import DataError, load_dataset, write_csv
from corridor_ml.demo import generate_demo
from corridor_ml.features import FeatureStore, documented, matching, WEEK
from corridor_ml.model import forecast_bundle, load_bundle, train
from corridor_ml.news import canonical_url, connect, ingest_feed, parse_feed, review


@pytest.fixture(scope="module")
def data_root(tmp_path_factory):
    root = tmp_path_factory.mktemp("data") / "scenario"
    generate_demo(root, weeks=116)
    return root


@pytest.fixture(scope="module")
def data(data_root):
    return load_dataset(data_root)


def test_duplicate_case_ids_and_synthetic_mixing_are_rejected(data_root, tmp_path):
    import shutil
    root = tmp_path / "copy"
    shutil.copytree(data_root, root)
    events = pd.read_csv(root / "events.csv", keep_default_na=False)
    events.loc[1, "case_id"] = events.loc[0, "case_id"]
    events.to_csv(root / "events.csv", index=False)
    with pytest.raises(DataError, match="canonical"):
        load_dataset(root)
    events.loc[1, "case_id"] = "unique"
    events.loc[0, "source_kind"] = "department"
    events.to_csv(root / "events.csv", index=False)
    with pytest.raises(DataError, match="mix"):
        load_dataset(root)


def test_future_event_review_release_and_withdrawal_cannot_leak(data):
    origin = date(2025, 1, 6)
    known = documented(data.events, origin)
    assert (known.event_date < origin).all()
    assert (known.available_date <= origin).all()
    assert (known.documented_date <= origin).all()
    row = data.events.iloc[0].copy()
    row.event_date, row.available_date = origin - timedelta(days=7), origin - timedelta(days=6)
    row.documented_date, row.withdrawn_date = origin - timedelta(days=5), origin + timedelta(days=1)
    assert len(documented(pd.DataFrame([row]), origin)) == 1
    assert len(documented(pd.DataFrame([row]), origin + timedelta(days=2))) == 0
    row.documented_date = origin + timedelta(days=1)
    row.withdrawn_date = None
    assert len(documented(pd.DataFrame([row]), origin)) == 0


def test_missing_coverage_is_not_zero_and_future_covariates_are_ignored(data):
    from copy import deepcopy
    d = deepcopy(data)
    origin = date(2025, 1, 6)
    store = FeatureStore(d)
    before, _ = store.snapshot("c01", origin)
    d.covariates.loc[len(d.covariates)] = {"entity_id": "c01", "metric": "transport_flow_index", "period_start": origin - WEEK, "period_end": origin, "available_date": origin + WEEK, "value": 999999.0, "unit": "index", "sample_size": None, "source_ref": "future-release"}
    after, _ = FeatureStore(d).snapshot("c01", origin)
    assert before["context_transport_flow_index"] == after["context_transport_flow_index"]
    d.coverage = d.coverage[d.coverage.entity_id != "c01"]
    features, info = FeatureStore(d).snapshot("c01", origin)
    assert np.isnan(features["lag_4w"])
    assert info["baseline_weekly"] is None
    assert FeatureStore(d).target("c01", origin, 4, origin + 6 * WEEK) is None


def test_seizure_location_does_not_manufacture_a_route(data):
    row = data.events.iloc[0].copy()
    row.origin_id = row.destination_id = ""
    row.seizure_area_id = "ernakulam"
    events = pd.DataFrame([row])
    entities = {r.entity_id: r for _, r in data.entities.iterrows()}
    assert len(matching(events, entities["c01"])) == 0
    assert len(matching(events, entities["area-ernakulam"])) == 1


def test_labels_wait_for_reporting_delay_and_full_coverage(data):
    panel = FeatureStore(data).panel("corridor", date(2025, 6, 2), 4, 2)
    assert len(panel) > 100
    assert (panel.label_cutoff <= date(2025, 6, 2)).all()
    assert all(r.label_cutoff == r.origin + 6 * WEEK for _, r in panel.iterrows())


def test_consumer_microdata_and_uncorroborated_news_are_rejected(data_root, tmp_path):
    import shutil
    root = tmp_path / "copy"
    shutil.copytree(data_root, root)
    cov = pd.read_csv(root / "covariates.csv", keep_default_na=False)
    cov.loc[0, ["metric", "unit", "sample_size", "value"]] = ["consumption_rate", "percent", 1, 50]
    cov.to_csv(root / "covariates.csv", index=False)
    with pytest.raises(DataError, match="aggregate"):
        load_dataset(root)
    cov.loc[0, "sample_size"] = 100
    cov.to_csv(root / "covariates.csv", index=False)
    events = pd.read_csv(root / "events.csv", keep_default_na=False)
    events.loc[0, "source_kind"] = "reviewed_news"
    events.to_csv(root / "events.csv", index=False)
    with pytest.raises(DataError, match="corroboration_ref"):
        load_dataset(root)


def test_news_metadata_is_idempotent_and_never_becomes_training_data(tmp_path):
    raw = b'<rss><channel><item><title>Fictional reported case</title><link>https://news.example/case?utm_source=rss</link><pubDate>Mon, 01 Jun 2026 12:00:00 GMT</pubDate></item></channel></rss>'
    path = tmp_path / "inbox.sqlite"
    with connect(path) as db:
        assert ingest_feed(db, "https://news.example/feed", raw, "2026-06-01T12:01:00Z") == 1
        assert ingest_feed(db, "https://news.example/feed", raw, "2026-06-02T12:01:00Z") == 0
        row = db.execute("SELECT * FROM articles").fetchone()
        assert row["status"] == "unreviewed"
        assert row["first_seen_at"] == "2026-06-01T12:01:00Z"
        identifier = row["id"]
    with pytest.raises(DataError, match="independent"):
        review(path, identifier, "corroborated")
    review(path, identifier, "corroborated", "canonical-case", "department-reference")
    assert not (tmp_path / "events.csv").exists()
    assert canonical_url("https://news.example/case?utm_source=rss#x") == "https://news.example/case"
    malicious = b'<!DOCTYPE x [<!ENTITY steal SYSTEM "file:///etc/passwd">]><rss>&steal;</rss>'
    with pytest.raises(Exception):
        parse_feed(malicious)


def test_atom_feed_keeps_source_metadata():
    rows = parse_feed(b'<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Example</title><link href="https://news.example/a"/><updated>2026-06-01T00:00:00Z</updated></entry></feed>')
    assert rows[0]["url"] == "https://news.example/a"
    assert rows[0]["published_at"] == "2026-06-01T00:00:00Z"


def test_end_to_end_training_artifact_holdout_and_abstention(data, tmp_path):
    as_of = date.fromisoformat(data.metadata["recommended_as_of"])
    out = tmp_path / "run"
    report = train(data, out, as_of)
    bundle = load_bundle(out / "model.joblib")
    assert report["synthetic"] is True
    assert report["horizonDays"] == 28
    assert report["selectedModel"] in ("model", "baseline", "recent_baseline")
    assert report["holdout"]["selected"]["mae"] >= 0
    assert len(report["holdout"]["folds"]) == 4
    assert report["monitoring"]["operationallyValidated"] is False
    selection_last = date.fromisoformat(report["selection"]["origins"][-1]) + 6 * WEEK
    calibration_first = date.fromisoformat(report["calibration"]["origins"][0])
    calibration_last = date.fromisoformat(report["calibration"]["origins"][-1]) + 6 * WEEK
    holdout_first = date.fromisoformat(report["holdout"]["origins"][0])
    assert selection_last <= calibration_first
    assert calibration_last <= holdout_first
    for fold in report["holdout"]["folds"]:
        assert fold["train_labels_through"] <= fold["origin"]
    assert forecast_bundle(bundle, data, as_of) == report["forecasts"]
    assert (out / "manifest.json").exists()
    assert (out / "model-card.md").exists()
    for row in report["forecasts"]:
        if row["status"] == "forecast":
            assert 0 <= row["lower"] <= row["estimate"] <= row["upper"]
    old = forecast_bundle(bundle, data, as_of + 14 * WEEK)
    assert all(r["status"] == "abstained" for r in old)
    from copy import deepcopy
    changed = deepcopy(data)
    changed.entities.loc[changed.entities.entity_id == "c02", "destination_id"] = "different-area"
    changed_row = next(r for r in forecast_bundle(bundle, changed, as_of) if r["entityId"] == "c02")
    assert changed_row["status"] == "abstained"
    assert "definition changed" in changed_row["reason"]
    mixed = deepcopy(data)
    mixed.metadata["data_mode"] = "real"
    with pytest.raises(DataError, match="synthetic model"):
        forecast_bundle(bundle, mixed, as_of)
    with pytest.raises(DataError, match="immutable"):
        train(data, out, as_of)


def test_short_history_fails_clearly(tmp_path):
    root = tmp_path / "short"
    generate_demo(root, weeks=12)
    data = load_dataset(root)
    with pytest.raises(DataError, match="No mature"):
        train(data, tmp_path / "run", date.fromisoformat(data.metadata["recommended_as_of"]))
