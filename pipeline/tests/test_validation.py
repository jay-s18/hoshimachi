"""The parts of validation whose correctness the published numbers depend on."""

import numpy as np
import pandas as pd
import pytest

from hoshimachi_pipeline.validation.estimator import CalendarIndex, neighbour_matrix, replay_predict
from hoshimachi_pipeline.validation.metrics import brier, skill
from hoshimachi_pipeline.validation.nights import decode_bits, good_nights, good_trips, longest_run, sun_altitude
from hoshimachi_pipeline.validation.run import Split


def test_decode_bits_order():
    # bit 0 = first hour (18:00), bit 11 = last hour (05:00)
    flags = decode_bits(np.array([0b100000000001], dtype=np.uint16), 12)
    assert flags[0].tolist() == [True] + [False] * 10 + [True]


def test_longest_run():
    f = np.array([[1, 1, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0]], bool)
    assert longest_run(f).tolist() == [3]


def test_good_nights_rules():
    clear = np.array([[[1, 1, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0]]], bool)
    dark = np.ones_like(clear)
    assert good_nights(clear, dark, 3, "run").item() is False  # longest run is 2
    assert good_nights(clear, dark, 3, "any").item() is True  # 4 clear hours with gaps
    assert good_nights(clear, ~dark, 1, "any").item() is False  # clear but never dark


def test_good_trips_any_night():
    nights = np.array([[0], [0], [1], [0]], bool)
    assert good_trips(nights, 2)[:, 0].tolist() == [False, True, True]


def test_sun_altitude_sanity():
    t = pd.DatetimeIndex(["2024-06-21 03:00", "2024-06-21 15:00"])  # UTC: noon and midnight in Tokyo
    alt = sun_altitude(t, np.array([35.68]), np.array([139.77]))[:, 0]
    assert alt[0] > 70 and alt[1] < -25


def test_replay_excludes_held_out_years():
    dates = pd.date_range("2015-01-01", "2016-12-31")
    trips = np.zeros((len(dates), 1), bool)
    trips[dates.year == 2016] = True  # held-out year is all successes
    p = replay_predict(trips, dates, CalendarIndex(dates), [2015], pd.Timestamp("2016-06-15"), 15, 0.0, np.eye(1), k=1)
    assert p[0] == 0.0


def test_replay_excludes_trips_ending_in_held_out_year():
    dates = pd.date_range("2015-01-01", "2016-12-31")
    nights = np.zeros((len(dates), 1), bool)
    nights[dates == pd.Timestamp("2016-01-01")] = True  # only good night is in the held-out year
    trips = good_trips(nights, 3)
    p = replay_predict(trips, dates, CalendarIndex(dates), [2015], pd.Timestamp("2016-12-28"), 7, 0.0, np.eye(1), k=3)
    assert p[0] == 0.0


def test_brier_and_skill():
    y = np.array([1.0, 0.0])
    assert brier(np.array([1.0, 0.0]), y) == 0.0
    assert abs(skill(0.15, 0.20) - 0.25) < 1e-12


def test_neighbour_matrix_rows_sum_to_one():
    A = neighbour_matrix(np.array([[0, 0], [0, 1], [1, 1], [5, 5]]))
    assert np.allclose(A.sum(1), 1)
    assert A[3, 3] == 1.0  # isolated cell averages itself
    assert A[0].tolist() == [0, 0.5, 0.5, 0]


def test_rolling_split_moves_with_the_data():
    s = Split.rolling(list(range(2015, 2025)), tune_n=2, test_n=2)
    assert (s.tune, s.test) == ([2021, 2022], [2023, 2024])
    assert s.tune_train == list(range(2015, 2021)) and s.final_train == list(range(2015, 2023))
    s = Split.rolling(list(range(2015, 2026)), tune_n=2, test_n=2)  # one more year of data
    assert (s.tune, s.test) == ([2022, 2023], [2024, 2025])


def test_rolling_split_needs_enough_years():
    with pytest.raises(ValueError):
        Split.rolling([2020, 2021, 2022, 2023, 2024], 2, 2)
