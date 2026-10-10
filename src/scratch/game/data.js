const icon = (id, name, country, group, rarity = "普通") => ({ id, name, country, group, rarity });
const pack = (country, group, items) => items.map(([id, name, rarity]) => icon(id, name, country, group, rarity));

export const ICONS = [
  icon("cn_dragon", "青龙", "中国", "A", "传说"), icon("cn_phoenix", "丹凤", "中国", "A", "传说"),
  icon("cn_lion", "瑞狮", "中国", "A", "稀有"), icon("cn_koi", "锦鲤", "中国", "A", "稀有"),
  icon("cn_panda", "竹熊", "中国", "A"), icon("cn_coin", "方孔钱", "中国", "A"),
  icon("cn_lantern", "红灯笼", "中国", "A"), icon("cn_peach", "寿桃", "中国", "A"),
  icon("cn_gourd", "福禄葫芦", "中国", "A"), icon("cn_crane", "仙鹤", "中国", "A", "稀有"),
  icon("cn_jade", "如意玉", "中国", "A", "稀有"), icon("cn_rabbit", "月兔", "中国", "A"),
  icon("jp_daruma", "达摩", "日本", "A"), icon("jp_maneki", "招财猫", "日本", "A", "稀有"),
  icon("jp_fuji", "富士山", "日本", "A", "传说"), icon("jp_koi", "鲤鱼旗", "日本", "A"),
  icon("jp_torii", "鸟居", "日本", "A", "稀有"), icon("jp_fan", "金扇", "日本", "B"),
  icon("jp_mask", "狐面", "日本", "B", "稀有"), icon("jp_sakura", "樱花", "日本", "B"),
  icon("jp_tanuki", "狸猫", "日本", "B"), icon("jp_bell", "风铃", "日本", "B"),
  icon("jp_omamori", "御守", "日本", "B", "稀有"), icon("jp_crane", "纸鹤", "日本", "B"),
  icon("jp_moon", "月见", "日本", "B", "传说"),
  icon("us_eagle", "白头鹰", "美国", "B", "传说"), icon("us_horseshoe", "幸运马蹄", "美国", "B"),
  icon("us_clover", "四叶草", "美国", "B", "稀有"), icon("us_bell", "自由钟", "美国", "B", "稀有"),
  icon("us_cactus", "沙漠花", "美国", "B"), icon("us_route", "蓝公路牌", "美国", "B"),
  icon("us_rocket", "复古火箭", "美国", "B", "传说"), icon("us_bison", "野牛", "美国", "B"),
  icon("us_crown", "西部金星", "美国", "B", "稀有"), icon("us_dice", "幸运骰子", "美国", "C"),
  icon("us_cherry", "红樱桃", "美国", "C"), icon("us_rainbow", "彩虹", "美国", "C"),
  icon("us_jukebox", "点唱机", "美国", "C", "稀有"), icon("kr_tiger", "民画白虎", "韩国", "C", "传说"),
  icon("kr_magpie", "喜鹊", "韩国", "C"), icon("kr_bok", "福袋", "韩国", "C", "稀有"),
  icon("kr_dokkaebi", "鬼怪面", "韩国", "C", "传说"), icon("kr_crane", "丹顶鹤", "韩国", "C", "稀有"),
  icon("kr_lotus", "莲花", "韩国", "C"), icon("kr_drum", "长鼓", "韩国", "C"),
  icon("kr_moonjar", "月亮罐", "韩国", "C", "稀有"), icon("kr_hanbok", "彩衣", "韩国", "C"),
  icon("kr_persimmon", "柿柿如意", "韩国", "C"), icon("kr_cloud", "云结", "韩国", "C"),
  icon("kr_rabbit", "捣药兔", "韩国", "C", "传说"),
  icon("cn_qilin", "踏云麒麟", "中国", "D", "传说"), icon("cn_pomegranate", "百籽石榴", "中国", "D"),
  icon("cn_bat", "五福蝠", "中国", "D", "稀有"), icon("cn_butterfly", "长寿蝶", "中国", "D"),
  icon("cn_lotus", "白玉莲", "中国", "D"), icon("cn_ingot", "金元宝", "中国", "D", "稀有"),
  icon("cn_ruyi", "珊瑚如意", "中国", "D", "稀有"), icon("cn_bamboo", "节节高", "中国", "D"),
  icon("cn_ducks", "鸳鸯", "中国", "D", "传说"), icon("cn_pipa", "琵琶", "中国", "D"),
  icon("cn_fan", "梅花团扇", "中国", "D"), icon("cn_tiger", "福铃虎", "中国", "D", "稀有"),
  icon("cn_cloudgate", "祥云月门", "中国", "D", "传说"),
  icon("jp_kokeshi", "木芥子", "日本", "D"), icon("jp_sumo", "力士", "日本", "D", "稀有"),
  icon("jp_goldfish", "琉金", "日本", "D"), icon("jp_uchiwa", "浪纹团扇", "日本", "D"),
  icon("jp_bonsai", "松盆景", "日本", "E", "稀有"), icon("jp_taiko", "太鼓", "日本", "E"),
  icon("jp_ebisu", "惠比寿", "日本", "E", "传说"), icon("jp_umbrella", "朱伞", "日本", "E"),
  icon("jp_ema", "绘马", "日本", "E"), icon("jp_shimenawa", "注连绳", "日本", "E", "稀有"),
  icon("jp_onigiri", "御饭团", "日本", "E"), icon("jp_hotspring", "汤烟", "日本", "E"),
  icon("jp_tea", "抹茶", "日本", "E", "稀有"),
  icon("us_balloon", "热气球", "美国", "E", "稀有"), icon("us_lighthouse", "海岸灯塔", "美国", "E"),
  icon("us_baseball", "棒球手套", "美国", "E"), icon("us_boot", "西部靴", "美国", "E", "稀有"),
  icon("us_sunflower", "向日葵", "美国", "E"), icon("us_train", "蒸汽火车", "美国", "E", "传说"),
  icon("us_moon", "银月三星", "美国", "E", "稀有"), icon("us_guitar", "公路吉他", "美国", "E"),
  icon("us_apple", "红苹果", "美国", "F"), icon("us_bear", "灰熊", "美国", "F", "传说"),
  icon("us_pinwheel", "复古风车", "美国", "F"), icon("us_anchor", "航海锚", "美国", "F", "稀有"),
  icon("kr_ginseng", "高丽参", "韩国", "F", "稀有"), icon("kr_hahoetal", "河回假面", "韩国", "F", "传说"),
  icon("kr_pagoda", "青瓷石塔", "韩国", "F"), icon("kr_fan", "三色扇", "韩国", "F"),
  icon("kr_turtleship", "龟船", "韩国", "F", "传说"), icon("kr_jangseung", "村落守护柱", "韩国", "F", "稀有"),
  icon("kr_plum", "梅花枝", "韩国", "F"), icon("kr_sunmoon", "日月五峰", "韩国", "F", "传说"),
  icon("kr_butterfly", "彩蝶结", "韩国", "F"), icon("kr_kite", "盾形风筝", "韩国", "F"),
  icon("kr_sotdae", "长杆神鸟", "韩国", "F", "稀有"), icon("kr_chest", "朱漆礼箱", "韩国", "F", "稀有"),
  ...pack("英国", "G", [
    ["uk_crown", "红宝王冠", "传说"], ["uk_lion", "金狮", "稀有"], ["uk_rose", "都铎玫瑰"], ["uk_tea", "蓝瓷茶杯"],
    ["uk_clocktower", "金色钟塔", "传说"], ["uk_bus", "红双层巴士"], ["uk_phonebox", "红电话亭"], ["uk_castle", "双塔古堡", "稀有"],
    ["uk_unicorn", "白独角兽", "传说"], ["uk_raven", "银枝乌鸦"], ["uk_oak", "橡叶果"], ["uk_fox", "环尾赤狐"],
    ["uk_hedgehog", "浆果刺猬"], ["uk_guard", "仪仗卫兵", "稀有"], ["uk_ship", "海峡帆船"], ["uk_compass", "黄铜罗盘"],
    ["uk_key", "古银钥匙"], ["uk_thistle", "紫蓟花"], ["uk_harp", "金竖琴", "稀有"], ["uk_cricket", "板球徽章"], ["uk_umbrella", "雨幕蓝伞"]
  ]),
  ...pack("英国", "H", [["uk_lantern", "雾都街灯"], ["uk_stag", "金角赤鹿", "稀有"], ["uk_robin", "冬青知更鸟"], ["uk_orb", "蓝金宝球", "传说"]]),
  ...pack("法国", "H", [
    ["fr_lily", "白百合", "稀有"], ["fr_rooster", "高卢雄鸡", "传说"], ["fr_tower", "铁塔", "传说"], ["fr_croissant", "金可颂"],
    ["fr_baguette", "麦穗长棍"], ["fr_cheese", "奶酪"], ["fr_grapes", "紫葡萄"], ["fr_perfume", "粉晶香水", "稀有"],
    ["fr_beret", "红贝雷帽"], ["fr_bicycle", "花篮单车"], ["fr_lavender", "薰衣草束"], ["fr_chateau", "蓝顶城堡", "传说"],
    ["fr_sun", "金太阳", "稀有"], ["fr_camellia", "白山茶"], ["fr_palette", "画家调色盘"], ["fr_accordion", "红手风琴"], ["fr_sailboat", "蔚蓝帆船"]
  ]),
  ...pack("法国", "I", [["fr_macaron", "马卡龙"], ["fr_coffee", "咖啡杯"], ["fr_lock", "心形金锁", "稀有"], ["fr_fountain", "蓝石喷泉"], ["fr_swallow", "海军蓝燕"], ["fr_ribbon", "三色丝带"], ["fr_horse", "白骏马", "稀有"], ["fr_clock", "蓝金座钟", "传说"]]),
  ...pack("印度", "I", [
    ["in_elephant", "宝象", "传说"], ["in_peacock", "孔雀", "传说"], ["in_lotus", "粉莲"], ["in_tiger", "孟加拉虎", "稀有"],
    ["in_cobra", "金环眼镜蛇", "稀有"], ["in_diya", "吉祥油灯"], ["in_mango", "金芒果"], ["in_rickshaw", "三轮车"],
    ["in_palace", "穹顶宫殿", "传说"], ["in_spicebox", "黄铜香料盒"], ["in_bangles", "宝石手镯"], ["in_sitar", "西塔琴", "稀有"], ["in_tabla", "塔布拉鼓"]
  ]),
  ...pack("印度", "J", [["in_kite", "彩鸢"], ["in_coconut", "椰香"], ["in_rangoli", "兰戈里", "传说"], ["in_bell", "寺庙金铃", "稀有"], ["in_parrot", "芒果绿鹦鹉"], ["in_camel", "盛装骆驼"], ["in_moon", "蓝宝新月"], ["in_sun", "藏红太阳"], ["in_conch", "圣白海螺", "稀有"], ["in_paisley", "翠金佩斯利"], ["in_jasmine", "茉莉花环"], ["in_gem", "王冠红宝", "传说"]]),
  ...pack("墨西哥", "J", [["mx_axolotl", "粉色美西螈", "稀有"], ["mx_marigold", "万寿菊"], ["mx_sun", "民艺太阳", "传说"], ["mx_cactus", "花掌仙人掌"], ["mx_agave", "蓝色龙舌兰"], ["mx_jaguar", "金斑美洲豹", "传说"], ["mx_eagle", "展翼鹰", "稀有"], ["mx_mask", "彩色面具"], ["mx_guitar", "花纹吉他"]]),
  ...pack("墨西哥", "K", [
    ["mx_pinata", "彩星皮纳塔"], ["mx_talavera", "陶瓷花章", "稀有"], ["mx_cocoa", "可可果"], ["mx_chili", "红辣椒"],
    ["mx_avocado", "牛油果"], ["mx_butterfly", "帝王蝶", "稀有"], ["mx_hummingbird", "翡翠蜂鸟", "传说"], ["mx_pyramid", "阶梯金字塔", "传说"],
    ["mx_heart", "花冠红心", "稀有"], ["mx_moon", "花纹蓝月"], ["mx_sombrero", "宽边帽"], ["mx_corn", "彩玉米"],
    ["mx_rattle", "彩绘沙锤"], ["mx_lizard", "绿松石蜥蜴"], ["mx_rose", "深红玫瑰"], ["mx_star", "锡艺星", "传说"]
  ]),
  ...pack("埃及", "K", [["eg_scarab", "绿松石圣甲虫", "传说"], ["eg_ankh", "青金生命结", "稀有"], ["eg_eye", "守护之眼", "传说"], ["eg_cat", "金领黑猫"], ["eg_falcon", "蓝金猎鹰", "稀有"]]),
  ...pack("埃及", "L", [
    ["eg_cobra", "青金眼镜蛇", "稀有"], ["eg_pyramid", "三座金字塔", "传说"], ["eg_sphinx", "法老金面", "传说"], ["eg_lotus", "尼罗蓝莲"],
    ["eg_papyrus", "纸莎草束"], ["eg_crocodile", "尼罗鳄"], ["eg_hippo", "蓝陶河马", "稀有"], ["eg_ibis", "白鹮"],
    ["eg_sun", "红金日轮"], ["eg_moon", "沙丘银月"], ["eg_boat", "纸莎帆船"], ["eg_canopic", "守护陶罐", "稀有"],
    ["eg_fan", "青金羽扇"], ["eg_necklace", "宽领宝饰", "稀有"], ["eg_key", "神殿金钥"], ["eg_jackal", "黑金胡狼", "传说"],
    ["eg_wingedsun", "翼展日盘", "传说"], ["eg_oasis", "双棕绿洲"], ["eg_datepalm", "果实椰枣树"], ["eg_obelisk", "沙金方尖碑", "稀有"]
  ])
];

