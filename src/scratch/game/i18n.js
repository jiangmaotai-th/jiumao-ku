import { getLocale } from "../../i18n";

const TAGS = {
  "zh-CN": "zh-CN",
  "zh-TW": "zh-TW",
  en: "en",
  ja: "ja",
  ko: "ko",
  fr: "fr",
  de: "de",
  es: "es",
  hi: "hi-IN",
  th: "th",
  ru: "ru",
  pt: "pt"
};

const COUNTRIES = {
  中国: { "zh-CN": "中国", "zh-TW": "中國", en: "China", ja: "中国", ko: "중국", fr: "Chine", de: "China", es: "China", hi: "चीन", th: "จีน", ru: "Китай", pt: "China" },
  日本: { "zh-CN": "日本", "zh-TW": "日本", en: "Japan", ja: "日本", ko: "일본", fr: "Japon", de: "Japan", es: "Japón", hi: "जापान", th: "ญี่ปุ่น", ru: "Япония", pt: "Japão" },
  美国: { "zh-CN": "美国", "zh-TW": "美國", en: "United States", ja: "アメリカ", ko: "미국", fr: "États-Unis", de: "USA", es: "EE. UU.", hi: "अमेरिका", th: "สหรัฐฯ", ru: "США", pt: "EUA" },
  韩国: { "zh-CN": "韩国", "zh-TW": "韓國", en: "Korea", ja: "韓国", ko: "한국", fr: "Corée", de: "Korea", es: "Corea", hi: "कोरिया", th: "เกาหลี", ru: "Корея", pt: "Coreia" },
  英国: { "zh-CN": "英国", "zh-TW": "英國", en: "United Kingdom", ja: "イギリス", ko: "영국", fr: "Royaume-Uni", de: "Großbritannien", es: "Reino Unido", hi: "ब्रिटेन", th: "อังกฤษ", ru: "Великобритания", pt: "Reino Unido" },
  法国: { "zh-CN": "法国", "zh-TW": "法國", en: "France", ja: "フランス", ko: "프랑스", fr: "France", de: "Frankreich", es: "Francia", hi: "फ़्रांस", th: "ฝรั่งเศส", ru: "Франция", pt: "França" },
  印度: { "zh-CN": "印度", "zh-TW": "印度", en: "India", ja: "インド", ko: "인도", fr: "Inde", de: "Indien", es: "India", hi: "भारत", th: "อินเดีย", ru: "Индия", pt: "Índia" },
  墨西哥: { "zh-CN": "墨西哥", "zh-TW": "墨西哥", en: "Mexico", ja: "メキシコ", ko: "멕시코", fr: "Mexique", de: "Mexiko", es: "México", hi: "मेक्सिको", th: "เม็กซิโก", ru: "Мексика", pt: "México" },
  埃及: { "zh-CN": "埃及", "zh-TW": "埃及", en: "Egypt", ja: "エジプト", ko: "이집트", fr: "Égypte", de: "Ägypten", es: "Egipto", hi: "मिस्र", th: "อียิปต์", ru: "Египет", pt: "Egito" }
};

const RARITY = {
  普通: { "zh-CN": "普通", "zh-TW": "普通", en: "Common", ja: "ノーマル", ko: "일반", fr: "Commun", de: "Gewöhnlich", es: "Común", hi: "सामान्य", th: "ธรรมดา", ru: "Обычный", pt: "Comum" },
  稀有: { "zh-CN": "稀有", "zh-TW": "稀有", en: "Rare", ja: "レア", ko: "희귀", fr: "Rare", de: "Selten", es: "Raro", hi: "दुर्लभ", th: "หายาก", ru: "Редкий", pt: "Raro" },
  传说: { "zh-CN": "传说", "zh-TW": "傳說", en: "Legendary", ja: "伝説", ko: "전설", fr: "Légendaire", de: "Legendär", es: "Legendario", hi: "पौराणिक", th: "ตำนาน", ru: "Легенда", pt: "Lendário" }
};

const TIER = {
  未中奖: { "zh-CN": "未中奖", "zh-TW": "未中獎", en: "No win", ja: "ハズレ", ko: "낙첨", fr: "Perdu", de: "Niete", es: "Sin premio", hi: "कोई जीत नहीं", th: "ไม่ถูกรางวัล", ru: "Без выигрыша", pt: "Sem prêmio" },
  谢谢惠顾: { "zh-CN": "谢谢惠顾", "zh-TW": "謝謝惠顧", en: "Try again", ja: "また今度", ko: "다음 기회에", fr: "Réessayez", de: "Niete", es: "Sigue intentando", hi: "फिर कोशिश", th: "ครั้งหน้า", ru: "Повезёт в другой раз", pt: "Tente de novo" },
  小奖: { "zh-CN": "小奖", "zh-TW": "小獎", en: "Small", ja: "小当たり", ko: "소상", fr: "Petit", de: "Klein", es: "Pequeño", hi: "छोटा", th: "รางวัลเล็ก", ru: "Малый", pt: "Pequeno" },
  中奖: { "zh-CN": "中奖", "zh-TW": "中獎", en: "Win", ja: "当たり", ko: "당첨", fr: "Gain", de: "Gewinn", es: "Premio", hi: "जीत", th: "ถูกรางวัล", ru: "Выигрыш", pt: "Prêmio" },
  大奖: { "zh-CN": "大奖", "zh-TW": "大獎", en: "Big win", ja: "大当たり", ko: "대상", fr: "Gros lot", de: "Großer Gewinn", es: "Gran premio", hi: "बड़ी जीत", th: "รางวัลใหญ่", ru: "Крупный", pt: "Grande" },
  头奖: { "zh-CN": "头奖", "zh-TW": "頭獎", en: "Jackpot", ja: "一等", ko: "잭팟", fr: "Jackpot", de: "Jackpot", es: "Bote", hi: "जैकपॉट", th: "แจ็กพอต", ru: "Джекпот", pt: "Jackpot" },
  连线: { "zh-CN": "连线", "zh-TW": "連線", en: "Line", ja: "リーチ", ko: "라인", fr: "Ligne", de: "Linie", es: "Línea", hi: "लाइन", th: "เส้น", ru: "Линия", pt: "Linha" },
  四角: { "zh-CN": "四角", "zh-TW": "四角", en: "Corners", ja: "四隅", ko: "네 모서리", fr: "Coins", de: "Ecken", es: "Esquinas", hi: "कोने", th: "มุม", ru: "Углы", pt: "Cantos" },
  "X 大奖": { "zh-CN": "X 大奖", "zh-TW": "X 大獎", en: "X prize", ja: "X 大当たり", ko: "X 대상", fr: "Prix X", de: "X-Preis", es: "Premio X", hi: "X इनाम", th: "รางวัล X", ru: "Приз X", pt: "Prêmio X" },
  "3 词": { "zh-CN": "3 词", "zh-TW": "3 詞", en: "3 words", ja: "3語", ko: "3단어", fr: "3 mots", de: "3 Wörter", es: "3 palabras", hi: "3 शब्द", th: "3 คำ", ru: "3 слова", pt: "3 palavras" },
  "4 词": { "zh-CN": "4 词", "zh-TW": "4 詞", en: "4 words", ja: "4語", ko: "4단어", fr: "4 mots", de: "4 Wörter", es: "4 palabras", hi: "4 शब्द", th: "4 คำ", ru: "4 слова", pt: "4 palavras" },
  "5 词": { "zh-CN": "5 词", "zh-TW": "5 詞", en: "5 words", ja: "5語", ko: "5단어", fr: "5 mots", de: "5 Wörter", es: "5 palabras", hi: "5 शब्द", th: "5 คำ", ru: "5 слов", pt: "5 palavras" },
  全中: { "zh-CN": "全中", "zh-TW": "全中", en: "All words", ja: "全問", ko: "전부", fr: "Tous", de: "Alle", es: "Todas", hi: "सभी", th: "ครบ", ru: "Все", pt: "Todas" },
  一卡连线: { "zh-CN": "一卡连线", "zh-TW": "一卡連線", en: "One card line", ja: "1枚リーチ", ko: "카드 1장 라인", fr: "1 carte ligne", de: "1 Karte Linie", es: "1 carta línea", hi: "एक कार्ड लाइन", th: "1 ใบ เส้น", ru: "1 карта линия", pt: "1 cartão linha" },
  一卡四角: { "zh-CN": "一卡四角", "zh-TW": "一卡四角", en: "One card corners", ja: "1枚四隅", ko: "카드 1장 모서리", fr: "1 carte coins", de: "1 Karte Ecken", es: "1 carta esquinas", hi: "एक कार्ड कोने", th: "1 ใบ มุม", ru: "1 карта углы", pt: "1 cartão cantos" },
  "大奖 · 传说三连": { "zh-CN": "大奖 · 传说三连", "zh-TW": "大獎 · 傳說三連", en: "Big · legendary 3", ja: "大当たり · 伝説3", ko: "대상 · 전설 3", fr: "Gros · légendaire", de: "Groß · Legende", es: "Grande · legendario", hi: "बड़ा · लीजेंड", th: "ใหญ่ · ตำนาน", ru: "Крупный · легенда", pt: "Grande · lenda" },
  "头奖 · 传说三连": { "zh-CN": "头奖 · 传说三连", "zh-TW": "頭獎 · 傳說三連", en: "Jackpot · legendary 3", ja: "一等 · 伝説3", ko: "잭팟 · 전설 3", fr: "Jackpot · légendaire", de: "Jackpot · Legende", es: "Bote · legendario", hi: "जैकपॉट · लीजेंड", th: "แจ็กพอต · ตำนาน", ru: "Джекпот · легенда", pt: "Jackpot · lenda" }
};

