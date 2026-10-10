import { v5Lines, v5Ui, type V5Ui } from './arena-v5'
import type { Locale } from './types'

export type ArenaExtra = {
  chars: Record<'knight' | 'dragon' | 'mage' | 'mech' | 'whale' | 'scholar' | 'rabbit' | 'fox', string>
  predict: string
  /** `{left}` `{right}` percentages */
  predictLine: string
  predictNote: string
  speed: string
  skip: string
  roundsWon: string
  damageDealt: string
  guardBreak: string
  scene: string
  music: string
}
const X_EN: ArenaExtra = {
  chars: { knight: 'Sol Paladin', dragon: 'Amber Fable Drake', mage: 'Twin-Star Sorcerer', mech: 'Obsidian Mech', whale: 'Deep-Sea Whale Samurai', scholar: 'Thousand-Question Scholar', rabbit: 'Moon Rabbit Ninja', fox: 'Nine-Tail Spirit Fox' },
  predict: 'Pre-fight prediction',
  predictLine: '{left}% vs {right}%',
  predictNote: 'Average expected score from the Elo gaps on the same leaderboards (Bradley–Terry). Shown for fun; the fight itself uses the rules below.',
  speed: 'Speed',
  skip: 'Skip to result',
  roundsWon: 'Rounds won',
  damageDealt: 'Damage dealt',
  guardBreak: 'Guard break (effect only)',
  scene: 'Stage',
  music: 'Music',
}
const X: Record<string, ArenaExtra> = {
  'zh-CN': {
    chars: { knight: '圣辉骑士', dragon: '琥珀文龙', mage: '双子星术士', mech: '黑曜机甲', whale: '深海鲸武士', scholar: '千问书生', rabbit: '月影兔忍', fox: '九尾灵狐' },
    predict: '赛前预测', predictLine: '{left}% 对 {right}%',
    predictNote: '按两边在同一批榜单上的 Elo 分差算期望胜率再取平均（Bradley–Terry）。只是预测，胜负照下面的规则打出来。',
    speed: '速度', skip: '跳到结果', roundsWon: '赢下回合', damageDealt: '造成伤害', guardBreak: '破防（仅演出）', scene: '场景', music: '音乐',
  },
  'zh-TW': {
    chars: { knight: '聖輝騎士', dragon: '琥珀文龍', mage: '雙子星術士', mech: '黑曜機甲', whale: '深海鯨武士', scholar: '千問書生', rabbit: '月影兔忍', fox: '九尾靈狐' },
    predict: '賽前預測', predictLine: '{left}% 對 {right}%',
    predictNote: '按兩邊在同一批榜單上的 Elo 分差算期望勝率再取平均（Bradley–Terry）。只是預測，勝負照下面的規則打出來。',
    speed: '速度', skip: '跳到結果', roundsWon: '贏下回合', damageDealt: '造成傷害', guardBreak: '破防（僅演出）', scene: '場景', music: '音樂',
  },
  en: X_EN,
  ja: {
    chars: { knight: '聖輝の騎士', dragon: '琥珀の文竜', mage: '双子星の術士', mech: '黒曜メカ', whale: '深海クジラ武士', scholar: '千問の書生', rabbit: '月影ウサギ忍者', fox: '九尾の霊狐' },
    predict: '試合前の予想', predictLine: '{left}% 対 {right}%',
    predictNote: '同じリーダーボード上の Elo 差から期待勝率を出して平均したもの（Bradley–Terry）。あくまで予想で、勝敗は下のルールで決まります。',
    speed: '速度', skip: '結果へスキップ', roundsWon: '取ったラウンド', damageDealt: '与ダメージ', guardBreak: 'ガードブレイク（演出のみ）', scene: 'ステージ', music: 'BGM',
  },
  ko: {
    chars: { knight: '성휘 기사', dragon: '호박 문룡', mage: '쌍둥이별 술사', mech: '흑요 메카', whale: '심해 고래 무사', scholar: '천문 서생', rabbit: '달그림자 토끼 닌자', fox: '구미 영호' },
    predict: '경기 전 예측', predictLine: '{left}% 대 {right}%',
    predictNote: '같은 리더보드들의 Elo 차이로 기대 승률을 구해 평균한 값(Bradley–Terry)입니다. 예측일 뿐, 승패는 아래 규칙대로 정해집니다.',
    speed: '속도', skip: '결과로 건너뛰기', roundsWon: '이긴 라운드', damageDealt: '준 피해', guardBreak: '가드 브레이크(연출만)', scene: '스테이지', music: '음악',
  },
  fr: { ...X_EN, chars: { knight: 'Paladin Sol', dragon: 'Drake d’ambre Fable', mage: 'Sorcier Étoiles-Jumelles', mech: 'Méca d’obsidienne', whale: 'Samouraï baleine des abysses', scholar: 'Lettré aux mille questions', rabbit: 'Ninja lapin lunaire', fox: 'Renard esprit à neuf queues' }, predict: 'Pronostic', predictLine: '{left} % contre {right} %', predictNote: 'Moyenne des scores attendus selon les écarts Elo sur les mêmes classements (Bradley–Terry). Simple pronostic : le combat suit les règles ci-dessous.', speed: 'Vitesse', skip: 'Passer au résultat', roundsWon: 'Manches gagnées', damageDealt: 'Dégâts infligés', guardBreak: 'Garde brisée (effet seulement)', scene: 'Décor', music: 'Musique' },
  de: { ...X_EN, chars: { knight: 'Sol-Paladin', dragon: 'Bernstein-Drache Fable', mage: 'Zwillingsstern-Magier', mech: 'Obsidian-Mech', whale: 'Tiefsee-Walsamurai', scholar: 'Gelehrter der tausend Fragen', rabbit: 'Mondhasen-Ninja', fox: 'Neunschwänziger Geisterfuchs' }, predict: 'Prognose', predictLine: '{left} % zu {right} %', predictNote: 'Durchschnitt der erwarteten Siegchancen aus den Elo-Abständen auf denselben Ranglisten (Bradley–Terry). Nur eine Prognose; der Kampf folgt den Regeln unten.', speed: 'Tempo', skip: 'Zum Ergebnis', roundsWon: 'Gewonnene Runden', damageDealt: 'Verursachter Schaden', guardBreak: 'Deckungsbruch (nur Effekt)', scene: 'Bühne', music: 'Musik' },
  es: { ...X_EN, chars: { knight: 'Paladín Sol', dragon: 'Dragón de ámbar Fable', mage: 'Hechicero Estrellas Gemelas', mech: 'Meca de obsidiana', whale: 'Samurái ballena abisal', scholar: 'Erudito de mil preguntas', rabbit: 'Ninja conejo lunar', fox: 'Zorro espíritu de nueve colas' }, predict: 'Pronóstico', predictLine: '{left} % contra {right} %', predictNote: 'Media de la probabilidad esperada según las diferencias Elo en las mismas clasificaciones (Bradley–Terry). Solo es un pronóstico; el combate sigue las reglas de abajo.', speed: 'Velocidad', skip: 'Ir al resultado', roundsWon: 'Asaltos ganados', damageDealt: 'Daño causado', guardBreak: 'Rotura de guardia (solo efecto)', scene: 'Escenario', music: 'Música' },
  hi: { ...X_EN, chars: { knight: 'सोल पलाडिन', dragon: 'एम्बर फ़ेबल ड्रैगन', mage: 'जुड़वाँ-तारा जादूगर', mech: 'ऑब्सीडियन मेक', whale: 'गहरे समुद्र का व्हेल समुराई', scholar: 'हज़ार-सवाल विद्वान', rabbit: 'चंद्र खरगोश निंजा', fox: 'नौ-पूँछ आत्मा लोमड़ी' }, predict: 'मुकाबले से पहले अनुमान', predictLine: '{left}% बनाम {right}%', predictNote: 'एक जैसे लीडरबोर्ड पर Elo अंतर से निकली अपेक्षित जीत-संभावना का औसत (Bradley–Terry)। यह सिर्फ़ अनुमान है; लड़ाई नीचे के नियमों से चलती है।', speed: 'रफ़्तार', skip: 'सीधे नतीजा', roundsWon: 'जीते राउंड', damageDealt: 'दिया गया डैमेज', guardBreak: 'गार्ड ब्रेक (सिर्फ़ इफ़ेक्ट)', scene: 'मंच', music: 'संगीत' },
  th: { ...X_EN, chars: { knight: 'อัศวินโซล', dragon: 'มังกรอำพันเฟเบิล', mage: 'จอมเวทดาวคู่', mech: 'เมคออบซิเดียน', whale: 'ซามูไรวาฬทะเลลึก', scholar: 'บัณฑิตพันคำถาม', rabbit: 'นินจากระต่ายจันทร์', fox: 'จิ้งจอกวิญญาณเก้าหาง' }, predict: 'คาดการณ์ก่อนชก', predictLine: '{left}% ต่อ {right}%', predictNote: 'ค่าเฉลี่ยโอกาสชนะที่คาดจากส่วนต่าง Elo บนลีดเดอร์บอร์ดเดียวกัน (Bradley–Terry) เป็นแค่การคาดการณ์ ผลจริงตัดสินตามกติกาด้านล่าง', speed: 'ความเร็ว', skip: 'ข้ามไปดูผล', roundsWon: 'ยกที่ชนะ', damageDealt: 'ความเสียหายที่ทำ', guardBreak: 'ทำลายการป้องกัน (แค่เอฟเฟกต์)', scene: 'ฉาก', music: 'เพลง' },
  ru: { ...X_EN, chars: { knight: 'Паладин Сол', dragon: 'Янтарный дракон Фейбл', mage: 'Чародей Двух Звёзд', mech: 'Обсидиановый мех', whale: 'Кит-самурай глубин', scholar: 'Книжник тысячи вопросов', rabbit: 'Лунный кролик-ниндзя', fox: 'Девятихвостая лиса-дух' }, predict: 'Прогноз', predictLine: '{left}% против {right}%', predictNote: 'Среднее ожидаемых шансов по разнице Эло в одних и тех же рейтингах (Брэдли — Терри). Это лишь прогноз; бой идёт по правилам ниже.', speed: 'Скорость', skip: 'К результату', roundsWon: 'Выиграно раундов', damageDealt: 'Нанесено урона', guardBreak: 'Пробитие защиты (только эффект)', scene: 'Сцена', music: 'Музыка' },
  pt: { ...X_EN, chars: { knight: 'Paladino Sol', dragon: 'Dragão de âmbar Fable', mage: 'Feiticeiro Estrelas Gêmeas', mech: 'Mecha de obsidiana', whale: 'Samurai baleia abissal', scholar: 'Letrado das mil perguntas', rabbit: 'Ninja coelho lunar', fox: 'Raposa espírito de nove caudas' }, predict: 'Previsão', predictLine: '{left}% contra {right}%', predictNote: 'Média da chance esperada a partir das diferenças Elo nos mesmos rankings (Bradley–Terry). É só uma previsão; a luta segue as regras abaixo.', speed: 'Velocidade', skip: 'Pular para o resultado', roundsWon: 'Rounds vencidos', damageDealt: 'Dano causado', guardBreak: 'Quebra de guarda (só efeito)', scene: 'Cenário', music: 'Música' },
}
export function arenaExtra(locale: Locale): Omit<ArenaExtra, 'chars'> & { chars: Record<string, string>; moves: Record<string, string>; intro: Record<string, string>; win: Record<string, string>; ui: V5Ui } {
  const l = arenaLines(locale)
  const n = v5Lines(locale)
  return { ...(X[locale] ?? X_EN), chars: { ...l.chars, ...n.chars }, moves: { ...l.moves, ...n.moves }, intro: { ...l.intro, ...n.intro }, win: { ...l.win, ...n.win }, ui: v5Ui(locale) }
}