const tiers = (cost, loss, one, two, five, twenty, hundred) => [
  { label: "未中奖", probability: loss, prize: 0 },
  { label: `返还 ${cost}`, probability: one, prize: cost },
  { label: `2 倍`, probability: two, prize: cost * 2 },
  { label: `5 倍`, probability: five, prize: cost * 5 },
  { label: `20 倍`, probability: twenty, prize: cost * 20 },
  { label: `100 倍`, probability: hundred, prize: cost * 100 }
];

const playTiers = (cost) => [
  { label: "谢谢惠顾", probability: 62, prize: 0 },
  { label: "小奖", probability: 22, prize: Math.max(5, Math.round(cost * .5)) },
  { label: "中奖", probability: 11, prize: cost * 2 },
  { label: "大奖", probability: 4, prize: cost * 5 },
  { label: "头奖", probability: 1, prize: cost * 20 }
];

export const MODES = [
  { id: "cn-match", country: "中国", flag: "中", title: "三喜临门", subtitle: "6 区 · 三个相同即中奖", cost: 20, slots: 6, cols: 2, matchCount: 3, ticket: "TICKET_CHINA", accent: "#f2c44f", tiers: tiers(20, 64, 22, 9, 4, .9, .1) },
  {
    id: "cn-seat",
    kind: "match-number",
    country: "中国",
    flag: "中",
    title: "对号入座",
    subtitle: "6 格对号 · 先刮中奖号码，对上即中该格奖金",
    cost: 20,
    slots: 6,
    cols: 3,
    ticket: "TICKET_CHINA",
    accent: "#f2c44f",
    mascots: ["白兔", "三花猫"],
    tiers: [
      { label: "谢谢惠顾", probability: 58, prize: 0 },
      { label: "小奖", probability: 26, prize: 10 },
      { label: "中奖", probability: 11, prize: 40 },
      { label: "大奖", probability: 4, prize: 100 },
      { label: "头奖", probability: 1, prize: 500 }
    ]
  },
  {
    id: "cn-line",
    kind: "line-3",
    country: "中国",
    flag: "中",
    title: "九宫连线",
    subtitle: "3×3 横竖斜连成线即中 · 传说瑞兽三连为大奖",
    cost: 100,
    slots: 9,
    cols: 3,
    ticket: "TICKET_CHINA",
    accent: "#f1c45a",
    tiers: [
      { label: "谢谢惠顾", probability: 74, prize: 0 },
      { label: "连线", probability: 14, prize: 100 },
      { label: "小奖", probability: 7, prize: 200 },
      { label: "中奖", probability: 4, prize: 500 },
      { label: "大奖 · 传说三连", probability: 0.85, prize: 2000 },
      { label: "头奖 · 传说三连", probability: 0.15, prize: 10000 }
    ]
  },
  { id: "cn-ingot", kind: "instant-symbol", country: "中国", flag: "中", title: "元宝即中", subtitle: "刮出金元宝即中该格奖金", cost: 18, slots: 6, cols: 3, ticket: "TICKET_CHINA", accent: "#f2c44f", luckyId: "cn_ingot", luckyName: "金元宝", hint: "刮出元宝，即中该格奖金", tiers: playTiers(18) },
  { id: "cn-double", kind: "multiplier", country: "中国", flag: "中", title: "金条加倍", subtitle: "三枚相同即中 · 再刮金条翻倍", cost: 25, slots: 6, cols: 2, matchCount: 3, ticket: "TICKET_CHINA", accent: "#e8b944", hint: "三枚相同即中，再刮翻倍格", tiers: playTiers(25) },
  { id: "cn-score", kind: "compare", country: "中国", flag: "中", title: "荣耀比分", subtitle: "三局对决 · 你的分数更高即中", cost: 22, slots: 6, cols: 2, ticket: "TICKET_CHINA", accent: "#dc8f2c", hint: "你的分数大于对手即中奖", tiers: playTiers(22) },
  { id: "cn-map", kind: "coordinate", country: "中国", flag: "中", title: "财富之旅", subtitle: "刮出字母和数字，去棋盘对格领奖", cost: 26, slots: 16, cols: 4, ticket: "TICKET_CHINA", accent: "#e99f31", hint: "先刮坐标，再找棋盘对应格", tiers: playTiers(26) },
  { id: "cn-walk", kind: "walk", country: "中国", flag: "中", title: "勇士闯关", subtitle: "按刮出的步数走路线，停在奖金格即中", cost: 24, slots: 9, cols: 4, ticket: "TICKET_CHINA", accent: "#dc8f2c", hint: "按步数走路线，停在奖金格即中", tiers: playTiers(24) },
  { id: "cn-sum", kind: "sum7", country: "中国", flag: "中", title: "七喜相加", subtitle: "两数相加等于 7 即中该局奖金", cost: 16, slots: 8, cols: 2, ticket: "TICKET_CHINA", accent: "#f1bd47", hint: "两数相加等于 7 即中奖", tiers: playTiers(16) },
  { id: "cn-zodiac", country: "中国", flag: "中", title: "生肖聚福", subtitle: "9 区 · 三只福兽成组中奖", cost: 35, slots: 9, cols: 3, matchCount: 3, ticket: "TICKET_CHINA", accent: "#e99f31", tiers: tiers(35, 70, 18, 7, 4, .9, .1) },
  { id: "jp-fortune", country: "日本", flag: "日", title: "大吉御签", subtitle: "6 区 · 三枚相同御签中奖", cost: 15, slots: 6, cols: 2, matchCount: 3, ticket: "TICKET_JAPAN", accent: "#ef6a55", tiers: tiers(15, 60, 26, 9, 4, .9, .1) },
  { id: "jp-pair", kind: "pair-match", country: "日本", flag: "日", title: "双纹配对", subtitle: "三组配对 · 一组两格相同即中", cost: 16, slots: 6, cols: 2, ticket: "TICKET_JAPAN", accent: "#e96755", hint: "每组两格图案相同即中奖", tiers: playTiers(16) },
  { id: "jp-triangle", kind: "triangle", country: "日本", flag: "日", title: "三角开运", subtitle: "三角形任一边三枚相同即中", cost: 22, slots: 6, cols: 3, ticket: "TICKET_JAPAN", accent: "#416d91", hint: "三角形左、右、底边三连即中", tiers: playTiers(22) },
  { id: "jp-maze", kind: "maze", country: "日本", flag: "日", title: "幸运迷路", subtitle: "从起点按箭头走，走到奖金格即中", cost: 20, slots: 8, cols: 4, ticket: "TICKET_JAPAN", accent: "#ef6a55", hint: "从起点跟着箭头走到奖金格", tiers: playTiers(20) },
  { id: "jp-moon", country: "日本", flag: "日", title: "月见宝箱", subtitle: "9 区 · 三枚月纹符中奖", cost: 30, slots: 9, cols: 3, matchCount: 3, ticket: "TICKET_JAPAN", accent: "#365f85", tiers: tiers(30, 66, 21, 8, 4, .9, .1) },
  { id: "us-route", country: "美国", flag: "美", title: "幸运公路", subtitle: "9 区 · 三枚同款路标中奖", cost: 25, slots: 9, cols: 3, matchCount: 3, ticket: "TICKET_USA", accent: "#d5a449", tiers: tiers(25, 68, 19, 8, 4, .9, .1) },
  { id: "us-charm", kind: "instant-symbol", country: "美国", flag: "美", title: "马蹄即中", subtitle: "刮出幸运马蹄即中该格奖金", cost: 20, slots: 6, cols: 3, ticket: "TICKET_USA", accent: "#d5a449", luckyId: "us_horseshoe", luckyName: "幸运马蹄", hint: "刮出马蹄，即中该格奖金", tiers: playTiers(20) },
  { id: "us-double", kind: "multiplier", country: "美国", flag: "美", title: "星光加倍", subtitle: "三枚相同即中 · 再刮倍符翻倍", cost: 30, slots: 6, cols: 2, matchCount: 3, ticket: "TICKET_USA", accent: "#dc604c", hint: "三枚相同即中，再刮翻倍格", tiers: playTiers(30) },
  { id: "us-key", kind: "key-match", country: "美国", flag: "美", title: "金钥公路", subtitle: "对上号码，或刮出钥匙即中该格", cost: 28, slots: 6, cols: 3, ticket: "TICKET_USA", accent: "#dca64b", hint: "对号或刮出钥匙即中该格", tiers: playTiers(28) },
  { id: "us-bingo", kind: "bingo", country: "美国", flag: "美", title: "星条宾果", subtitle: "先刮开奖号 · 连线 / 四角 / X", cost: 35, slots: 9, cols: 3, ticket: "TICKET_USA", accent: "#d85f4e", hint: "先刮开奖号码，再连成一线", tiers: [
    { label: "谢谢惠顾", probability: 64, prize: 0 },
    { label: "连线", probability: 22, prize: 30 },
    { label: "四角", probability: 10, prize: 70 },
    { label: "X 大奖", probability: 3.2, prize: 210 },
    { label: "头奖", probability: 0.8, prize: 700 }
  ] },
  { id: "us-crossword", kind: "crossword", country: "美国", flag: "美", title: "公路填字", subtitle: "先刮 12 个字母，凑齐单词即可领奖", cost: 40, slots: 18, cols: 4, ticket: "TICKET_USA", accent: "#d5a449", hint: "先刮你的字母，再对单词", tiers: [
    { label: "谢谢惠顾", probability: 62, prize: 0 },
    { label: "3 词", probability: 22, prize: 20 },
    { label: "4 词", probability: 11, prize: 80 },
    { label: "5 词", probability: 4, prize: 200 },
    { label: "全中", probability: 1, prize: 800 }
  ] },
  { id: "us-dual", kind: "dual-bingo", country: "美国", flag: "美", title: "双卡宾果", subtitle: "12 个开奖号 · 两张 3×3 卡兼中兼得", cost: 45, slots: 30, cols: 6, ticket: "TICKET_USA", accent: "#d85f4e", hint: "先刮开奖号，两张卡都可连线", tiers: [
    { label: "谢谢惠顾", probability: 64, prize: 0 },
    { label: "一卡连线", probability: 22, prize: 40 },
    { label: "一卡四角", probability: 10, prize: 90 },
    { label: "双卡连线", probability: 3.2, prize: 270 },
    { label: "双卡 X", probability: 0.8, prize: 900 }
  ] },
  { id: "us-jackpot", country: "美国", flag: "美", title: "星光大奖", subtitle: "6 区 · 三枚同款徽章中奖", cost: 50, slots: 6, cols: 2, matchCount: 3, ticket: "TICKET_USA", accent: "#dc604c", tiers: tiers(50, 72, 16, 7, 4, .9, .1) },
  { id: "kr-bok", country: "韩国", flag: "韩", title: "福袋花牌", subtitle: "6 区 · 三只相同福物中奖", cost: 20, slots: 6, cols: 2, matchCount: 3, ticket: "TICKET_KOREA", accent: "#ec7469", tiers: tiers(20, 62, 24, 9, 4, .9, .1) },
  { id: "kr-pair", kind: "pair-match", country: "韩国", flag: "韩", title: "福缘成双", subtitle: "三组配对 · 一组两格相同即中", cost: 18, slots: 6, cols: 2, ticket: "TICKET_KOREA", accent: "#e87669", hint: "每组两格图案相同即中奖", tiers: playTiers(18) },
  { id: "kr-bingo", kind: "bingo", country: "韩国", flag: "韩", title: "花牌宾果", subtitle: "先刮开奖号 · 连线 / 四角 / X", cost: 32, slots: 9, cols: 3, ticket: "TICKET_KOREA", accent: "#4f8f83", hint: "先刮开奖号码，再连成一线", tiers: [
    { label: "谢谢惠顾", probability: 64, prize: 0 },
    { label: "连线", probability: 22, prize: 28 },
    { label: "四角", probability: 10, prize: 64 },
    { label: "X 大奖", probability: 3.2, prize: 192 },
    { label: "头奖", probability: 0.8, prize: 640 }
  ] },
  { id: "kr-moon", country: "韩国", flag: "韩", title: "月宫宝藏", subtitle: "9 区 · 三枚月兔符中奖", cost: 40, slots: 9, cols: 3, matchCount: 3, ticket: "TICKET_KOREA", accent: "#4f8f83", tiers: tiers(40, 69, 18, 7, 4, .9, .1) },
  { id: "cn-pair", country: "中国", flag: "中", title: "三星报喜", subtitle: "3 区 · 任意两枚相同即中奖", cost: 12, slots: 3, cols: 3, matchCount: 2, ticket: "TICKET_CHINA", accent: "#f1bd47", tiers: tiers(12, 55, 30, 10, 4, .9, .1) },
  { id: "cn-seven", country: "中国", flag: "中", title: "七宝如意", subtitle: "7 区 · 三枚同款瑞物中奖", cost: 28, slots: 7, cols: 3, matchCount: 3, ticket: "TICKET_CHINA", accent: "#dc8f2c", tiers: tiers(28, 63, 23, 9, 4, .9, .1) },
  { id: "cn-twelve", country: "中国", flag: "中", title: "十二金册", subtitle: "12 区 · 四枚同款珍宝中奖", cost: 60, slots: 12, cols: 4, matchCount: 4, ticket: "TICKET_CHINA", accent: "#e8b944", tiers: tiers(60, 72, 16, 7, 4, .9, .1) },
  { id: "jp-four", country: "日本", flag: "日", title: "四门结缘", subtitle: "4 区 · 两枚相同御守中奖", cost: 18, slots: 4, cols: 2, matchCount: 2, ticket: "TICKET_JAPAN", accent: "#e96755", tiers: tiers(18, 58, 28, 9, 4, .9, .1) },
  { id: "jp-ten", country: "日本", flag: "日", title: "十景绘卷", subtitle: "10 区 · 三枚同景徽章中奖", cost: 42, slots: 10, cols: 5, matchCount: 3, ticket: "TICKET_JAPAN", accent: "#416d91", tiers: tiers(42, 68, 20, 7, 4, .9, .1) },
  { id: "us-five", country: "美国", flag: "美", title: "五星好运", subtitle: "5 区 · 两枚同款幸运符中奖", cost: 22, slots: 5, cols: 3, matchCount: 2, ticket: "TICKET_USA", accent: "#dca64b", tiers: tiers(22, 60, 26, 9, 4, .9, .1) },
  { id: "us-fifteen", country: "美国", flag: "美", title: "十五号公路", subtitle: "15 区 · 四枚同款路标中奖", cost: 75, slots: 15, cols: 5, matchCount: 4, ticket: "TICKET_USA", accent: "#d85f4e", tiers: tiers(75, 74, 14, 7, 4, .9, .1) },
  { id: "us-twenty", country: "美国", flag: "美", title: "二十星金库", subtitle: "20 区 · 五枚同款徽章中奖", cost: 120, slots: 20, cols: 4, matchCount: 5, ticket: "TICKET_USA", accent: "#c99741", tiers: tiers(120, 78, 11, 6, 4, .9, .1) },
  { id: "kr-eight", country: "韩国", flag: "韩", title: "八方福缘", subtitle: "8 区 · 三枚同款福物中奖", cost: 32, slots: 8, cols: 4, matchCount: 3, ticket: "TICKET_KOREA", accent: "#e87669", tiers: tiers(32, 65, 21, 9, 4, .9, .1) },
  { id: "kr-sixteen", country: "韩国", flag: "韩", title: "十六彩阁", subtitle: "16 区 · 四枚同款彩章中奖", cost: 85, slots: 16, cols: 4, matchCount: 4, ticket: "TICKET_KOREA", accent: "#4c8e84", tiers: tiers(85, 75, 13, 7, 4, .9, .1) },
  { id: "uk-rose", country: "英国", flag: "英", title: "玫瑰宝库", subtitle: "8 区 · 三枚英伦徽章中奖", cost: 36, slots: 8, cols: 4, matchCount: 3, ticket: "TICKET_UK", accent: "#d3ac58", tiers: tiers(36, 64, 22, 9, 4, .9, .1) },
  { id: "uk-crown", country: "英国", flag: "英", title: "王冠迷雾", subtitle: "14 区 · 四枚同款珍宝中奖", cost: 78, slots: 14, cols: 4, matchCount: 4, ticket: "TICKET_UK", accent: "#c99d48", tiers: tiers(78, 74, 14, 7, 4, .9, .1) },
  { id: "fr-lily", country: "法国", flag: "法", title: "百合花都", subtitle: "5 区 · 两枚相同徽章中奖", cost: 24, slots: 5, cols: 3, matchCount: 2, ticket: "TICKET_FRANCE", accent: "#d3a653", tiers: tiers(24, 60, 26, 9, 4, .9, .1) },
  { id: "fr-chateau", country: "法国", flag: "法", title: "十三城堡", subtitle: "13 区 · 四枚同款收藏中奖", cost: 68, slots: 13, cols: 4, matchCount: 4, ticket: "TICKET_FRANCE", accent: "#d2ae62", tiers: tiers(68, 73, 15, 7, 4, .9, .1) },
  { id: "in-mandala", country: "印度", flag: "印", title: "吉祥曼陀罗", subtitle: "9 区 · 三枚同款宝饰中奖", cost: 40, slots: 9, cols: 3, matchCount: 3, ticket: "TICKET_INDIA", accent: "#efb548", tiers: tiers(40, 67, 21, 7, 4, .9, .1) },
  { id: "in-gems", country: "印度", flag: "印", title: "十八宝石宫", subtitle: "18 区 · 五枚同款宝物中奖", cost: 105, slots: 18, cols: 6, matchCount: 5, ticket: "TICKET_INDIA", accent: "#e6a83b", tiers: tiers(105, 77, 12, 6, 4, .9, .1) },
  { id: "mx-sun", country: "墨西哥", flag: "墨", title: "太阳庆典", subtitle: "7 区 · 三枚同款彩章中奖", cost: 30, slots: 7, cols: 3, matchCount: 3, ticket: "TICKET_MEXICO", accent: "#f0a64a", tiers: tiers(30, 63, 23, 9, 4, .9, .1) },
  { id: "mx-fiesta", country: "墨西哥", flag: "墨", title: "十五彩旗", subtitle: "15 区 · 四枚同款民艺中奖", cost: 76, slots: 15, cols: 5, matchCount: 4, ticket: "TICKET_MEXICO", accent: "#ef8b49", tiers: tiers(76, 74, 14, 7, 4, .9, .1) },
  { id: "eg-scarab", country: "埃及", flag: "埃", title: "圣甲秘藏", subtitle: "6 区 · 三枚同款古宝中奖", cost: 32, slots: 6, cols: 2, matchCount: 3, ticket: "TICKET_EGYPT", accent: "#d5b65a", tiers: tiers(32, 62, 24, 9, 4, .9, .1) },
  { id: "eg-nile", country: "埃及", flag: "埃", title: "尼罗星盘", subtitle: "20 区 · 五枚同款符号中奖", cost: 125, slots: 20, cols: 4, matchCount: 5, ticket: "TICKET_EGYPT", accent: "#c8a74e", tiers: tiers(125, 79, 10, 6, 4, .9, .1) },
  {
    id: "cn-seat12",
    kind: "match-number",
    country: "中国",
    flag: "中",
    title: "对号入座 · 加强版",
    subtitle: "12 格对号 · 先刮中奖号码，对上即中该格奖金",
    cost: 40,
    slots: 12,
    cols: 4,
    ticket: "TICKET_CHINA",
    accent: "#e8b944",
    mascots: ["白兔", "三花猫", "踏云麒麟"],
    decoys: [10, 20, 40, 80, 200, 400],
    tiers: [
      { label: "谢谢惠顾", probability: 58, prize: 0 },
      { label: "小奖", probability: 26, prize: 20 },
      { label: "中奖", probability: 11, prize: 80 },
      { label: "大奖", probability: 4, prize: 200 },
      { label: "头奖", probability: 1, prize: 1000 }
    ]
  }
];