const UI = {
  gold: { "zh-CN": "金币", "zh-TW": "金幣", en: "coins", ja: "コイン", ko: "코인", fr: "pièces", de: "Münzen", es: "monedas", hi: "सिक्के", th: "เหรียญ", ru: "монеты", pt: "moedas" },
  shop: { "zh-CN": "打开商店", "zh-TW": "打開商店", en: "Open shop", ja: "お店を開く", ko: "상점 열기", fr: "Ouvrir la boutique", de: "Laden öffnen", es: "Abrir tienda", hi: "दुकान खोलें", th: "เปิดร้าน", ru: "Открыть лавку", pt: "Abrir loja" },
  shopLabel: { "zh-CN": "商店", "zh-TW": "商店", en: "Shop", ja: "商店", ko: "상점", fr: "Magasin", de: "Laden", es: "Tienda", hi: "दुकान", th: "ร้านค้า", ru: "Лавка", pt: "Loja" },
  shopTitle: { "zh-CN": "杂货铺", "zh-TW": "雜貨鋪", en: "General store", ja: "雑貨屋", ko: "잡화점", fr: "Épicerie", de: "Kramladen", es: "Ultramarinos", hi: "किराना", th: "ร้านของชำ", ru: "Лавка", pt: "Armazém" },
  shopClosedSign: { "zh-CN": "今日打烊", "zh-TW": "今日打烊", en: "Closed today", ja: "本日休業", ko: "오늘 휴무", fr: "Fermé aujourd’hui", de: "Heute geschlossen", es: "Cerrado hoy", hi: "आज बंद", th: "วันนี้ปิด", ru: "Сегодня закрыто", pt: "Fechado hoje" },
  shopLead: { "zh-CN": "货物还没到齐，橱窗先关着。", "zh-TW": "貨物還沒到齊，櫥窗先關著。", en: "Stock hasn’t arrived, so the windows stay shuttered.", ja: "品物がまだ揃っていないので、窓は閉めたままです。", ko: "물건이 아직 안 와서 진열창은 닫혀 있습니다.", fr: "Le stock n’est pas arrivé ; les vitrines restent fermées.", de: "Ware fehlt noch, die Fenster bleiben zu.", es: "Aún no llega la mercancía; las vitrinas siguen cerradas.", hi: "माल नहीं आया, खिड़कियाँ बंद हैं।", th: "ของยังไม่มา ตู้โชว์ปิดไว้ก่อน", ru: "Товар ещё не пришёл — витрины закрыты.", pt: "A mercadoria ainda não chegou; as montras ficam fechadas." },
  shopClosed: { "zh-CN": "未开张", "zh-TW": "未開張", en: "Not open", ja: "未開店", ko: "미개점", fr: "Pas ouvert", de: "Nicht offen", es: "Sin abrir", hi: "बंद", th: "ยังไม่เปิด", ru: "Не открыто", pt: "Fechado" },
  shopWindow: { "zh-CN": "橱窗", "zh-TW": "櫥窗", en: "Window", ja: "窓", ko: "진열창", fr: "Vitrine", de: "Schaufenster", es: "Vitrina", hi: "खिड़की", th: "ตู้โชว์", ru: "Витрина", pt: "Montra" },
  shopComing: { "zh-CN": "这扇橱窗还没开张", "zh-TW": "這扇櫥窗還沒開張", en: "This window isn’t open yet", ja: "この窓はまだ開いていません", ko: "이 창은 아직 안 열렸습니다", fr: "Cette vitrine n’est pas encore ouverte", de: "Dieses Fenster ist noch zu", es: "Esta vitrina aún no abre", hi: "यह खिड़की अभी नहीं खुली", th: "ตู้โชว์นี้ยังไม่เปิด", ru: "Эта витрина ещё закрыта", pt: "Esta montra ainda não abre" },
  modeMeta: { "zh-CN": "{flag} · {cost} 金币 · 点此换玩法", "zh-TW": "{flag} · {cost} 金幣 · 點此換玩法", en: "{flag} · {cost} coins · tap to switch", ja: "{flag} · {cost} コイン · タップで切替", ko: "{flag} · {cost}코인 · 눌러서 변경", fr: "{flag} · {cost} pièces · changer", de: "{flag} · {cost} Münzen · wechseln", es: "{flag} · {cost} monedas · cambiar", hi: "{flag} · {cost} सिक्के · बदलें", th: "{flag} · {cost} เหรียญ · แตะเพื่อเปลี่ยน", ru: "{flag} · {cost} монет · сменить", pt: "{flag} · {cost} moedas · trocar" },
  scratching: { "zh-CN": "刮奖中…", "zh-TW": "刮獎中…", en: "Scratching…", ja: "スクラッチ中…", ko: "긁는 중…", fr: "Grattage…", de: "Rubbeln…", es: "Rascando…", hi: "खरोंच रहे…", th: "กำลังขูด…", ru: "Стираем…", pt: "Raspando…" },
  playAgain: { "zh-CN": "再来一张 · {cost}", "zh-TW": "再來一張 · {cost}", en: "Play again · {cost}", ja: "もう一枚 · {cost}", ko: "한 장 더 · {cost}", fr: "Encore · {cost}", de: "Nochmal · {cost}", es: "Otra · {cost}", hi: "फिर से · {cost}", th: "อีกใบ · {cost}", ru: "Ещё · {cost}", pt: "Outra · {cost}" },
  close: { "zh-CN": "关闭", "zh-TW": "關閉", en: "Close", ja: "閉じる", ko: "닫기", fr: "Fermer", de: "Schließen", es: "Cerrar", hi: "बंद", th: "ปิด", ru: "Закрыть", pt: "Fechar" },
  guestAccount: { "zh-CN": "游客账号", "zh-TW": "遊客帳號", en: "Guest account", ja: "ゲスト", ko: "게스트", fr: "Invité", de: "Gast", es: "Invitado", hi: "अतिथि", th: "แขก", ru: "Гость", pt: "Convidado" },
  accountUser: { "zh-CN": "游戏账号 {name}", "zh-TW": "遊戲帳號 {name}", en: "Account {name}", ja: "アカウント {name}", ko: "계정 {name}", fr: "Compte {name}", de: "Konto {name}", es: "Cuenta {name}", hi: "खाता {name}", th: "บัญชี {name}", ru: "Аккаунт {name}", pt: "Conta {name}" },
  stubs: { "zh-CN": "奖票票根", "zh-TW": "獎票票根", en: "Ticket stubs", ja: "半券", ko: "티켓 반쪽", fr: "Souches", de: "Abschnitte", es: "Talones", hi: "टिकट स्टब", th: "ต้นขั้ว", ru: "Корешки", pt: "Canhotos" },
  collection: { "zh-CN": "打开图鉴", "zh-TW": "打開圖鑑", en: "Open album", ja: "図鑑", ko: "도감", fr: "Album", de: "Album", es: "Álbum", hi: "एल्बम", th: "อัลบั้ม", ru: "Альбом", pt: "Álbum" },
  odds: { "zh-CN": "查看概率", "zh-TW": "查看機率", en: "View odds", ja: "確率", ko: "확률", fr: "Cotes", de: "Quoten", es: "Probabilidades", hi: "संभावना", th: "อัตรา", ru: "Шансы", pt: "Odds" },
  soundOn: { "zh-CN": "关闭音乐", "zh-TW": "關閉音樂", en: "Mute music", ja: "音楽オフ", ko: "음악 끄기", fr: "Couper la musique", de: "Musik aus", es: "Silenciar", hi: "म्यूट", th: "ปิดเสียง", ru: "Выкл. музыку", pt: "Silenciar" },
  soundOff: { "zh-CN": "开启音乐", "zh-TW": "開啟音樂", en: "Unmute music", ja: "音楽オン", ko: "음악 켜기", fr: "Activer la musique", de: "Musik an", es: "Activar sonido", hi: "अनम्यूट", th: "เปิดเสียง", ru: "Вкл. музыку", pt: "Som" },
  ticketStage: { "zh-CN": "刮奖券", "zh-TW": "刮獎券", en: "Scratch ticket", ja: "スクラッチ券", ko: "스크래치 티켓", fr: "Ticket à gratter", de: "Rubbellos", es: "Boleto", hi: "स्क्रैच टिकट", th: "ใบขูด", ru: "Лотерея", pt: "Raspadinha" },
  loading: { "zh-CN": "正在布置展柜…", "zh-TW": "正在布置展櫃…", en: "Setting the gallery…", ja: "展示を準備中…", ko: "전시를 준비하는 중…", fr: "Préparation…", de: "Galerie wird vorbereitet…", es: "Preparando…", hi: "तैयार हो रहा…", th: "กำลังจัดตู้…", ru: "Готовим витрину…", pt: "Preparando…" },
  loadFail: { "zh-CN": "展品加载失败，请刷新重试", "zh-TW": "展品載入失敗，請重新整理", en: "Failed to load. Please refresh.", ja: "読み込みに失敗しました。更新してください。", ko: "불러오지 못했습니다. 새로고침하세요.", fr: "Échec du chargement. Actualisez.", de: "Laden fehlgeschlagen. Bitte neu laden.", es: "Error al cargar. Actualiza.", hi: "लोड नहीं हुआ। रीफ़्रेश करें।", th: "โหลดไม่สำเร็จ รีเฟรชได้", ru: "Не удалось загрузить. Обновите.", pt: "Falha ao carregar. Atualize." },
  prevMode: { "zh-CN": "上一个玩法", "zh-TW": "上一個玩法", en: "Previous game", ja: "前の遊び方", ko: "이전 게임", fr: "Jeu précédent", de: "Vorheriges Spiel", es: "Juego anterior", hi: "पिछला खेल", th: "เกมก่อน", ru: "Предыдущая", pt: "Jogo anterior" },
  nextMode: { "zh-CN": "下一个玩法", "zh-TW": "下一個玩法", en: "Next game", ja: "次の遊び方", ko: "다음 게임", fr: "Jeu suivant", de: "Nächstes Spiel", es: "Juego siguiente", hi: "अगला खेल", th: "เกมถัดไป", ru: "Следующая", pt: "Próximo jogo" },
  chooseMode: { "zh-CN": "选择玩法", "zh-TW": "選擇玩法", en: "Choose a game", ja: "遊び方を選ぶ", ko: "게임 선택", fr: "Choisir un jeu", de: "Spiel wählen", es: "Elegir juego", hi: "खेल चुनें", th: "เลือกเกม", ru: "Выбор игры", pt: "Escolher jogo" },
  modeHint: { "zh-CN": "还没开始刮时可以换玩法，未开封的票会退回金币。一旦开始刮，必须刮完这张才能换。换回来后会重新开一张，图案不会沿用。", "zh-TW": "還沒開始刮時可以換玩法，未開封的票會退回金幣。一旦開始刮，必須刮完這張才能換。換回來後會重新開一張，圖案不會沿用。", en: "You can switch before scratching; an unopened ticket is refunded. Once you start, finish this ticket first. Coming back deals a new ticket.", ja: "削る前なら切り替え可。未開封は払い戻し。削り始めたら最後まで。戻ると新しい券になります。", ko: "긁기 전에는 바꿀 수 있고 안 긁은 표는 환불됩니다. 긁기 시작했으면 끝까지. 돌아오면 새 표입니다.", fr: "Avant de gratter, vous pouvez changer (remboursement). Une fois commencé, terminez. Au retour, un nouveau ticket.", de: "Vor dem Rubbeln wechseln möglich, ungenutzt wird erstattet. Danach erst fertig reiben. Zurück gibt ein neues Los.", es: "Antes de rascar puedes cambiar; el boleto sin abrir se reembolsa. Si ya rascaste, termínalo. Al volver hay uno nuevo.", hi: "खरोंचने से पहले बदल सकते हैं। शुरू करने के बाद पूरा करें। वापस आने पर नया टिकट मिलेगा।", th: "ยังไม่ขูดเปลี่ยนได้ ใบที่ยังไม่เปิดคืนเหรียญ เริ่มขูดแล้วต้องขูดให้จบ กลับมาจะได้ใบใหม่", ru: "До стирания можно сменить игру — билет вернётся. Начали стирать — дотрите. По возвращении будет новый билет.", pt: "Antes de raspar pode trocar; o bilhete fechado é reembolsado. Se já raspou, termine. Ao voltar sai um novo." },
  finishScratch: { "zh-CN": "请先刮完这张票，再换其他玩法", "zh-TW": "請先刮完這張票，再換其他玩法", en: "Finish this ticket before switching games", ja: "先にこの券を削り終えてください", ko: "이 표를 다 긁은 뒤에 바꾸세요", fr: "Terminez ce ticket avant de changer", de: "Erst dieses Los fertig reiben", es: "Termina este boleto antes de cambiar", hi: "पहले यह टिकट पूरा करें", th: "ขูดใบนี้ให้จบก่อนค่อยเปลี่ยน", ru: "Сначала дотрите этот билет", pt: "Termine este bilhete antes de trocar" },
  rules: { "zh-CN": "抽奖说明", "zh-TW": "抽獎說明", en: "How it works", ja: "抽選の説明", ko: "추첨 안내", fr: "Règles", de: "Regeln", es: "Reglas", hi: "नियम", th: "วิธีเล่น", ru: "Правила", pt: "Regras" },
  lobbyGames: { "zh-CN": "{n} 种玩法", "zh-TW": "{n} 種玩法", en: "{n} games", ja: "{n} 種類", ko: "{n}가지", fr: "{n} jeux", de: "{n} Spiele", es: "{n} juegos", hi: "{n} खेल", th: "{n} เกม", ru: "{n} игр", pt: "{n} jogos" },
  railTitle: { "zh-CN": "各国彩票", "zh-TW": "各國彩票", en: "Countries", ja: "各国の宝くじ", ko: "나라별 복권", fr: "Pays", de: "Länder", es: "Países", hi: "देश", th: "ประเทศ", ru: "Страны", pt: "Países" },
  help: { "zh-CN": "玩法说明", "zh-TW": "玩法說明", en: "How to play", ja: "遊び方", ko: "하는 법", fr: "Comment jouer", de: "So spielt man", es: "Cómo jugar", hi: "कैसे खेलें", th: "วิธีเล่นเกมนี้", ru: "Как играть", pt: "Como jogar" },
  helpTitle: { "zh-CN": "{title} · 玩法说明", "zh-TW": "{title} · 玩法說明", en: "{title} · how to play", ja: "{title} · 遊び方", ko: "{title} · 하는 법", fr: "{title} · règles", de: "{title} · Anleitung", es: "{title} · cómo jugar", hi: "{title} · कैसे खेलें", th: "{title} · วิธีเล่น", ru: "{title} · как играть", pt: "{title} · como jogar" },
  rules1: { "zh-CN": "每张票独立随机。购买时先按公示概率抽取奖级，再生成对应图案；概率总和为 100%。理论返奖率是长期统计值，不代表单次结果。", "zh-TW": "每張票獨立隨機。購買時先按公示機率抽取獎級，再生成對應圖案；機率總和為 100%。理論返獎率是長期統計值，不代表單次結果。", en: "Each ticket is drawn independently. A prize tier is rolled at the posted odds, then the art is generated. Odds sum to 100%. RTP is a long-run average, not a single-ticket promise.", ja: "各券は独立抽選。公示確率で等級を引いてから絵柄を作ります。確率合計は 100%。還元率は長期統計です。", ko: "각 표는 독립 추첨입니다. 공시 확률로 등급을 뽑은 뒤 문양을 만듭니다. 확률 합은 100%입니다.", fr: "Chaque ticket est tiré séparément selon les cotes affichées. Le RTP est une moyenne longue.", de: "Jedes Los ist unabhängig. RTP ist ein Langzeitwert.", es: "Cada boleto es independiente. El RTP es un promedio a largo plazo.", hi: "हर टिकट अलग निकलता है। RTP लंबी अवधि का औसत है।", th: "แต่ละใบสุ่มอิสระตามอัตราที่ประกาศ RTP เป็นค่าเฉลี่ยระยะยาว", ru: "Каждый билет независим. RTP — долгосрочная средняя.", pt: "Cada bilhete é independente. O RTP é uma média longa." },
  rules3: { "zh-CN": "票根只记录已经刮完的票（中奖或未中）。待刮、中途作废的票不展示、不计入角标。", "zh-TW": "票根只記錄已經刮完的票（中獎或未中）。待刮、中途作廢的票不展示、不計入角標。", en: "Stubs only record finished tickets (win or miss). Open or voided tickets are not listed or counted.", ja: "半券は削り終えた券だけ（当たり／ハズレ）。未削りや無効は数えません。", ko: "반쪽은 다 긁은 표만 기록합니다(당첨/낙첨). 대기·무효는 세지 않습니다.", fr: "Les souches ne gardent que les tickets terminés. Les tickets ouverts ou annulés ne comptent pas.", de: "Abschnitte nur für fertige Lose. Offene oder ungültige zählen nicht.", es: "Los talones solo guardan boletos terminados. Los abiertos o anulados no cuentan.", hi: "स्टब सिर्फ़ पूरे टिकट का। अधूरे नहीं गिने जाते।", th: "ต้นขั้วบันทึกเฉพาะใบที่ขูดจบ ใบค้างหรือโมฆะไม่นับ", ru: "Корешки только для доигранных билетов. Незавершённые не считаются.", pt: "Canhotos só de bilhetes terminados. Abertos ou anulados não contam." },
  rules4: { "zh-CN": "还没开始刮时可以换玩法：未开封的票退回金币，也不会占用发行编号。换回来会重新开一张，图案不会沿用。", "zh-TW": "還沒開始刮時可以換玩法：未開封的票退回金幣，也不會占用發行編號。換回來會重新開一張，圖案不會沿用。", en: "Before you scratch, you may switch games. An unopened ticket is refunded and does not use a serial. Coming back deals a new ticket; the old layout is not reused.", ja: "削る前なら切り替え可。未開封は払い戻し、番号も使いません。戻ると新しい券になり、絵柄は引き継ぎません。", ko: "긁기 전에는 바꿀 수 있습니다. 안 긁은 표는 환불되며 번호도 쓰지 않습니다. 돌아오면 새 표이며 이전 문양은 쓰지 않습니다.", fr: "Avant de gratter, vous pouvez changer. Remboursement, et le numéro n’est pas pris. Au retour, un nouveau ticket.", de: "Vor dem Rubbeln wechseln möglich. Erstattung, Nummer bleibt frei. Zurück gibt ein neues Los.", es: "Antes de rascar puedes cambiar. Se reembolsa y el número no se usa. Al volver hay un boleto nuevo.", hi: "खरोंचने से पहले बदल सकते हैं। पैसे वापस, नंबर खर्च नहीं। वापस नया टिकट।", th: "ยังไม่ขูดเปลี่ยนได้ คืนเหรียญ และไม่ใช้เลข กลับมาได้ใบใหม่ ลายเดิมไม่ใช้", ru: "До стирания можно сменить игру. Монеты вернутся, номер не занят. По возвращении — новый билет.", pt: "Antes de raspar pode trocar. Reembolso, e o número não é usado. Ao voltar sai um novo." },
  rules5: { "zh-CN": "一旦开始刮，必须刮完这张才能换其他玩法，避免先看图案再弃票。", "zh-TW": "一旦開始刮，必須刮完這張才能換其他玩法，避免先看圖案再棄票。", en: "Once you start scratching, finish this ticket before switching, so you cannot peek and dump it.", ja: "削り始めたら最後まで。途中で見て捨てることはできません。", ko: "긁기 시작했으면 이 표를 다 긁어야 바꿀 수 있습니다. 보고 버리는 것을 막습니다.", fr: "Une fois le grattage commencé, terminez ce ticket avant de changer.", de: "Nach dem ersten Rubbeln erst fertig machen.", es: "Si ya rascaste, termina este boleto antes de cambiar.", hi: "खरोंचना शुरू तो पूरा करें, देखकर छोड़ नहीं सकते।", th: "เริ่มขูดแล้วต้องขูดให้จบ จะแอบดูแล้วทิ้งไม่ได้", ru: "Начали стирать — дотрите. Нельзя подсмотреть и бросить.", pt: "Se já raspou, termine este bilhete antes de trocar." },
  rules7: { "zh-CN": "图鉴只收录中奖图案，并奖励金币。游客进度留在这台设备；注册后跟账号走。", "zh-TW": "圖鑑只收錄中獎圖案，並獎勵金幣。遊客進度留在這台裝置；註冊後跟帳號走。", en: "The album unlocks only winning symbols, with a coin bonus. Guest progress stays on this device; after signup it follows the account.", ja: "図鑑は当たり絵柄だけ。ゲスト進捗はこの端末、登録後はアカウントに付きます。", ko: "도감은 당첨 문양만 해금됩니다. 게스트 진행은 이 기기, 가입 후 계정을 따릅니다.", fr: "L’album n’ouvre que les symboles gagnants. La progression invité reste ici ; après inscription elle suit le compte.", de: "Album nur Gewinnsymbole. Gastfortschritt bleibt hier, nach Registrierung am Konto.", es: "El álbum solo desbloquea símbolos ganadores. El invitado queda aquí; tras registrarte sigue la cuenta.", hi: "एल्बम सिर्फ़ जीतने वाले चिह्न। अतिथि यहीं; खाते के बाद उसके साथ।", th: "อัลบั้มปลดล็อกเฉพาะสัญลักษณ์ที่ถูก ความคืบหน้าแขกอยู่เครื่องนี้ สมัครแล้วตามบัญชี", ru: "Альбом открывает только выигрышные знаки. Гость — на этом устройстве, после регистрации — с аккаунтом.", pt: "O álbum só desbloqueia símbolos vencedores. Convidado fica neste aparelho; após cadastro segue a conta." },
  help_match: { "zh-CN": "刮开所有格子。凑齐 {n} 个相同图案即中奖，奖金按公示奖级发放。", "zh-TW": "刮開所有格子。湊齊 {n} 個相同圖案即中獎，獎金按公示獎級發放。", en: "Scratch every cell. Match {n} identical symbols to win the posted prize tier.", ja: "すべてのマスを削ります。同じ絵柄が {n} つ揃えば当たりです。", ko: "모든 칸을 긁으세요. 같은 문양 {n}개가 모이면 당첨입니다.", fr: "Grattez toutes les cases. {n} symboles identiques gagnent.", de: "Alle Felder reiben. {n} gleiche Symbole gewinnen.", es: "Rasca todas las casillas. {n} símbolos iguales ganan.", hi: "सभी खाने खरोंचें। {n} एक जैसे चिह्न जीत।", th: "ขูดทุกช่อง สัญลักษณ์เหมือนกัน {n} อันชนะ", ru: "Сотрите все клетки. {n} одинаковых знака — выигрыш.", pt: "Raspe todas as casas. {n} símbolos iguais ganham." },
  "help_match-number": { "zh-CN": "先刮中奖号码，再刮你的格子。有一格号码与中奖号码相同，即中该格奖金；其他格上的金额仅作对照。", "zh-TW": "先刮中獎號碼，再刮你的格子。有一格號碼與中獎號碼相同，即中該格獎金；其他格上的金額僅作對照。", en: "Scratch the winning number, then your cells. One matching number wins that cell’s prize. Other amounts are for comparison only.", ja: "当選番号を削り、自分のマスと照合。一致したマスの賞金です。", ko: "당첨 번호를 긁은 뒤 칸과 맞추세요. 같은 번호가 있는 칸의 상금입니다.", fr: "Grattez le numéro gagnant, puis vos cases. Un numéro identique gagne cette case.", de: "Gewinnzahl reiben, dann die Felder. Eine passende Zahl gewinnt das Feld.", es: "Rasca el número ganador y tus casillas. Un número igual gana esa casilla.", hi: "जीतने वाला नंबर, फिर खाने। एक मिलान उस खाने का इनाम।", th: "ขูดเลขรางวัล แล้วขูดช่อง เลขตรงได้รางวัลช่องนั้น", ru: "Сотрите выигрышный номер, затем клетки. Совпадение даёт приз клетки.", pt: "Raspe o número vencedor e as casas. Um número igual ganha essa casa." },
  "help_line-3": { "zh-CN": "3×3 九宫格。横、竖或斜连成三个相同图案即中奖。传说瑞兽三连为大奖或头奖。", "zh-TW": "3×3 九宮格。橫、豎或斜連成三個相同圖案即中獎。傳說瑞獸三連為大獎或頭獎。", en: "A 3×3 grid. Three matching symbols in a row, column, or diagonal win. A legendary three is a big prize or jackpot.", ja: "3×3。縦横斜めの3つ揃いで当たり。伝説の三連は高額です。", ko: "3×3. 가로·세로·대각선 3개가 같으면 당첨. 전설 3연속은 고액입니다.", fr: "Grille 3×3. Une ligne de 3 identiques gagne. Un trio légendaire est un gros lot.", de: "3×3-Feld. Drei Gleiche in Reihe gewinnen. Legendäre Drei sind der große Gewinn.", es: "Cuadrícula 3×3. Tres iguales en línea ganan. Un trío legendario es un gran premio.", hi: "3×3 ग्रिड। एक लाइन में 3 एक जैसे जीत।", th: "ตาราง 3×3 สามตัวเหมือนกันตามเส้นชนะ", ru: "Поле 3×3. Три одинаковых в линии — выигрыш.", pt: "Grelha 3×3. Três iguais em linha ganham." },
  "help_instant-symbol": { "zh-CN": "刮出「{name}」即中该格奖金，不必凑齐多个。未刮出指定图符则不中奖。", "zh-TW": "刮出「{name}」即中該格獎金，不必湊齊多個。未刮出指定圖符則不中獎。", en: "Scratch a “{name}” to win that cell’s prize. You do not need a set of three. No mark means no win.", ja: "「{name}」を削ればそのマスの賞金。3つ揃えは不要です。", ko: "「{name}」를 긁으면 그 칸 상금입니다. 여러 개를 모을 필요 없습니다.", fr: "Un « {name} » gagne la case. Pas besoin d’en aligner trois.", de: "„{name}“ gewinnt das Feld. Keine Dreier nötig.", es: "Un «{name}» gana esa casilla. No hace falta juntar tres.", hi: "“{name}” उस खाने का इनाम। तीन की ज़रूरत नहीं।", th: "ขูด「{name}」ได้รางวัลช่องนั้น ไม่ต้องครบชุด", ru: "«{name}» даёт приз клетки. Собирать тройку не нужно.", pt: "Um “{name}” ganha essa casa. Não precisa de três." },
  help_multiplier: { "zh-CN": "先凑齐三枚相同开出基础奖，再刮底部翻倍格。翻倍只在已经中奖时生效；未中奖时即使刮出倍数也不发放。", "zh-TW": "先湊齊三枚相同開出基礎獎，再刮底部翻倍格。翻倍只在已經中獎時生效；未中獎時即使刮出倍數也不發放。", en: "Match three to win a base prize, then scratch the multiplier. The multiplier only applies if you already won.", ja: "3つ揃えのあと倍率マス。倍率は当たっているときだけ有効です。", ko: "3개를 맞춘 뒤 배율 칸. 이미 당첨일 때만 배율이 적용됩니다.", fr: "Alignez 3, puis grattez le multiplicateur. Il ne compte que si vous avez déjà gagné.", de: "Drei Gleiche, dann Multiplikator. Gilt nur bei Gewinn.", es: "Junta tres y rasca el multiplicador. Solo vale si ya ganaste.", hi: "तीन मिलाएँ, फिर गुणक। जीत पर ही लगेगा।", th: "ครบสามแล้วค่อยขูดตัวคูณ ใช้ได้เมื่อถูกแล้วเท่านั้น", ru: "Соберите три, затем множитель. Он действует только при выигрыше.", pt: "Junte três e raspe o multiplicador. Só vale se já ganhou." },
  "help_pair-match": { "zh-CN": "三组配对，每组两格。有一组两格图案相同即中奖。", "zh-TW": "三組配對，每組兩格。有一組兩格圖案相同即中獎。", en: "Three pairs of two cells. Matching both cells in any pair wins.", ja: "3組のペア。どれか1組が揃えば当たりです。", ko: "세 쌍. 한 쌍의 두 칸이 같으면 당첨입니다.", fr: "Trois paires. Une paire identique gagne.", de: "Drei Paare. Ein gleiches Paar gewinnt.", es: "Tres pares. Un par igual gana.", hi: "तीन जोड़े। कोई एक जोड़ी मिलान जीत।", th: "สามคู่ คู่ใดคู่หนึ่งเหมือนกันชนะ", ru: "Три пары. Одна совпавшая пара — выигрыш.", pt: "Três pares. Um par igual ganha." },
  help_triangle: { "zh-CN": "六个格排成三角形。左斜边、右斜边或底边三枚相同即中奖。", "zh-TW": "六個格排成三角形。左斜邊、右斜邊或底邊三枚相同即中獎。", en: "Six cells form a triangle. Three matching symbols on the left side, right side, or base win.", ja: "三角形。左辺・右辺・底辺のいずれかが3つ揃えなら当たりです。", ko: "삼각형. 왼변·오른변·밑변 중 3개가 같으면 당첨입니다.", fr: "Triangle de 6 cases. Une des trois arêtes de 3 identiques gagne.", de: "Dreieck aus sechs Feldern. Eine Seite mit drei Gleichen gewinnt.", es: "Triángulo de seis casillas. Un lado de tres iguales gana.", hi: "त्रिभुज। किसी भुजा पर 3 एक जैसे जीत।", th: "สามเหลี่ยม ด้านใดด้านหนึ่งสามตัวเหมือนกันชนะ", ru: "Треугольник из шести клеток. Три одинаковых на любой стороне.", pt: "Triângulo de seis casas. Um lado com três iguais ganha." },
  help_compare: { "zh-CN": "三局比分。你的分数高于对手即中该局，奖金按公示奖级发放。", "zh-TW": "三局比分。你的分數高於對手即中該局，獎金按公示獎級發放。", en: "Three rounds. Beat the rival’s score in a round to win that round’s posted prize.", ja: "3局。自分の点数が相手より高ければその局の当たりです。", ko: "세 판. 내 점수가 상대보다 높으면 그 판 당첨입니다.", fr: "Trois manches. Un score plus élevé que l’adversaire gagne la manche.", de: "Drei Runden. Höher als der Gegner gewinnt die Runde.", es: "Tres rondas. Superar al rival gana esa ronda.", hi: "तीन राउंड। प्रतिद्वंद्वी से आगे वह राउंड जीत।", th: "สามรอบ คะแนนสูงกว่าคู่แข่งชนะรอบนั้น", ru: "Три раунда. Обойти соперника — выигрыш раунда.", pt: "Três rondas. Superar o rival ganha essa ronda." },
  "help_key-match": { "zh-CN": "先刮中奖号码，再刮你的号码。对上号码，或刮出钥匙，即中该格奖金。", "zh-TW": "先刮中獎號碼，再刮你的號碼。對上號碼，或刮出鑰匙，即中該格獎金。", en: "Scratch the winning number, then yours. A matching number or a key wins that cell’s prize.", ja: "当選番号と自分の番号。一致、または鍵ならそのマスの賞金です。", ko: "당첨 번호와 내 번호. 같거나 열쇠면 그 칸 상금입니다.", fr: "Numéro gagnant, puis les vôtres. Un numéro identique ou une clé gagne la case.", de: "Gewinnzahl, dann Ihre Zahlen. Treffer oder Schlüssel gewinnt das Feld.", es: "Número ganador y los tuyos. Un igual o una llave gana la casilla.", hi: "जीत नंबर फिर अपने। मिलान या चाबी उस खाने का इनाम।", th: "ขูดเลขรางวัลแล้วขูดของคุณ เลขตรงหรือกุญแจได้รางวัลช่องนั้น", ru: "Выигрышный номер, затем ваши. Совпадение или ключ — приз клетки.", pt: "Número vencedor e os seus. Igual ou uma chave ganha a casa." },
  help_bingo: { "zh-CN": "先刮开奖号码，再刮 3×3 宾果卡。开奖号命中后：连线、四角或 X 对应不同奖级。", "zh-TW": "先刮開獎號碼，再刮 3×3 賓果卡。開獎號命中後：連線、四角或 X 對應不同獎級。", en: "Scratch the draw, then the 3×3 card. A line, four corners, or an X maps to different prize tiers.", ja: "抽選番号のあと 3×3 カード。ライン・四隅・X で等級が変わります。", ko: "추첨 번호를 긁은 뒤 3×3 카드. 라인·모서리·X가 다른 등급입니다.", fr: "Grattez le tirage, puis la carte 3×3. Ligne, coins ou X = paliers différents.", de: "Ziehung, dann 3×3-Karte. Linie, Ecken oder X sind verschiedene Stufen.", es: "Rasca el sorteo y la carta 3×3. Línea, esquinas o X son niveles distintos.", hi: "ड्रॉ फिर 3×3 कार्ड। लाइन, कोने या X अलग स्तर।", th: "ขูดเลขออก แล้วขูดการ์ด 3×3 เส้น มุม หรือ X คนละชั้น", ru: "Тираж, затем карта 3×3. Линия, углы или X — разные уровни.", pt: "Raspe o sorteio e o cartão 3×3. Linha, cantos ou X são níveis diferentes." },
  help_coordinate: { "zh-CN": "先刮两组坐标，再刮棋盘。坐标对应的格子里有奖金才中奖；其他格子上的金额仅作对照。", "zh-TW": "先刮兩組座標，再刮棋盤。座標對應的格子裡有獎金才中獎；其他格子上的金額僅作對照。", en: "Scratch two coordinates, then the board. You win only if a coordinate lands on a prize cell.", ja: "座標を2組削り、盤へ。座標のマスに賞金があれば当たりです。", ko: "좌표 두 조를 긁은 뒤 판. 좌표 칸에 상금이 있어야 당첨입니다.", fr: "Deux coordonnées, puis le plateau. Gain seulement si la case a un prix.", de: "Zwei Koordinaten, dann das Brett. Gewinn nur bei Preisfeld.", es: "Dos coordenadas y el tablero. Ganas solo si la casilla tiene premio.", hi: "दो निर्देशांक फिर बोर्ड। इनाम वाली खाने पर ही जीत।", th: "ขูดพิกัดสองชุดแล้วขูดกระดาน ช่องมีรางวัลถึงชนะ", ru: "Две координаты, затем доска. Выигрыш только на клетке с призом.", pt: "Duas coordenadas e o tabuleiro. Só ganha se a casa tiver prémio." },
  help_walk: { "zh-CN": "先刮步数，再沿路线往前走。停在有奖金的格子才中奖；停在空格则不中。", "zh-TW": "先刮步數，再沿路線往前走。停在有獎金的格子才中獎；停在空格則不中。", en: "Scratch the step count, then walk the path. Landing on a prize cell wins; an empty stop misses.", ja: "歩数を削り、ルートを進みます。賞金マスで止まれば当たりです。", ko: "걸음 수를 긁은 뒤 길을 갑니다. 상금 칸에 멈추면 당첨입니다.", fr: "Grattez le nombre de pas, puis avancez. Une case à prix gagne.", de: "Schritte reiben, dann laufen. Halt auf einem Preisfeld gewinnt.", es: "Rasca los pasos y camina. Parar en una casilla con premio gana.", hi: "कदम खरोंचें, रास्ता चलें। इनाम खाने पर रुकना जीत।", th: "ขูดจำนวนก้าวแล้วเดิน หยุดช่องมีรางวัลถึงชนะ", ru: "Сотрите шаги и идите. Остановка на призовой клетке — выигрыш.", pt: "Raspe os passos e avance. Parar numa casa com prémio ganha." },
  help_maze: { "zh-CN": "从起点按箭头走到终点。终点格有奖金才中奖；终点为空则不中。", "zh-TW": "從起點按箭頭走到終點。終點格有獎金才中獎；終點為空則不中。", en: "Follow the arrows from start to end. You win only if the finish cell has a prize.", ja: "矢印どおりゴールへ。ゴールに賞金があれば当たりです。", ko: "화살표를 따라 끝까지. 끝 칸에 상금이 있어야 당첨입니다.", fr: "Suivez les flèches jusqu’à la fin. Gain si la case d’arrivée a un prix.", de: "Pfeilen zum Ziel folgen. Gewinn nur bei Preis im Ziel.", es: "Sigue las flechas al final. Ganas si la meta tiene premio.", hi: "तीर से अंत तक। अंत की खाने में इनाम हो तो जीत।", th: "ตามลูกศรถึงจุดจบ ช่องจบมีรางวัลถึงชนะ", ru: "По стрелкам к финишу. Выигрыш, если на финише есть приз.", pt: "Siga as setas até ao fim. Ganha se a meta tiver prémio." },
  help_crossword: { "zh-CN": "先刮 12 个字母，再对 6 个单词。能凑齐的单词数对应奖级。", "zh-TW": "先刮 12 個字母，再對 6 個單詞。能湊齊的單詞數對應獎級。", en: "Scratch 12 letters, then check 6 words. How many words you complete sets the prize tier.", ja: "12文字を削り、6語と照合。完成した語数で等級が決まります。", ko: "12글자를 긁은 뒤 6단어를 맞춥니다. 완성한 단어 수가 등급입니다.", fr: "12 lettres, puis 6 mots. Le nombre de mots complets fixe le palier.", de: "12 Buchstaben, dann 6 Wörter. Fertige Wörter bestimmen die Stufe.", es: "12 letras y 6 palabras. Cuántas completes fija el nivel.", hi: "12 अक्षर, 6 शब्द। पूरे शब्दों से स्तर।", th: "ขูด 12 ตัวอักษร แล้วเทียบ 6 คำ จำนวนคำครบคือชั้นรางวัล", ru: "12 букв, затем 6 слов. Число собранных слов задаёт уровень.", pt: "12 letras e 6 palavras. Quantas completar define o nível." },
  "help_dual-bingo": { "zh-CN": "先刮 12 个开奖号码，再刮两张 3×3 宾果卡。一卡连线、一卡四角、双卡连线或双卡 X 对应不同奖级。", "zh-TW": "先刮 12 個開獎號碼，再刮兩張 3×3 賓果卡。一卡連線、一卡四角、雙卡連線或雙卡 X 對應不同獎級。", en: "Scratch 12 draws, then two 3×3 cards. One-card line, one-card corners, both lines, or both X map to different tiers.", ja: "12個抽選のあと 3×3 が2枚。1枚ライン、四隅、両ライン、両Xで等級が変わります。", ko: "12개 추첨 뒤 3×3 두 장. 한 장 라인·모서리, 양쪽 라인·X가 다른 등급입니다.", fr: "12 tirages, deux cartes 3×3. Ligne, coins, double ligne ou double X = paliers différents.", de: "12 Zahlen, zwei 3×3-Karten. Linie, Ecken, beide Linien oder X sind Stufen.", es: "12 sorteos y dos cartas 3×3. Línea, esquinas, ambas o X son niveles distintos.", hi: "12 ड्रॉ, दो 3×3 कार्ड। लाइन/कोने/दोनों अलग स्तर।", th: "ขูด 12 เลข แล้วสองใบ 3×3 เส้น มุม สองใบ หรือ X คนละชั้น", ru: "12 тиражей и две карты 3×3. Линия, углы, обе или X — разные уровни.", pt: "12 sorteios e dois cartões 3×3. Linha, cantos, ambos ou X são níveis diferentes." },
  help_sum7: { "zh-CN": "每局刮两个 1–6 的数字，两数相加等于 7 即中该局，奖金按公示奖级发放。", "zh-TW": "每局刮兩個 1–6 的數字，兩數相加等於 7 即中該局，獎金按公示獎級發放。", en: "Each round has two numbers from 1–6. If they add to 7, that round wins the posted prize.", ja: "各局で 1–6 の2つ。合計が 7 ならその局の当たりです。", ko: "각 판에 1–6 숫자 둘. 합이 7이면 그 판 당첨입니다.", fr: "Chaque manche a deux nombres de 1 à 6. Une somme de 7 gagne la manche.", de: "Pro Runde zwei Zahlen 1–6. Summe 7 gewinnt die Runde.", es: "Cada ronda tiene dos números del 1 al 6. Si suman 7, ganas esa ronda.", hi: "हर राउंड दो संख्या 1–6। योग 7 वह राउंड जीत।", th: "แต่ละรอบขูดเลข 1–6 สองตัว รวมได้ 7 ชนะรอบนั้น", ru: "В раунде два числа 1–6. Сумма 7 — выигрыш раунда.", pt: "Cada ronda tem dois números de 1 a 6. Soma 7 ganha essa ronda." },
  winJackpot: { "zh-CN": "头奖开出", "zh-TW": "頭獎開出", en: "Jackpot!", ja: "一等当選", ko: "잭팟!", fr: "Jackpot !", de: "Jackpot!", es: "¡Bote!", hi: "जैकपॉट!", th: "แจ็กพอต!", ru: "Джекпот!", pt: "Jackpot!" },
  winBig: { "zh-CN": "鸿运当头", "zh-TW": "鴻運當頭", en: "Big luck", ja: "大吉", ko: "대길", fr: "Grosse veine", de: "Großes Glück", es: "Gran suerte", hi: "बड़ी किस्मत", th: "โชคดีใหญ่", ru: "Крупная удача", pt: "Grande sorte" },
  winNorm: { "zh-CN": "彩运降临", "zh-TW": "彩運降臨", en: "You won", ja: "当たり", ko: "당첨", fr: "Gagné", de: "Gewinn", es: "Ganaste", hi: "जीत", th: "ถูกรางวัล", ru: "Выигрыш", pt: "Ganhou" },
  jackpotTitle: { "zh-CN": "头奖驾到", "zh-TW": "頭獎駕到", en: "Jackpot lands", ja: "一等が来た", ko: "잭팟 등장", fr: "Le jackpot arrive", de: "Jackpot da", es: "Llegó el bote", hi: "जैकपॉट आया", th: "แจ็กพอตมาแล้ว", ru: "Джекпот здесь", pt: "Jackpot chegou" },
  bigTitle: { "zh-CN": "鸿运当头", "zh-TW": "鴻運當頭", en: "Big luck", ja: "大吉", ko: "대길", fr: "Grosse veine", de: "Großes Glück", es: "Gran suerte", hi: "बड़ी किस्मत", th: "โชคดีใหญ่", ru: "Крупная удача", pt: "Grande sorte" },
  winTitle: { "zh-CN": "恭喜中奖", "zh-TW": "恭喜中獎", en: "Congratulations", ja: "おめでとう", ko: "축하합니다", fr: "Félicitations", de: "Glückwunsch", es: "Enhorabuena", hi: "बधाई हो", th: "ยินดีด้วย", ru: "Поздравляем", pt: "Parabéns" },
  claimPrize: { "zh-CN": "收下奖金", "zh-TW": "收下獎金", en: "Collect prize", ja: "賞金を受け取る", ko: "상금 받기", fr: "Prendre le gain", de: "Gewinn holen", es: "Recoger premio", hi: "इनाम लें", th: "รับรางวัล", ru: "Забрать", pt: "Receber" },
  albumBonus: { "zh-CN": "新图鉴奖励 +{n}", "zh-TW": "新圖鑑獎勵 +{n}", en: "New album bonus +{n}", ja: "図鑑ボーナス +{n}", ko: "도감 보너스 +{n}", fr: "Bonus album +{n}", de: "Album-Bonus +{n}", es: "Bonus álbum +{n}", hi: "एल्बम बोनस +{n}", th: "โบนัสอัลบั้ม +{n}", ru: "Бонус альбома +{n}", pt: "Bônus álbum +{n}" },
  missSeal: { "zh-CN": "未中", "zh-TW": "未中", en: "Miss", ja: "ハズレ", ko: "낙첨", fr: "Perdu", de: "Niete", es: "No", hi: "नहीं", th: "ไม่ถูก", ru: "Нет", pt: "Não" },
  missTitle: { "zh-CN": "可惜未中", "zh-TW": "可惜未中", en: "Not this time", ja: "今回はハズレ", ko: "아쉽네요", fr: "Pas cette fois", de: "Leider nicht", es: "Esta vez no", hi: "इस बार नहीं", th: "รอบนี้ไม่ถูก", ru: "Не в этот раз", pt: "Não foi agora" },
  missRetry: { "zh-CN": "再接再厉", "zh-TW": "再接再厲", en: "Try again", ja: "もう一度", ko: "다시 도전", fr: "Réessayer", de: "Nochmal", es: "Otra vez", hi: "फिर कोशिश", th: "ลองใหม่", ru: "Ещё раз", pt: "Tentar de novo" },
  missDefault: { "zh-CN": "本张未中奖", "zh-TW": "本張未中獎", en: "This ticket did not win", ja: "この券はハズレ", ko: "이번 표는 낙첨", fr: "Ce ticket n’a pas gagné", de: "Dieses Los hat nicht gewonnen", es: "Este boleto no ganó", hi: "यह टिकट नहीं जीता", th: "ใบนี้ไม่ถูกรางวัล", ru: "Этот билет не выиграл", pt: "Este bilhete não ganhou" },
  login: { "zh-CN": "登录", "zh-TW": "登入", en: "Log in", ja: "ログイン", ko: "로그인", fr: "Connexion", de: "Anmelden", es: "Entrar", hi: "लॉग इन", th: "เข้าสู่ระบบ", ru: "Войти", pt: "Entrar" },
  register: { "zh-CN": "补注册", "zh-TW": "補註冊", en: "Register", ja: "登録", ko: "가입", fr: "S’inscrire", de: "Registrieren", es: "Registrarse", hi: "पंजीकरण", th: "สมัคร", ru: "Регистрация", pt: "Cadastrar" },
  quickRegister: { "zh-CN": "快速注册", "zh-TW": "快速註冊", en: "Quick sign-up", ja: "かんたん登録", ko: "빠른 가입", fr: "Inscription rapide", de: "Schnellregistrierung", es: "Registro rápido", hi: "तेज़ पंजीकरण", th: "สมัครด่วน", ru: "Быстрая регистрация", pt: "Cadastro rápido" },
  customRegister: { "zh-CN": "自己起账号名", "zh-TW": "自己取帳號名", en: "Choose a username", ja: "ユーザー名を自分で付ける", ko: "아이디 직접 정하기", fr: "Choisir un identifiant", de: "Namen selbst wählen", es: "Elegir usuario", hi: "नाम खुद चुनें", th: "ตั้งชื่อเอง", ru: "Своё имя", pt: "Escolher usuário" },
  backToQuick: { "zh-CN": "改用快速注册", "zh-TW": "改用快速註冊", en: "Back to quick sign-up", ja: "かんたん登録に戻る", ko: "빠른 가입으로", fr: "Retour à l’inscription rapide", de: "Zurück zur Schnellregistrierung", es: "Volver al registro rápido", hi: "तेज़ पंजीकरण पर जाएँ", th: "กลับไปสมัครด่วน", ru: "К быстрой регистрации", pt: "Voltar ao cadastro rápido" },
  quickHint: { "zh-CN": "填邮箱和密码即可。账号会按邮箱自动生成，之后用邮箱或账号都能登录。", "zh-TW": "填信箱和密碼即可。帳號會依信箱自動產生，之後用信箱或帳號都能登入。", en: "Just email and password. A username is created from your email; you can log in with either.", ja: "メールとパスワードだけで登録。ユーザー名はメールから自動作成され、どちらでもログインできます。", ko: "이메일과 비밀번호만 있으면 됩니다. 아이디는 이메일로 만들어지며, 둘 다로 로그인할 수 있습니다.", fr: "E-mail et mot de passe suffisent. Un identifiant est créé depuis l’e-mail ; les deux marchent pour se connecter.", de: "Nur E-Mail und Passwort. Der Name kommt aus der E-Mail; beides geht zum Anmelden.", es: "Con correo y contraseña basta. El usuario sale del correo; puedes entrar con cualquiera.", hi: "ईमेल और पासवर्ड काफ़ी। नाम ईमेल से बनेगा; दोनों से लॉग इन।", th: "ใส่อีเมลกับรหัสก็พอ ชื่อจะสร้างจากอีเมล เข้าสู่ระบบได้ทั้งสองอย่าง", ru: "Достаточно почты и пароля. Имя создаётся из почты; войти можно и так, и так.", pt: "E-mail e senha bastam. O usuário sai do e-mail; dê para entrar com os dois." },
  usernameOptional: { "zh-CN": "游戏账号（可不填）", "zh-TW": "遊戲帳號（可不填）", en: "Username (optional)", ja: "ユーザー名（任意）", ko: "아이디 (선택)", fr: "Identifiant (facultatif)", de: "Benutzername (optional)", es: "Usuario (opcional)", hi: "नाम (वैकल्पिक)", th: "ชื่อผู้ใช้ (ไม่บังคับ)", ru: "Имя (необязательно)", pt: "Usuário (opcional)" },
  usernamePlaceholder: { "zh-CN": "留空则用邮箱自动生成", "zh-TW": "留空則用信箱自動產生", en: "Leave blank to auto-create from email", ja: "空欄ならメールから自動作成", ko: "비우면 이메일로 자동 생성", fr: "Vide = créé depuis l’e-mail", de: "Leer = aus E-Mail erzeugt", es: "Vacío: se crea con el correo", hi: "खाली छोड़ें तो ईमेल से बनेगा", th: "ว่างไว้จะสร้างจากอีเมล", ru: "Пусто — имя из почты", pt: "Vazio: criado pelo e-mail" },
  guestPlay: { "zh-CN": "先游客玩", "zh-TW": "先遊客玩", en: "Play as guest", ja: "ゲストで遊ぶ", ko: "게스트로 하기", fr: "Jouer en invité", de: "Als Gast spielen", es: "Jugar como invitado", hi: "अतिथि के रूप में खेलें", th: "เล่นแบบแขก", ru: "Играть гостем", pt: "Jogar como convidado" },
  username: { "zh-CN": "游戏账号", "zh-TW": "遊戲帳號", en: "Username", ja: "ユーザー名", ko: "아이디", fr: "Identifiant", de: "Benutzername", es: "Usuario", hi: "उपयोगकर्ता", th: "ชื่อผู้ใช้", ru: "Имя", pt: "Usuário" },
  userOrEmail: { "zh-CN": "账号或邮箱", "zh-TW": "帳號或信箱", en: "Username or email", ja: "ユーザー名またはメール", ko: "아이디 또는 이메일", fr: "Identifiant ou e-mail", de: "Name oder E-Mail", es: "Usuario o correo", hi: "नाम या ईमेल", th: "ชื่อหรืออีเมล", ru: "Имя или почта", pt: "Usuário ou e-mail" },
  email: { "zh-CN": "邮箱", "zh-TW": "信箱", en: "Email", ja: "メール", ko: "이메일", fr: "E-mail", de: "E-Mail", es: "Correo", hi: "ईमेल", th: "อีเมล", ru: "Почта", pt: "E-mail" },
  password: { "zh-CN": "密码", "zh-TW": "密碼", en: "Password", ja: "パスワード", ko: "비밀번호", fr: "Mot de passe", de: "Passwort", es: "Contraseña", hi: "पासवर्ड", th: "รหัสผ่าน", ru: "Пароль", pt: "Senha" },
  confirm: { "zh-CN": "确认密码", "zh-TW": "確認密碼", en: "Confirm password", ja: "パスワード確認", ko: "비밀번호 확인", fr: "Confirmer", de: "Bestätigen", es: "Confirmar", hi: "पुष्टि", th: "ยืนยันรหัส", ru: "Подтвердите", pt: "Confirmar" },
  code: { "zh-CN": "邮箱验证码", "zh-TW": "信箱驗證碼", en: "Email code", ja: "メール認証コード", ko: "이메일 코드", fr: "Code e-mail", de: "E-Mail-Code", es: "Código", hi: "ईमेल कोड", th: "รหัสอีเมล", ru: "Код", pt: "Código" },
  sendCode: { "zh-CN": "获取验证码", "zh-TW": "取得驗證碼", en: "Get code", ja: "コード取得", ko: "코드 받기", fr: "Obtenir le code", de: "Code holen", es: "Pedir código", hi: "कोड लें", th: "ขอรหัส", ru: "Получить код", pt: "Pedir código" },
  retryIn: { "zh-CN": "{n}秒后重试", "zh-TW": "{n} 秒後重試", en: "Retry in {n}s", ja: "{n}秒後", ko: "{n}초 후", fr: "Dans {n}s", de: "In {n}s", es: "En {n}s", hi: "{n}सेकंड बाद", th: "อีก {n} วินาที", ru: "Через {n}с", pt: "Em {n}s" },
  finishRegister: { "zh-CN": "完成注册", "zh-TW": "完成註冊", en: "Create account", ja: "登録する", ko: "가입 완료", fr: "Créer le compte", de: "Konto erstellen", es: "Crear cuenta", hi: "खाता बनाएँ", th: "สร้างบัญชี", ru: "Создать", pt: "Criar conta" },
  passwordMismatch: { "zh-CN": "两次密码不一致", "zh-TW": "兩次密碼不一致", en: "Passwords do not match", ja: "パスワードが一致しません", ko: "비밀번호가 다릅니다", fr: "Les mots de passe ne correspondent pas", de: "Passwörter stimmen nicht überein", es: "Las contraseñas no coinciden", hi: "पासवर्ड मेल नहीं खाते", th: "รหัสไม่ตรงกัน", ru: "Пароли не совпадают", pt: "As senhas não coincidem" },
  codeSent: { "zh-CN": "验证码已发到邮箱", "zh-TW": "驗證碼已寄到信箱", en: "Code sent to your email", ja: "コードを送信しました", ko: "코드를 보냈습니다", fr: "Code envoyé", de: "Code gesendet", es: "Código enviado", hi: "कोड भेजा गया", th: "ส่งรหัสแล้ว", ru: "Код отправлен", pt: "Código enviado" },
  codeSentAs: { "zh-CN": "验证码已发到邮箱，账号为 {name}", "zh-TW": "驗證碼已寄到信箱，帳號為 {name}", en: "Code sent. Your username is {name}", ja: "コード送信済み。ユーザー名は {name}", ko: "코드를 보냈습니다. 아이디는 {name}", fr: "Code envoyé. Identifiant : {name}", de: "Code gesendet. Name: {name}", es: "Código enviado. Usuario: {name}", hi: "कोड गया। नाम {name}", th: "ส่งรหัสแล้ว ชื่อคือ {name}", ru: "Код отправлен. Имя: {name}", pt: "Código enviado. Usuário: {name}" },
  codeFail: { "zh-CN": "验证码发送失败", "zh-TW": "驗證碼發送失敗", en: "Could not send code", ja: "送信に失敗", ko: "전송 실패", fr: "Échec d’envoi", de: "Senden fehlgeschlagen", es: "No se pudo enviar", hi: "कोड नहीं गया", th: "ส่งไม่สำเร็จ", ru: "Не удалось отправить", pt: "Falha ao enviar" },
  failRetry: { "zh-CN": "失败，请重试", "zh-TW": "失敗，請重試", en: "Failed, try again", ja: "失敗しました", ko: "실패했습니다", fr: "Échec, réessayez", de: "Fehlgeschlagen", es: "Error, reintenta", hi: " असफल", th: "ล้มเหลว", ru: "Ошибка", pt: "Falhou" },
  authHintGuest: { "zh-CN": "不注册也能玩，进度会留在这台电脑。注册后刮刮卡和鱼缸共用这个账号，换电脑也能取回。", "zh-TW": "不註冊也能玩，進度會留在這台電腦。註冊後刮刮卡和魚缸共用這個帳號，換電腦也能取回。", en: "Play without an account; progress stays on this device. After signup, Daily Scratch and the aquarium share this account across computers.", ja: "登録しなくても遊べます。進捗はこの端末に。登録後はスクラッチと水槽が同じアカウントです。", ko: "가입 없이 할 수 있습니다. 진행은 이 기기에 남습니다. 가입하면 스크래치와 수조가 같은 계정입니다.", fr: "Jouez sans compte ; la progression reste ici. Après inscription, grattage et aquarium partagent le compte.", de: "Ohne Konto spielbar. Fortschritt bleibt hier. Danach teilen Rubbeln und Aquarium das Konto.", es: "Juega sin cuenta; el progreso queda aquí. Tras registrarte, rasca y acuario comparten cuenta.", hi: "बिना खाते खेलें। प्रगति यहीं। साइन अप के बाद स्क्रैच और एक्वेरियम एक खाता।", th: "เล่นโดยไม่สมัครได้ ความคืบหน้าอยู่เครื่องนี้ สมัครแล้วขูดกับตู้ปลาใช้บัญชีเดียวกัน", ru: "Можно без аккаунта. Прогресс здесь. После регистрации скретч и аквариум на одном аккаунте.", pt: "Jogue sem conta; o progresso fica neste aparelho. Depois, raspadinha e aquário partilham a conta." },
  authHintUpgrade: { "zh-CN": "游客进度只留在这台电脑。登录或注册后，刮刮卡和鱼缸共用账号，换电脑也能取回。", "zh-TW": "遊客進度只留在這台電腦。補註冊並完成信箱驗證後，目前金幣和圖鑑會轉到這個帳號。", en: "Guest progress stays on this device. After signup, current coins and album move to this account.", ja: "ゲスト進捗はこの端末のみ。登録後、コインと図鑑がこのアカウントに移ります。", ko: "게스트 진행은 이 기기에만 있습니다. 가입하면 코인과 도감이 이 계정으로 옮겨집니다.", fr: "La progression invité reste ici. Après inscription, pièces et album passent sur ce compte.", de: "Gastfortschritt bleibt hier. Nach Registrierung wechseln Münzen und Album auf dieses Konto.", es: "El progreso de invitado queda aquí. Tras registrarte, pasa a esta cuenta.", hi: "अतिथि प्रगति यहीं है। पंजीकरण के बाद सिक्के और एल्बम इस खाते पर आ जाएंगे।", th: "ความคืบหน้าแขกอยู่เครื่องนี้ สมัครแล้วเหรียญกับอัลบั้มย้ายมาบัญชีนี้", ru: "Гостевой прогресс только здесь. После регистрации монеты и альбом перейдут на аккаунт.", pt: "O progresso de convidado fica aqui. Após cadastro, moedas e álbum vão para esta conta." },
  accountTitle: { "zh-CN": "游戏账号", "zh-TW": "遊戲帳號", en: "Game account", ja: "ゲームアカウント", ko: "게임 계정", fr: "Compte", de: "Spielkonto", es: "Cuenta", hi: "गेम खाता", th: "บัญชีเกม", ru: "Аккаунт", pt: "Conta" },
  accountSaved: { "zh-CN": "进度已跟这个游戏账号保存。刮刮卡和鱼缸通用。退出后这台电脑仍可继续游客游玩，记录不会清掉。", "zh-TW": "進度已跟這個遊戲帳號保存。刮刮卡和魚缸通用。退出後這台電腦仍可繼續遊客遊玩，記錄不會清掉。", en: "Progress is saved to this account, shared with Daily Scratch and the aquarium. After logout you can keep playing as guest on this device.", ja: "進捗はこのアカウントに保存。スクラッチと水槽で共通。ログアウト後もこの端末でゲスト続行できます。", ko: "진행이 이 계정에 저장됩니다. 스크래치와 수조 공용. 로그아웃 후에도 이 기기에서 게스트로 할 수 있습니다.", fr: "Progression liée à ce compte, partagée avec le grattage et l’aquarium. Après déconnexion, continuez en invité ici.", de: "Fortschritt am Konto, geteilt mit Rubbeln und Aquarium. Nach Logout als Gast hier weiter.", es: "Progreso en esta cuenta, compartido con rasca y acuario. Tras salir sigue como invitado.", hi: "प्रगति इस खाते में है, स्क्रैच और एक्वेरियम साझा। लॉग आउट के बाद अतिथि जारी।", th: "ความคืบหน้าผูกบัญชีนี้ ใช้ร่วมขูดกับตู้ปลา ออกแล้วเล่นต่อแบบแขกได้", ru: "Прогресс на аккаунте, общий для скретча и аквариума. После выхода можно играть гостем здесь.", pt: "O progresso está nesta conta, partilhada com raspadinha e aquário. Depois de sair, continue como convidado." },
  logout: { "zh-CN": "退出登录", "zh-TW": "退出登入", en: "Log out", ja: "ログアウト", ko: "로그아웃", fr: "Déconnexion", de: "Abmelden", es: "Salir", hi: "लॉग आउट", th: "ออก", ru: "Выйти", pt: "Sair" },
  stubWin: { "zh-CN": "中奖", "zh-TW": "中獎", en: "Win", ja: "当たり", ko: "당첨", fr: "Gagné", de: "Gewinn", es: "Premio", hi: "जीत", th: "ถูก", ru: "Выигрыш", pt: "Prêmio" },
  stubWinPrize: { "zh-CN": "中奖 {n}", "zh-TW": "中獎 {n}", en: "Win {n}", ja: "当たり {n}", ko: "당첨 {n}", fr: "Gagné {n}", de: "Gewinn {n}", es: "Premio {n}", hi: "जीत {n}", th: "ถูก {n}", ru: "Выигрыш {n}", pt: "Prêmio {n}" },
  stubPending: { "zh-CN": "待刮", "zh-TW": "待刮", en: "Open", ja: "未削り", ko: "대기", fr: "Ouvert", de: "Offen", es: "Pendiente", hi: "खुला", th: "รอขูด", ru: "Открыт", pt: "Aberto" },
  stubLose: { "zh-CN": "未中", "zh-TW": "未中", en: "Miss", ja: "ハズレ", ko: "낙첨", fr: "Perdu", de: "Niete", es: "No", hi: "नहीं", th: "ไม่ถูก", ru: "Нет", pt: "Não" },
  stubTicket: { "zh-CN": "奖票", "zh-TW": "獎票", en: "Ticket", ja: "券", ko: "티켓", fr: "Ticket", de: "Los", es: "Boleto", hi: "टिकट", th: "ใบ", ru: "Билет", pt: "Bilhete" },
  stubNo: { "zh-CN": "第 {series} {n} 号", "zh-TW": "第 {series} {n} 號", en: "No. {series} {n}", ja: "第 {series} {n} 号", ko: "제 {series} {n} 호", fr: "N° {series} {n}", de: "Nr. {series} {n}", es: "N.º {series} {n}", hi: "क्र. {series} {n}", th: "เลข {series} {n}", ru: "№ {series} {n}", pt: "N.º {series} {n}" },
  stubEmpty: { "zh-CN": "还没有买过奖票。每买一张都会留下票根，记录购买时间和发行编号。", "zh-TW": "還沒買過獎票。每買一張都會留下票根，記錄購買時間和發行編號。", en: "No tickets yet. Each purchase leaves a stub with time and serial.", ja: "まだ購入がありません。買うたびに半券が残ります。", ko: "아직 산 표가 없습니다. 살 때마다 반쪽이 남습니다.", fr: "Aucun ticket. Chaque achat laisse une souche.", de: "Noch keine Lose. Jeder Kauf hinterlässt einen Abschnitt.", es: "Aún no hay boletos. Cada compra deja un talón.", hi: "अभी कोई टिकट नहीं। हर खरीद पर स्टब रहेगा।", th: "ยังไม่มีใบ ซื้อแล้วจะเหลือต้นขั้ว", ru: "Билетов пока нет. Каждая покупка оставит корешок.", pt: "Ainda sem bilhetes. Cada compra deixa um canhoto." },
  stubMore: { "zh-CN": "再显示 50 张", "zh-TW": "再顯示 50 張", en: "Show 50 more", ja: "さらに 50 枚", ko: "50장 더", fr: "50 de plus", de: "50 weitere", es: "50 más", hi: "50 और", th: "อีก 50 ใบ", ru: "Ещё 50", pt: "Mais 50" },
  stubMoreLeft: { "zh-CN": "再显示 50 张 · 还有 {n}", "zh-TW": "再顯示 50 張 · 還有 {n}", en: "Show 50 more · {n} left", ja: "さらに 50 枚 · 残り {n}", ko: "50장 더 · {n}장 남음", fr: "50 de plus · {n} restants", de: "50 weitere · noch {n}", es: "50 más · quedan {n}", hi: "50 और · {n} बाकी", th: "อีก 50 · เหลือ {n}", ru: "Ещё 50 · осталось {n}", pt: "Mais 50 · faltam {n}" },
  collectionLead: { "zh-CN": "已收录 {n} / {total} · 只有中奖图案才会解锁，并奖励金币", "zh-TW": "已收錄 {n} / {total} · 只有中獎圖案才會解鎖，並獎勵金幣", en: "Collected {n} / {total} · only winning symbols unlock, with a coin bonus", ja: "収録 {n} / {total} · 当たり絵柄だけが解放され、コインが付きます", ko: "수록 {n} / {total} · 당첨 문양만 해금되며 코인을 줍니다", fr: "Collection {n} / {total} · seuls les symboles gagnants se débloquent, avec des pièces", de: "Gesammelt {n} / {total} · nur Gewinnsymbole schalten frei und geben Münzen", es: "Colección {n} / {total} · solo se desbloquean símbolos ganadores, con monedas", hi: "संग्रह {n} / {total} · केवल जीतने वाले चिह्न खुलते हैं", th: "สะสม {n} / {total} · ปลดล็อกเฉพาะสัญลักษณ์ที่ถูก พร้อมเหรียญ", ru: "Собрано {n} / {total} · открываются только выигрышные знаки", pt: "Coleção {n} / {total} · só símbolos vencedores desbloqueiam, com moedas" },
  collectionNote: { "zh-CN": "游客进度只留在这台电脑。中途补注册后，金币和图鉴会跟账号走；换电脑可先导出存档码，或登录账号取回。", "zh-TW": "遊客進度只留在這台電腦。中途補註冊後，金幣和圖鑑會跟帳號走；換電腦可先匯出存檔碼，或登入帳號取回。", en: "Guest progress stays on this device. After signup it follows the account. On a new device, import a save code or log in.", ja: "ゲスト進捗はこの端末のみ。登録後はアカウントに付きます。別端末ではコードまたはログインで戻せます。", ko: "게스트 진행은 이 기기만. 가입 후 계정을 따릅니다. 다른 기기는 코드나 로그인으로 가져오세요.", fr: "La progression invité reste ici. Après inscription elle suit le compte. Sur un autre appareil, importez un code ou connectez-vous.", de: "Gastfortschritt bleibt hier. Nach Registrierung folgt er dem Konto. Auf einem neuen Gerät: Code oder Login.", es: "El progreso de invitado queda aquí. Tras registrarte sigue la cuenta. En otro aparato, importa un código o entra.", hi: "अतिथि प्रगति यहीं है। खाते के बाद उसके साथ जाएगी। नए उपकरण पर कोड या लॉग इन।", th: "ความคืบหน้าแขกอยู่เครื่องนี้ สมัครแล้วตามบัญชี เครื่องใหม่ใช้รหัสหรือเข้าสู่ระบบ", ru: "Гостевой прогресс только здесь. После регистрации — с аккаунтом. На другом устройстве: код или вход.", pt: "O progresso de convidado fica aqui. Após cadastro, segue a conta. Noutro aparelho, importe um código ou entre." },
  exportSave: { "zh-CN": "导出存档", "zh-TW": "匯出存檔", en: "Export save", ja: "セーブ書き出し", ko: "저장 내보내기", fr: "Exporter", de: "Exportieren", es: "Exportar", hi: "निर्यात", th: "ส่งออก", ru: "Экспорт", pt: "Exportar" },
  importSave: { "zh-CN": "导入存档", "zh-TW": "匯入存檔", en: "Import save", ja: "セーブ読み込み", ko: "저장 가져오기", fr: "Importer", de: "Importieren", es: "Importar", hi: "आयात", th: "นำเข้า", ru: "Импорт", pt: "Importar" },
  locked: { "zh-CN": "未发现", "zh-TW": "未發現", en: "Locked", ja: "未発見", ko: "미발견", fr: "Verrouillé", de: "Gesperrt", es: "Bloqueado", hi: "बंद", th: "ยังไม่พบ", ru: "Закрыто", pt: "Bloqueado" },
  albumTitle: { "zh-CN": "幸运图鉴", "zh-TW": "幸運圖鑑", en: "Lucky album", ja: "幸運図鑑", ko: "행운 도감", fr: "Album chanceux", de: "Glücksalbum", es: "Álbum de la suerte", hi: "लकी एल्बम", th: "อัลบั้มโชค", ru: "Альбом удачи", pt: "Álbum da sorte" },
  exportHint: { "zh-CN": "把这段存档码复制走，换设备时在图鉴里导入即可恢复金币和图鉴。存档码只保存在你自己手里。", "zh-TW": "把這段存檔碼複製走，換裝置時在圖鑑裡匯入即可恢復金幣和圖鑑。存檔碼只保存在你自己手裡。", en: "Copy this save code. Import it in the album on another device to restore coins and collection. Keep the code yourself.", ja: "このコードをコピーし、別端末の図鑑で読み込めばコインと図鑑が戻ります。", ko: "이 코드를 복사해 다른 기기 도감에서 가져오면 코인과 도감이 복구됩니다.", fr: "Copiez ce code. Importez-le dans l’album sur un autre appareil.", de: "Code kopieren und auf einem anderen Gerät im Album importieren.", es: "Copia este código e impórtalo en el álbum de otro aparato.", hi: "यह कोड कॉपी करें। दूसरे उपकरण के एल्बम में डालें।", th: "คัดลอกรหัสนี้ แล้วนำเข้าในอัลบั้มเครื่องอื่น", ru: "Скопируйте код и импортируйте в альбоме на другом устройстве.", pt: "Copie este código e importe-o no álbum noutro aparelho." },
  copyCode: { "zh-CN": "复制存档码", "zh-TW": "複製存檔碼", en: "Copy save code", ja: "コードをコピー", ko: "코드 복사", fr: "Copier le code", de: "Code kopieren", es: "Copiar código", hi: "कोड कॉपी", th: "คัดลอกรหัส", ru: "Копировать", pt: "Copiar código" },
  copied: { "zh-CN": "存档码已复制", "zh-TW": "存檔碼已複製", en: "Save code copied", ja: "コピーしました", ko: "복사했습니다", fr: "Code copié", de: "Code kopiert", es: "Código copiado", hi: "कॉपी हो गया", th: "คัดลอกแล้ว", ru: "Скопировано", pt: "Código copiado" },
  importHint: { "zh-CN": "粘贴之前导出的存档码。导入后会覆盖当前浏览器里的金币和图鉴。", "zh-TW": "貼上之前匯出的存檔碼。匯入後會覆蓋目前瀏覽器裡的金幣和圖鑑。", en: "Paste a previously exported save code. Importing overwrites coins and album in this browser.", ja: "書き出したコードを貼り付けます。読み込むとこのブラウザのコインと図鑑が上書きされます。", ko: "내보낸 코드를 붙여넣으세요. 가져오면 이 브라우저의 코인과 도감이 덮입니다.", fr: "Collez un code exporté. L’import écrase pièces et album ici.", de: "Exportierten Code einfügen. Import überschreibt Münzen und Album hier.", es: "Pega un código exportado. Sustituye monedas y álbum de este navegador.", hi: "पहले वाला कोड चिपकाएँ। आयात से यहाँ के सिक्के और एल्बम बदल जाएंगे।", th: "วางรหัสที่ส่งออกไว้ การนำเข้าจะทับเหรียญกับอัลบั้มในเบราว์เซอร์นี้", ru: "Вставьте код. Импорт заменит монеты и альбом в этом браузере.", pt: "Cole um código exportado. A importação substitui moedas e álbum neste navegador." },
  importPlaceholder: { "zh-CN": "在此粘贴 SG1. 开头的存档码", "zh-TW": "在此貼上 SG1. 開頭的存檔碼", en: "Paste a save code starting with SG1.", ja: "SG1. で始まるコードを貼り付け", ko: "SG1.으로 시작하는 코드를 붙이세요", fr: "Collez un code commençant par SG1.", de: "Code mit SG1. einfügen", es: "Pega un código que empiece por SG1.", hi: "SG1. से शुरू कोड चिपकाएँ", th: "วางรหัสที่ขึ้นต้น SG1.", ru: "Вставьте код, начинающийся с SG1.", pt: "Cole um código que comece com SG1." },
  importApply: { "zh-CN": "确认导入", "zh-TW": "確認匯入", en: "Import", ja: "読み込む", ko: "가져오기", fr: "Importer", de: "Importieren", es: "Importar", hi: "आयात", th: "นำเข้า", ru: "Импорт", pt: "Importar" },
  importBad: { "zh-CN": "存档码无效", "zh-TW": "存檔碼無效", en: "Invalid save code", ja: "コードが無効です", ko: "코드가 올바르지 않습니다", fr: "Code invalide", de: "Ungültiger Code", es: "Código no válido", hi: "अमान्य कोड", th: "รหัสไม่ถูกต้อง", ru: "Неверный код", pt: "Código inválido" },
  restoreOk: { "zh-CN": "存档已恢复 · {n} 枚图鉴 · {coins} 金币", "zh-TW": "存檔已恢復 · {n} 枚圖鑑 · {coins} 金幣", en: "Save restored · {n} album · {coins} coins", ja: "復元しました · 図鑑 {n} · {coins} コイン", ko: "복구됨 · 도감 {n} · {coins}코인", fr: "Sauvegarde restaurée · album {n} · {coins} pièces", de: "Stand wiederhergestellt · Album {n} · {coins} Münzen", es: "Guardado restaurado · álbum {n} · {coins} monedas", hi: "सेव वापस · एल्बम {n} · {coins} सिक्के", th: "กู้แล้ว · อัลบั้ม {n} · {coins} เหรียญ", ru: "Сейв восстановлен · альбом {n} · {coins} монет", pt: "Save restaurado · álbum {n} · {coins} moedas" },
  restoreBad: { "zh-CN": "存档码无效，请检查后重试", "zh-TW": "存檔碼無效，請檢查後重試", en: "Invalid save code, please check and retry", ja: "コードを確認して再試行", ko: "코드를 확인하고 다시 시도", fr: "Code invalide, vérifiez", de: "Ungültiger Code", es: "Código no válido", hi: "अमान्य कोड", th: "รหัสไม่ถูกต้อง", ru: "Неверный код", pt: "Código inválido" },
  oddsRate: { "zh-CN": "综合中奖率 {n}%", "zh-TW": "綜合中獎率 {n}%", en: "Win rate {n}%", ja: "当選率 {n}%", ko: "당첨률 {n}%", fr: "Taux de gain {n} %", de: "Gewinnquote {n} %", es: "Tasa de premio {n} %", hi: "जीत दर {n}%", th: "อัตราถูก {n}%", ru: "Шанс {n}%", pt: "Taxa {n}%" },
  oddsRtp: { "zh-CN": "理论返奖率 {n}%", "zh-TW": "理論返獎率 {n}%", en: "RTP {n}%", ja: "還元率 {n}%", ko: "환수율 {n}%", fr: "RTP {n} %", de: "RTP {n} %", es: "RTP {n} %", hi: "RTP {n}%", th: "RTP {n}%", ru: "RTP {n}%", pt: "RTP {n}%" },
  oddsTier: { "zh-CN": "奖级", "zh-TW": "獎級", en: "Tier", ja: "等級", ko: "등급", fr: "Palier", de: "Stufe", es: "Nivel", hi: "स्तर", th: "ชั้น", ru: "Уровень", pt: "Nível" },
  oddsChance: { "zh-CN": "概率", "zh-TW": "機率", en: "Odds", ja: "確率", ko: "확률", fr: "Probabilité", de: "Chance", es: "Prob.", hi: "संभावना", th: "โอกาส", ru: "Шанс", pt: "Chance" },
  oddsPrize: { "zh-CN": "奖金", "zh-TW": "獎金", en: "Prize", ja: "賞金", ko: "상금", fr: "Gain", de: "Gewinn", es: "Premio", hi: "इनाम", th: "รางวัล", ru: "Приз", pt: "Prêmio" },
  oddsTitle: { "zh-CN": "{title} · 概率公示", "zh-TW": "{title} · 機率公示", en: "{title} · odds", ja: "{title} · 確率", ko: "{title} · 확률", fr: "{title} · cotes", de: "{title} · Quoten", es: "{title} · probabilidades", hi: "{title} · संभावना", th: "{title} · อัตรา", ru: "{title} · шансы", pt: "{title} · odds" },
  oddsDefault: { "zh-CN": "概率公示", "zh-TW": "機率公示", en: "Odds", ja: "確率公示", ko: "확률 공시", fr: "Cotes", de: "Quoten", es: "Probabilidades", hi: "संभावना", th: "อัตรา", ru: "Шансы", pt: "Odds" },
  oddsFoot: { "zh-CN": "理论返奖率是长期统计值，不代表单次结果。", "zh-TW": "理論返獎率是長期統計值，不代表單次結果。", en: "RTP is a long-run average, not a single-ticket promise.", ja: "還元率は長期の統計であり、1枚の結果ではありません。", ko: "환수율은 장기 통계이며 한 장의 결과가 아닙니다.", fr: "Le RTP est une moyenne longue, pas une promesse par ticket.", de: "RTP ist ein Langzeitwert, kein Einzelergebnis.", es: "El RTP es un promedio a largo plazo, no una promesa por boleto.", hi: "RTP लंबी अवधि का औसत है, एक टिकट का वादा नहीं।", th: "RTP เป็นค่าเฉลี่ยระยะยาว ไม่ใช่ผลใบเดียว", ru: "RTP — долгосрочная средняя, не обещание одного билета.", pt: "O RTP é uma média longa, não uma promessa por bilhete." },
  oddsGeneric: { "zh-CN": "每张票独立随机。购买时先按上表抽取奖级，再生成对应图案；概率总和为 100%。", "zh-TW": "每張票獨立隨機。購買時先按上表抽取獎級，再生成對應圖案；機率總和為 100%。", en: "Each ticket is drawn independently. A prize tier is rolled first, then the art is generated. Odds sum to 100%.", ja: "各券は独立抽選。先に等級を引き、その後絵柄を生成します。確率合計は 100%。", ko: "각 표는 독립 추첨입니다. 먼저 등급을 뽑은 뒤 문양을 만듭니다. 확률 합은 100%입니다.", fr: "Chaque ticket est tiré séparément. Le palier est tiré d’abord, puis le visuel. Total 100 %.", de: "Jedes Los ist unabhängig. Zuerst Stufe, dann Motiv. Summe 100 %.", es: "Cada boleto es independiente. Primero el nivel, luego el dibujo. Suma 100 %.", hi: "हर टिकट अलग है। पहले स्तर, फिर चित्र। योग 100%。", th: "แต่ละใบสุ่มอิสระ สุ่มชั้นก่อน แล้วค่อยสร้างลาย รวม 100%", ru: "Каждый билет независим. Сначала уровень, затем рисунок. Сумма 100%.", pt: "Cada bilhete é independente. Primeiro o nível, depois a arte. Soma 100%." },
  goldAmount: { "zh-CN": "{n} 金币", "zh-TW": "{n} 金幣", en: "{n} coins", ja: "{n} コイン", ko: "{n}코인", fr: "{n} pièces", de: "{n} Münzen", es: "{n} monedas", hi: "{n} सिक्के", th: "{n} เหรียญ", ru: "{n} монет", pt: "{n} moedas" },
  dailyTitle: { "zh-CN": "每日登陆礼", "zh-TW": "每日登入禮", en: "Daily login gift", ja: "デイリーログイン", ko: "매일 로그인 선물", fr: "Cadeau quotidien", de: "Tägliches Login", es: "Regalo diario", hi: "दैनिक उपहार", th: "ของขวัญรายวัน", ru: "Ежедневный подарок", pt: "Presente diário" },
  dailyHead: { "zh-CN": "今日登陆奖励", "zh-TW": "今日登入獎勵", en: "Today’s login reward", ja: "今日のログイン報酬", ko: "오늘 로그인 보상", fr: "Récompense du jour", de: "Heutige Belohnung", es: "Recompensa de hoy", hi: "आज का इनाम", th: "รางวัลวันนี้", ru: "Награда за сегодня", pt: "Recompensa de hoje" },
  dailyBody: { "zh-CN": "足够免费刮 {n} 张「{title}」。当天未领取，第二天不会累计。", "zh-TW": "足夠免費刮 {n} 張「{title}」。當天未領取，第二天不會累計。", en: "Enough for {n} free plays of “{title}”. Unused gifts do not roll over.", ja: "「{title}」を {n} 枚無料で遊べます。当日受け取らないと翌日に持ち越しません。", ko: "「{title}」 {n}장을 무료로 할 수 있습니다. 오늘 안 받으면 넘어가지 않습니다.", fr: "Assez pour {n} parties gratuites de « {title} ». Pas de report.", de: "Reicht für {n} freie Spiele von „{title}“. Kein Übertrag.", es: "Alcanza para {n} jugadas gratis de «{title}». No se acumula.", hi: "“{title}” के {n} मुफ़्त खेल। अगले दिन नहीं जुड़ता।", th: "พอขูด «{title}» ฟรี {n} ใบ วันนี้ไม่รับ พรุ่งนี้ไม่สะสม", ru: "Хватит на {n} бесплатных игр «{title}». На завтра не переносится.", pt: "Dá para {n} jogadas grátis de “{title}”. Não acumula." },
  claim: { "zh-CN": "领取", "zh-TW": "領取", en: "Claim", ja: "受け取る", ko: "받기", fr: "Récupérer", de: "Abholen", es: "Recoger", hi: "लें", th: "รับ", ru: "Забрать", pt: "Receber" },
  giftTitle: { "zh-CN": "欢迎入馆", "zh-TW": "歡迎入館", en: "Welcome", ja: "ようこそ", ko: "환영합니다", fr: "Bienvenue", de: "Willkommen", es: "Bienvenida", hi: "स्वागत", th: "ยินดีต้อนรับ", ru: "Добро пожаловать", pt: "Bem-vindo" },
  giftHead: { "zh-CN": "开馆见面礼", "zh-TW": "開館見面禮", en: "Opening gift", ja: "入館祝い", ko: "개관 선물", fr: "Cadeau d’ouverture", de: "Willkommensgeschenk", es: "Regalo de bienvenida", hi: "स्वागत उपहार", th: "ของขวัญเปิด馆", ru: "Подарок на вход", pt: "Presente de abertura" },
  giftBody: { "zh-CN": "足够体验所有国家的刮奖券。每张票都会按公示概率独立开奖。", "zh-TW": "足夠體驗所有國家的刮獎券。每張票都會按公示機率獨立開獎。", en: "Enough to try tickets from every country. Each ticket is drawn independently at the posted odds.", ja: "各国の券を試せます。各券は公示確率で独立抽選です。", ko: "모든 나라의 표를 해볼 수 있습니다. 각 표는 공시 확률로 독립 추첨됩니다.", fr: "Assez pour essayer tous les pays. Chaque ticket est tiré selon les cotes affichées.", de: "Reicht, um alle Länder zu testen. Jedes Los nach veröffentlichten Quoten.", es: "Alcanza para probar todos los países. Cada boleto se sortea por las cuotas publicadas.", hi: "हर देश के टिकट आज़माने को काफ़ी। हर टिकट अलग निकलता है।", th: "พอลองใบทุกประเทศ แต่ละใบสุ่มตามอัตราที่ประกาศ", ru: "Хватит, чтобы попробовать все страны. Каждый билет разыгрывается отдельно.", pt: "Dá para experimentar todos os países. Cada bilhete é sorteado à parte." },
  takeGift: { "zh-CN": "收下礼包", "zh-TW": "收下禮包", en: "Take the gift", ja: "受け取る", ko: "선물 받기", fr: "Prendre le cadeau", de: "Geschenk nehmen", es: "Aceptar", hi: "उपहार लें", th: "รับของขวัญ", ru: "Взять подарок", pt: "Receber presente" },
  poorTitle: { "zh-CN": "零钱补给", "zh-TW": "零錢補給", en: "Coin relief", ja: "補給", ko: "보충", fr: "Appoint", de: "Nachschub", es: "Recarga", hi: "सिक्के", th: "เติมเหรียญ", ru: "Пополнение", pt: "Reforço" },
  poorHead: { "zh-CN": "金币不足", "zh-TW": "金幣不足", en: "Not enough coins", ja: "コイン不足", ko: "코인 부족", fr: "Pas assez de pièces", de: "Zu wenig Münzen", es: "Faltan monedas", hi: "सिक्के कम हैं", th: "เหรียญไม่พอ", ru: "Не хватает монет", pt: "Moedas insuficientes" },
  poorBody: { "zh-CN": "博物馆为收藏家提供 100 金币研究补助，领取后可以继续体验。", "zh-TW": "博物館為收藏家提供 100 金幣研究補助，領取後可以繼續體驗。", en: "The gallery offers collectors a 100-coin research grant so you can keep playing.", ja: "博物館から研究補助 100 コインを受け取れます。", ko: "박물관이 연구 지원금 100코인을 줍니다.", fr: "La galerie offre 100 pièces de recherche pour continuer.", de: "Die Galerie gibt 100 Forschungsmünzen, damit es weitergeht.", es: "La galería ofrece 100 monedas de investigación para seguir.", hi: "गैलरी 100 सिक्कों की मदद देती है।", th: "พิพิธภัณฑ์ให้ทุนวิจัย 100 เหรียญ", ru: "Галерея даёт 100 монет на исследования.", pt: "A galeria oferece 100 moedas de pesquisa." },
  takeRelief: { "zh-CN": "领取 100 金币", "zh-TW": "領取 100 金幣", en: "Claim 100 coins", ja: "100 コイン受け取る", ko: "100코인 받기", fr: "Prendre 100 pièces", de: "100 Münzen holen", es: "Recoger 100 monedas", hi: "100 सिक्के लें", th: "รับ 100 เหรียญ", ru: "Забрать 100", pt: "Receber 100 moedas" },
  edition: { "zh-CN": "剩余{n}张/总发行{total}张", "zh-TW": "剩餘{n}張/總發行{total}張", en: "{n} left/{total} issued", ja: "残{n}枚/発行{total}枚", ko: "잔여 {n}장/총발행 {total}장", fr: "{n} restants/{total} émis", de: "{n} übrig/{total} Auflage", es: "{n} restantes/{total} emitidos", hi: "{n} शेष/{total} जारी", th: "เหลือ {n} ใบ/ออก {total} ใบ", ru: "осталось {n}/{total} выпуск", pt: "{n} restantes/{total} emitidos" },
  serialBefore: { "zh-CN": "第", "zh-TW": "第", en: "No.", ja: "第", ko: "제", fr: "N°", de: "Nr.", es: "N.º", hi: "क्र.", th: "เลข", ru: "№", pt: "N.º" },
  serialAfter: { "zh-CN": "号", "zh-TW": "號", en: "", ja: "号", ko: "호", fr: "", de: "", es: "", hi: "", th: "", ru: "", pt: "" },
  myScore: { "zh-CN": "我的分数", "zh-TW": "我的分數", en: "My score", ja: "自分の点数", ko: "내 점수", fr: "Mon score", de: "Meine Punkte", es: "Mi puntuación", hi: "मेरा स्कोर", th: "คะแนนฉัน", ru: "Мои очки", pt: "Meu placar" },
  rivalScore: { "zh-CN": "对手分数", "zh-TW": "對手分數", en: "Rival", ja: "相手の点数", ko: "상대 점수", fr: "Adversaire", de: "Gegner", es: "Rival", hi: "प्रतिद्वंद्वी", th: "คู่แข่ง", ru: "Соперник", pt: "Rival" },
  startMark: { "zh-CN": "始", "zh-TW": "始", en: "S", ja: "始", ko: "시작", fr: "D", de: "S", es: "I", hi: "श", th: "ต้น", ru: "С", pt: "I" },
  endMark: { "zh-CN": "终", "zh-TW": "終", en: "E", ja: "終", ko: "끝", fr: "F", de: "Z", es: "F", hi: "अ", th: "จบ", ru: "Ф", pt: "F" },
  scratchCell: { "zh-CN": "刮", "zh-TW": "刮", en: "Go", ja: "削", ko: "긁", fr: "OK", de: "Los", es: "Ya", hi: "खो", th: "ขูด", ru: "Сотри", pt: "Vai" },
  leftNum: { "zh-CN": "左数", "zh-TW": "左數", en: "Left", ja: "左", ko: "왼쪽", fr: "Gauche", de: "Links", es: "Izq.", hi: "बाएँ", th: "ซ้าย", ru: "Левое", pt: "Esq." },
  rightNum: { "zh-CN": "右数", "zh-TW": "右數", en: "Right", ja: "右", ko: "오른쪽", fr: "Droite", de: "Rechts", es: "Der.", hi: "दाएँ", th: "ขวา", ru: "Правое", pt: "Dir." },
  walkN: { "zh-CN": "走 {n} 步", "zh-TW": "走 {n} 步", en: "Walk {n}", ja: "{n} 歩", ko: "{n}칸", fr: "{n} pas", de: "{n} Schritte", es: "{n} pasos", hi: "{n} कदम", th: "{n} ก้าว", ru: "{n} шагов", pt: "{n} passos" },
  matchHint: { "zh-CN": "对号即中该格奖金", "zh-TW": "對號即中該格獎金", en: "Match a number to win that cell", ja: "番号が一致すればそのマスの賞金", ko: "번호가 맞으면 그 칸 상금", fr: "Un numéro identique gagne la case", de: "Passende Zahl gewinnt das Feld", es: "Si coincide el número, ganas la casilla", hi: "नंबर मिलने पर वह खाना जीतें", th: "เลขตรง ชนะช่องนั้น", ru: "Совпадение номера даёт приз клетки", pt: "Número igual ganha a casa" },
  lineHint: { "zh-CN": "横竖斜连成一线即中", "zh-TW": "橫豎斜連成一線即中", en: "A line across, down, or diagonal wins", ja: "縦横斜めの3つ揃いで当たり", ko: "가로·세로·대각선 3개면 당첨", fr: "Une ligne gagne", de: "Eine Linie gewinnt", es: "Una línea gana", hi: "एक लाइन जीत", th: "ครบเส้นชนะ", ru: "Линия побеждает", pt: "Uma linha ganha" },
  boughtToast: { "zh-CN": "已购入「{title}」 · 剩余{left}张/总发行10000张", "zh-TW": "已購入「{title}」 · 剩餘{left}張/總發行10000張", en: "Bought “{title}” · {left} left / 10,000 issued", ja: "「{title}」購入 · 残{left}枚/発行10000枚", ko: "「{title}」 구매 · 잔여 {left}장/총발행 10000장", fr: "Acheté « {title} » · {left} restants / 10 000 émis", de: "„{title}“ gekauft · {left} übrig / 10.000 Auflage", es: "Comprado «{title}» · {left} restantes / 10 000 emitidos", hi: "“{title}” खरीदा · {left} शेष / 10,000 जारी", th: "ซื้อ «{title}» · เหลือ {left} ใบ/ออก 10,000 ใบ", ru: "Куплено «{title}» · осталось {left} / выпуск 10 000", pt: "Comprado “{title}” · {left} restantes / 10.000 emitidos" },
  serialFail: { "zh-CN": "彩票号领取失败，请再试一次", "zh-TW": "彩票號領取失敗，請再試一次", en: "Could not issue a serial, try again", ja: "番号を取れませんでした", ko: "번호를 받지 못했습니다", fr: "Numéro indisponible", de: "Nummer fehlgeschlagen", es: "No se pudo emitir el número", hi: "क्रमांक नहीं मिला", th: "ออกเลขไม่สำเร็จ", ru: "Не удалось выдать номер", pt: "Falha ao emitir número" },
  welcomeBack: { "zh-CN": "欢迎回来，{name}", "zh-TW": "歡迎回來，{name}", en: "Welcome back, {name}", ja: "おかえり、{name}", ko: "다시 환영합니다, {name}", fr: "Bon retour, {name}", de: "Willkommen zurück, {name}", es: "Hola de nuevo, {name}", hi: "वापसी पर स्वागत, {name}", th: "ยินดีต้อนรับกลับ {name}", ru: "С возвращением, {name}", pt: "Bem-vindo de volta, {name}" },
  accountCreated: { "zh-CN": "账号已创建，当前进度已转到 {name}", "zh-TW": "帳號已建立，目前進度已轉到 {name}", en: "Account created. Progress moved to {name}", ja: "アカウント作成。進捗は {name} に移りました", ko: "계정 생성. 진행이 {name}(으)로 옮겨졌습니다", fr: "Compte créé. Progression transférée vers {name}", de: "Konto erstellt. Fortschritt zu {name}", es: "Cuenta creada. Progreso pasado a {name}", hi: "खाता बना। प्रगति {name} पर गई", th: "สร้างบัญชีแล้ว ย้ายความคืบหน้าไป {name}", ru: "Аккаунт создан. Прогресс у {name}", pt: "Conta criada. Progresso passou para {name}" },
  loggedOut: { "zh-CN": "已退出登录，进度还在这台电脑", "zh-TW": "已退出登入，進度還在這台電腦", en: "Logged out. Progress stays on this device", ja: "ログアウトしました。進捗はこの端末に残ります", ko: "로그아웃했습니다. 진행은 이 기기에 남습니다", fr: "Déconnecté. La progression reste ici", de: "Abgemeldet. Fortschritt bleibt hier", es: "Sesión cerrada. El progreso queda aquí", hi: "लॉग आउट। प्रगति यहीं है", th: "ออกแล้ว ความคืบหน้าอยู่เครื่องนี้", ru: "Вышли. Прогресс остался здесь", pt: "Saiu. O progresso fica neste aparelho" },
  dailyClaimed: { "zh-CN": "已领取今日登陆礼 · {n} 金币", "zh-TW": "已領取今日登入禮 · {n} 金幣", en: "Claimed today’s gift · {n} coins", ja: "本日のログイン報酬 {n} コイン", ko: "오늘 선물 {n}코인", fr: "Cadeau du jour · {n} pièces", de: "Heutiges Geschenk · {n} Münzen", es: "Regalo de hoy · {n} monedas", hi: "आज का उपहार · {n} सिक्के", th: "รับของวันนี้ · {n} เหรียญ", ru: "Подарок дня · {n} монет", pt: "Presente de hoje · {n} moedas" },
  keyHit: { "zh-CN": "钥匙即中", "zh-TW": "鑰匙即中", en: "Key hit", ja: "キー当たり", ko: "열쇠 당첨", fr: "Clé", de: "Schlüssel", es: "Llave", hi: "चाबी", th: "กุญแจ", ru: "Ключ", pt: "Chave" },
  bingoX: { "zh-CN": "宾果 X", "zh-TW": "賓果 X", en: "Bingo X", ja: "ビンゴ X", ko: "빙고 X", fr: "Bingo X", de: "Bingo X", es: "Bingo X", hi: "बिंगो X", th: "บิงโก X", ru: "Бинго X", pt: "Bingo X" },
  bingoCorners: { "zh-CN": "宾果四角", "zh-TW": "賓果四角", en: "Bingo corners", ja: "ビンゴ四隅", ko: "빙고 모서리", fr: "Bingo coins", de: "Bingo Ecken", es: "Bingo esquinas", hi: "बिंगो कोने", th: "บิงโกมุม", ru: "Бинго углы", pt: "Bingo cantos" },
  bingoLine: { "zh-CN": "宾果连线", "zh-TW": "賓果連線", en: "Bingo line", ja: "ビンゴリーチ", ko: "빙고 라인", fr: "Bingo ligne", de: "Bingo Linie", es: "Bingo línea", hi: "बिंगो लाइन", th: "บิงโกเส้น", ru: "Бинго линия", pt: "Bingo linha" },
  dualX: { "zh-CN": "双卡宾果 X", "zh-TW": "雙卡賓果 X", en: "Dual bingo X", ja: "ダブルビンゴ X", ko: "더블 빙고 X", fr: "Double bingo X", de: "Doppel-Bingo X", es: "Bingo doble X", hi: "दोहरा बिंगो X", th: "บิงโกคู่ X", ru: "Двойное бинго X", pt: "Bingo duplo X" },
  dualBingo: { "zh-CN": "双卡宾果", "zh-TW": "雙卡賓果", en: "Dual bingo", ja: "ダブルビンゴ", ko: "더블 빙고", fr: "Double bingo", de: "Doppel-Bingo", es: "Bingo doble", hi: "दोहरा बिंगो", th: "บิงโกคู่", ru: "Двойное бинго", pt: "Bingo duplo" },
  wordsN: { "zh-CN": "凑齐 {n} 词", "zh-TW": "湊齊 {n} 詞", en: "{n} words", ja: "{n} 語", ko: "{n}단어", fr: "{n} mots", de: "{n} Wörter", es: "{n} palabras", hi: "{n} शब्द", th: "{n} คำ", ru: "{n} слов", pt: "{n} palavras" },
  goldLine: { "zh-CN": "传说瑞兽三连", "zh-TW": "傳說瑞獸三連", en: "Legendary three", ja: "伝説の三連", ko: "전설 3연속", fr: "Trio légendaire", de: "Legendäre Drei", es: "Trío legendario", hi: "लीजेंड तीन", th: "สามตำนาน", ru: "Легендарная тройка", pt: "Três lendários" },
  missMatch: { "zh-CN": "本张未对上号码", "zh-TW": "本張未對上號碼", en: "No number matched", ja: "番号が一致しません", ko: "번호가 맞지 않음", fr: "Aucun numéro", de: "Keine Zahl", es: "Ningún número", hi: "कोई नंबर नहीं", th: "เลขไม่ตรง", ru: "Номера не совпали", pt: "Nenhum número" },
  missBingo: { "zh-CN": "本张未连成宾果", "zh-TW": "本張未連成賓果", en: "No bingo", ja: "ビンゴなし", ko: "빙고 없음", fr: "Pas de bingo", de: "Kein Bingo", es: "Sin bingo", hi: "बिंगो नहीं", th: "ไม่มีบิงโก", ru: "Нет бинго", pt: "Sem bingo" },
  missCompare: { "zh-CN": "本局比分未超过对手", "zh-TW": "本局比分未超過對手", en: "Did not beat the rival", ja: "相手を超えられず", ko: "상대를 넘지 못함", fr: "Pas mieux que l’adversaire", de: "Gegner nicht übertroffen", es: "No superaste al rival", hi: "प्रतिद्वंद्वी से आगे नहीं", th: "ไม่ชนะคู่แข่ง", ru: "Соперника не обошли", pt: "Não superou o rival" },
  missCoord: { "zh-CN": "本张坐标格没有奖金", "zh-TW": "本張座標格沒有獎金", en: "Coordinates landed empty", ja: "座標は空マス", ko: "좌표가 빈칸", fr: "Coordonnées vides", de: "Koordinaten leer", es: "Coordenadas vacías", hi: "निर्देशांक खाली", th: "พิกัดว่าง", ru: "Координаты пусты", pt: "Coordenadas vazias" },
  missWalk: { "zh-CN": "本张停在空格", "zh-TW": "本張停在空格", en: "Stopped on an empty space", ja: "空きマスで停止", ko: "빈칸에 멈춤", fr: "Arrêt sur une case vide", de: "Auf leerem Feld gestoppt", es: "Paró en vacío", hi: "खाली जगह रुके", th: "หยุดช่องว่าง", ru: "Остановка на пустой клетке", pt: "Parou no vazio" },
  missMaze: { "zh-CN": "本张迷宫走到空格", "zh-TW": "本張迷宮走到空格", en: "Maze ended empty", ja: "迷路のゴールは空", ko: "미로 끝이 빈칸", fr: "Labyrinthe vide", de: "Labyrinth leer", es: "Laberinto vacío", hi: "भूलभुलैया खाली", th: "เขาวงกตว่าง", ru: "Лабиринт пуст", pt: "Labirinto vazio" },
  missWords: { "zh-CN": "本张单词未凑齐", "zh-TW": "本張單詞未湊齊", en: "Not enough words", ja: "単語が足りない", ko: "단어가 모자람", fr: "Pas assez de mots", de: "Zu wenige Wörter", es: "Faltan palabras", hi: "शब्द पूरे नहीं", th: "คำไม่ครบ", ru: "Мало слов", pt: "Palavras incompletas" },
  missSum: { "zh-CN": "本张没有相加为 7", "zh-TW": "本張沒有相加為 7", en: "No pair summed to 7", ja: "合計 7 なし", ko: "합이 7이 아님", fr: "Aucune somme à 7", de: "Keine Summe 7", es: "Ninguna suma 7", hi: "कोई जोड़ी 7 नहीं", th: "ไม่มีคู่รวม 7", ru: "Нет суммы 7", pt: "Nenhuma soma 7" },
  refund: { "zh-CN": "返还 {n}", "zh-TW": "返還 {n}", en: "Refund {n}", ja: "払い戻し {n}", ko: "환급 {n}", fr: "Remboursement {n}", de: "Rückgabe {n}", es: "Reembolso {n}", hi: "वापसी {n}", th: "คืน {n}", ru: "Возврат {n}", pt: "Reembolso {n}" },
  times: { "zh-CN": "{n} 倍", "zh-TW": "{n} 倍", en: "{n}×", ja: "{n} 倍", ko: "{n}배", fr: "×{n}", de: "{n}×", es: "×{n}", hi: "{n}×", th: "{n} เท่า", ru: "×{n}", pt: "×{n}" },
  soldOut: { "zh-CN": "本奖票已售罄，发行上限 10000 张", "zh-TW": "本獎票已售罄，發行上限 10000 張", en: "Sold out — edition of 10,000", ja: "完売です。発行上限 1 万枚", ko: "매진 · 발행 한도 1만 장", fr: "Épuisé — édition de 10 000", de: "Ausverkauft — Auflage 10.000", es: "Agotado — edición de 10 000", hi: "बिक गया — 10,000", th: "หมดแล้ว — ออก 10,000 ใบ", ru: "Распродано — тираж 10 000", pt: "Esgotado — edição de 10.000" },
  badTicket: { "zh-CN": "奖票不对", "zh-TW": "獎票不對", en: "Invalid ticket", ja: "券が違います", ko: "표가 올바르지 않습니다", fr: "Ticket invalide", de: "Ungültiges Los", es: "Boleto no válido", hi: "गलत टिकट", th: "ใบไม่ถูกต้อง", ru: "Неверный билет", pt: "Bilhete inválido" },
  loginBad: { "zh-CN": "账号或密码不对", "zh-TW": "帳號或密碼不對", en: "Wrong account or password", ja: "アカウントまたはパスワードが違います", ko: "계정 또는 비밀번호가 틀립니다", fr: "Identifiant ou mot de passe incorrect", de: "Konto oder Passwort falsch", es: "Cuenta o contraseña incorrecta", hi: "खाता या पासवर्ड गलत", th: "บัญชีหรือรหัสไม่ถูก", ru: "Неверный аккаунт или пароль", pt: "Conta ou senha incorreta" },
  reLogin: { "zh-CN": "请重新登录", "zh-TW": "請重新登入", en: "Please log in again", ja: "再ログインしてください", ko: "다시 로그인하세요", fr: "Reconnectez-vous", de: "Bitte erneut anmelden", es: "Vuelve a entrar", hi: "फिर लॉग इन करें", th: "เข้าสู่ระบบใหม่", ru: "Войдите снова", pt: "Entre de novo" },
  requestFail: { "zh-CN": "请求失败", "zh-TW": "請求失敗", en: "Request failed", ja: "リクエスト失敗", ko: "요청 실패", fr: "Échec de la requête", de: "Anfrage fehlgeschlagen", es: "Error de solicitud", hi: "अनुरोध असफल", th: "คำขอล้มเหลว", ru: "Запрос не удался", pt: "Falha no pedido" },
  needServerCode: { "zh-CN": "需要游戏服务器才能发送邮箱验证码", "zh-TW": "需要遊戲伺服器才能發送信箱驗證碼", en: "A game server is required to send the email code", ja: "メールコードにはゲームサーバーが必要です", ko: "이메일 코드는 게임 서버가 필요합니다", fr: "Un serveur de jeu est requis pour envoyer le code", de: "Zum Senden des Codes braucht es den Spielserver", es: "Se necesita el servidor para enviar el código", hi: "कोड भेजने के लिए सर्वर चाहिए", th: "ต้องมีเซิร์ฟเวอร์เกมถึงจะส่งรหัสได้", ru: "Для кода нужен игровой сервер", pt: "É preciso o servidor para enviar o código" },
  needServerRegister: { "zh-CN": "需要游戏服务器才能完成邮箱注册", "zh-TW": "需要遊戲伺服器才能完成信箱註冊", en: "A game server is required to finish email signup", ja: "メール登録にはゲームサーバーが必要です", ko: "이메일 가입은 게임 서버가 필요합니다", fr: "Un serveur de jeu est requis pour l’inscription", de: "Zur Registrierung braucht es den Spielserver", es: "Se necesita el servidor para registrarte", hi: "पंजीकरण के लिए सर्वर चाहिए", th: "ต้องมีเซิร์ฟเวอร์เกมถึงจะสมัครได้", ru: "Для регистрации нужен игровой сервер", pt: "É preciso o servidor para cadastrar" },
  nameRule: { "zh-CN": "账号需为 2–16 个字，可用中文、字母或数字", "zh-TW": "帳號需為 2–16 個字，可用中文、字母或數字", en: "Username must be 2–16 characters (letters, numbers, or CJK)", ja: "ユーザー名は 2–16 文字", ko: "아이디는 2–16자", fr: "Identifiant : 2–16 caractères", de: "Name: 2–16 Zeichen", es: "Usuario: 2–16 caracteres", hi: "नाम 2–16 अक्षर", th: "ชื่อ 2–16 ตัว", ru: "Имя: 2–16 символов", pt: "Usuário: 2–16 caracteres" },
  passRule: { "zh-CN": "密码需为 6–32 位", "zh-TW": "密碼需為 6–32 位", en: "Password must be 6–32 characters", ja: "パスワードは 6–32 文字", ko: "비밀번호는 6–32자", fr: "Mot de passe : 6–32 caractères", de: "Passwort: 6–32 Zeichen", es: "Contraseña: 6–32 caracteres", hi: "पासवर्ड 6–32", th: "รหัส 6–32 ตัว", ru: "Пароль: 6–32", pt: "Senha: 6–32" },
  emailRule: { "zh-CN": "请填写正确的邮箱", "zh-TW": "請填寫正確的信箱", en: "Enter a valid email", ja: "正しいメールを入力", ko: "올바른 이메일을 입력", fr: "E-mail valide requis", de: "Gültige E-Mail", es: "Correo válido", hi: "सही ईमेल लिखें", th: "ใส่อีเมลให้ถูก", ru: "Введите почту", pt: "E-mail válido" },
  userTaken: { "zh-CN": "这个账号已经有人用了", "zh-TW": "這個帳號已經有人用了", en: "That username is taken", ja: "このユーザー名は使われています", ko: "이미 쓰인 아이디입니다", fr: "Identifiant déjà pris", de: "Name schon vergeben", es: "Ese usuario ya existe", hi: "यह नाम लिया गया", th: "ชื่อนี้อาชีพแล้ว", ru: "Имя занято", pt: "Usuário já existe" },
  emailTaken: { "zh-CN": "这个邮箱已经注册过了", "zh-TW": "這個信箱已經註冊過了", en: "That email is already registered", ja: "このメールは登録済みです", ko: "이미 가입된 이메일입니다", fr: "E-mail déjà inscrit", de: "E-Mail schon registriert", es: "Ese correo ya está registrado", hi: "ईमेल पहले से है", th: "อีเมลนี้สมัครแล้ว", ru: "Почта уже занята", pt: "E-mail já cadastrado" },
  codeWait: { "zh-CN": "验证码刚发过，请稍后再获取", "zh-TW": "驗證碼剛發過，請稍後再取得", en: "Code just sent, wait a moment", ja: "コード送信直後です。少し待ってください", ko: "코드를 방금 보냈습니다. 잠시 후", fr: "Code déjà envoyé, patientez", de: "Code gerade gesendet, bitte warten", es: "Código recién enviado, espera", hi: "कोड अभी गया, थोड़ी देर बाद", th: "เพิ่งส่งรหัส รอสักครู่", ru: "Код только что отправлен", pt: "Código acabou de ser enviado" },
  needSixCode: { "zh-CN": "请填写 6 位邮箱验证码", "zh-TW": "請填寫 6 位信箱驗證碼", en: "Enter the 6-digit email code", ja: "6桁のコードを入力", ko: "6자리 코드를 입력", fr: "Entrez le code à 6 chiffres", de: "6-stelligen Code eingeben", es: "Introduce el código de 6 dígitos", hi: "6 अंकों का कोड लिखें", th: "ใส่รหัส 6 หลัก", ru: "Введите 6-значный код", pt: "Digite o código de 6 dígitos" },
  getCodeFirst: { "zh-CN": "请先获取邮箱验证码", "zh-TW": "請先取得信箱驗證碼", en: "Get an email code first", ja: "先にコードを取得", ko: "먼저 코드를 받으세요", fr: "Demandez d’abord le code", de: "Zuerst Code holen", es: "Pide primero el código", hi: "पहले कोड लें", th: "ขอก่อน", ru: "Сначала получите код", pt: "Peça o código primeiro" },
  sameUser: { "zh-CN": "请使用获取验证码时填写的账号", "zh-TW": "請使用取得驗證碼時填寫的帳號", en: "Use the same username as when you requested the code", ja: "コード取得時と同じユーザー名", ko: "코드를 받을 때와 같은 아이디", fr: "Utilisez le même identifiant", de: "Denselben Namen wie beim Code", es: "Usa el mismo usuario", hi: "वही नाम इस्तेमाल करें", th: "ใช้ชื่อเดียวกับตอนขอรหัส", ru: "То же имя, что при запросе кода", pt: "Use o mesmo usuário" },
  samePass: { "zh-CN": "请使用获取验证码时填写的密码", "zh-TW": "請使用取得驗證碼時填寫的密碼", en: "Use the same password as when you requested the code", ja: "コード取得時と同じパスワード", ko: "코드를 받을 때와 같은 비밀번호", fr: "Utilisez le même mot de passe", de: "Dasselbe Passwort wie beim Code", es: "Usa la misma contraseña", hi: "वही पासवर्ड", th: "ใช้รหัสเดียวกับตอนขอ", ru: "Тот же пароль", pt: "Use a mesma senha" },
  codeExpired: { "zh-CN": "验证码已失效，请重新获取", "zh-TW": "驗證碼已失效，請重新取得", en: "Code expired, request a new one", ja: "コード期限切れ。再取得してください", ko: "코드가 만료됐습니다", fr: "Code expiré", de: "Code abgelaufen", es: "Código caducado", hi: "कोड समाप्त", th: "รหัสหมดอายุ", ru: "Код истёк", pt: "Código expirado" },
  badCode: { "zh-CN": "验证码不对", "zh-TW": "驗證碼不對", en: "Wrong code", ja: "コードが違います", ko: "코드가 틀립니다", fr: "Code incorrect", de: "Falscher Code", es: "Código incorrecto", hi: "गलत कोड", th: "รหัสไม่ถูก", ru: "Неверный код", pt: "Código errado" },
  userOrEmailTaken: { "zh-CN": "这个账号或邮箱已经有人用了", "zh-TW": "這個帳號或信箱已經有人用了", en: "That username or email is taken", ja: "ユーザー名またはメールは使用中", ko: "아이디 또는 이메일이 이미 있습니다", fr: "Identifiant ou e-mail déjà pris", de: "Name oder E-Mail vergeben", es: "Usuario o correo ya usados", hi: "नाम या ईमेल लिया गया", th: "ชื่อหรืออีเมลมีคนใช้แล้ว", ru: "Имя или почта заняты", pt: "Usuário ou e-mail já usados" },
  badRequest: { "zh-CN": "请求格式不对", "zh-TW": "請求格式不對", en: "Bad request", ja: "リクエスト形式が違います", ko: "요청 형식이 올바르지 않습니다", fr: "Requête incorrecte", de: "Ungültige Anfrage", es: "Solicitud incorrecta", hi: "गलत अनुरोध", th: "คำขอไม่ถูก", ru: "Неверный запрос", pt: "Pedido inválido" },
  unsupported: { "zh-CN": "不支持的请求", "zh-TW": "不支援的請求", en: "Unsupported request", ja: "未対応のリクエスト", ko: "지원하지 않는 요청", fr: "Requête non prise en charge", de: "Nicht unterstützt", es: "No compatible", hi: "असमर्थित", th: "ไม่รองรับ", ru: "Не поддерживается", pt: "Não suportado" },
  notFound: { "zh-CN": "找不到接口", "zh-TW": "找不到介面", en: "Not found", ja: "見つかりません", ko: "찾을 수 없습니다", fr: "Introuvable", de: "Nicht gefunden", es: "No encontrado", hi: "नहीं मिला", th: "ไม่พบ", ru: "Не найдено", pt: "Não encontrado" },
  accountDown: { "zh-CN": "账号服务暂时不可用", "zh-TW": "帳號服務暫時不可用", en: "Account service is temporarily unavailable", ja: "アカウントサービスは一時停止中", ko: "계정 서비스를 잠시 쓸 수 없습니다", fr: "Service de compte indisponible", de: "Kontodienst vorübergehend down", es: "Servicio de cuenta no disponible", hi: "खाता सेवा बंद है", th: "บริการบัญชียังใช้ไม่ได้", ru: "Сервис аккаунтов недоступен", pt: "Serviço de conta indisponível" },
  luckyMark: { "zh-CN": "指定图符", "zh-TW": "指定圖符", en: "the mark", ja: "指定マーク", ko: "지정 문양", fr: "le symbole", de: "das Zeichen", es: "el símbolo", hi: "निशान", th: "สัญลักษณ์", ru: "знак", pt: "o símbolo" }
};