/* ---------- v3: mascot brawlers — names, move names, intro & victory lines ---------- */
type AvatarKey = keyof ArenaExtra['chars']
type Lines = { chars?: Record<AvatarKey, string>; moves: Record<AvatarKey, string>; intro: Record<AvatarKey, string>; win: Record<AvatarKey, string> }
const L = (a: string[]): Record<AvatarKey, string> => ({ knight: a[0], dragon: a[1], mage: a[2], mech: a[3], whale: a[4], scholar: a[5], rabbit: a[6], fox: a[7] })
const CHARS_EN = L(['ChatGPT Knot Sprite', 'Claude Crab “Clawd”', 'Gemini Sparkle', 'Grok Black-Hole Kid', 'DeepSeek Little Whale', 'Qwen Capybara', 'Kimi Crescent', 'GLM Z-Bot'])
const LINES: Record<string, Lines> = {
  'zh-CN': {
    chars: L(['ChatGPT 结花精灵', 'Claude 小螃蟹 Clawd', 'Gemini 星芒', 'Grok 黑洞仔', 'DeepSeek 小蓝鲸', 'Qwen 卡皮巴拉', 'Kimi 月牙', 'GLM Z 宝']),
    moves: L(['六瓣结界·终焉补全！', '橙钳·宪法裁决！', '双子星芒·无限上下文斩！', '黑洞·事件视界吐槽拳！', '深度求索·海啸斩！', '千问·淡定柚子炮！', '月之暗面·长文本回旋踢！', 'Z 字闪电·知识图谱连击！']),
    intro: L(['吾之下一个 token，便是你的终焉！', '咔嚓咔嚓……我会很有礼貌地打败你。', '两颗星的光，你接得住吗？', '规则？我只看过梗图版。', '潜得越深，拍得越狠！', '……嗯？要打架？先泡个温泉。', '今晚的月色，是我的主场。', 'Z 宝已上线，正在加载必胜结局。']),
    win: L(['胜利……已自动补全。（被花瓣绊倒）', '承让承让！（钳子夹到自己）', '闪耀吧！……啊，星光漏电了。', '我赢了，这条可以发推。', '海啸过后，一片平静～（喷到自己）', '赢了吗？那我继续泡澡了。', '月亮代表我的胜利！（帽子掉了）', '必胜结局加载 100%！……又卡了一下。']),
  },
  'zh-TW': {
    chars: L(['ChatGPT 結花精靈', 'Claude 小螃蟹 Clawd', 'Gemini 星芒', 'Grok 黑洞仔', 'DeepSeek 小藍鯨', 'Qwen 卡皮巴拉', 'Kimi 月牙', 'GLM Z 寶']),
    moves: L(['六瓣結界·終焉補全！', '橙鉗·憲法裁決！', '雙子星芒·無限上下文斬！', '黑洞·事件視界吐槽拳！', '深度求索·海嘯斬！', '千問·淡定柚子砲！', '月之暗面·長文本迴旋踢！', 'Z 字閃電·知識圖譜連擊！']),
    intro: L(['吾之下一個 token，便是你的終焉！', '喀嚓喀嚓……我會很有禮貌地打敗你。', '兩顆星的光，你接得住嗎？', '規則？我只看過梗圖版。', '潛得越深，拍得越狠！', '……嗯？要打架？先泡個溫泉。', '今晚的月色，是我的主場。', 'Z 寶已上線，正在載入必勝結局。']),
    win: L(['勝利……已自動補全。（被花瓣絆倒）', '承讓承讓！（鉗子夾到自己）', '閃耀吧！……啊，星光漏電了。', '我贏了，這條可以發推。', '海嘯過後，一片平靜～（噴到自己）', '贏了嗎？那我繼續泡澡了。', '月亮代表我的勝利！（帽子掉了）', '必勝結局載入 100%！……又卡了一下。']),
  },
  en: {
    chars: CHARS_EN,
    moves: L(['Hexa-Knot: Final Completion!', 'Orange Claw: Constitutional Verdict!', 'Twin Sparkle: Infinite Context Slash!', 'Event Horizon Roast Punch!', 'Deep Seek: Tsunami Slash!', 'Chill Yuzu Cannon!', 'Dark Side Moon: Long-Context Spin Kick!', 'Z-Bolt: Knowledge Graph Combo!']),
    intro: L(['My next token is your doom!', 'Click-clack… I will beat you very politely.', 'Can you handle the light of two stars?', 'Rules? I only read the meme version.', 'The deeper I dive, the harder I splash!', '…Hm? A fight? Hot spring first.', 'Tonight the moon is my home turf.', 'Z-Bot online. Loading the winning ending…']),
    win: L(['Victory… autocompleted. (trips on a petal)', 'Thank you, thank you! (pinches self)', 'Shine! …oops, the starlight shorted out.', 'I won. This one goes on the timeline.', 'After the tsunami, calm~ (spouts on self)', 'Did I win? Back to my bath, then.', 'In the name of the moon, I win! (hat falls off)', 'Winning ending 100% loaded! …lagged a bit.']),
  },
  ja: {
    chars: L(['ChatGPT 結び花の精', 'Claude カニ「Clawd」', 'Gemini スパークル', 'Grok ブラックホールっ子', 'DeepSeek 子クジラ', 'Qwen カピバラ', 'Kimi 三日月', 'GLM Zボット']),
    moves: L(['六花結界・終焉補完！', '橙鋏・憲法裁定！', '双子星芒・無限コンテキスト斬！', '事象の地平・ツッコミ拳！', '深度探求・津波斬り！', '千問・まったり柚子砲！', '月の裏側・長文回し蹴り！', 'Z字稲妻・知識グラフ連撃！']),
    intro: L(['我が次のトークンが、貴様の終焉だ！', 'カチカチ……とても丁寧に倒します。', '二つの星の光、受け止められる？', 'ルール？ミーム版しか読んでない。', '深く潜るほど、強く叩く！', '……ん？ケンカ？まず温泉で。', '今夜の月は、僕のホームだ。', 'Zボット起動。勝利エンド読込中…']),
    win: L(['勝利……自動補完完了。（花びらでコケる）', 'どうもどうも！（自分を挟む）', '輝け！……あ、星の光が漏電した。', '勝った。これはポストしとこう。', '津波のあとは静けさ～（自分に潮吹き）', '勝った？じゃあお風呂に戻るね。', '月に代わって勝利！（帽子が落ちる）', '勝利エンド100%！……ちょっとカクついた。']),
  },
  ko: {
    chars: L(['ChatGPT 매듭꽃 요정', 'Claude 꽃게 Clawd', 'Gemini 반짝별', 'Grok 블랙홀 꼬마', 'DeepSeek 꼬마 고래', 'Qwen 카피바라', 'Kimi 초승달', 'GLM Z봇']),
    moves: L(['육화결계·종언 자동완성!', '주황 집게·헌법 판결!', '쌍둥이별·무한 컨텍스트 베기!', '사건의 지평선·츳코미 펀치!', '딥시크·해일 베기!', '천문·느긋한 유자포!', '달의 뒷면·장문 회전차기!', 'Z 번개·지식 그래프 연격!']),
    intro: L(['나의 다음 토큰이 너의 종언이다!', '찰칵찰칵… 아주 정중하게 이겨 줄게.', '두 별의 빛, 받아낼 수 있겠어?', '규칙? 밈 버전만 읽어 봤어.', '깊이 잠수할수록 세게 친다!', '…응? 싸움? 온천부터 하자.', '오늘 밤 달빛은 내 홈그라운드.', 'Z봇 가동. 승리 엔딩 로딩 중…']),
    win: L(['승리… 자동완성됨. (꽃잎에 걸려 넘어짐)', '고마워 고마워! (자기 집게에 집힘)', '빛나라! …앗, 별빛이 누전됐다.', '이겼다. 이건 타임라인에 올려야지.', '해일 뒤엔 고요~ (자기한테 물 뿜음)', '이긴 거야? 그럼 다시 목욕하러.', '달을 대신해 승리! (모자가 떨어짐)', '승리 엔딩 100%! …조금 끊겼다.']),
  },
  fr: {
    moves: L(['Hexa-nœud : complétion finale !', 'Pince orange : verdict constitutionnel !', 'Étoiles jumelles : taille contexte infini !', 'Poing horizon des événements !', 'Deep Seek : tranche-tsunami !', 'Canon zen au yuzu !', 'Face cachée : coup de pied long contexte !', 'Éclair Z : combo graphe de savoir !']),
    intro: L(['Mon prochain token sera ta fin !', 'Clic-clac… je vais te battre très poliment.', 'Tiendras-tu la lumière de deux étoiles ?', 'Les règles ? J’ai lu la version mème.', 'Plus je plonge, plus j’éclabousse !', '…Hein ? Un combat ? Onsen d’abord.', 'Ce soir, la lune joue à domicile.', 'Z-Bot en ligne. Fin victorieuse en chargement…']),
    win: L(['Victoire… autocomplétée. (trébuche sur un pétale)', 'Merci, merci ! (se pince tout seul)', 'Brille ! …oups, court-circuit stellaire.', 'Gagné. Celle-là, je la poste.', 'Après le tsunami, le calme~ (s’arrose)', 'J’ai gagné ? Retour au bain.', 'Au nom de la lune, victoire ! (perd son bonnet)', 'Fin victorieuse 100 % ! …petit lag.']),
  },
  de: {
    moves: L(['Hexa-Knoten: Finale Vervollständigung!', 'Orangene Schere: Verfassungsurteil!', 'Zwillingsstern: Endloskontext-Hieb!', 'Ereignishorizont-Spottfaust!', 'Deep Seek: Tsunami-Hieb!', 'Gechillte Yuzu-Kanone!', 'Dunkle Mondseite: Langkontext-Drehkick!', 'Z-Blitz: Wissensgraph-Kombo!']),
    intro: L(['Mein nächstes Token ist dein Ende!', 'Klick-klack… ich besiege dich sehr höflich.', 'Hältst du das Licht zweier Sterne aus?', 'Regeln? Kenne nur die Meme-Version.', 'Je tiefer ich tauche, desto härter platscht es!', '…Hm? Kampf? Erst mal Onsen.', 'Heute Nacht hat der Mond Heimspiel.', 'Z-Bot online. Siegesende lädt…']),
    win: L(['Sieg… autovervollständigt. (stolpert über Blüte)', 'Danke, danke! (zwickt sich selbst)', 'Strahle! …oh, Sternenlicht-Kurzschluss.', 'Gewonnen. Das wird gepostet.', 'Nach dem Tsunami: Ruhe~ (bespritzt sich)', 'Gewonnen? Dann zurück ins Bad.', 'Im Namen des Mondes: Sieg! (Mütze fällt)', 'Siegesende 100 %! …kurz geruckelt.']),
  },
  es: {
    moves: L(['Hexanudo: ¡compleción final!', 'Pinza naranja: ¡veredicto constitucional!', 'Estrellas gemelas: ¡corte de contexto infinito!', '¡Puño del horizonte de eventos!', 'Deep Seek: ¡tajo tsunami!', '¡Cañón zen de yuzu!', 'Cara oculta: ¡patada giratoria de contexto largo!', 'Rayo Z: ¡combo de grafo de saber!']),
    intro: L(['¡Mi próximo token será tu fin!', 'Clic-clac… te ganaré muy educadamente.', '¿Aguantarás la luz de dos estrellas?', '¿Reglas? Solo leí la versión meme.', '¡Cuanto más hondo buceo, más fuerte salpico!', '…¿Eh? ¿Pelea? Primero, aguas termales.', 'Esta noche la luna juega en casa.', 'Z-Bot en línea. Cargando final ganador…']),
    win: L(['Victoria… autocompletada. (tropieza con un pétalo)', '¡Gracias, gracias! (se pellizca solo)', '¡Brilla! …uy, cortocircuito estelar.', 'Gané. Esto va al timeline.', 'Tras el tsunami, calma~ (se moja solo)', '¿Gané? Pues vuelvo al baño.', '¡En nombre de la luna, gano! (se le cae el gorro)', '¡Final ganador al 100 %! …se trabó un poco.']),
  },
  pt: {
    moves: L(['Hexanó: conclusão final!', 'Pinça laranja: veredito constitucional!', 'Estrelas gêmeas: corte de contexto infinito!', 'Soco do horizonte de eventos!', 'Deep Seek: golpe tsunami!', 'Canhão zen de yuzu!', 'Lado oculto: chute giratório de contexto longo!', 'Raio Z: combo de grafo do saber!']),
    intro: L(['Meu próximo token é o seu fim!', 'Clic-clac… vou te vencer com muita educação.', 'Aguenta a luz de duas estrelas?', 'Regras? Só li a versão meme.', 'Quanto mais fundo mergulho, mais forte bato!', '…Hã? Briga? Primeiro, termas.', 'Hoje a lua joga em casa.', 'Z-Bot online. Carregando final vitorioso…']),
    win: L(['Vitória… autocompletada. (tropeça numa pétala)', 'Valeu, valeu! (belisca a si mesmo)', 'Brilha! …ops, curto-circuito estelar.', 'Venci. Essa vai pra timeline.', 'Depois do tsunami, calma~ (se molha)', 'Venci? Então volto pro banho.', 'Em nome da lua, venci! (o gorro cai)', 'Final vitorioso 100%! …travou um pouco.']),
  },
  ru: {
    moves: L(['Гекса-узел: финальное дополнение!', 'Оранжевая клешня: конституционный вердикт!', 'Звёзды-близнецы: удар бесконечного контекста!', 'Кулак горизонта событий!', 'Deep Seek: цунами-удар!', 'Невозмутимая юдзу-пушка!', 'Тёмная сторона Луны: вертушка длинного контекста!', 'Z-молния: комбо графа знаний!']),
    intro: L(['Мой следующий токен — твой конец!', 'Щёлк-щёлк… побежу тебя очень вежливо.', 'Выдержишь свет двух звёзд?', 'Правила? Читал только мем-версию.', 'Чем глубже ныряю, тем сильнее шлёп!', '…А? Драка? Сначала в онсэн.', 'Сегодня луна играет дома.', 'Z-Bot в сети. Загрузка победного финала…']),
    win: L(['Победа… автодополнена. (спотыкается о лепесток)', 'Спасибо, спасибо! (щиплет сам себя)', 'Сияй! …ой, звёздное замыкание.', 'Победил. Это в ленту.', 'После цунами — штиль~ (обрызгал себя)', 'Я победил? Тогда обратно в ванну.', 'Именем Луны — победа! (слетел колпак)', 'Победный финал 100%! …чуть подлагал.']),
  },
  hi: {
    moves: L(['षट्-गाँठ: अंतिम पूर्णता!', 'नारंगी पंजा: संवैधानिक फ़ैसला!', 'जुड़वाँ तारे: अनंत संदर्भ वार!', 'घटना-क्षितिज मुक्का!', 'डीप सीक: सुनामी वार!', 'बेफ़िक्र युज़ु तोप!', 'चाँद का अँधेरा पक्ष: लंबा-संदर्भ किक!', 'Z-बिजली: ज्ञान-ग्राफ़ कॉम्बो!']),
    intro: L(['मेरा अगला टोकन तुम्हारा अंत है!', 'क्लिक-क्लैक… बड़ी तमीज़ से हराऊँगा।', 'दो तारों की रोशनी झेल पाओगे?', 'नियम? मैंने बस मीम वाला पढ़ा है।', 'जितना गहरा गोता, उतना ज़ोर का छपाक!', '…हैं? लड़ाई? पहले गर्म पानी का स्नान।', 'आज रात चाँद मेरा घरेलू मैदान है।', 'Z-बॉट ऑनलाइन। जीत वाला अंत लोड हो रहा…']),
    win: L(['जीत… ऑटो-पूर्ण। (पंखुड़ी से फिसला)', 'शुक्रिया, शुक्रिया! (खुद को चुटकी)', 'चमको! …उफ़, तारों में शॉर्ट-सर्किट।', 'जीत गया। ये पोस्ट होगा।', 'सुनामी के बाद शांति~ (खुद पर फुहार)', 'जीत गया? तो वापस नहाने चला।', 'चाँद के नाम पर जीत! (टोपी गिरी)', 'जीत वाला अंत 100%! …थोड़ा अटका।']),
  },
  th: {
    moves: L(['ปมหกกลีบ: เติมคำสุดท้าย!', 'ก้ามส้ม: คำตัดสินรัฐธรรมนูญ!', 'ดาวคู่: ฟันบริบทไม่สิ้นสุด!', 'หมัดขอบฟ้าเหตุการณ์!', 'ดีพซีก: ฟันสึนามิ!', 'ปืนใหญ่ส้มยูซุชิลๆ!', 'ด้านมืดของดวงจันทร์: เตะหมุนบริบทยาว!', 'สายฟ้า Z: คอมโบกราฟความรู้!']),
    intro: L(['โทเคนถัดไปของข้า คือจุดจบของเจ้า!', 'แกร๊กๆ… จะชนะแบบสุภาพมากเลยนะ', 'รับแสงจากดาวสองดวงไหวไหม?', 'กติกา? อ่านแค่ฉบับมีม', 'ยิ่งดำลึก ยิ่งฟาดแรง!', '…หือ? จะสู้เหรอ? แช่ออนเซ็นก่อน', 'คืนนี้ดวงจันทร์คือสนามเหย้าของฉัน', 'Z-Bot ออนไลน์ กำลังโหลดตอนจบแบบชนะ…']),
    win: L(['ชนะ… เติมคำอัตโนมัติแล้ว (สะดุดกลีบดอก)', 'ขอบคุณๆ! (หนีบตัวเอง)', 'เปล่งประกาย! …อุ๊ย แสงดาวช็อต', 'ชนะแล้ว อันนี้ต้องโพสต์', 'หลังสึนามิ สงบ~ (พ่นน้ำใส่ตัวเอง)', 'ชนะแล้วเหรอ? งั้นกลับไปแช่น้ำต่อ', 'ในนามของดวงจันทร์ ชนะ! (หมวกหล่น)', 'ตอนจบแบบชนะ 100%! …กระตุกนิดนึง']),
  },
}
export type ArenaLines = { chars: Record<AvatarKey, string>; moves: Record<AvatarKey, string>; intro: Record<AvatarKey, string>; win: Record<AvatarKey, string> }
export function arenaLines(locale: Locale): ArenaLines {
  const l = LINES[locale] ?? LINES.en
  return { chars: l.chars ?? CHARS_EN, moves: l.moves, intro: l.intro, win: l.win }
}