export function drawTier(mode) {
  let roll = Math.random() * 100;
  for (const tier of mode.tiers) {
    roll -= tier.probability;
    if (roll < 0) return tier;
  }
  return mode.tiers[0];
}

function padNumber(value) {
  return String(value).padStart(2, "0");
}

function uniqueNumber(used) {
  let value;
  do value = 1 + Math.floor(Math.random() * 99);
  while (used.has(value));
  used.add(value);
  return value;
}

function pickFrom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function fillCapped(count, pool, maxEach, exclude = new Set()) {
  const symbols = [];
  const counts = new Map();
  let guard = 0;
  while (symbols.length < count && guard++ < 8000) {
    const candidate = pickFrom(pool);
    if (exclude.has(candidate.id)) continue;
    const n = counts.get(candidate.id) || 0;
    if (n >= maxEach) continue;
    symbols.push(candidate);
    counts.set(candidate.id, n + 1);
  }
  return symbols;
}

export const TICKET_EDITION_SIZE = 10000;

export function formatTicketSerial(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return "00001";
  return digits.padStart(5, "0");
}

export function assignedTicketSerial(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits ? digits.padStart(5, "0") : "";
}

export function ticketsLeft(serial, issued = 0) {
  const n = parseInt(String(serial ?? "").replace(/\D/g, ""), 10);
  if (Number.isFinite(n) && n > 0) return Math.max(0, TICKET_EDITION_SIZE - n);
  return Math.max(0, TICKET_EDITION_SIZE - Math.max(0, Number(issued) || 0));
}