const MODE_EN = {
  "cn-match": ["Triple Luck", "6 spots · match 3 to win"],
  "cn-seat": ["Match the Number", "6 cells · scratch the winning number, match a cell to win"],
  "cn-seat12": ["Match the Number Plus", "12 cells · scratch the winning number, match a cell to win"],
  "cn-line": ["Nine Grid", "3×3 line wins · legendary beasts for jackpot"],
  "cn-ingot": ["Instant Ingot", "Scratch a gold ingot to win that cell"],
  "cn-double": ["Gold Bar Double", "Match 3, then scratch to multiply"],
  "cn-score": ["Honor Score", "Win a round if your score is higher"],
  "cn-map": ["Fortune Trail", "Scratch letters and numbers, claim the board cell"],
  "cn-walk": ["Hero Path", "Walk the steps you scratch, land on a prize"],
  "cn-sum": ["Lucky Seven", "Two numbers that add to 7 win"],
  "cn-zodiac": ["Zodiac Fortune", "9 spots · match 3 lucky beasts"],
  "jp-fortune": ["Great Fortune", "6 spots · match 3 omikuji"],
  "jp-pair": ["Twin Crests", "Three pairs · match one pair to win"],
  "jp-triangle": ["Triangle Luck", "Match 3 on any triangle side"],
  "jp-maze": ["Lucky Maze", "Follow arrows from start to a prize"],
  "jp-moon": ["Moon Chest", "9 spots · match 3 moon marks"],
  "us-route": ["Lucky Highway", "9 spots · match 3 road signs"],
  "us-charm": ["Instant Horseshoe", "Scratch a horseshoe to win that cell"],
  "us-double": ["Starlight Double", "Match 3, then scratch a multiplier"],
  "us-key": ["Golden Key Road", "Match a number or scratch a key"],
  "us-bingo": ["Stars and Bingo", "Draw numbers · line / corners / X"],
  "us-crossword": ["Highway Words", "Scratch 12 letters, complete words"],
  "us-dual": ["Dual Bingo", "12 draws · two 3×3 cards"],
  "us-jackpot": ["Starlight Jackpot", "6 spots · match 3 badges"],
  "kr-bok": ["Lucky Hwatu", "6 spots · match 3 charms"],
  "kr-pair": ["Twin Fortune", "Three pairs · match one pair"],
  "kr-bingo": ["Hwatu Bingo", "Draw numbers · line / corners / X"],
  "kr-moon": ["Moon Palace", "9 spots · match 3 moon rabbits"],
  "cn-pair": ["Triple Joy", "3 spots · match any 2"],
  "cn-seven": ["Seven Treasures", "7 spots · match 3"],
  "cn-twelve": ["Twelve Gold Books", "12 spots · match 4"],
  "jp-four": ["Four Gates", "4 spots · match 2 omamori"],
  "jp-ten": ["Ten Views", "10 spots · match 3"],
  "us-five": ["Five-Star Luck", "5 spots · match 2"],
  "us-fifteen": ["Route 15", "15 spots · match 4"],
  "us-twenty": ["Twenty-Star Vault", "20 spots · match 5"],
  "kr-eight": ["Eight Fortunes", "8 spots · match 3"],
  "kr-sixteen": ["Sixteen Pavilion", "16 spots · match 4"],
  "uk-rose": ["Rose Vault", "8 spots · match 3"],
  "uk-crown": ["Crown Mist", "14 spots · match 4"],
  "fr-lily": ["Lily City", "5 spots · match 2"],
  "fr-chateau": ["Thirteen Castles", "13 spots · match 4"],
  "in-mandala": ["Lucky Mandala", "9 spots · match 3"],
  "in-gems": ["Eighteen Gems", "18 spots · match 5"],
  "mx-sun": ["Sun Fiesta", "7 spots · match 3"],
  "mx-fiesta": ["Fifteen Flags", "15 spots · match 4"],
  "eg-scarab": ["Sacred Scarab", "6 spots · match 3"],
  "eg-nile": ["Nile Star", "20 spots · match 5"]
};

