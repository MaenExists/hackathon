import pytest
import networkx as nx
import numpy as np
import pandas as pd
from pathlib import Path

from corridor_transit_model import (
    DISTRICTS,
    GATEWAYS,
    CORRIDOR_EDGES,
    build_corridor_graph,
    NextHopPredictor,
    build_macro_features,
    simulate_enforcement_displacement,
    load_unified_dataset,
)
from tools.kanoon_collector import extract_incident, parse_judgment_date


def test_corridor_graph_topology():
    G = build_corridor_graph()
    # Check all 14 districts are in graph
    for d in DISTRICTS:
        assert G.has_node(d), f"District {d} missing in corridor graph"
        assert G.nodes[d]["kind"] == "district"

    # Check key border gateways exist
    for k in ["muthanga", "walayar", "kumily", "aryankavu", "thalappady"]:
        assert G.has_node(k), f"Gateway {k} missing in corridor graph"
        assert G.nodes[k]["kind"] == "gateway"

    # Verify road connectivity from Muthanga to Ernakulam
    assert nx.has_path(G, "muthanga", "Ernakulam")
    path = nx.shortest_path(G, "muthanga", "Ernakulam", weight="time_hrs")
    assert path[0] == "muthanga"
    assert path[-1] == "Ernakulam"
    time_taken = nx.shortest_path_length(G, "muthanga", "Ernakulam", weight="time_hrs")
    assert 5.0 <= time_taken <= 12.0  # realistic road travel time


def test_next_hop_predictor_inference():
    G = build_corridor_graph()
    predictor = NextHopPredictor(G)

    # Synthetic training data
    df = pd.DataFrame([
        {"district": "Wayanad", "place": "muthanga", "substance": "mdma", "quantity_g": 50.0, "transport_mode": "road_private", "date": "2024-03-01", "origin_hub": "Bengaluru", "destination_district": "Kozhikode"},
        {"district": "Palakkad", "place": "walayar", "substance": "ganja", "quantity_g": 50000.0, "transport_mode": "road_private", "date": "2024-03-02", "origin_hub": "Andhra Pradesh", "destination_district": "Ernakulam"},
        {"district": "Kasaragod", "place": "thalappady", "substance": "mdma", "quantity_g": 20.0, "transport_mode": "bus", "date": "2024-03-03", "origin_hub": "Mangalore", "destination_district": "Kannur"},
        {"district": "Idukki", "place": "kumily", "substance": "ganja", "quantity_g": 10000.0, "transport_mode": "road_private", "date": "2024-03-04", "origin_hub": "Madurai", "destination_district": "Kottayam"},
    ] * 20)  # repeat to satisfy min_samples_leaf

    predictor.fit(df)
    assert predictor.is_fitted

    pred = predictor.predict_next_hop(
        entry_node="muthanga",
        substance="mdma",
        quantity_g=75.0,
        transport_mode="road_private"
    )

    assert "predicted_destinations" in pred
    assert len(pred["predicted_destinations"]) == 3
    # Check probabilities are sorted descending
    probs = [d["probability"] for d in pred["predicted_destinations"]]
    assert probs == sorted(probs, reverse=True)
    assert sum(probs) <= 100.01

    # Check tactical and community directives are populated
    assert len(pred["enforcer_tactical_directive"]) >= 2
    assert len(pred["community_early_warning"]) >= 2


def test_macro_features_no_future_leakage():
    # Generate continuous dummy weekly count panel
    idx = pd.date_range("2023-01-02", periods=50, freq="W-MON")
    C = pd.DataFrame(np.random.poisson(2, size=(50, 14)), index=idx, columns=DISTRICTS)

    H = 2
    F = build_macro_features(C, H=H)

    # Test lag features at t=0
    first_week = F[F["t"] == 0]
    # Lags at t=0 should be NaN because there is no prior history
    assert first_week["own_l1"].isna().all()

    # Targets y at cutoff T-H should exist, but at T-1 should be NaN
    valid_F = F.dropna()
    assert (valid_F["t"] <= 50 - H - 1).all()


def test_counterfactual_displacement_conservation():
    res = simulate_enforcement_displacement("walayar", 50.0)
    assert res["target_checkpost"] == "walayar"
    assert "rerouting_distribution" in res
    total_share = sum(item["share_pct"] for item in res["rerouting_distribution"])
    assert abs(total_share - 100.0) < 1e-4  # Flow conservation (100%)


def test_kanoon_case_extraction():
    sample_text = """
    CRIME NO. 1234/2025 OF SULTHAN BATHERY POLICE STATION, WAYANAD
    The applicant was charged under Section 22(c) of the NDPS Act.
    The applicant was found in possession of 55.5 grams of MDMA near Muthanga checkpost.
    The applicant was travelling from Bengaluru to Kozhikode in a private vehicle.
    """
    case = extract_incident(999999, "Test Accused vs State Of Kerala on 10 March, 2025", sample_text)
    assert case is not None
    assert case["district"] == "Wayanad"
    assert case["substance"] == "mdma"
    assert case["quantity_g"] == 55.5
    assert case["origin_place"] == "Bengaluru"
    assert case["destination_place"] == "Kozhikode"
    assert case["is_commercial"] is True
