/**
 * Japan Post EMS accepted countries, organized by zone (地帯).
 * Source: https://www.post.japanpost.jp/int/ems/country/all.html
 * Zone determines EMS pricing.
 */

export const COUNTRY_ZONES = {
  zone1: {
    label: "第1地帯（中国・韓国・台湾）",
    countries: [
      { code: "KR", name: "韩国", nameJa: "韓国" },
      { code: "TW", name: "台湾", nameJa: "台湾" },
      { code: "CN", name: "中国", nameJa: "中国" },
    ],
  },
  zone2: {
    label: "第2地帯（亚洲）",
    countries: [
      { code: "IN", name: "印度", nameJa: "インド" },
      { code: "ID", name: "印度尼西亚", nameJa: "インドネシア" },
      { code: "KH", name: "柬埔寨", nameJa: "カンボジア" },
      { code: "SG", name: "新加坡", nameJa: "シンガポール" },
      { code: "LK", name: "斯里兰卡", nameJa: "スリランカ" },
      { code: "TH", name: "泰国", nameJa: "タイ" },
      { code: "NP", name: "尼泊尔", nameJa: "ネパール" },
      { code: "PK", name: "巴基斯坦", nameJa: "パキスタン" },
      { code: "BD", name: "孟加拉国", nameJa: "バングラデシュ" },
      { code: "PH", name: "菲律宾", nameJa: "フィリピン" },
      { code: "BT", name: "不丹", nameJa: "ブータン" },
      { code: "BN", name: "文莱", nameJa: "ブルネイ" },
      { code: "VN", name: "越南", nameJa: "ベトナム" },
      { code: "HK", name: "香港", nameJa: "香港" },
      { code: "MO", name: "澳门", nameJa: "マカオ" },
      { code: "MY", name: "马来西亚", nameJa: "マレーシア" },
      { code: "MM", name: "缅甸", nameJa: "ミャンマー" },
      { code: "MV", name: "马尔代夫", nameJa: "モルディブ" },
      { code: "MN", name: "蒙古", nameJa: "モンゴル" },
      { code: "LA", name: "老挝", nameJa: "ラオス" },
    ],
  },
  zone3: {
    label: "第3地帯（大洋洲・北美・中近东・欧洲）",
    countries: [
      // オセアニア
      { code: "AU", name: "澳大利亚", nameJa: "オーストラリア" },
      { code: "CK", name: "库克群岛", nameJa: "クック" },
      { code: "SB", name: "所罗门群岛", nameJa: "ソロモン" },
      { code: "NC", name: "新喀里多尼亚", nameJa: "ニュー・カレドニア" },
      { code: "NZ", name: "新西兰", nameJa: "ニュージーランド" },
      { code: "PG", name: "巴布亚新几内亚", nameJa: "パプアニューギニア" },
      { code: "FJ", name: "斐济", nameJa: "フィジー" },
      // 北アメリカ（米国除く）
      { code: "CA", name: "加拿大", nameJa: "カナダ" },
      { code: "PM", name: "圣皮埃尔和密克隆", nameJa: "サンピエールおよびミクロン" },
      { code: "MX", name: "墨西哥", nameJa: "メキシコ" },
      // 中近東
      { code: "AE", name: "阿联酋", nameJa: "アラブ首長国連邦" },
      { code: "IL", name: "以色列", nameJa: "イスラエル" },
      { code: "IQ", name: "伊拉克", nameJa: "イラク" },
      { code: "IR", name: "伊朗", nameJa: "イラン" },
      { code: "OM", name: "阿曼", nameJa: "オマーン" },
      { code: "QA", name: "卡塔尔", nameJa: "カタール" },
      { code: "KW", name: "科威特", nameJa: "クウェート" },
      { code: "SA", name: "沙特阿拉伯", nameJa: "サウジアラビア" },
      { code: "SY", name: "叙利亚", nameJa: "シリア" },
      { code: "TR", name: "土耳其", nameJa: "トルコ" },
      { code: "BH", name: "巴林", nameJa: "バーレーン" },
      { code: "JO", name: "约旦", nameJa: "ヨルダン" },
      { code: "LB", name: "黎巴嫩", nameJa: "レバノン" },
      // ヨーロッパ
      { code: "IS", name: "冰岛", nameJa: "アイスランド" },
      { code: "IE", name: "爱尔兰", nameJa: "アイルランド" },
      { code: "AZ", name: "阿塞拜疆", nameJa: "アゼルバイジャン" },
      { code: "AD", name: "安道尔", nameJa: "アンドラ" },
      { code: "IT", name: "意大利", nameJa: "イタリア" },
      { code: "UA", name: "乌克兰", nameJa: "ウクライナ" },
      { code: "GB", name: "英国", nameJa: "英国" },
      { code: "EE", name: "爱沙尼亚", nameJa: "エストニア" },
      { code: "AT", name: "奥地利", nameJa: "オーストリア" },
      { code: "NL", name: "荷兰", nameJa: "オランダ" },
      { code: "GG", name: "根西岛", nameJa: "ガーンジー" },
      { code: "MK", name: "北马其顿", nameJa: "北マケドニア" },
      { code: "CY", name: "塞浦路斯", nameJa: "キプロス" },
      { code: "GR", name: "希腊", nameJa: "ギリシャ" },
      { code: "HR", name: "克罗地亚", nameJa: "クロアチア" },
      { code: "SM", name: "圣马力诺", nameJa: "サンマリノ" },
      { code: "JE", name: "泽西岛", nameJa: "ジャージー" },
      { code: "CH", name: "瑞士", nameJa: "スイス" },
      { code: "SE", name: "瑞典", nameJa: "スウェーデン" },
      { code: "ES", name: "西班牙", nameJa: "スペイン" },
      { code: "SK", name: "斯洛伐克", nameJa: "スロバキア" },
      { code: "SI", name: "斯洛文尼亚", nameJa: "スロベニア" },
      { code: "CZ", name: "捷克", nameJa: "チェコ" },
      { code: "DK", name: "丹麦", nameJa: "デンマーク" },
      { code: "DE", name: "德国", nameJa: "ドイツ" },
      { code: "NO", name: "挪威", nameJa: "ノルウェー" },
      { code: "HU", name: "匈牙利", nameJa: "ハンガリー" },
      { code: "FI", name: "芬兰", nameJa: "フィンランド" },
      { code: "FR", name: "法国", nameJa: "フランス" },
      { code: "BG", name: "保加利亚", nameJa: "ブルガリア" },
      { code: "BY", name: "白俄罗斯", nameJa: "ベラルーシ" },
      { code: "BE", name: "比利时", nameJa: "ベルギー" },
      { code: "PL", name: "波兰", nameJa: "ポーランド" },
      { code: "PT", name: "葡萄牙", nameJa: "ポルトガル" },
      { code: "MT", name: "马耳他", nameJa: "マルタ" },
      { code: "MC", name: "摩纳哥", nameJa: "モナコ" },
      { code: "LV", name: "拉脱维亚", nameJa: "ラトビア" },
      { code: "LT", name: "立陶宛", nameJa: "リトアニア" },
      { code: "LI", name: "列支敦士登", nameJa: "リヒテンシュタイン" },
      { code: "LU", name: "卢森堡", nameJa: "ルクセンブルク" },
      { code: "RO", name: "罗马尼亚", nameJa: "ルーマニア" },
      { code: "RU", name: "俄罗斯", nameJa: "ロシア" },
    ],
  },
  zone4: {
    label: "第4地帯（美国）",
    countries: [
      { code: "US", name: "美国", nameJa: "アメリカ合衆国" },
    ],
  },
  zone5: {
    label: "第5地帯（中南美・非洲）",
    countries: [
      // 中南米
      { code: "AR", name: "阿根廷", nameJa: "アルゼンチン" },
      { code: "UY", name: "乌拉圭", nameJa: "ウルグアイ" },
      { code: "EC", name: "厄瓜多尔", nameJa: "エクアドル" },
      { code: "SV", name: "萨尔瓦多", nameJa: "エルサルバドル" },
      { code: "GP", name: "瓜德罗普", nameJa: "ガドループ" },
      { code: "CU", name: "古巴", nameJa: "キューバ" },
      { code: "CR", name: "哥斯达黎加", nameJa: "コスタリカ" },
      { code: "CO", name: "哥伦比亚", nameJa: "コロンビア" },
      { code: "JM", name: "牙买加", nameJa: "ジャマイカ" },
      { code: "CL", name: "智利", nameJa: "チリ" },
      { code: "TT", name: "特立尼达和多巴哥", nameJa: "トリニダード・トバゴ" },
      { code: "PA", name: "巴拿马", nameJa: "パナマ" },
      { code: "PY", name: "巴拉圭", nameJa: "パラグアイ" },
      { code: "BB", name: "巴巴多斯", nameJa: "バルバドス" },
      { code: "GF", name: "法属圭亚那", nameJa: "仏領ギアナ" },
      { code: "BR", name: "巴西", nameJa: "ブラジル" },
      { code: "VE", name: "委内瑞拉", nameJa: "ベネズエラ" },
      { code: "PE", name: "秘鲁", nameJa: "ペルー" },
      { code: "HN", name: "洪都拉斯", nameJa: "ホンジュラス" },
      { code: "MQ", name: "马提尼克", nameJa: "マルチニーク" },
      // アフリカ
      { code: "DZ", name: "阿尔及利亚", nameJa: "アルジェリア" },
      { code: "UG", name: "乌干达", nameJa: "ウガンダ" },
      { code: "EG", name: "埃及", nameJa: "エジプト" },
      { code: "ET", name: "埃塞俄比亚", nameJa: "エチオピア" },
      { code: "GH", name: "加纳", nameJa: "ガーナ" },
      { code: "GA", name: "加蓬", nameJa: "ガボン" },
      { code: "KE", name: "肯尼亚", nameJa: "ケニア" },
      { code: "CI", name: "科特迪瓦", nameJa: "コートジボワール" },
      { code: "DJ", name: "吉布提", nameJa: "ジブチ" },
      { code: "ZW", name: "津巴布韦", nameJa: "ジンバブエ" },
      { code: "SD", name: "苏丹", nameJa: "スーダン" },
      { code: "SN", name: "塞内加尔", nameJa: "セネガル" },
      { code: "TZ", name: "坦桑尼亚", nameJa: "タンザニア" },
      { code: "TN", name: "突尼斯", nameJa: "チュニジア" },
      { code: "TG", name: "多哥", nameJa: "トーゴ" },
      { code: "NG", name: "尼日利亚", nameJa: "ナイジェリア" },
      { code: "BW", name: "博茨瓦纳", nameJa: "ボツワナ" },
      { code: "MG", name: "马达加斯加", nameJa: "マダガスカル" },
      { code: "ZA", name: "南非", nameJa: "南アフリカ共和国" },
      { code: "MU", name: "毛里求斯", nameJa: "モーリシャス" },
      { code: "MA", name: "摩洛哥", nameJa: "モロッコ" },
      { code: "RW", name: "卢旺达", nameJa: "ルワンダ" },
      { code: "RE", name: "留尼汪", nameJa: "レユニオン" },
    ],
  },
};