export function ticketSeries(mode) {
  const id = String(mode?.id || mode || "");
  const country = COUNTRY_SERIES[mode?.country] || "";
  let h = 2166136261;
  for (const ch of id) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  h >>>= 0;
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const len = 2 + (h % 2);
  const chars = [];
  if (country[0]) chars.push(country[0]);
  let n = h;
  while (chars.length < len) {
    chars.push(alphabet[n % alphabet.length]);
    n = Math.imul(n ^ (n >>> 15), 0x6D2B79F5) >>> 0;
  }
  return chars.join("");
}

function serial() {
  return formatTicketSerial(1);
}

export const COUNTRY_SERIES = {
  中国: "CN",
  日本: "JP",
  美国: "US",
  韩国: "KR",
  英国: "GB",
  法国: "FR",
  印度: "IN",
  墨西哥: "MX",
  埃及: "EG"
};

export function countryCharms(country, limit = 10) {
  const rank = (rarity) => (rarity === "传说" ? 0 : rarity === "稀有" ? 1 : 2);
  return ICONS.filter((item) => item.country === country)
    .sort((a, b) => rank(a.rarity) - rank(b.rarity) || a.id.localeCompare(b.id))
    .slice(0, limit);
}

export function modesForCountry(country) {
  const list = MODES.filter((mode) => mode.country === country);
  const plus = list.findIndex((mode) => mode.id === "cn-seat12");
  const base = list.findIndex((mode) => mode.id === "cn-seat");
  if (plus >= 0 && base >= 0 && plus !== base + 1) {
    const [item] = list.splice(plus, 1);
    list.splice(base + 1, 0, item);
  }
  return list;
}

