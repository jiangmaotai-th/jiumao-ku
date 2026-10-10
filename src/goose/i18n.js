const STR = {
  home: { 'zh-CN': '返回九猫库', 'zh-TW': '返回九貓庫', en: 'Back', ja: '戻る', ko: '돌아가기' },
  levelLine: { 'zh-CN': '第{n}关 · {name}', 'zh-TW': '第{n}關 · {name}', en: 'Lv.{n} · {name}', ja: '第{n}面 · {name}', ko: '{n}스테이지 · {name}' },
  score: { 'zh-CN': '分数 {n}', 'zh-TW': '分數 {n}', en: 'Score {n}', ja: 'スコア {n}', ko: '점수 {n}' },
  target: { 'zh-CN': '{n} 分回本', 'zh-TW': '{n} 分回本', en: '{n} to clear', ja: '{n}点でクリア', ko: '{n}점이면 클리어' },
  gameTitle: { 'zh-CN': '套大鹅', 'zh-TW': '套大鵝', en: 'Ring the Goose', ja: 'ガチョウ輪投げ', ko: '거위 고리' },
  pickLevel: { 'zh-CN': '关卡选择', 'zh-TW': '關卡選擇', en: 'Level select', ja: '面選択', ko: '스테이지 선택' },
  storyMode: { 'zh-CN': '关卡模式', 'zh-TW': '關卡模式', en: 'Story', ja: 'ステージ', ko: '스테이지' },
  endlessMode: { 'zh-CN': '无尽模式', 'zh-TW': '無盡模式', en: 'Endless', ja: 'エンドレス', ko: '무한' },
  endlessBest: { 'zh-CN': '最高纪录: {n}次', 'zh-TW': '最高紀錄: {n}次', en: 'Best: {n}', ja: '最高 {n}回', ko: '최고 {n}회' },
  settings: { 'zh-CN': '设置', 'zh-TW': '設置', en: 'Settings', ja: '設定', ko: '설정' },
  soundOn: { 'zh-CN': '声音开', 'zh-TW': '聲音開', en: 'Sound on', ja: '音あり', ko: '소리 켜짐' },
  soundOff: { 'zh-CN': '声音关', 'zh-TW': '聲音關', en: 'Sound off', ja: 'ミュート', ko: '음소거' },
  windTitle: { 'zh-CN': '当前风向', 'zh-TW': '目前風向', en: 'Wind', ja: '風向き', ko: '바람' },
  windEast: { 'zh-CN': '东风 →', 'zh-TW': '東風 →', en: 'East →', ja: '東風 →', ko: '동풍 →' },
  windWest: { 'zh-CN': '西风 ←', 'zh-TW': '西風 ←', en: '← West', ja: '← 西風', ko: '← 서풍' },
  windNone: { 'zh-CN': '无风', 'zh-TW': '無風', en: 'Calm', ja: '無風', ko: '바람 없음' },
  windLv: { 'zh-CN': '风力 {n}级', 'zh-TW': '風力 {n}級', en: 'Force {n}', ja: '風力 {n}', ko: '풍력 {n}' },
  remainTimes: { 'zh-CN': '剩余 {n} 次', 'zh-TW': '剩餘 {n} 次', en: '{n} throws', ja: '残り {n} 回', ko: '남은 횟수 {n}' },
  remainRings: { 'zh-CN': '剩{n}环', 'zh-TW': '剩{n}環', en: '{n} rings', ja: '輪 {n}', ko: '링 {n}' },
  paused: { 'zh-CN': '暂停', 'zh-TW': '暫停', en: 'Paused', ja: '一時停止', ko: '일시정지' },
  resume: { 'zh-CN': '继续', 'zh-TW': '繼續', en: 'Resume', ja: '再開', ko: '계속' },
  win: { 'zh-CN': '回本了！', 'zh-TW': '回本了！', en: 'Cleared!', ja: 'クリア！', ko: '클리어!' },
  lose: { 'zh-CN': '没回本', 'zh-TW': '沒回本', en: 'Not enough', ja: '未達', ko: '미달' },
  total: { 'zh-CN': '总分 {n}', 'zh-TW': '總分 {n}', en: 'Total {n}', ja: '{n}点', ko: '총점 {n}' },
  best: { 'zh-CN': '最佳 {n}', 'zh-TW': '最佳 {n}', en: 'Best {n}', ja: 'ベスト {n}', ko: '최고 {n}' },
  retry: { 'zh-CN': '重开本关', 'zh-TW': '重開本關', en: 'Retry', ja: 'リトライ', ko: '다시' },
  next: { 'zh-CN': '下一关', 'zh-TW': '下一關', en: 'Next', ja: '次へ', ko: '다음' },
  jump: { 'zh-CN': '跳关', 'zh-TW': '跳關', en: 'Select level', ja: '面選択', ko: '스테이지' },
  noHit: { 'zh-CN': '一圈都没套中', 'zh-TW': '一圈都沒套中', en: 'No catches', ja: 'ノーキャッチ', ko: '하나도 못 감' },
  caughtTitle: { 'zh-CN': '恭喜套中', 'zh-TW': '恭喜套中', en: 'Caught!', ja: 'キャッチ！', ko: '성공!' },
  lootTitle: { 'zh-CN': '套中', 'zh-TW': '套中', en: 'Caught', ja: '捕獲', ko: '성공' },
  caughtScore: { 'zh-CN': '+{n} 分', 'zh-TW': '+{n} 分', en: '+{n}', ja: '+{n}', ko: '+{n}' },
  catchTap: { 'zh-CN': '点击关闭继续', 'zh-TW': '點擊關閉繼續', en: 'Tap to continue', ja: 'タップして続ける', ko: '탭해서 계속' },
  caughtCoins: { 'zh-CN': '金币 +{n}', 'zh-TW': '金幣 +{n}', en: 'Coins +{n}', ja: 'コイン +{n}', ko: '코인 +{n}' },
  rotate: { 'zh-CN': '请横过来玩', 'zh-TW': '請橫過來玩', en: 'Turn your phone sideways', ja: '横にして遊んで', ko: '가로로 돌려 주세요' },
  gosling: { 'zh-CN': '小鹅', 'zh-TW': '小鵝', en: 'Gosling', ja: '子ガチョウ', ko: '새끼거위' },
  goose: { 'zh-CN': '大白鹅', 'zh-TW': '大白鵝', en: 'Goose', ja: 'ガチョウ', ko: '거위' },
  gander: { 'zh-CN': '狮头鹅', 'zh-TW': '獅頭鵝', en: 'Lion-head', ja: 'シナガチョウ', ko: '사자머리' },
  boss: { 'zh-CN': '鹅王', 'zh-TW': '鵝王', en: 'Goose King', ja: 'ガチョウ王', ko: '거위왕' },
  easy: { 'zh-CN': '简单·细圈', 'zh-TW': '簡單·細圈', en: 'Easy · thin', ja: '簡単・細い', ko: '쉬움·가는 링' },
  normal: { 'zh-CN': '普通', 'zh-TW': '普通', en: 'Normal', ja: '普通', ko: '보통' },
  hard: { 'zh-CN': '困难·小圈', 'zh-TW': '困難·小圈', en: 'Hard · small', ja: '難しい・小さい', ko: '어려움·작은 링' },
  endless: { 'zh-CN': '无尽夜市', 'zh-TW': '無盡夜市', en: 'Endless', ja: 'エンドレス', ko: '무한' },
  mix: { 'zh-CN': '关卡混搭', 'zh-TW': '關卡混搭', en: 'Mix', ja: 'ミックス', ko: '믹스' },
  coins: { 'zh-CN': '金币 {n}', 'zh-TW': '金幣 {n}', en: 'Coins {n}', ja: 'コイン {n}', ko: '코인 {n}' },
  geeseCaught: { 'zh-CN': '套中 {n} 只', 'zh-TW': '套中 {n} 隻', en: '{n} geese', ja: '{n}羽', ko: '{n}마리' },
  geeseUnit: { 'zh-CN': '只', 'zh-TW': '隻', en: '', ja: '羽', ko: '마리' },
  shop: { 'zh-CN': '夜市商店', 'zh-TW': '夜市商店', en: 'Shop', ja: 'ショップ', ko: '상점' },
  shopHint: { 'zh-CN': '挑 1 件带走。进阶货要先买到前置才会进店。', 'zh-TW': '挑 1 件帶走。進階貨要先買到前置才會進店。', en: 'Pick one. Advanced goods appear after you own their prereqs.', ja: '1つ選ぶ。上位は前提を買ってから店に出る。', ko: '하나 고르세요. 상위 상품은 선행 스킬 후에 나옵니다.' },
  shopIn: { 'zh-CN': '再套 {n} 只进商店', 'zh-TW': '再套 {n} 隻進商店', en: 'Shop in {n}', ja: 'あと{n}羽で店', ko: '{n}마리 더 잡으면 상점' },
  noCoin: { 'zh-CN': '金币不够', 'zh-TW': '金幣不夠', en: 'Not enough coins', ja: 'コイン不足', ko: '코인 부족' },
  kindAmmo: { 'zh-CN': '弹药', 'zh-TW': '彈藥', en: 'Ammo', ja: '弾', ko: '탄약' },
  kindWeapon: { 'zh-CN': '武器', 'zh-TW': '武器', en: 'Weapon', ja: '武器', ko: '무기' },
  kindBuff: { 'zh-CN': '增益', 'zh-TW': '增益', en: 'Charm', ja: '強化', ko: '버프' },
  single: { 'zh-CN': '单发', 'zh-TW': '單發', en: 'Single', ja: '単発', ko: '단발' },
  lastShop: { 'zh-CN': '圈没了！再买一点？', 'zh-TW': '圈沒了！再買一點？', en: 'Out of rings!', ja: '輪がない！', ko: '링이 없어요!' },
  shopClose: { 'zh-CN': '先不买', 'zh-TW': '先不買', en: 'Skip', ja: 'やめる', ko: '건너뛰기' },
  giveUp: { 'zh-CN': '结束本局', 'zh-TW': '結束本局', en: 'End run', ja: '終了', ko: '종료' },
  cost: { 'zh-CN': '{n} 金', 'zh-TW': '{n} 金', en: '{n}c', ja: '{n}', ko: '{n}' },
  board: { 'zh-CN': '排行榜', 'zh-TW': '排行榜', en: 'Board', ja: 'ランキング', ko: '랭킹' },
  endlessOver: { 'zh-CN': '摊收了', 'zh-TW': '攤收了', en: 'Night market closed', ja: '閉店', ko: '장 종료' },
  nameHint: { 'zh-CN': '你的名字', 'zh-TW': '你的名字', en: 'Your name', ja: '名前', ko: '이름' },
  submitBoard: { 'zh-CN': '登上榜', 'zh-TW': '登上榜', en: 'Submit', ja: '登録', ko: '등록' },
  emptyBoard: { 'zh-CN': '还没有人上榜', 'zh-TW': '還沒有人上榜', en: 'No scores yet', ja: 'まだいない', ko: '아직 없음' },
  loading: { 'zh-CN': '读取中…', 'zh-TW': '讀取中…', en: 'Loading…', ja: '読み込み中…', ko: '로딩…' },
  anon: { 'zh-CN': '夜市游客', 'zh-TW': '夜市遊客', en: 'Visitor', ja: '観光客', ko: '손님' },
}