const MODE_TW = {
  "cn-match": ["三喜臨門", "6 區 · 三個相同即中獎"],
  "cn-seat": ["對號入座", "6 格對號 · 先刮中獎號碼，對上即中該格獎金"],
  "cn-seat12": ["對號入座 · 加強版", "12 格對號 · 先刮中獎號碼，對上即中該格獎金"],
  "cn-line": ["九宮連線", "3×3 橫豎斜連成線即中 · 傳說瑞獸三連為大獎"],
  "cn-ingot": ["元寶即中", "刮出金元寶即中該格獎金"],
  "cn-double": ["金條加倍", "三枚相同即中 · 再刮金條翻倍"],
  "cn-score": ["榮耀比分", "三局對決 · 你的分數更高即中"],
  "cn-map": ["財富之旅", "刮出字母和數字，去棋盤對格領獎"],
  "cn-walk": ["勇士闖關", "按刮出的步數走路線，停在獎金格即中"],
  "cn-sum": ["七喜相加", "兩數相加等於 7 即中該局獎金"],
  "cn-zodiac": ["生肖聚福", "9 區 · 三隻福獸成組中獎"],
  "jp-fortune": ["大吉御籤", "6 區 · 三枚相同御籤中獎"],
  "jp-pair": ["雙紋配對", "三組配對 · 一組兩格相同即中"],
  "jp-triangle": ["三角開運", "三角形任一邊三枚相同即中"],
  "jp-maze": ["幸運迷路", "從起點按箭頭走，走到獎金格即中"],
  "jp-moon": ["月見寶箱", "9 區 · 三枚月紋符中獎"],
  "us-route": ["幸運公路", "9 區 · 三枚同款路標中獎"],
  "us-charm": ["馬蹄即中", "刮出幸運馬蹄即中該格獎金"],
  "us-double": ["星光加倍", "三枚相同即中 · 再刮倍符翻倍"],
  "us-key": ["金鑰公路", "對上號碼，或刮出鑰匙即中該格"],
  "us-bingo": ["星條賓果", "先刮開獎號 · 連線 / 四角 / X"],
  "us-crossword": ["公路填字", "先刮 12 個字母，湊齊單詞即可領獎"],
  "us-dual": ["雙卡賓果", "12 個開獎號 · 兩張 3×3 卡兼中兼得"],
  "us-jackpot": ["星光大獎", "6 區 · 三枚同款徽章中獎"],
  "kr-bok": ["福袋花牌", "6 區 · 三隻相同福物中獎"],
  "kr-pair": ["福緣成雙", "三組配對 · 一組兩格相同即中"],
  "kr-bingo": ["花牌賓果", "先刮開獎號 · 連線 / 四角 / X"],
  "kr-moon": ["月宮寶藏", "9 區 · 三枚月兔符中獎"],
  "cn-pair": ["三星報喜", "3 區 · 任意兩枚相同即中獎"],
  "cn-seven": ["七寶如意", "7 區 · 三枚同款瑞物中獎"],
  "cn-twelve": ["十二金冊", "12 區 · 四枚同款珍寶中獎"],
  "jp-four": ["四門結緣", "4 區 · 兩枚相同御守中獎"],
  "jp-ten": ["十景繪卷", "10 區 · 三枚同景徽章中獎"],
  "us-five": ["五星好運", "5 區 · 兩枚同款幸運符中獎"],
  "us-fifteen": ["十五號公路", "15 區 · 四枚同款路標中獎"],
  "us-twenty": ["二十星金庫", "20 區 · 五枚同款徽章中獎"],
  "kr-eight": ["八方福緣", "8 區 · 三枚同款福物中獎"],
  "kr-sixteen": ["十六彩閣", "16 區 · 四枚同款彩章中獎"],
  "uk-rose": ["玫瑰寶庫", "8 區 · 三枚英倫徽章中獎"],
  "uk-crown": ["王冠迷霧", "14 區 · 四枚同款珍寶中獎"],
  "fr-lily": ["百合花都", "5 區 · 兩枚相同徽章中獎"],
  "fr-chateau": ["十三城堡", "13 區 · 四枚同款收藏中獎"],
  "in-mandala": ["吉祥曼陀羅", "9 區 · 三枚同款寶飾中獎"],
  "in-gems": ["十八寶石宮", "18 區 · 五枚同款寶物中獎"],
  "mx-sun": ["太陽慶典", "7 區 · 三枚同款彩章中獎"],
  "mx-fiesta": ["十五彩旗", "15 區 · 四枚同款民藝中獎"],
  "eg-scarab": ["聖甲秘藏", "6 區 · 三枚同款古寶中獎"],
  "eg-nile": ["尼羅星盤", "20 區 · 五枚同款符號中獎"]
};