export function countryCatalog() {
  return Object.keys(COUNTRY_SERIES).map((country) => {
    const modes = modesForCountry(country);
    return {
      country,
      flag: modes[0]?.flag || "",
      ticket: modes[0]?.ticket,
      accent: modes[0]?.accent || "#e7c063",
      games: modes.length,
      charms: countryCharms(country)
    };
  });
}

function countryIcons(country) {
  return ICONS.filter((item) => item.country === country);
}

function createMatchSymbols(mode, tier, matchCount = mode.matchCount || 3) {
  const available = countryIcons(mode.country);
  const pick = () => pickFrom(available);
  const winning = pick();
  const symbols = [];
  if (tier.prize > 0) {
    for (let i = 0; i < matchCount; i++) symbols.push(winning);
    while (symbols.length < mode.slots) symbols.push(pick());
  } else {
    const counts = new Map();
    while (symbols.length < mode.slots) {
      const candidate = pick();
      const count = counts.get(candidate.id) || 0;
      if (count < matchCount - 1) {
        symbols.push(candidate);
        counts.set(candidate.id, count + 1);
      }
    }
  }
  symbols.sort(() => Math.random() - .5);
  return symbols;
}

function createMatchNumberTicket(mode) {
  const tier = drawTier(mode);
  const winningNumber = 1 + Math.floor(Math.random() * 99);
  const used = new Set([winningNumber]);
  const decoys = (mode.decoys || [5, 10, 20, 40, 100]).filter((prize) => prize !== tier.prize);
  const matchIndex = tier.prize > 0 ? Math.floor(Math.random() * mode.slots) : -1;
  const mascots = mode.mascots || [mode.mascot || "白兔"];
  const cells = Array.from({ length: mode.slots }, (_, index) => {
    if (index === matchIndex) return { number: winningNumber, prize: tier.prize, hit: true };
    return { number: uniqueNumber(used), prize: decoys[Math.floor(Math.random() * decoys.length)], hit: false };
  });
  return {
    serial: serial(),
    kind: "match-number",
    mascot: mascots[Math.floor(Math.random() * mascots.length)],
    tier,
    winningNumber,
    winningLabel: padNumber(winningNumber),
    cells: cells.map((cell) => ({ ...cell, label: padNumber(cell.number) })),
    symbols: []
  };
}