/** Flat list of all countries with zone info */
export const ALL_COUNTRIES = Object.entries(COUNTRY_ZONES).flatMap(([zone, { countries }]) =>
  countries.map(c => ({ ...c, zone }))
);

/** Get zone for a country code */
export function getCountryZone(code) {
  const c = ALL_COUNTRIES.find(c => c.code === code);
  return c?.zone || null;
}

/** Get country by code */
export function getCountry(code) {
  return ALL_COUNTRIES.find(c => c.code === code) || null;
}

/**
 * EMS rates by zone (JPY), indexed by max weight in grams.
 * Source: https://www.post.japanpost.jp/int/charge/list/ems_all.html
 */
export const EMS_RATES = {
  zone1: [
    { maxWeight: 500, fee: 1450 },
    { maxWeight: 600, fee: 1600 },
    { maxWeight: 700, fee: 1750 },
    { maxWeight: 800, fee: 1900 },
    { maxWeight: 900, fee: 2050 },
    { maxWeight: 1000, fee: 2200 },
    { maxWeight: 1250, fee: 2500 },
    { maxWeight: 1500, fee: 2800 },
    { maxWeight: 1750, fee: 3100 },
    { maxWeight: 2000, fee: 3400 },
    { maxWeight: 2500, fee: 3900 },
    { maxWeight: 3000, fee: 4400 },
    { maxWeight: 3500, fee: 4900 },
    { maxWeight: 4000, fee: 5400 },
    { maxWeight: 4500, fee: 5900 },
    { maxWeight: 5000, fee: 6400 },
    { maxWeight: 5500, fee: 6900 },
    { maxWeight: 6000, fee: 7400 },
    { maxWeight: 7000, fee: 8200 },
    { maxWeight: 8000, fee: 9000 },
    { maxWeight: 9000, fee: 9800 },
    { maxWeight: 10000, fee: 10600 },
    { maxWeight: 11000, fee: 11400 },
    { maxWeight: 12000, fee: 12200 },
    { maxWeight: 13000, fee: 13000 },
    { maxWeight: 14000, fee: 13800 },
    { maxWeight: 15000, fee: 14600 },
    { maxWeight: 16000, fee: 15400 },
    { maxWeight: 17000, fee: 16200 },
    { maxWeight: 18000, fee: 17000 },
    { maxWeight: 19000, fee: 17800 },
    { maxWeight: 20000, fee: 18600 },
    { maxWeight: 21000, fee: 19400 },
    { maxWeight: 22000, fee: 20200 },
    { maxWeight: 23000, fee: 21000 },
    { maxWeight: 24000, fee: 21800 },
    { maxWeight: 25000, fee: 22600 },
    { maxWeight: 26000, fee: 23400 },
    { maxWeight: 27000, fee: 24200 },
    { maxWeight: 28000, fee: 25000 },
    { maxWeight: 29000, fee: 25800 },
    { maxWeight: 30000, fee: 26600 },
  ],
  zone2: [
    { maxWeight: 500, fee: 1900 },
    { maxWeight: 600, fee: 2150 },
    { maxWeight: 700, fee: 2400 },
    { maxWeight: 800, fee: 2650 },
    { maxWeight: 900, fee: 2900 },
    { maxWeight: 1000, fee: 3150 },
    { maxWeight: 1250, fee: 3500 },
    { maxWeight: 1500, fee: 3850 },
    { maxWeight: 1750, fee: 4200 },
    { maxWeight: 2000, fee: 4550 },
    { maxWeight: 2500, fee: 5150 },
    { maxWeight: 3000, fee: 5750 },
    { maxWeight: 3500, fee: 6350 },
    { maxWeight: 4000, fee: 6950 },
    { maxWeight: 4500, fee: 7550 },
    { maxWeight: 5000, fee: 8150 },
    { maxWeight: 5500, fee: 8750 },
    { maxWeight: 6000, fee: 9350 },
    { maxWeight: 7000, fee: 10350 },
    { maxWeight: 8000, fee: 11350 },
    { maxWeight: 9000, fee: 12350 },
    { maxWeight: 10000, fee: 13350 },
    { maxWeight: 11000, fee: 14350 },
    { maxWeight: 12000, fee: 15350 },
    { maxWeight: 13000, fee: 16350 },
    { maxWeight: 14000, fee: 17350 },
    { maxWeight: 15000, fee: 18350 },
    { maxWeight: 16000, fee: 19350 },
    { maxWeight: 17000, fee: 20350 },
    { maxWeight: 18000, fee: 21350 },
    { maxWeight: 19000, fee: 22350 },
    { maxWeight: 20000, fee: 23350 },
    { maxWeight: 21000, fee: 24350 },
    { maxWeight: 22000, fee: 25350 },
    { maxWeight: 23000, fee: 26350 },
    { maxWeight: 24000, fee: 27350 },
    { maxWeight: 25000, fee: 28350 },
    { maxWeight: 26000, fee: 29350 },
    { maxWeight: 27000, fee: 30350 },
    { maxWeight: 28000, fee: 31350 },
    { maxWeight: 29000, fee: 32350 },
    { maxWeight: 30000, fee: 33350 },
  ],
  zone3: [
    { maxWeight: 500, fee: 3150 },
    { maxWeight: 600, fee: 3400 },
    { maxWeight: 700, fee: 3650 },
    { maxWeight: 800, fee: 3900 },
    { maxWeight: 900, fee: 4150 },
    { maxWeight: 1000, fee: 4400 },
    { maxWeight: 1250, fee: 5000 },
    { maxWeight: 1500, fee: 5550 },
    { maxWeight: 1750, fee: 6150 },
    { maxWeight: 2000, fee: 6700 },
    { maxWeight: 2500, fee: 7750 },
    { maxWeight: 3000, fee: 8800 },
    { maxWeight: 3500, fee: 9850 },
    { maxWeight: 4000, fee: 10900 },
    { maxWeight: 4500, fee: 11950 },
    { maxWeight: 5000, fee: 13000 },
    { maxWeight: 5500, fee: 14050 },
    { maxWeight: 6000, fee: 15100 },
    { maxWeight: 7000, fee: 17200 },
    { maxWeight: 8000, fee: 19300 },
    { maxWeight: 9000, fee: 21400 },
    { maxWeight: 10000, fee: 23500 },
    { maxWeight: 11000, fee: 25600 },
    { maxWeight: 12000, fee: 27700 },
    { maxWeight: 13000, fee: 29800 },
    { maxWeight: 14000, fee: 31900 },
    { maxWeight: 15000, fee: 34000 },
    { maxWeight: 16000, fee: 36100 },
    { maxWeight: 17000, fee: 38200 },
    { maxWeight: 18000, fee: 40300 },
    { maxWeight: 19000, fee: 42400 },
    { maxWeight: 20000, fee: 44500 },
    { maxWeight: 21000, fee: 46600 },
    { maxWeight: 22000, fee: 48700 },
    { maxWeight: 23000, fee: 50800 },
    { maxWeight: 24000, fee: 52900 },
    { maxWeight: 25000, fee: 55000 },
    { maxWeight: 26000, fee: 57100 },
    { maxWeight: 27000, fee: 59200 },
    { maxWeight: 28000, fee: 61300 },
    { maxWeight: 29000, fee: 63400 },
    { maxWeight: 30000, fee: 65500 },
  ],
  zone4: [
    { maxWeight: 500, fee: 3900 },
    { maxWeight: 600, fee: 4180 },
    { maxWeight: 700, fee: 4460 },
    { maxWeight: 800, fee: 4740 },
    { maxWeight: 900, fee: 5020 },
    { maxWeight: 1000, fee: 5300 },
    { maxWeight: 1250, fee: 5990 },
    { maxWeight: 1500, fee: 6600 },
    { maxWeight: 1750, fee: 7290 },
    { maxWeight: 2000, fee: 7900 },
    { maxWeight: 2500, fee: 9100 },
    { maxWeight: 3000, fee: 10300 },
    { maxWeight: 3500, fee: 11500 },
    { maxWeight: 4000, fee: 12700 },
    { maxWeight: 4500, fee: 13900 },
    { maxWeight: 5000, fee: 15100 },
    { maxWeight: 5500, fee: 16300 },
    { maxWeight: 6000, fee: 17500 },
    { maxWeight: 7000, fee: 19900 },
    { maxWeight: 8000, fee: 22300 },
    { maxWeight: 9000, fee: 24700 },
    { maxWeight: 10000, fee: 27100 },
    { maxWeight: 11000, fee: 29500 },
    { maxWeight: 12000, fee: 31900 },
    { maxWeight: 13000, fee: 34300 },
    { maxWeight: 14000, fee: 36700 },
    { maxWeight: 15000, fee: 39100 },
    { maxWeight: 16000, fee: 41500 },
    { maxWeight: 17000, fee: 43900 },
    { maxWeight: 18000, fee: 46300 },
    { maxWeight: 19000, fee: 48700 },
    { maxWeight: 20000, fee: 51100 },
    { maxWeight: 21000, fee: 53500 },
    { maxWeight: 22000, fee: 55900 },
    { maxWeight: 23000, fee: 58300 },
    { maxWeight: 24000, fee: 60700 },
    { maxWeight: 25000, fee: 63100 },
    { maxWeight: 26000, fee: 65500 },
    { maxWeight: 27000, fee: 67900 },
    { maxWeight: 28000, fee: 70300 },
    { maxWeight: 29000, fee: 72700 },
    { maxWeight: 30000, fee: 75100 },
  ],
  zone5: [
    { maxWeight: 500, fee: 3600 },
    { maxWeight: 600, fee: 3900 },
    { maxWeight: 700, fee: 4200 },
    { maxWeight: 800, fee: 4500 },
    { maxWeight: 900, fee: 4800 },
    { maxWeight: 1000, fee: 5100 },
    { maxWeight: 1250, fee: 5850 },
    { maxWeight: 1500, fee: 6600 },
    { maxWeight: 1750, fee: 7350 },
    { maxWeight: 2000, fee: 8100 },
    { maxWeight: 2500, fee: 9600 },
    { maxWeight: 3000, fee: 11100 },
    { maxWeight: 3500, fee: 12600 },
    { maxWeight: 4000, fee: 14100 },
    { maxWeight: 4500, fee: 15600 },
    { maxWeight: 5000, fee: 17100 },
    { maxWeight: 5500, fee: 18600 },
    { maxWeight: 6000, fee: 20100 },
    { maxWeight: 7000, fee: 22500 },
    { maxWeight: 8000, fee: 24900 },
    { maxWeight: 9000, fee: 27300 },
    { maxWeight: 10000, fee: 29700 },
    { maxWeight: 11000, fee: 32100 },
    { maxWeight: 12000, fee: 34500 },
    { maxWeight: 13000, fee: 36900 },
    { maxWeight: 14000, fee: 39300 },
    { maxWeight: 15000, fee: 41700 },
    { maxWeight: 16000, fee: 44100 },
    { maxWeight: 17000, fee: 46500 },
    { maxWeight: 18000, fee: 48900 },
    { maxWeight: 19000, fee: 51300 },
    { maxWeight: 20000, fee: 53700 },
    { maxWeight: 21000, fee: 56100 },
    { maxWeight: 22000, fee: 58500 },
    { maxWeight: 23000, fee: 60900 },
    { maxWeight: 24000, fee: 63300 },
    { maxWeight: 25000, fee: 65700 },
    { maxWeight: 26000, fee: 68100 },
    { maxWeight: 27000, fee: 70500 },
    { maxWeight: 28000, fee: 72900 },
    { maxWeight: 29000, fee: 75300 },
    { maxWeight: 30000, fee: 77700 },
  ],
};

