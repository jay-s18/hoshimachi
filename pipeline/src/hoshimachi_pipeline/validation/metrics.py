"""Scoring probability forecasts of a yes/no outcome."""

from __future__ import annotations

import numpy as np


def brier(p: np.ndarray, y: np.ndarray) -> float:
    """Mean squared error between predicted probability and the 0/1 outcome (lower is better)."""
    return float(np.mean((p - y) ** 2))


def skill(score: float, reference: float) -> float:
    """Brier skill score: share of the reference's error removed (0 = no better, 1 = perfect)."""
    return 1.0 - score / reference


def reliability(p: np.ndarray, y: np.ndarray, bins: int, min_count: int) -> list[dict]:
    """Mean prediction vs observed frequency per equal-width bin."""
    edges = np.linspace(0, 1, bins + 1)
    cat = np.clip(np.digitize(p, edges) - 1, 0, bins - 1)
    out = []
    for b in range(bins):
        s = cat == b
        if s.sum() >= min_count:
            out.append(
                {
                    "bin": f"{edges[b]:.1f}-{edges[b + 1]:.1f}",
                    "n": int(s.sum()),
                    "predicted": float(p[s].mean()),
                    "observed": float(y[s].mean()),
                }
            )
    return out


def block_bootstrap_skill(
    se_model: np.ndarray, se_ref: np.ndarray, blocks: np.ndarray, reps: int, seed: int
) -> tuple[float, float]:
    """95% interval for the Brier skill score, resampling whole blocks (test weeks) with replacement.

    se_model, se_ref : squared errors per prediction; blocks : block id per prediction.
    Resampling weeks, not individual predictions, respects the fact that all regions in one week
    share weather systems.
    """
    ids, inv = np.unique(blocks, return_inverse=True)
    sm = np.bincount(inv, weights=se_model)
    sr = np.bincount(inv, weights=se_ref)
    rng = np.random.default_rng(seed)
    draws = rng.integers(0, len(ids), size=(reps, len(ids)))
    sk = 1 - sm[draws].sum(1) / sr[draws].sum(1)
    lo, hi = np.percentile(sk, [2.5, 97.5])
    return float(lo), float(hi)