const MODE_JA = {
  "cn-match": ["三喜臨門", "6マス · 3つ揃いで当たり"],
  "cn-seat": ["番号合わせ", "6マス · 当選番号を削り、一致したマスの賞金"],
  "cn-seat12": ["番号合わせ・強化", "12マス · 当選番号を削り、一致したマスの賞金"],
  "cn-line": ["九宮ライン", "3×3 の縦横斜めで当たり"],
  "cn-ingot": ["元宝即当たり", "金の元宝を削ればそのマスの賞金"],
  "cn-double": ["金条ダブル", "3つ揃えのあと倍率マス"],
  "cn-score": ["栄光スコア", "自分の点数が高ければ当たり"],
  "cn-map": ["富の旅", "文字と数字を削り、盤のマスへ"],
  "cn-walk": ["勇者の道", "出た歩数だけ進み、賞金マスへ"],
  "cn-sum": ["七の和", "2つの数が 7 なら当たり"],
  "cn-zodiac": ["十二支の福", "9マス · 福獣3つ"],
  "jp-fortune": ["大吉おみくじ", "6マス · おみくじ3つ"],
  "jp-pair": ["双紋ペア", "3組のうち1組が揃えば当たり"],
  "jp-triangle": ["三角開運", "三角形の一辺が3つ揃え"],
  "jp-maze": ["幸運迷路", "矢印どおりゴールの賞金へ"],
  "jp-moon": ["月見宝箱", "9マス · 月紋3つ"],
  "us-route": ["ラッキーハイウェイ", "9マス · 標識3つ"],
  "us-charm": ["蹄鉄即当たり", "蹄鉄を削ればそのマスの賞金"],
  "us-double": ["星明かりダブル", "3つ揃えのあと倍率"],
  "us-key": ["金の鍵ロード", "番号一致、または鍵"],
  "us-bingo": ["星条ビンゴ", "抽選番号 · ライン / 四隅 / X"],
  "us-crossword": ["ハイウェイワード", "12文字を削り単語を完成"],
  "us-dual": ["ダブルビンゴ", "12個抽選 · 3×3 が2枚"],
  "us-jackpot": ["星明かり一等", "6マス · バッジ3つ"],
  "kr-bok": ["福袋ファトゥ", "6マス · 福物3つ"],
  "kr-pair": ["福縁ペア", "3組のうち1組が揃えば当たり"],
  "kr-bingo": ["ファトゥビンゴ", "抽選番号 · ライン / 四隅 / X"],
  "kr-moon": ["月宮の宝", "9マス · 月うさぎ3つ"],
  "cn-pair": ["三星報喜", "3マス · どれか2つ"],
  "cn-seven": ["七宝如意", "7マス · 3つ揃え"],
  "cn-twelve": ["十二金冊", "12マス · 4つ揃え"],
  "jp-four": ["四門の縁", "4マス · お守り2つ"],
  "jp-ten": ["十景絵巻", "10マス · 3つ揃え"],
  "us-five": ["五星ラッキー", "5マス · 2つ揃え"],
  "us-fifteen": ["ルート15", "15マス · 4つ揃え"],
  "us-twenty": ["二十星の金庫", "20マス · 5つ揃え"],
  "kr-eight": ["八方の福", "8マス · 3つ揃え"],
  "kr-sixteen": ["十六彩閣", "16マス · 4つ揃え"],
  "uk-rose": ["バラの宝庫", "8マス · 3つ揃え"],
  "uk-crown": ["王冠の霧", "14マス · 4つ揃え"],
  "fr-lily": ["百合の都", "5マス · 2つ揃え"],
  "fr-chateau": ["十三の城", "13マス · 4つ揃え"],
  "in-mandala": ["吉祥マンダラ", "9マス · 3つ揃え"],
  "in-gems": ["十八宝石宮", "18マス · 5つ揃え"],
  "mx-sun": ["太陽の祭り", "7マス · 3つ揃え"],
  "mx-fiesta": ["十五の旗", "15マス · 4つ揃え"],
  "eg-scarab": ["聖甲虫", "6マス · 3つ揃え"],
  "eg-nile": ["ナイル星盤", "20マス · 5つ揃え"]
};