const BOSS = {
  intro: { 'zh-CN': '吾乃夜之鹅王·项圈终结者！凡人，献出汝之圈吧！' },
  hit: [
    { 'zh-CN': '不可能……吾之天鹅颈居然中了？！' },
    { 'zh-CN': '区区塑料圈！下次定叫它粉身碎骨！' },
    { 'zh-CN': '咕……这是何等的羞辱——！' },
  ],
  miss: [
    { 'zh-CN': '哈哈哈！汝之圈连吾之影都碰不到！' },
    { 'zh-CN': '弱！太弱了！' },
    { 'zh-CN': '鹅王的走位，汝看懂了吗？' },
  ],
  dead: { 'zh-CN': '鹅王陨落……世间再无夜之至尊——' },
}

function loc() {
  const raw = (document.documentElement.lang || 'zh-CN').replace('_', '-')
  if (raw.startsWith('zh-TW') || raw.includes('Hant') || raw.includes('HK')) return 'zh-TW'
  if (raw.startsWith('zh')) return 'zh-CN'
  if (raw.startsWith('en')) return 'en'
  if (raw.startsWith('ja')) return 'ja'
  if (raw.startsWith('ko')) return 'ko'
  return 'en'
}

function pick(map) {
  if (!map) return ''
  const l = loc()
  return map[l] || map.en || map['zh-CN'] || ''
}

export function g(key, vars = {}) {
  let s = pick(STR[key]) || key
  for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v))
  return s
}

export function prizeName(kind) {
  return g(kind)
}

export function bossLine(kind) {
  if (kind === 'intro') return pick(BOSS.intro)
  if (kind === 'dead') return pick(BOSS.dead)
  const arr = BOSS[kind] || []
  return pick(arr[Math.floor(Math.random() * arr.length)])
}