const LINES_3 = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6]
];
const TRIANGLE_LINES = [[0, 1, 3], [0, 2, 5], [3, 4, 5]];
const BINGO_CORNERS = [0, 2, 6, 8];
const BINGO_X = [0, 2, 4, 6, 8];

function createLineTicket(mode) {
  const tier = drawTier(mode);
  const available = countryIcons(mode.country);
  const commons = available.filter((item) => item.rarity === "普通");
  const rares = available.filter((item) => item.rarity === "稀有");
  const legends = available.filter((item) => item.rarity === "传说");
  let symbols;
  let lineCells = [];
  let goldLine = false;
  if (tier.prize <= 0) {
    symbols = fillCapped(mode.slots, available, 2);
    symbols.sort(() => Math.random() - .5);
  } else {
    const line = LINES_3[Math.floor(Math.random() * LINES_3.length)];
    const winner = tier.prize >= 2000
      ? pickFrom(legends)
      : tier.prize >= 500
        ? pickFrom(rares.length ? rares : available)
        : pickFrom(commons.length ? commons : available);
    symbols = Array(mode.slots).fill(null);
    line.forEach((index) => { symbols[index] = winner; });
    const rest = fillCapped(mode.slots - line.length, available, 2, new Set([winner.id]));
    let next = 0;
    symbols = symbols.map((cell) => cell || rest[next++]);
    lineCells = line;
    goldLine = winner.rarity === "传说";
  }
  return { serial: serial(), kind: "line-3", tier, symbols, lineCells, goldLine };
}

function createInstantTicket(mode) {
  const tier = drawTier(mode);
  const available = countryIcons(mode.country);
  const lucky = ICONS.find((item) => item.id === mode.luckyId) || available[0];
  const decoys = [5, 10, 20, 40, 80].filter((prize) => prize !== tier.prize);
  const hitIndex = tier.prize > 0 ? Math.floor(Math.random() * mode.slots) : -1;
  const cells = Array.from({ length: mode.slots }, (_, index) => {
    if (index === hitIndex) return { symbol: lucky, prize: tier.prize, hit: true };
    let symbol;
    do symbol = pickFrom(available);
    while (symbol.id === lucky.id);
    return { symbol, prize: pickFrom(decoys), hit: false };
  });
  return {
    serial: serial(),
    kind: "instant-symbol",
    tier,
    lucky,
    cells,
    symbols: cells.map((cell) => cell.symbol),
    hitCells: hitIndex >= 0 ? [hitIndex] : []
  };
}

function createMultiplierTicket(mode) {
  const tier = drawTier(mode);
  const symbols = createMatchSymbols(mode, tier, 3);
  const value = tier.prize <= 0 ? pickFrom([1, 2, 5]) : tier.prize >= mode.cost * 5 ? 5 : tier.prize >= mode.cost * 2 ? 2 : 1;
  const label = value === 5 ? "金条 ×5" : value === 2 ? "×2" : "×1";
  return { serial: serial(), kind: "multiplier", tier, symbols, multiplier: { value, label, live: tier.prize > 0 && value > 1 } };
}

function createPairTicket(mode) {
  const tier = drawTier(mode);
  const available = countryIcons(mode.country);
  const pairCount = 3;
  const hitPair = tier.prize > 0 ? Math.floor(Math.random() * pairCount) : -1;
  const winner = pickFrom(available);
  const symbols = [];
  const hitCells = [];
  for (let pair = 0; pair < pairCount; pair++) {
    if (pair === hitPair) {
      symbols.push(winner, winner);
      hitCells.push(pair * 2, pair * 2 + 1);
    } else {
      const a = pickFrom(available.filter((item) => item.id !== winner.id));
      let b;
      do b = pickFrom(available);
      while (b.id === a.id);
      symbols.push(a, b);
    }
  }
  return { serial: serial(), kind: "pair-match", tier, symbols, hitCells };
}

function createTriangleTicket(mode) {
  const tier = drawTier(mode);
  const available = countryIcons(mode.country);
  let symbols;
  let lineCells = [];
  if (tier.prize <= 0) {
    symbols = fillCapped(6, available, 2);
    symbols.sort(() => Math.random() - .5);
  } else {
    const line = pickFrom(TRIANGLE_LINES);
    const winner = pickFrom(available);
    symbols = Array(6).fill(null);
    line.forEach((index) => { symbols[index] = winner; });
    const rest = fillCapped(3, available, 2, new Set([winner.id]));
    let next = 0;
    symbols = symbols.map((cell) => cell || rest[next++]);
    lineCells = line;
  }
  return { serial: serial(), kind: "triangle", tier, symbols, lineCells, hitCells: lineCells };
}

function createCompareTicket(mode) {
  const tier = drawTier(mode);
  const decoys = [8, 12, 20, 40].filter((prize) => prize !== tier.prize);
  const winRound = tier.prize > 0 ? Math.floor(Math.random() * 3) : -1;
  const rounds = Array.from({ length: 3 }, (_, index) => {
    const theirs = 20 + Math.floor(Math.random() * 70);
    if (index === winRound) {
      const mine = theirs + 1 + Math.floor(Math.random() * 18);
      return { mine, theirs, prize: tier.prize, hit: true };
    }
    const mine = Math.max(8, theirs - 1 - Math.floor(Math.random() * 16));
    return { mine, theirs, prize: pickFrom(decoys), hit: false };
  });
  return { serial: serial(), kind: "compare", tier, rounds, symbols: [] };
}