const MODE_KO = {
  "cn-match": ["삼희임문", "6칸 · 같은 것 3개"],
  "cn-seat": ["번호 맞추기", "6칸 · 당첨 번호를 긁어 칸 상금"],
  "cn-seat12": ["번호 맞추기 · 강화", "12칸 · 당첨 번호를 긁어 칸 상금"],
  "cn-line": ["구궁 라인", "3×3 가로·세로·대각선"],
  "cn-ingot": ["원보 즉시", "금원보를 긁으면 그 칸 상금"],
  "cn-double": ["금조 배율", "3개 맞춘 뒤 배율"],
  "cn-score": ["영광 점수", "내 점수가 높으면 당첨"],
  "cn-map": ["부의 여행", "글자와 숫자를 긁어 칸으로"],
  "cn-walk": ["용사 길", "나온 칸만큼 걸어 상금"],
  "cn-sum": ["일곱의 합", "두 수의 합이 7이면 당첨"],
  "cn-zodiac": ["십이지 복", "9칸 · 복짐승 3개"],
  "jp-fortune": ["대길 제비", "6칸 · 오미쿠지 3개"],
  "jp-pair": ["쌍문 짝", "세 쌍 중 한 쌍이 같으면"],
  "jp-triangle": ["삼각 개운", "삼각형 한 변 3개"],
  "jp-maze": ["행운 미로", "화살표를 따라 상금"],
  "jp-moon": ["달맞이 상자", "9칸 · 달무늬 3개"],
  "us-route": ["럭키 하이웨이", "9칸 · 표지 3개"],
  "us-charm": ["편자 즉시", "편자를 긁으면 그 칸 상금"],
  "us-double": ["별빛 배율", "3개 맞춘 뒤 배율"],
  "us-key": ["금열쇠 길", "번호 또는 열쇠"],
  "us-bingo": ["성조 빙고", "추첨 번호 · 라인 / 모서리 / X"],
  "us-crossword": ["하이웨이 단어", "12글자로 단어 완성"],
  "us-dual": ["더블 빙고", "12개 추첨 · 3×3 두 장"],
  "us-jackpot": ["별빛 잭팟", "6칸 · 배지 3개"],
  "kr-bok": ["복주머니 화투", "6칸 · 복물 3개"],
  "kr-pair": ["복연 짝", "세 쌍 중 한 쌍"],
  "kr-bingo": ["화투 빙고", "추첨 번호 · 라인 / 모서리 / X"],
  "kr-moon": ["월궁 보물", "9칸 · 달토끼 3개"],
  "cn-pair": ["삼성보희", "3칸 · 아무 2개"],
  "cn-seven": ["칠보 여의", "7칸 · 3개"],
  "cn-twelve": ["십이금책", "12칸 · 4개"],
  "jp-four": ["사문 인연", "4칸 · 부적 2개"],
  "jp-ten": ["십경 그림", "10칸 · 3개"],
  "us-five": ["오성 행운", "5칸 · 2개"],
  "us-fifteen": ["15번 도로", "15칸 · 4개"],
  "us-twenty": ["스무 별 금고", "20칸 · 5개"],
  "kr-eight": ["팔방 복연", "8칸 · 3개"],
  "kr-sixteen": ["십육 채각", "16칸 · 4개"],
  "uk-rose": ["장미 보고", "8칸 · 3개"],
  "uk-crown": ["왕관 안개", "14칸 · 4개"],
  "fr-lily": ["백합 도시", "5칸 · 2개"],
  "fr-chateau": ["열세 성", "13칸 · 4개"],
  "in-mandala": ["길상 만다라", "9칸 · 3개"],
  "in-gems": ["열여덟 보석궁", "18칸 · 5개"],
  "mx-sun": ["태양 축제", "7칸 · 3개"],
  "mx-fiesta": ["열다섯 깃발", "15칸 · 4개"],
  "eg-scarab": ["성갑충", "6칸 · 3개"],
  "eg-nile": ["나일 성반", "20칸 · 5개"]
};

