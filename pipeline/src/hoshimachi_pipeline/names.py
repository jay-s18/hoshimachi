"""English and Japanese place names for municipalities and prefectures."""

from __future__ import annotations

from functools import cache, lru_cache

import geopandas as gpd
import pykakasi

PREFECTURES = dict(
    zip(
        "北海道 青森県 岩手県 宮城県 秋田県 山形県 福島県 茨城県 栃木県 群馬県 埼玉県 千葉県 東京都 神奈川県 新潟県 富山県 "
        "石川県 福井県 山梨県 長野県 岐阜県 静岡県 愛知県 三重県 滋賀県 京都府 大阪府 兵庫県 奈良県 和歌山県 鳥取県 島根県 "
        "岡山県 広島県 山口県 徳島県 香川県 愛媛県 高知県 福岡県 佐賀県 長崎県 熊本県 大分県 宮崎県 鹿児島県 沖縄県".split(),
        "Hokkaido Aomori Iwate Miyagi Akita Yamagata Fukushima Ibaraki Tochigi Gunma Saitama Chiba Tokyo Kanagawa Niigata "
        "Toyama Ishikawa Fukui Yamanashi Nagano Gifu Shizuoka Aichi Mie Shiga Kyoto Osaka Hyogo Nara Wakayama Tottori "
        "Shimane Okayama Hiroshima Yamaguchi Tokushima Kagawa Ehime Kochi Fukuoka Saga Nagasaki Kumamoto Oita Miyazaki "
        "Kagoshima Okinawa".split(),
        strict=True,
    )
)
KINDS = {"市": "City", "町": "Town", "村": "Village", "区": "Ward"}
# N03 municipality dataset columns: N03_001 prefecture, N03_003 county/city, N03_004 municipality
COL_PREF, NAME_COLS = "N03_001", ("N03_004", "N03_003")


@lru_cache(maxsize=1)
def _kakasi():
    return pykakasi.kakasi()


class Namer:
    def __init__(self, municipalities: gpd.GeoDataFrame, fixes: dict[str, str]):
        self.muni = municipalities
        self.fixes = fixes

    def romaji(self, base: str) -> str:
        if base in self.fixes:
            return self.fixes[base]
        s = "".join(x["hepburn"] for x in _kakasi().convert(base))
        for long, short in (("ou", "o"), ("uu", "u"), ("oo", "o")):  # drop long-vowel doubling: Tōkyō -> Tokyo
            s = s.replace(long, short)
        return s.capitalize()

    @cache  # noqa: B019 - one Namer per build; caching per row is the point
    def label(self, row: int) -> dict[str, str]:
        """{en, jp, pref, prefjp} for municipality row `row`."""
        r = self.muni.loc[row]
        jp = next((str(r[k]) for k in NAME_COLS if isinstance(r[k], str) and r[k]), "")
        kind = KINDS.get(jp[-1:], "")
        base = jp[:-1] if kind else jp
        en = self.romaji(base) + (f" {kind}" if kind else "")
        return {"en": en, "jp": jp, "pref": PREFECTURES.get(r[COL_PREF], r[COL_PREF]), "prefjp": r[COL_PREF]}