function createKeyTicket(mode) {
  const tier = drawTier(mode);
  const winningNumber = 1 + Math.floor(Math.random() * 99);
  const used = new Set([winningNumber]);
  const decoys = [8, 12, 20, 40, 80].filter((prize) => prize !== tier.prize);
  const hitIndex = tier.prize > 0 ? Math.floor(Math.random() * mode.slots) : -1;
  const useKey = tier.prize > 0 && (tier.prize >= mode.cost * 5 || Math.random() < .45);
  const cells = Array.from({ length: mode.slots }, (_, index) => {
    if (index === hitIndex && useKey) return { key: true, label: "KEY", prize: tier.prize, hit: true };
    if (index === hitIndex) return { number: winningNumber, label: padNumber(winningNumber), prize: tier.prize, hit: true };
    const number = uniqueNumber(used);
    return { number, label: padNumber(number), prize: pickFrom(decoys), hit: false };
  });
  return {
    serial: serial(),
    kind: "key-match",
    tier,
    winningNumber,
    winningLabel: padNumber(winningNumber),
    cells,
    symbols: []
  };
}

function bingoComplete(marked, pattern) {
  return pattern.every((index) => marked.has(index));
}

function createBingoTicket(mode) {
  const tier = drawTier(mode);
  const numbers = [];
  const taken = new Set();
  while (numbers.length < 9) {
    const n = 1 + Math.floor(Math.random() * 40);
    if (taken.has(n)) continue;
    taken.add(n);
    numbers.push(n);
  }
  let marked = [];
  if (tier.prize <= 0) marked = [0, 4];
  else if (tier.label.includes("X") || tier.label.includes("头奖")) marked = [...BINGO_X];
  else if (tier.label.includes("四角")) marked = [...BINGO_CORNERS];
  else marked = [...pickFrom(LINES_3)];
  const markedSet = new Set(marked);
  const needed = marked.map((index) => numbers[index]);
  const extras = [];
  while (needed.length + extras.length < 8) {
    const n = 1 + Math.floor(Math.random() * 40);
    if (taken.has(n) || extras.includes(n) || needed.includes(n)) continue;
    extras.push(n);
  }
  return {
    serial: serial(),
    kind: "bingo",
    tier,
    caller: [...needed, ...extras].sort(() => Math.random() - .5),
    card: numbers,
    marked,
    pattern: bingoComplete(markedSet, BINGO_X) ? "x" : bingoComplete(markedSet, BINGO_CORNERS) ? "corners" : marked.length >= 3 ? "line" : "miss",
    symbols: []
  };
}

const MAP_LETTERS = ["A", "B", "C", "D"];
const MAP_NUMBERS = [1, 2, 3];
const CROSS_PACKS = [
  ["ACE", "CAR", "CASH", "STAR", "MAP", "ART"],
  ["SUN", "WIN", "KEY", "SKY", "INK", "NEW"],
  ["GOLD", "OLD", "LOG", "DOG", "GOD", "GO"]
];
const SUM7_PAIRS = [[1, 6], [6, 1], [2, 5], [5, 2], [3, 4], [4, 3]];
const NOT7_PAIRS = [];
for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) if (a + b !== 7) NOT7_PAIRS.push([a, b]);

function decoyPrizes(prize) {
  return [5, 10, 20, 40, 80].filter((value) => value !== prize);
}

function letterCounts(letters) {
  const bag = {};
  for (const ch of letters) bag[ch] = (bag[ch] || 0) + 1;
  return bag;
}

function canSpell(word, bag) {
  const need = letterCounts(word);
  return Object.keys(need).every((ch) => (bag[ch] || 0) >= need[ch]);
}

function createCoordinateTicket(mode) {
  const tier = drawTier(mode);
  const decoys = decoyPrizes(tier.prize);
  const all = MAP_LETTERS.flatMap((letter) => MAP_NUMBERS.map((number) => ({ letter, number, label: `${letter}${number}` })));
  const pickCell = (exclude = new Set()) => pickFrom(all.filter((cell) => !exclude.has(cell.label)));
  let coords;
  let hits = new Set();
  if (tier.prize > 0) {
    const hit = pickCell();
    const miss = pickCell(new Set([hit.label]));
    hits.add(hit.label);
    coords = [
      { ...hit, hit: true },
      { ...miss, hit: false }
    ].sort(() => Math.random() - .5);
  } else {
    const first = pickCell();
    const second = pickCell(new Set([first.label]));
    coords = [{ ...first, hit: false }, { ...second, hit: false }];
  }
  const landed = new Set(coords.map((coord) => coord.label));
  const board = all.map((cell) => {
    if (hits.has(cell.label)) return { ...cell, prize: tier.prize, hit: true };
    if (landed.has(cell.label)) return { ...cell, prize: 0, hit: false };
    return { ...cell, prize: Math.random() < .42 ? pickFrom(decoys) : 0, hit: false };
  });
  return { serial: serial(), kind: "coordinate", tier, coords, board, symbols: [] };
}

function createWalkTicket(mode) {
  const tier = drawTier(mode);
  const decoys = decoyPrizes(tier.prize);
  const length = 8;
  const steps = 1 + Math.floor(Math.random() * length);
  const land = steps - 1;
  const cells = Array.from({ length }, (_, index) => {
    if (index === land) return { step: index + 1, prize: tier.prize, hit: tier.prize > 0 };
    return { step: index + 1, prize: Math.random() < .38 ? pickFrom(decoys) : 0, hit: false };
  });
  return { serial: serial(), kind: "walk", tier, steps, land, cells, symbols: [] };
}

function createMazeTicket(mode) {
  const tier = drawTier(mode);
  const arrows = ["→", "→", "→", "↓", "←", "←", "←", ""];
  const cells = arrows.map((arrow, index) => {
    const end = index === arrows.length - 1;
    return {
      arrow,
      start: index === 0,
      end,
      prize: end ? tier.prize : 0,
      hit: end && tier.prize > 0
    };
  });
  return { serial: serial(), kind: "maze", tier, cells, symbols: [] };
}

function requiredLetters(words) {
  const bag = {};
  for (const word of words) {
    const need = letterCounts(word);
    for (const ch of Object.keys(need)) bag[ch] = Math.max(bag[ch] || 0, need[ch]);
  }
  const letters = [];
  for (const ch of Object.keys(bag)) for (let i = 0; i < bag[ch]; i++) letters.push(ch);
  return letters;
}