const ERRORS = {
  "本奖票已售罄，发行上限 10000 张": "soldOut",
  "奖票不对": "badTicket",
  "彩票号领取失败，请再试一次": "serialFail",
  "彩票号暂时发不出去": "serialFail",
  "请求失败": "requestFail",
  "账号或密码不对": "loginBad",
  "请重新登录": "reLogin",
  "需要游戏服务器才能发送邮箱验证码": "needServerCode",
  "需要游戏服务器才能完成邮箱注册": "needServerRegister",
  "账号需为 2–16 个字，可用中文、字母或数字": "nameRule",
  "密码需为 6–32 位": "passRule",
  "请填写正确的邮箱": "emailRule",
  "这个账号已经有人用了": "userTaken",
  "这个邮箱已经注册过了": "emailTaken",
  "验证码刚发过，请稍后再获取": "codeWait",
  "请填写 6 位邮箱验证码": "needSixCode",
  "请先获取邮箱验证码": "getCodeFirst",
  "请使用获取验证码时填写的账号": "sameUser",
  "请使用获取验证码时填写的密码": "samePass",
  "验证码已失效，请重新获取": "codeExpired",
  "验证码不对": "badCode",
  "这个账号或邮箱已经有人用了": "userOrEmailTaken",
  "请求格式不对": "badRequest",
  "不支持的请求": "unsupported",
  "找不到接口": "notFound",
  "账号服务暂时不可用": "accountDown"
};

