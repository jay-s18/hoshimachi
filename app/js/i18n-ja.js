/**
 * Japanese text, keyed by the English it replaces (see i18n.js). {placeholders} must match the English.
 * Long prose for the How it works dialog is in index.html ([data-lang="ja"]), not here.
 */
export const JA = {
  // ---------- page and header ----------
  "Hoshimachi 星待ち: stargazing trip planner for Japan": "星待ち Hoshimachi：日本の星空旅行プランナー",
  "Hoshimachi: odds of a clear, dark night anywhere in Japan": "星待ち：日本中の「晴れて暗い夜」に出会える確率",
  "Loading data…": "データを読み込み中…",
  Share: "共有",
  "Copy a link to this exact view: dates, settings and pinned spot": "今の表示（日程・設定・ピンの場所）のリンクをコピー",
  "Link copied": "リンクをコピーしました",
  "Copy the address bar": "アドレスバーをコピーしてください",
  "How it works": "仕組み",
  "Red light mode": "赤色ライトモード",
  Close: "閉じる",
  "Hoshimachi could not start.": "星待ちを起動できませんでした。",
  "If you opened index.html directly from disk, serve the folder over HTTP instead (see README).":
    "index.html を直接開いた場合は、フォルダを HTTP で配信してください（README 参照）。",

  // ---------- settings ----------
  "Trip settings": "旅行の設定",
  "Starting from": "出発地",
  "About: Starting from": "説明：出発地",
  "Regions are filtered by straight-line distance from this city to each region's darkest spot. Real travel is longer, and islands need a ferry or flight. Choose ‘Anywhere in Japan’ to see everything.":
    "この都市から各地域の最も暗い地点までの直線距離で絞り込みます。実際の移動距離はもっと長く、島へはフェリーか飛行機が必要です。すべて見るには「日本全国」を選んでください。",
  "Maximum distance": "最大距離",
  "Trip dates": "旅行日程",
  "About: Trip dates": "説明：旅行日程",
  "Pick the day you arrive and the day you leave. Every night in between counts, like a hotel booking: arrive Nov 8 and leave Nov 10 means the nights of Nov 8 and Nov 9.":
    "到着日と出発日を選びます。ホテルの予約と同じで、その間の夜がすべて対象です。11月8日に到着して10日に出発なら、8日と9日の夜です。",
  Arrive: "到着日",
  Leave: "出発日",
  "{n} night: ": "{n}泊：",
  "{n} nights: ": "{n}泊：",
  ", ": "、",
  "{a} to {b}": "{a}〜{b}",
  "Moon each night": "各夜の月",
  "About: Moon each night": "説明：各夜の月",
  "The share of the moon that is lit, and how many dark hours it costs on that night in central Japan. Hours with the moon above the horizon and more than 25% lit don't count towards a good night. Each region card shows that region's own hours.":
    "月の輝いている割合と、その夜（本州中部）に月のせいで失われる暗い時間です。月が地平線より上にあり25%以上輝いている時間は、好条件の夜に数えません。各地域のカードにはその地域の時間を表示します。",
  "{p}% lit": "輝面{p}%",
  "moon costs {h} h": "月で{h}時間減",
  "no moon cost": "月の影響なし",
  "Live forecast": "最新の天気予報",
  "About: Live forecast": "説明：最新の天気予報",
  "When your trip is within a week, this updates the odds with today's cloud forecast from the Japan Meteorological Agency. It is off by default because the free weather service has a limit shared by everyone on the same network. You can still see each spot's forecast in its card.":
    "旅行が1週間以内なら、気象庁の最新の雲の予報で確率を更新します。無料の気象サービスには同じネットワークの全員で共有する利用上限があるため、初期設定はオフです。各スポットの予報はカードでいつでも見られます。",
  "Use the live forecast in the odds": "確率に最新の予報を反映する",
  Shooting: "撮影対象",
  "About: Shooting": "説明：撮影対象",
  "Any dark sky: counts hours with the sun 18° below the horizon and the moon down or under 25% lit. Milky Way core: also needs the galactic core 10° above the horizon, roughly February to October in Japan. The core is only up for a few hours, so lower the hours needed to 1–2.":
    "暗い星空：太陽が地平線下18°以上で、月が沈んでいるか輝面25%未満の時間を数えます。天の川中心部：さらに銀河中心が地平線から10°以上の高さにあることが条件です（日本ではおよそ2月〜10月）。中心部が見える時間は数時間だけなので、必要な時間は1〜2時間に下げてください。",
  "Any dark sky": "暗い星空",
  "Milky Way core": "天の川中心部",
  "Darkest spot at least": "最も暗い地点の条件",
  "About: Bortle limit": "説明：ボートルの条件",
  "The Bortle scale runs from 1 (pristine sky) to 9 (inner city). Regions whose darkest ~1 km spot is brighter than your limit are hidden. Bortle 4 or darker shows the Milky Way clearly. Values are estimates and may be off by one class.":
    "ボートル・スケールは1（手つかずの暗い空）から9（都心）までです。最も暗い約1 kmの地点がこの条件より明るい地域は表示しません。ボートル4以下なら天の川がはっきり見えます。値は推定で、1階級ずれることがあります。",
  "Bortle 1": "ボートル1",
  "A good night needs": "好条件の夜の基準",
  "About: Good night": "説明：好条件の夜",
  "How many clear, dark hours a night needs to count as good. Clear means under 25% cloud in that hour. ‘In a row’ needs one unbroken window. ‘Passing clouds OK’ adds up clear hours with gaps, which suits places like Yaeyama where clouds drift through.":
    "好条件の夜とみなすのに必要な、晴れて暗い時間の数です。晴れとはその1時間の雲量が25%未満のこと。「連続」は途切れない時間帯が必要です。「途切れてもOK」は合間のある晴れ時間も合計します。雲が流れていく八重山のような場所に向いています。",
  "Clear hours needed": "必要な晴れ時間",
  "{n} hour": "{n}時間",
  "{n} hours": "{n}時間",
  "In a row": "連続",
  "Passing clouds OK": "途切れてもOK",
  "On the map": "地図の表示",
  "About: Map markers": "説明：地図のマーク",
  "Gold stars are certified International Dark Sky Places. White stars are spots the author has shot from. Grey dots are well-known stargazing spots. Positions are approximate.":
    "金色の星は国際ダークスカイ認定地、白い星は作者が撮影した場所、灰色の点は有名な星空スポットです。位置はおおよそです。",
  "Certified and well-known spots": "認定地と有名スポット",
  "About: {x}": "説明：{x}",

  // ---------- map ----------
  "Map of Japan": "日本地図",
  "Search a place: Nobeyama, 摩周湖, Mount Fuji…": "地名を検索：野辺山、摩周湖、富士山…",
  "Search a place in Japan": "日本の地名を検索",
  "Matching places": "一致する場所",
  "Trip odds": "旅行の確率",
  "Month odds": "月別の確率",
  Darkness: "空の暗さ",
  "Light trend": "光害の変化",
  Plain: "白地図",
  Roads: "道路",
  Terrain: "地形",
  Overlay: "重ね表示",
  "Road and terrain maps could not load here (the page may be embedded in a viewer that blocks them).":
    "道路・地形の地図を読み込めませんでした（ページが読み込みを制限するビューアに埋め込まれている可能性があります）。",
  "Chance of at least one good night on your trip": "旅行中に少なくとも1夜、好条件の夜になる確率",
  "Share of good nights in {m}, moon not counted": "{m}の好条件の夜の割合（月は考慮しない）",
  "Each square is a ~28 km cloud cell. Darkened squares fail your darkness or distance filter. A white box marks the selected region and a white dot its darkest spot.":
    "各マスは約28 kmの雲のセルです。暗くしたマスは暗さか距離の条件を満たしていません。白い枠が選択中の地域、白い点がその最も暗い地点です。",
  "Map squares": "地図のマス",
  certified: "認定地",
  "author's spots": "作者の撮影地",
  "well-known": "有名スポット",
  "Estimated sky brightness (Bortle class)": "推定される空の明るさ（ボートル階級）",
  "Modelled zenith sky brightness from satellite night lights, spread over 150 km. Brighter and warmer means more light pollution. Labels may be off by one class.":
    "衛星の夜間光を150 kmの範囲に広げて求めた、天頂の空の明るさのモデル値です。明るく暖かい色ほど光害が強いことを示します。階級は1つずれることがあります。",
  "Darkness layer": "空の暗さレイヤー",
  "darkest sky": "最も暗い空",
  "city glow": "都市の光",
  "Satellite night-light trend": "衛星で見た夜間光の変化",
  "Change in VIIRS satellite night lights over the years on record. The satellite under-sees blue-white LEDs, so real brightening is worse than shown, and some LED-converted areas may even appear to dim.":
    "記録期間中の VIIRS 衛星による夜間光の変化です。衛星は青白いLEDを捉えにくいため、実際の増加はこれより大きく、LEDに切り替えた地域は暗くなったように見えることもあります。",
  "brightening fast": "急速に明るく",
  brightening: "明るく",
  stable: "ほぼ変化なし",
  dimming: "暗く",
  "more than +30% per decade": "10年あたり+30%超",
  "+10% to +30% per decade": "10年あたり+10%〜+30%",
  "between −10% and +10% per decade": "10年あたり−10%〜+10%",
  "more than −10% per decade": "10年あたり−10%超の減少",
  "Certified Dark Sky Park, 2018": "ダークスカイ・パーク認定（2018年）",
  "Certified Dark Sky Park, 2020": "ダークスカイ・パーク認定（2020年）",
  "Certified Dark Sky Community, 2021": "ダークスカイ・コミュニティ認定（2021年）",
  "Certified Urban Night Sky Place, 2023": "アーバン・ナイトスカイ・プレイス認定（2023年）",
  "Field-tested by the author": "作者が実際に撮影",
  "Well-known stargazing spot": "有名な星空スポット",

  // ---------- place search ----------
  "this region's darkest spot": "この地域で最も暗い地点",
  "Hoshimachi spots and towns": "星待ちのスポットと町",
  "Places in Japan": "日本の地名",
  "Searching…": "検索中…",
  "Place search is unavailable right now.": "地名検索は現在利用できません。",
  "No other places found.": "ほかに見つかりませんでした。",
  "Keep typing…": "続けて入力してください…",
  "{x} is outside the regions Hoshimachi covers (sea or a small island).": "{x}は星待ちの対象地域外です（海上または小さな島）。",

  // ---------- results list ----------
  Results: "結果",
  "Your trip is within a week, so a weather forecast is available. Tick <b>Use the live forecast in the odds</b> to update these odds with it.":
    "旅行が1週間以内なので、天気予報が使えます。<b>確率に最新の予報を反映する</b>にチェックを入れると、確率が予報で更新されます。",
  "<b>Live forecast included.</b> These odds now mix the past {n} years with today's cloud forecast from the Japan Meteorological Agency. The closer a night is, the more the forecast counts. This mix is a rough estimate, not tested like the historical odds.":
    "<b>最新の予報を反映中。</b>この確率は過去{n}年分の記録と、気象庁による今日の雲の予報を組み合わせたものです。近い夜ほど予報を重視します。この組み合わせはおおまかな推定で、過去データによる確率のような検証はしていません。",
  "The live cloud forecast couldn't load, so these are historical odds only. It will try again in a minute; each region's card also has its own forecast.":
    "最新の雲の予報を読み込めなかったため、過去データだけの確率です。1分ほどで再試行します。各地域のカードでも予報を見られます。",
  "Loading the live cloud forecast for your trip…": "旅行日程の最新の雲の予報を読み込み中…",
  "These dates have passed. The odds show what history suggested beforehand.":
    "この日程は過ぎています。確率は、事前に過去データから見込まれた値です。",
  "Your dates fall inside our {period} record, so {years} is left out of the odds. Each region card shows what actually happened.":
    "日程が記録期間（{period}年）内にあるため、{years}年は確率から除いています。実際どうだったかは各地域のカードに表示します。",
  " and ": "・",
  "Clearly lower odds than #1 from here down. Everything above is within the uncertainty of #1.":
    "ここから下は1位より明らかに確率が低い地域です。上はすべて1位と誤差の範囲内です。",
  "near {x}": "{x}付近",
  "history {p}": "過去データ {p}",
  "range {r}": "範囲 {r}",
  "Best regions for {dates}, {nights}": "{dates}（{nights}）のおすすめ地域",
  "{n} night": "{n}泊",
  "{n} nights": "{n}泊",
  "Filter regions by town or prefecture": "市町村名や都道府県で絞り込む",
  "Filter regions": "地域を絞り込む",
  "{n} regions pass your filters": "条件に合う地域：{n}",
  "Odds are the chance of at least one good night on your trip, from replaying {period} weather around your dates. The range is a 95% interval from year-to-year variation. Regions above the dashed line are within the uncertainty of #1, so treat them as tied.":
    "確率は、{period}年の日程前後の天気を当てはめて求めた「旅行中に少なくとも1夜、好条件の夜になる確率」です。範囲は年ごとのばらつきによる95%区間です。点線より上の地域は1位と誤差の範囲内なので、同点とみなしてください。",
  "Odds and ranges": "確率と範囲",
  "Best odds": "確率順",
  Darkest: "暗さ順",
  "No usable dark hours on these dates: the moon is up and bright all night or the Milky Way core stays below 10°. Try dates nearer the new moon.":
    "この日程には使える暗い時間がありません。一晩中明るい月が出ているか、天の川中心部が10°より上に昇りません。新月に近い日程を試してください。",
  "No usable dark hours on these dates: the moon is up and bright all night. Try dates nearer the new moon.":
    "この日程には使える暗い時間がありません。一晩中明るい月が出ています。新月に近い日程を試してください。",
  "No regions match. Widen the distance or relax the darkness limit.":
    "条件に合う地域がありません。距離を広げるか、暗さの条件をゆるめてください。",

  // ---------- region card ----------
  "← All regions": "← 地域一覧",
  "This region doesn't pass your current darkness or distance filter.": "この地域は現在の暗さか距離の条件を満たしていません。",
  "trip odds with live forecast": "予報を反映した旅行の確率",
  "history alone {p}": "過去データのみ {p}",
  "trip odds, at least one good night": "旅行の確率（少なくとも1夜）",
  "Bortle {n}": "ボートル{n}",
  Bortle: "ボートル",
  "Bortle at darkest spot": "最暗地点のボートル",
  "est.": "推定",
  "km from {o}, straight line": "km（{o}から直線距離）",
  "km: pick a starting city": "km：出発地を選んでください",
  "Pinned spot": "ピンの地点",
  "Click or tap anywhere on the map to drop the pin. Sky brightness is the model estimate for that ~1 km pixel.":
    "地図のどこかをクリックまたはタップするとピンを置けます。空の明るさはその約1 kmの画素のモデル推定値です。",
  "The pin is over the sea. Tap on land.": "ピンが海上にあります。陸地をタップしてください。",
  "1 darkest": "1 最も暗い",
  "9 city": "9 都市",
  "Finding the place name…": "地名を検索中…",
  "Place name unavailable here": "この場所の地名は取得できません",
  "Terrain (地理院)": "地理院地図",
  "Live clouds": "現在の雲",
  "Copy coordinates": "座標をコピー",
  Copied: "コピーしました",
  "Copy failed: select the numbers above": "コピーできませんでした。上の数字を選択してください",
  "Back to this region's darkest spot": "この地域で最も暗い地点に戻る",
  "Satellite estimate, not a surveyed site. Check road access, land access and safety before you go.":
    "衛星による推定で、現地調査した場所ではありません。出かける前に、道路、立ち入りの可否、安全を確認してください。",

  // What you'll see here
  "What you'll see here": "ここで見える星空",
  "What the Bortle class means for your eyes: roughly how many stars you can see at once and how the Milky Way looks, on a clear night with no moon. The picture is an illustration, not a photo of this spot.":
    "ボートル階級が実際の見え方としてどういう意味か：月のない晴れた夜に、一度に見える星のおおよその数と、天の川の見え方です。絵はイメージで、この場所の写真ではありません。",
  "Compare Bortle classes": "ボートル階級を比べる",
  here: "ここ",
  "this spot": "この地点",
  "Illustration of the night sky at Bortle {n}": "ボートル{n}の夜空のイメージ",
  "stars visible at once": "一度に見える星の数",
  "Milky Way": "天の川",
  "Tap a class to compare. The dot marks the estimate for the pin. A rough guide for a clear, moonless night with eyes used to the dark for 20 minutes; eyesight, haze and the season change it.":
    "階級をタップすると比べられます。点はピンの地点の推定値です。月のない晴れた夜に、20分ほど目を暗さに慣らした場合のおおよその目安で、視力やかすみ、季節によって変わります。",
  "Excellent dark-sky site": "最高の暗い空",
  "Truly dark site": "本当に暗い空",
  "Rural sky": "田舎の空",
  "Rural–suburban transition": "田舎と郊外の間",
  "Suburban sky": "郊外の空",
  "Bright suburban sky": "明るい郊外の空",
  "Suburban–urban transition": "郊外と都市の間",
  "City sky": "都市の空",
  "Inner-city sky": "都心の空",
  "5,000+": "5,000個以上",
  "~4,000": "約4,000個",
  "~3,000": "約3,000個",
  "~2,000": "約2,000個",
  "~1,000": "約1,000個",
  "~500": "約500個",
  "~300": "約300個",
  "~100": "約100個",
  "under 50": "50個未満",
  "Bright enough to cast faint shadows, full of detail and dark lanes. Zodiacal light and airglow are visible.":
    "かすかに影ができるほど明るく、細かな模様や暗い筋まで見えます。黄道光や大気光も見えます。",
  "Clearly structured, like veined marble, almost down to the horizon.": "大理石の模様のようにはっきりした構造が、地平線近くまで見えます。",
  "Shows structure overhead, fading near the horizon. Faint glows from towns sit on the horizon.":
    "頭上では構造が見えますが、地平線近くではかすみます。地平線に町のかすかな光が見えます。",
  "Easy to see overhead but with little detail, washed out lower down. Town glows in several directions.":
    "頭上ではよく見えますが細部はわからず、低い所ではかすみます。いくつかの方角に町の光が見えます。",
  "Faint, and only visible high in the sky.": "かすかで、空の高い所でしか見えません。",
  "Barely visible, only straight overhead on the best nights.": "条件の良い夜に、真上でかろうじて見える程度です。",
  "Not visible. The whole sky glows grey.": "見えません。空全体が灰色に明るく光っています。",
  "Not visible. Only the familiar constellations stand out.": "見えません。おなじみの星座がわかる程度です。",
  "Not visible. Only the Moon, planets and the brightest stars.": "見えません。月と惑星、ごく明るい星だけです。",

  // Live forecast at the pin
  "Live forecast at the pin": "ピンの地点の最新予報",
  'Japan Meteorological Agency forecast for the next {n} nights at the pinned spot, hour by hour from 18:00 to 05:00. Outlined hours are usable: astronomically dark, with the moon down or under 25% lit. A night counts as good when its clear usable hours meet your "good night needs" setting.':
    "ピンの地点の今後{n}夜の気象庁の予報です（18時〜翌5時、1時間ごと）。枠で囲んだ時間が使える時間で、天文薄明が終わって暗く、月が沈んでいるか輝面25%未満です。使える晴れ時間が「好条件の夜の基準」を満たすと好条件の夜になります。",
  "Loading the forecast…": "予報を読み込み中…",
  'The live forecast couldn\'t load (offline, blocked or over the free limit). Try "Live clouds" above.':
    "予報を読み込めませんでした（オフライン、ブロック、または無料の上限超過）。上の「現在の雲」をお試しください。",
  "Show the forecast for the next {n} nights here": "この地点の今後{n}夜の予報を表示",
  "No forecast for the coming nights here.": "この地点の今後の夜の予報はありません。",
  Tonight: "今夜",
  "cloud {p}%": "雲量{p}%",
  "rain {mm} mm": "雨 {mm} mm",
  "usable dark hour": "使える暗い時間",
  "no dark hours": "暗い時間なし",
  "{a}/{b} h clear": "{a}/{b}時間 晴れ",
  "low {c}°": "最低{c}°",
  "wind {v} km/h": "風 {v} km/h",
  "dew likely": "夜露の可能性",
  trip: "旅行",
  "clear (cloud under {p}%, as in the odds)": "晴れ（雲量{p}%未満、確率と同じ基準）",
  "partly cloudy": "一部曇り",
  overcast: "曇り",
  "Model forecast for a ~5 km square around the pin (ground {m} m). Valley fog and mountain cloud can differ locally.":
    "ピン周辺の約5 km四方のモデル予報です（標高{m} m）。谷の霧や山の雲は局地的に異なることがあります。",

  // Sky from the pin
  "Sky from the pin": "ピンから見た空",
  "An approximate picture of the whole sky from the pin: horizon at the bottom, zenith at the top, all the way round. Glow falls with distance squared and haze, so a big city far away can look fainter than a village nearby, and distant domes sit lower. The sky is brightest near the horizon because you look through more air there (about 4× the zenith). Stars fade where the glow is strong. Hills that would hide a town are not modelled, and white LEDs are under-counted. An illustration, not a measurement.":
    "ピンから見た全天のおおよその様子です（下が地平線、上が天頂、ぐるりと一周）。光は距離の2乗とかすみで弱まるため、遠くの大都市が近くの村より暗く見えることがあり、遠い光のドームは低く見えます。地平線近くは空気の層が厚いため最も明るくなります（天頂の約4倍）。光が強い所では星が見えにくくなります。町を隠す山は考慮しておらず、白色LEDは少なめに数えられます。測定値ではなくイメージです。",
  "Simulated horizon glow around the pin": "ピン周辺の地平線の光のシミュレーション",
  Low: "弱い",
  Moderate: "中程度",
  High: "強い",
  "Very high": "非常に強い",
  ", mainly from {x}, {d} km away": "。主な光源は{x}（{d} km先）",
  ", mainly from {x}, close by": "。主な光源はすぐ近くの{x}",
  " That's where the Milky Way core sits, low between south-east and south-west.":
    "天の川中心部は南東から南西の低い空にあるので、その方角です。",
  " The southern sky, where the Milky Way core sits, is clearer.": "天の川中心部がある南の空は比較的暗いです。",
  "Horizon glow: {lv}. Brightest towards {dir}{from}.{core}": "地平線の光：{lv}。最も明るいのは{dir}の方角{from}。{core}",
  N: "北",
  NE: "北東",
  E: "東",
  SE: "南東",
  S: "南",
  SW: "南西",
  W: "西",
  NW: "北西",

  // Night by night
  "Night by night": "夜ごとの条件",
  "Usable hours have the sun 18° below the horizon and the moon down or under 25% lit, with the galactic core 10° up. Odds per night differ by a few points mostly through noise.":
    "使える時間は、太陽が地平線下18°以上、月が沈んでいるか輝面25%未満、かつ銀河中心が10°以上の高さにある時間です。夜ごとの確率の数ポイントの差は、ほとんどが誤差です。",
  "Usable hours have the sun 18° below the horizon and the moon down or under 25% lit. Odds per night differ by a few points mostly through noise.":
    "使える時間は、太陽が地平線下18°以上で、月が沈んでいるか輝面25%未満の時間です。夜ごとの確率の数ポイントの差は、ほとんどが誤差です。",
  "Night of": "日付",
  Moon: "月",
  "Usable hours": "使える時間",
  Forecast: "予報",
  Odds: "確率",
  none: "なし",
  "Forecast clear hours in the usable window; trusted {p}% for this night": "使える時間帯の予報の晴れ時間。この夜は予報を{p}%重視",
  "clear {h} h": "晴れ {h}時間",
  "cloudy {h} h": "曇り {h}時間",
  "beyond {n} days": "{n}日より先",
  "New moon": "新月",
  "Full moon": "満月",
  "Waxing crescent": "三日月（満ちていく）",
  "Waning crescent": "有明月（欠けていく）",
  "Waxing gibbous": "十三夜（満ちていく）",
  "Waning gibbous": "寝待月（欠けていく）",
  "Expected good nights on this trip:": "この旅行で見込まれる好条件の夜の数：",
  "What actually happened in {y}": "{y}年に実際どうだったか",
  "On these exact dates: {x} good night out of {n}. That year is excluded from the odds above.":
    "まったく同じ日程で、{n}夜中{x}夜が好条件でした。この年は上の確率から除いています。",
  "On these exact dates: {x} good nights out of {n}. That year is excluded from the odds above.":
    "まったく同じ日程で、{n}夜中{x}夜が好条件でした。この年は上の確率から除いています。",

  // Luck, months, trend, towns
  "How much luck is involved": "運の要素はどのくらい？",
  "Each box is the same dates in a past year. It shows how much outcomes swing from year to year. A clear night on these dates in a past year doesn't make one more likely this year: the odds pool every year and a month either side of your dates.":
    "各マスは過去の年の同じ日程です。年によって結果がどれだけ変わるかがわかります。過去にこの日程で晴れたからといって、今年晴れやすいわけではありません。確率は全部の年と、日程の前後1か月をまとめて求めています。",
  Luck: "運",
  "not used": "使用しない",
  "at least one good night": "少なくとも1夜は好条件",
  "no good night": "好条件の夜なし",
  "Filled = at least one good night on these dates that year.": "塗りつぶし＝その年のこの日程に少なくとも1夜、好条件の夜があった。",
  "Best months here": "この地域のベストシーズン",
  "Share of all nights in each month with a good clear window, using your hours setting. The moon is not counted, so pick new-moon dates within the best months.":
    "各月の夜のうち、設定した時間数の晴れ間があった夜の割合です。月は考慮していないので、良い月の中で新月に近い日程を選んでください。",
  "Best months": "ベストシーズン",
  "Best: {m} ({p})": "最良：{m}（{p}）",
  "Good-night odds by month": "月別の好条件の夜の確率",
  "Is the sky here changing?": "この空は変わってきている？",
  "Change in satellite-measured night light{since}, in % per decade: at the pin for its ~1 km pixel, as coloured on the Light trend layer, and for the whole region. The satellite under-sees blue-white LEDs, so real brightening is likely worse than shown.":
    "衛星で測った夜間光の変化{since}（10年あたりの%）です。ピンの約1 kmの画素（光害の変化レイヤーの色と同じ）と、地域全体の値を示します。衛星は青白いLEDを捉えにくいため、実際の増加はこれより大きい可能性があります。",
  " since {y}": "（{y}年以降）",
  "Reading the trend at the pin…": "ピンの地点の変化を読み取り中…",
  "At the pin (~1 km):": "ピンの地点（約1 km）：",
  "too little artificial light to measure a trend, a good sign for darkness":
    "人工の光が少なすぎて変化を測れません。暗さにとっては良い兆候です",
  "more than {x}": "{x}超",
  "{x} per decade": "10年あたり{x}",
  "{p}% per decade": "10年あたり{p}%",
  "Whole region (~28 km): too little artificial light for the satellite to measure a trend.":
    "地域全体（約28 km）：人工の光が少なすぎて、衛星では変化を測れません。",
  "Whole region (~28 km square), all its lights together: {x}": "地域全体（約28 km四方）の光をすべて合わせると：{x}",
  "Towns in this region": "この地域の市町村",

  // ---------- validation (How it works) ----------
  "No validation results are bundled with this data.": "このデータには検証結果が含まれていません。",
  "{x} pts": "{x}ポイント",
  " (about {k},000 predictions per trip length)": "（旅行の長さごとに約{k},000件の予測）",
  "Settings were chosen on {tune} using data before them. The model was then refit on everything before {y0} and tested once on every trip start date in {test} across all {n} regions{per}.":
    "設定は{tune}年について、それ以前のデータを使って選びました。その後、{y0}年より前の全データでモデルを作り直し、{test}年のすべての旅行開始日・全{n}地域で一度だけテストしました{per}。",
  "Trip length": "旅行の長さ",
  "Largest calibration gap": "確率のずれの最大値",
  "Better than ignoring the season": "季節を無視した場合より",
  "Better than ignoring the region": "地域を無視した場合より",
  'Brier skill scores with 95% block-bootstrap intervals. Most of the skill comes from knowing the region and the season: against a plain "this region, this month" average, the replay and blending add {lo}–{hi}%. A single night\'s weather is mostly luck, so no base rate can be sharp; its job is to be honest about the odds.':
    "ブライアスキルスコアと95%ブロック・ブートストラップ区間です。精度の大部分は地域と季節を知ることから来ています。単純な「この地域・この月」の平均と比べると、過去の天気の当てはめと平滑化で{lo}〜{hi}%改善します。1夜の天気はほとんど運なので、どんな基準確率もはっきりとは当たりません。大事なのは確率を正直に示すことです。",
  "Across Japan, darkness and clear-night odds are negatively correlated ({r}).":
    "日本全体では、空の暗さと晴れる確率には負の相関があります（{r}）。",
  "National clear-night frequency was {a}% in {ya} and {b}% in {yb}.": "全国の晴れた夜の割合は、{ya}年が{a}%、{yb}年が{b}%でした。",
  "Other checks:": "その他の確認：",
};