function createCrosswordTicket(mode) {
  const tier = drawTier(mode);
  const target = tier.prize <= 0 ? 1 : tier.label.includes("全") ? 6 : parseInt(tier.label, 10) || 3;
  const bank = target >= 5
    ? pickFrom(CROSS_PACKS)
    : ["WIN", "GOLD", "CASH", "STAR", "LUCK", "KEY", "SUN", "BELL", "ROAD", "MOON", "HOPE", "MAP"];
  let complete = [];
  let incomplete = [];
  for (let attempt = 0; attempt < 50; attempt++) {
    const pool = bank.slice().sort(() => Math.random() - .5);
    complete = [];
    for (const word of pool) {
      if (complete.length >= target) break;
      if (requiredLetters([...complete, word]).length > 12) continue;
      complete.push(word);
    }
    const bag = letterCounts(requiredLetters(complete));
    incomplete = pool.filter((word) => !complete.includes(word) && !canSpell(word, bag)).slice(0, 6 - complete.length);
    if (complete.length === target && complete.length + incomplete.length === 6) break;
  }
  if (complete.length + incomplete.length < 6) {
    const bag = letterCounts(requiredLetters(complete));
    const extras = ["WIN", "CASH", "STAR", "LUCK", "KEY", "BELL", "ROAD", "MOON", "HOPE", "MAP"]
      .filter((word) => !complete.includes(word) && !incomplete.includes(word) && !canSpell(word, bag));
    incomplete = [...incomplete, ...extras].slice(0, 6 - complete.length);
  }
  let letters = requiredLetters(complete);
  const fillers = "BFPQVXZJ".split("");
  let guard = 0;
  while (letters.length < 12 && guard++ < 400) {
    const ch = pickFrom(fillers);
    const trial = letterCounts([...letters, ch]);
    if (incomplete.some((word) => canSpell(word, trial))) continue;
    letters.push(ch);
  }
  while (letters.length < 12) letters.push("X");
  letters.sort(() => Math.random() - .5);
  const words = [...complete, ...incomplete].map((word) => ({ word, complete: complete.includes(word) })).sort(() => Math.random() - .5);
  return { serial: serial(), kind: "crossword", tier, letters, words, completeCount: complete.length, symbols: [] };
}

function bingoMarksFor(pattern) {
  if (pattern === "x") return [...BINGO_X];
  if (pattern === "corners") return [...BINGO_CORNERS];
  if (pattern === "line") return [...pickFrom(LINES_3)];
  return [0, 4];
}

function uniqueBingoCard(exclude = new Set()) {
  const numbers = [];
  const used = new Set(exclude);
  while (numbers.length < 9) {
    const n = 1 + Math.floor(Math.random() * 40);
    if (used.has(n)) continue;
    used.add(n);
    numbers.push(n);
  }
  return numbers;
}

function createDualBingoTicket(mode) {
  const tier = drawTier(mode);
  let pat0 = "miss";
  let pat1 = "miss";
  if (tier.label.includes("双卡 X")) { pat0 = "x"; pat1 = "x"; }
  else if (tier.label.includes("双卡")) { pat0 = "line"; pat1 = "line"; }
  else if (tier.label.includes("四角")) { pat0 = "corners"; pat1 = "miss"; }
  else if (tier.prize > 0) { pat0 = "line"; pat1 = "miss"; }
  const card0 = uniqueBingoCard();
  const card1 = uniqueBingoCard();
  const marked0 = bingoMarksFor(pat0);
  const marked1 = bingoMarksFor(pat1);
  const needed = [...marked0.map((index) => card0[index]), ...marked1.map((index) => card1[index])];
  const callerSet = new Set(needed);
  const caller = [...callerSet];
  let guard = 0;
  while (caller.length < 12 && guard++ < 400) {
    const n = 1 + Math.floor(Math.random() * 40);
    if (callerSet.has(n) || card0.includes(n) || card1.includes(n)) continue;
    callerSet.add(n);
    caller.push(n);
  }
  return {
    serial: serial(),
    kind: "dual-bingo",
    tier,
    caller: caller.sort(() => Math.random() - .5),
    cards: [card0, card1],
    marked: [marked0, marked1],
    patterns: [pat0, pat1],
    symbols: []
  };
}

function createSum7Ticket(mode) {
  const tier = drawTier(mode);
  const decoys = decoyPrizes(tier.prize);
  const winPair = tier.prize > 0 ? Math.floor(Math.random() * 4) : -1;
  const pairs = Array.from({ length: 4 }, (_, index) => {
    if (index === winPair) {
      const [a, b] = pickFrom(SUM7_PAIRS);
      return { a, b, prize: tier.prize, hit: true };
    }
    const [a, b] = pickFrom(NOT7_PAIRS);
    return { a, b, prize: pickFrom(decoys), hit: false };
  });
  return { serial: serial(), kind: "sum7", tier, pairs, symbols: [] };
}

export function createTicket(mode, serialNo, editionIssued = 0) {
  let ticket;
  if (mode.kind === "match-number") ticket = createMatchNumberTicket(mode);
  else if (mode.kind === "line-3") ticket = createLineTicket(mode);
  else if (mode.kind === "instant-symbol") ticket = createInstantTicket(mode);
  else if (mode.kind === "multiplier") ticket = createMultiplierTicket(mode);
  else if (mode.kind === "pair-match") ticket = createPairTicket(mode);
  else if (mode.kind === "triangle") ticket = createTriangleTicket(mode);
  else if (mode.kind === "compare") ticket = createCompareTicket(mode);
  else if (mode.kind === "key-match") ticket = createKeyTicket(mode);
  else if (mode.kind === "bingo") ticket = createBingoTicket(mode);
  else if (mode.kind === "coordinate") ticket = createCoordinateTicket(mode);
  else if (mode.kind === "walk") ticket = createWalkTicket(mode);
  else if (mode.kind === "maze") ticket = createMazeTicket(mode);
  else if (mode.kind === "crossword") ticket = createCrosswordTicket(mode);
  else if (mode.kind === "dual-bingo") ticket = createDualBingoTicket(mode);
  else if (mode.kind === "sum7") ticket = createSum7Ticket(mode);
  else {
    const tier = drawTier(mode);
    const symbols = createMatchSymbols(mode, tier);
    ticket = { serial: serial(), tier, symbols };
  }
  ticket.serial = assignedTicketSerial(serialNo);
  ticket.editionIssued = Math.max(0, Number(editionIssued) || 0);
  return ticket;
}

export const rtp = (mode) => Math.round(mode.tiers.reduce((sum, tier) => sum + tier.probability * tier.prize / 100, 0) / mode.cost * 1000) / 10;
export const discoveryBonus = (iconData) => iconData.rarity === "传说" ? 120 : iconData.rarity === "稀有" ? 40 : 15;

export function winningSymbols(ticket, mode) {
  if (!ticket || ticket.tier?.prize <= 0) return [];
  if (ticket.kind === "match-number" || ticket.kind === "key-match" || ticket.kind === "compare" || ticket.kind === "bingo" || ticket.kind === "coordinate" || ticket.kind === "walk" || ticket.kind === "maze" || ticket.kind === "crossword" || ticket.kind === "dual-bingo" || ticket.kind === "sum7") return [];
  if (ticket.kind === "instant-symbol") return ticket.cells.filter((cell) => cell.hit).map((cell) => cell.symbol);
  if (ticket.kind === "line-3" || ticket.kind === "triangle") {
    const symbol = ticket.symbols[ticket.lineCells?.[0]];
    return symbol ? [symbol] : [];
  }
  if (ticket.kind === "pair-match") {
    const symbol = ticket.symbols[ticket.hitCells?.[0]];
    return symbol ? [symbol] : [];
  }
  const matchCount = mode?.matchCount || 3;
  const counts = new Map();
  for (const symbol of ticket.symbols || []) {
    const entry = counts.get(symbol.id) || { symbol, count: 0 };
    entry.count += 1;
    counts.set(symbol.id, entry);
  }
  return [...counts.values()].filter((entry) => entry.count >= matchCount).map((entry) => entry.symbol);
}