function pick(row, loc) {
  if (!row) return "";
  if (typeof row === "string") return row;
  return row[loc] || row.en || row["zh-CN"] || "";
}

function fill(text, vars) {
  if (!vars) return text;
  return String(text).replace(/\{(\w+)\}/g, (_, key) => (vars[key] == null ? `{${key}}` : String(vars[key])));
}

export function g(key, vars) {
  const loc = getLocale();
  return fill(pick(UI[key], loc), vars);
}

export function countryLabel(name) {
  return pick(COUNTRIES[name], getLocale()) || name;
}

export function rarityLabel(name) {
  return pick(RARITY[name], getLocale()) || name;
}

export function tierLabel(label) {
  const loc = getLocale();
  if (TIER[label]) return pick(TIER[label], loc);
  const refund = String(label).match(/^返还 (\d+)$/);
  if (refund) return g("refund", { n: refund[1] });
  const times = String(label).match(/^(\d+) 倍$/);
  if (times) return g("times", { n: times[1] });
  return label;
}

export function modeCopy(mode) {
  if (!mode) return { title: "", subtitle: "", hint: "", country: "" };
  const loc = getLocale();
  const pack = loc === "zh-TW" ? MODE_TW : loc === "ja" ? MODE_JA : loc === "ko" ? MODE_KO : loc === "zh-CN" ? null : MODE_EN;
  const row = pack?.[mode.id];
  return {
    title: row?.[0] || mode.title,
    subtitle: row?.[1] || mode.subtitle,
    hint: row?.[1] && mode.hint ? row[1] : (mode.hint || row?.[1] || mode.subtitle),
    country: countryLabel(mode.country)
  };
}

export function displayMode(mode) {
  if (!mode) return mode;
  const copy = modeCopy(mode);
  return { ...mode, title: copy.title, subtitle: copy.subtitle, hint: copy.hint, country: copy.country };
}

export function localeFont() {
  const loc = getLocale();
  if (loc === "zh-TW") return `"Noto Sans TC", "Noto Sans SC", sans-serif`;
  if (loc === "ja") return `"Noto Sans JP", "Noto Sans SC", sans-serif`;
  if (loc === "ko") return `"Noto Sans KR", "Noto Sans SC", sans-serif`;
  if (loc === "zh-CN") return `"Noto Sans SC", sans-serif`;
  return `"Noto Sans", "Noto Sans SC", sans-serif`;
}

export function formatCoins(value) {
  const tag = TAGS[getLocale()] || "en";
  return Math.floor(Number(value) || 0).toLocaleString(tag);
}

export function gameError(message) {
  const key = ERRORS[String(message || "")];
  return key ? g(key) : (message || g("failRetry"));
}

export function mechanicText(modeOrKind) {
  const kind = typeof modeOrKind === "string" ? modeOrKind : modeOrKind?.kind;
  const name = typeof modeOrKind === "object" && modeOrKind?.luckyName ? modeOrKind.luckyName : g("luckyMark");
  return g(`mechanic_${kind}`, { name }) || g("oddsGeneric");
}

export function modeHelpText(mode) {
  const kind = mode?.kind || "match";
  const name = mode?.luckyName || g("luckyMark");
  const n = mode?.matchCount || 3;
  return g(`help_${kind}`, { name, n }) || g("help_match", { n });
}