/**
 * Country calling codes mapping (国码)
 * Maps country code to international phone calling code
 */
export const COUNTRY_CALLING_CODES = {
  CN: "+86",   // 中国
  TW: "+886",  // 台湾
  KR: "+82",   // 韩国
  JP: "+81",   // 日本（虽然列表中没有，但预留）
  HK: "+852",  // 香港
  MO: "+853",  // 澳门
  IN: "+91",   // 印度
  ID: "+62",   // 印度尼西亚
  KH: "+855",  // 柬埔寨
  SG: "+65",   // 新加坡
  LK: "+94",   // 斯里兰卡
  TH: "+66",   // 泰国
  NP: "+977",  // 尼泊尔
  PK: "+92",   // 巴基斯坦
  BD: "+880",  // 孟加拉国
  PH: "+63",   // 菲律宾
  BT: "+975",  // 不丹
  BN: "+673",  // 文莱
  VN: "+84",   // 越南
  MY: "+60",   // 马来西亚
  MM: "+95",   // 缅甸
  MV: "+960",  // 马尔代夫
  MN: "+976",  // 蒙古
  LA: "+856",  // 老挝
  AU: "+61",   // 澳大利亚
  CK: "+682",  // 库克群岛
  SB: "+677",  // 所罗门群岛
  NC: "+687",  // 新喀里多尼亚
  NZ: "+64",   // 新西兰
  PG: "+675",  // 巴布亚新几内亚
  FJ: "+679",  // 斐济
  CA: "+1",    // 加拿大
  PM: "+508",  // 圣皮埃尔和密克隆
  MX: "+52",   // 墨西哥
  AE: "+971",  // 阿联酋
  IL: "+972",  // 以色列
  IQ: "+964",  // 伊拉克
  IR: "+98",   // 伊朗
  OM: "+968",  // 阿曼
  QA: "+974",  // 卡塔尔
  KW: "+965",  // 科威特
  SA: "+966",  // 沙特阿拉伯
  SY: "+963",  // 叙利亚
  TR: "+90",   // 土耳其
  BH: "+973",  // 巴林
  JO: "+962",  // 约旦
  LB: "+961",  // 黎巴嫩
  IS: "+354",  // 冰岛
  IE: "+353",  // 爱尔兰
  AZ: "+994",  // 阿塞拜疆
  AD: "+376",  // 安道尔
  IT: "+39",   // 意大利
  UA: "+380",  // 乌克兰
  GB: "+44",   // 英国
  EE: "+372",  // 爱沙尼亚
  AT: "+43",   // 奥地利
  NL: "+31",   // 荷兰
  GG: "+44",   // 根西岛
  MK: "+389",  // 北马其顿
  CY: "+357",  // 塞浦路斯
  GR: "+30",   // 希腊
  HR: "+385",  // 克罗地亚
  SM: "+378",  // 圣马力诺
  JE: "+44",   // 泽西岛
  CH: "+41",   // 瑞士
  SE: "+46",   // 瑞典
  ES: "+34",   // 西班牙
  SK: "+421",  // 斯洛伐克
  SI: "+386",  // 斯洛文尼亚
  CZ: "+420",  // 捷克
  DK: "+45",   // 丹麦
  DE: "+49",   // 德国
  NO: "+47",   // 挪威
  HU: "+36",   // 匈牙利
  FI: "+358",  // 芬兰
  FR: "+33",   // 法国
  BG: "+359",  // 保加利亚
  BY: "+375",  // 白俄罗斯
  BE: "+32",   // 比利时
  PL: "+48",   // 波兰
  PT: "+351",  // 葡萄牙
  MT: "+356",  // 马耳他
  MC: "+377",  // 摩纳哥
  LV: "+371",  // 拉脱维亚
  LT: "+370",  // 立陶宛
  LI: "+423",  // 列支敦士登
  LU: "+352",  // 卢森堡
  RO: "+40",   // 罗马尼亚
  RU: "+7",    // 俄罗斯
  US: "+1",    // 美国
  AR: "+54",   // 阿根廷
  UY: "+598",  // 乌拉圭
  EC: "+593",  // 厄瓜多尔
  SV: "+503",  // 萨尔瓦多
  GP: "+590",  // 瓜德罗普
  CU: "+53",   // 古巴
  CR: "+506",  // 哥斯达黎加
  CO: "+57",   // 哥伦比亚
  JM: "+1",    // 牙买加
  CL: "+56",   // 智利
  TT: "+1",    // 特立尼达和多巴哥
  PA: "+507",  // 巴拿马
  PY: "+595",  // 巴拉圭
  BB: "+1",    // 巴巴多斯
  GF: "+594",  // 法属圭亚那
  BR: "+55",   // 巴西
  VE: "+58",   // 委内瑞拉
  PE: "+51",   // 秘鲁
  HN: "+504",  // 洪都拉斯
  MQ: "+596",  // 马提尼克
  DZ: "+213",  // 阿尔及利亚
  UG: "+256",  // 乌干达
  EG: "+20",   // 埃及
  ET: "+251",  // 埃塞俄比亚
  GH: "+233",  // 加纳
  GA: "+241",  // 加蓬
  KE: "+254",  // 肯尼亚
  CI: "+225",  // 科特迪瓦
  DJ: "+253",  // 吉布提
  ZW: "+263",  // 津巴布韦
  SD: "+249",  // 苏丹
  SN: "+221",  // 塞内加尔
  TZ: "+255",  // 坦桑尼亚
  TN: "+216",  // 突尼斯
  TG: "+228",  // 多哥
  NG: "+234",  // 尼日利亚
  BW: "+267",  // 博茨瓦纳
  MG: "+261",  // 马达加斯加
  ZA: "+27",   // 南非
  MU: "+230",  // 毛里求斯
  MA: "+212",  // 摩洛哥
  RW: "+250",  // 卢旺达
  RE: "+262",  // 留尼汪
};

/**
 * Get country calling code by country code
 */
export function getCountryCallingCode(countryCode) {
  return COUNTRY_CALLING_CODES[countryCode] || "";
}

/**
 * Calculate EMS fee for a given country code and weight in grams.
 * Returns { fee, currency, zone } or null if country not found.
 */
export function calcEMSFee(countryCode, weightG) {
  const zone = getCountryZone(countryCode);
  if (!zone) return null;
  const rates = EMS_RATES[zone];
  const bracket = rates.find(r => weightG <= r.maxWeight);
  if (!bracket) return { fee: rates[rates.length - 1].fee, currency: "JPY", zone };
  return { fee: bracket.fee, currency: "JPY", zone };
}