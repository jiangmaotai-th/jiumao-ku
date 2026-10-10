#!/usr/bin/env python3
"""Replace the store locale blocks from native, reviewed translations."""

from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
LOCALES = ROOT / "src/i18n/locales"

KEYS = """
metaTitle metaDescription navHome navAll heroTitle heroLead dailyBadge updatedAtLabel
browseAll browseTitle browseLead searchPlaceholder searchAria channelWeb channelDesktop
channelAppStore pending hot freeTier none noMatch globalWeb currentLowestRegion
viewProductDeals updatePrices updating priceUpdated updatingChannel noPriceChannel pickRegion
rank lowest lowestTag noPlanPrice noWebDesktop unifiedStripe premium cheap baseline equivalent
noPrice equivMonth equiv globalUnified globalLowest selectedRegion disclaimer loadingProduct
loadingHome categoryAll backToAll planStructure changeNote tableUpdated status buyChannel
channelAdvice allRegionsTop plan region listPrice relativeUs bill topNLowest priceHistory
noHistory needTwoDays samples appstoreRankHint billingMonthHint globalBenchmark usdParityNote
catChat catCoding catImage catVideo catAudio catWriting catResearch catDesign catEdu catHealth
catHardware billMonth billYear billWeek billQuarter billOther advicePreferAppStore adviceSimilar
adviceAppStoreOnly adviceWebOnly adviceWebPremium
""".split()

# Each locale is a complete native translation in the same order as KEYS.
STORE_TRANSLATIONS = {
    "ko": """
AI 구독 가격 찾기 · 구묘 라이브러리
언어에 맞는 현지 통화로 전 세계 AI 구독 정가를 비교합니다.
홈
모든 구독
AI 구독 가격 찾기
App Store, 웹, 데스크톱 채널의 주요 AI 구독 가격을 비교하고 가격 이력을 추적하세요.
(매일 업데이트)
업데이트
모든 AI 보기
모든 AI 구독
카테고리로 필터링하고 한국어·영어 이름으로 검색하세요.
ChatGPT, Claude, Cursor 검색…
AI 제품 검색
웹
데스크톱
App Store
출시 예정
인기
무료 요금제
해당 없음
일치하는 제품이 없습니다
전 세계 웹 가격
현재 최저가 지역
모든 저가 보기
가격 새로고침
새로고침 중…
가격이 업데이트되었습니다
이 채널 가격을 새로고침하는 중…
이 채널의 정가가 아직 없습니다. 나중에 다시 시도하세요
국가 / 지역 선택
#{n}위
현재 최저
최저
이 채널에 요금제 가격이 없습니다
웹/데스크톱 가격이 아직 없습니다. 새로고침을 눌러 다시 시도하세요
전 세계 통일 가격 (Stripe / 공식 사이트)
프리미엄
더 저렴함
기준
동일
가격 없음
예상 월간 ({currency})
{currency} 기준
전 세계 통일가
전 세계 최저가
선택한 지역
공개 정가를 언어에 맞는 통화로 환산한 참고 정보이며, 공식 플랫폼 서비스가 아닙니다. 저가는 보통 앱 내 구매에 적용되며 실제 청구는 계정 지역을 따릅니다.
제품 불러오는 중…
불러오는 중…
전체
← 모든 AI로 돌아가기
요금제 구성
변경 사항
표 업데이트
상태
구매 채널
추천 채널
모든 지역 (최저가 상위 10개)
요금제
지역
스토어 가격
미국 대비
청구
최저가 상위 {n}개
가격 이력
아직 이력이 없습니다 (가격을 새로고침하면 기록됩니다)
현재 {n}개 샘플 ({date} · {price}); 차트에는 최소 2일이 필요합니다
{label} · 최근 {n}일 샘플
App Store 지역별 앱 내 구매 가격을 {currency} 기준 낮은 순으로 정렬했습니다. #1이 최저가입니다.
{period} 결제 기준 예상 월 가격으로 정렬했습니다 (스토어 정가는 월간 요금제와 같아도 결제 주기는 다를 수 있습니다).
전 세계 기준가
전 세계 USD 가격과 동일 (지역 스토어 할인 아님)
채팅 / LLM
코딩 / 개발
이미지 생성
영상 생성
음악 / 오디오
글쓰기 / 오피스
검색 / 리서치
디자인 / 기타
교육
라이프스타일 / 건강
AI 하드웨어
월간
연간
주간
분기
기타
절약하려면 App Store 앱 내 구매를 이용하세요. 최저가는 약 {appPrice} ({flag} {region})로, 전 세계 웹 가격 {webPrice}보다 약 {save}% 낮습니다.
App Store 최저가는 약 {appPrice}, 전 세계 웹 가격은 약 {webPrice}로 서로 비슷합니다.
App Store 저가 지역은 약 {appPrice} ({flag} {region})입니다.
웹/데스크톱은 대부분 {webPrice} ({listPrice}) 정도의 전 세계 통일가이며 App Store식 저가 지역이 없습니다.
⚠ {flag} {region}의 현지 웹 가격 {listPrice} (≈{equiv})는 미국 기준가보다 높습니다. 웹 구독 할인 지역으로 선택하지 마세요.
""",
    "fr": """
Comparateur de prix d’abonnements IA · Jiumao Library
Comparez les tarifs publics des abonnements IA mondiaux dans la devise correspondant à votre langue.
Accueil
Tous les abonnements
Comparateur de prix d’abonnements IA
Comparez les principaux abonnements IA sur l’App Store, le web et les applications de bureau, et suivez l’historique des prix.
(mis à jour chaque jour)
Mis à jour
Voir toutes les IA
Tous les abonnements IA
Filtrez par catégorie et recherchez par nom français ou anglais.
Rechercher ChatGPT, Claude, Cursor…
Rechercher des produits IA
En ligne
Bureau
App Store
Bientôt disponible
Populaire
Offre gratuite
S/O
Aucun produit correspondant
Prix web mondial
Région la moins chère actuellement
Voir tous les prix bas
Actualiser les prix
Actualisation…
Prix mis à jour
Actualisation de ce canal…
Pas encore de prix public pour ce canal ; réessayez plus tard
Choisir un pays / une région
Rang n°{n}
Le plus bas actuellement
Le plus bas
Pas de prix d’offre pour ce canal
Pas encore de prix web/de bureau ; actualisez pour réessayer
Prix mondial unique (Stripe / site officiel)
Plus cher
Moins cher
Référence
Identique
Aucun prix
Mensuel estimé ({currency})
En {currency}
Prix mondial unique
Plus bas mondial
Région sélectionnée
Tarifs publics convertis dans la devise de votre langue, à titre indicatif uniquement ; il ne s’agit pas de services officiels des plateformes. Les prix bas s’appliquent généralement aux achats intégrés ; la facturation dépend de la région de votre compte.
Chargement du produit…
Chargement…
Tous
← Retour à toutes les IA
Structure de l’offre
Notes de modification
Tableau mis à jour
Statut
Canal d’achat
Quel canal choisir
Toutes les régions (10 moins chères)
Offre
Région
Prix en vitrine
par rapport aux États-Unis
Facturation
Les {n} moins chers
Historique des prix
Pas encore d’historique (enregistré après actualisation des prix)
{n} échantillon(s) pour l’instant ({date} · {price}) ; au moins 2 jours sont nécessaires pour un graphique
{label} · {n} derniers jours échantillonnés
Prix régionaux IAP de l’App Store, classés du moins cher au plus cher en {currency} ; le n°1 est le moins cher.
Classé par prix mensuel estimé pour une facturation {period} (le prix affiché peut correspondre au forfait mensuel alors que le cycle diffère).
Référence mondiale
Identique au prix mondial en USD (pas une offre régionale)
Conversation / LLM
Code / développement
Génération d’images
Génération de vidéos
Musique / audio
Rédaction / bureautique
Recherche / études
Design / autres
Éducation
Style de vie / santé
Matériel IA
Mensuel
Annuel
Hebdomadaire
Trimestriel
Autre
Pour économiser, utilisez les achats intégrés App Store : le plus bas est d’environ {appPrice} ({flag} {region}), soit environ {save}% de moins que le prix web mondial de {webPrice}.
Le plus bas sur l’App Store est d’environ {appPrice} ; le web mondial est d’environ {webPrice} : ils sont proches.
La région App Store la moins chère est à environ {appPrice} ({flag} {region}).
Le web/bureau propose surtout un prix mondial unique autour de {webPrice} ({listPrice}), sans régions à bas prix comme l’App Store.
⚠ Le prix web local en {flag} {region}, {listPrice} (≈{equiv}), dépasse la référence américaine ; évitez cette région pour un abonnement web en quête d’économies.
""",
    "de": """
KI-Abo-Preisfinder · Jiumao Library
Vergleichen Sie weltweite Listenpreise für KI-Abonnements in der Währung Ihrer Sprache.
Startseite
Alle Abonnements
KI-Abo-Preisfinder
Vergleichen Sie wichtige KI-Abonnements über App Store, Web und Desktop und verfolgen Sie den Preisverlauf.
(täglich aktualisiert)
Aktualisiert
Alle KIs anzeigen
Alle KI-Abonnements
Nach Kategorie filtern; deutsche oder englische Namen suchen.
ChatGPT, Claude, Cursor suchen…
KI-Produkte suchen
En ligne
Ordinateur
App Store
Demnächst
Beliebt
Kostenlose Stufe
K. A.
Keine passenden Produkte
Globaler Webpreis
Derzeit günstigste Region
Alle günstigen Preise ansehen
Preise aktualisieren
Aktualisierung…
Preise aktualisiert
Dieser Kanal wird aktualisiert…
Für diesen Kanal gibt es noch keinen Listenpreis – später erneut versuchen
Land / Region auswählen
Rang #{n}
Derzeit am günstigsten
Am günstigsten
Kein Tarifpreis für diesen Kanal
Noch kein Web-/Desktoppreis – zum Wiederholen auf „Preise aktualisieren“ klicken
Globaler Einheitspreis (Stripe / offizielle Website)
Teurer
Günstiger
Referenz
Gleich
Keine Preise
Geschätzt monatlich ({currency})
Betrag in {currency}
Global einheitlich
Global am günstigsten
Ausgewählte Region
Öffentliche Listenpreise werden nur zur Orientierung in die Währung Ihrer Sprache umgerechnet und sind keine offiziellen Plattformdienste. Niedrige Preise gelten meist für In-App-Käufe; die Abrechnung richtet sich nach Ihrer Kontoregion.
Produkt wird geladen…
Lädt…
Alle
← Zurück zu allen KIs
Tarifstruktur
Änderungshinweise
Tabelle aktualisiert
Zustand
Kaufkanal
Welchen Kanal nutzen
Alle Regionen (10 günstigste)
Tarif
Gebiet
Shoppreis
gegenüber den USA
Abrechnung
Top {n} günstigste
Preisverlauf
Noch kein Verlauf (wird nach dem Aktualisieren der Preise erfasst)
Bisher {n} Messwert(e) ({date} · {price}); für ein Diagramm sind mindestens 2 Tage nötig
{label} · letzte {n} Messtage
Regionale App-Store-IAP-Preise, nach {currency} aufsteigend sortiert; Platz 1 ist der günstigste.
Sortiert nach geschätztem Monatspreis bei {period}-Abrechnung (der Shoppreis kann dem Monatstarif entsprechen, obwohl der Abrechnungszyklus abweicht).
Globale Referenz
Gleich wie der globale USD-Preis (kein regionales Shop-Angebot)
Unterhaltung / LLM
Programmierung / Entwicklung
Bildgenerierung
Videogenerierung
Musik / Audio
Schreiben / Büro
Suche / Recherche
Design / Sonstiges
Bildung
Lifestyle / Gesundheit
KI-Hardware
Monatlich
Jährlich
Wöchentlich
Vierteljährlich
Sonstiges
Zum Sparen App-Store-In-App-Käufe nutzen: Der niedrigste Preis beträgt etwa {appPrice} ({flag} {region}) und liegt rund {save}% unter dem globalen Webpreis von {webPrice}.
Der niedrigste App-Store-Preis liegt bei etwa {appPrice}; global im Web sind es etwa {webPrice} – die Preise liegen nah beieinander.
Die günstige App-Store-Region liegt bei etwa {appPrice} ({flag} {region}).
Web/Desktop hat meist einen globalen Einheitspreis von etwa {webPrice} ({listPrice}) und keine Schnäppchenregionen wie der App Store.
⚠ Der lokale Webpreis in {flag} {region}, {listPrice} (≈{equiv}), liegt über der US-Referenz – diese Region ist für günstige Web-Abos ungeeignet.
""",
    "es": """
Buscador de precios de suscripciones de IA · Jiumao Library
Compara los precios de lista mundiales de suscripciones de IA en la moneda de tu idioma.
Inicio
Todas las suscripciones
Buscador de precios de suscripciones de IA
Compara las principales suscripciones de IA en App Store, web y escritorio, y consulta su historial de precios.
(actualizado a diario)
Actualizado
Ver todas las IA
Todas las suscripciones de IA
Filtra por categoría; busca por nombres en español o inglés.
Buscar ChatGPT, Claude, Cursor…
Buscar productos de IA
En línea
Escritorio
App Store
Próximamente
Destacado
Plan gratuito
N/D
No hay productos coincidentes
Precio web global
Región más barata ahora
Ver todos los precios bajos
Actualizar precios
Actualizando…
Precios actualizados
Actualizando este canal…
Todavía no hay precio de lista para este canal; inténtalo más tarde
Elegir país / región
Puesto #{n}
Más bajo ahora
Más bajo
No hay precio de plan para este canal
Todavía no hay precio web/de escritorio; pulsa Actualizar precios para reintentar
Precio global unificado (Stripe / sitio oficial)
Más caro
Más barato
Referencia
Igual
Sin precios
Mensual estimado ({currency})
En {currency}
Global unificado
Mínimo global
Región seleccionada
Precios de lista públicos convertidos a la moneda de tu idioma solo como referencia; no son servicios oficiales de las plataformas. Los precios bajos suelen aplicarse a compras dentro de la app; el cobro depende de la región de tu cuenta.
Cargando producto…
Cargando…
Todo
← Volver a todas las IA
Estructura del plan
Notas de cambios
Tabla actualizada
Estado
Canal de compra
Qué canal usar
Todas las regiones (10 más baratas)
Tarifa
Región
Precio de tienda
frente a EE. UU.
Facturación
Las {n} más baratas
Historial de precios
Sin historial aún (se registra después de actualizar los precios)
{n} muestra(s) hasta ahora ({date} · {price}); se necesitan al menos 2 días para un gráfico
{label} · últimos {n} días de muestras
Precios regionales de compras integradas de App Store, ordenados de menor a mayor en {currency}; el n.º 1 es el más bajo.
Ordenado por precio mensual estimado para facturación {period} (el precio de tienda puede coincidir con el plan mensual aunque el ciclo sea distinto).
Referencia global
Igual que el precio global en USD (no es una oferta regional)
Conversación / LLM
Programación / desarrollo
Generación de imágenes
Generación de vídeo
Música / audio
Redacción / oficina
Búsqueda / investigación
Diseño / otros
Educación
Estilo de vida / salud
Hardware de IA
Mensual
Anual
Semanal
Trimestral
Otro
Para ahorrar, usa compras integradas de App Store: el precio más bajo es de unos {appPrice} ({flag} {region}), aproximadamente un {save}% menos que el precio web global de {webPrice}.
El mínimo de App Store es de unos {appPrice}; el web global es de unos {webPrice}: son parecidos.
La región barata de App Store cuesta unos {appPrice} ({flag} {region}).
La web/el escritorio suele tener un precio global unificado de unos {webPrice} ({listPrice}), sin regiones de ganga como App Store.
⚠ El precio web local de {flag} {region}, {listPrice} (≈{equiv}), es mayor que la referencia de EE. UU.; evita esa región para suscripciones web si buscas ahorrar.
""",
    "pt": """
Localizador de preços de assinaturas de IA · Jiumao Library
Compare preços de tabela globais de assinaturas de IA na moeda correspondente ao seu idioma.
Início
Todas as assinaturas
Localizador de preços de assinaturas de IA
Compare as principais assinaturas de IA na App Store, web e desktop e acompanhe o histórico de preços.
(atualizado diariamente)
Atualizado
Ver todas as IAs
Todas as assinaturas de IA
Filtre por categoria; pesquise por nomes em português ou inglês.
Pesquisar ChatGPT, Claude, Cursor…
Pesquisar produtos de IA
Online
Computador
App Store
Em breve
Em destaque
Plano gratuito
N/D
Nenhum produto correspondente
Preço global na web
Região mais barata agora
Ver todos os preços baixos
Atualizar preços
Atualizando…
Preços atualizados
Atualizando este canal…
Ainda não há preço de tabela para este canal; tente novamente mais tarde
Escolher país / região
Posição #{n}
Mais barato agora
Mais barato
Não há preço de plano para este canal
Ainda não há preço web/desktop; toque em Atualizar preços para tentar novamente
Preço global unificado (Stripe / site oficial)
Mais caro
Mais barato
Referência
Igual
Sem preços
Mensal estimado ({currency})
Em {currency}
Global unificado
Menor preço global
Região selecionada
Preços de tabela públicos convertidos para a moeda do seu idioma apenas como referência; não são serviços oficiais das plataformas. Preços baixos geralmente se aplicam a compras no app; a cobrança segue a região da sua conta.
Carregando produto…
Carregando…
Todos
← Voltar a todas as IAs
Estrutura do plano
Notas de alterações
Tabela atualizada
Situação
Canal de compra
Qual canal usar
Todas as regiões (10 mais baratas)
Plano
Região
Preço da loja
vs. EUA
Cobrança
As {n} mais baratas
Histórico de preços
Ainda sem histórico (registrado após atualizar os preços)
{n} amostra(s) até agora ({date} · {price}); são necessários pelo menos 2 dias para um gráfico
{label} · últimos {n} dias de amostras
Preços regionais de compras no app da App Store, em ordem crescente em {currency}; o nº 1 é o menor.
Ordenado pelo preço mensal estimado na cobrança {period} (o preço da loja pode corresponder ao plano mensal, embora o ciclo seja diferente).
Referência global
Igual ao preço global em USD (não é uma oferta regional)
Conversa / LLM
Programação / desenvolvimento
Geração de imagens
Geração de vídeo
Música / áudio
Escrita / escritório
Busca / pesquisa
Design / outros
Educação
Estilo de vida / saúde
Hardware de IA
Mensal
Anual
Semanal
Trimestral
Outro
Para economizar, use compras no app da App Store: o menor preço é cerca de {appPrice} ({flag} {region}), aproximadamente {save}% abaixo do preço global na web de {webPrice}.
O menor preço na App Store é cerca de {appPrice}; na web global é cerca de {webPrice} — são próximos.
A região barata da App Store custa cerca de {appPrice} ({flag} {region}).
Web/desktop geralmente tem preço global unificado de cerca de {webPrice} ({listPrice}), sem regiões de pechincha como na App Store.
⚠ O preço web local de {flag} {region}, {listPrice} (≈{equiv}), é maior que a referência dos EUA; evite essa região para uma assinatura web buscando economia.
""",
    "ru": """
Поиск цен на ИИ-подписки · Jiumao Library
Сравнивайте мировые публичные цены на ИИ-подписки в валюте вашего языка.
Главная
Все подписки
Поиск цен на ИИ-подписки
Сравнивайте основные ИИ-подписки в App Store, вебе и на компьютере, а также отслеживайте историю цен.
(обновляется ежедневно)
Обновлено
Все ИИ
Все ИИ-подписки
Фильтруйте по категориям и ищите по русским или английским названиям.
Поиск ChatGPT, Claude, Cursor…
Поиск ИИ-продуктов
Веб
Компьютер
App Store
Скоро
Популярное
Бесплатный тариф
Н/Д
Нет подходящих продуктов
Мировая веб-цена
Самый дешёвый регион сейчас
Все низкие цены
Обновить цены
Обновление…
Цены обновлены
Обновление этого канала…
Для этого канала пока нет публичной цены; повторите позже
Выберите страну / регион
Место #{n}
Минимум сейчас
Минимум
Нет цены тарифа для этого канала
Цены для веба/компьютера пока нет — нажмите «Обновить цены», чтобы повторить
Единая мировая цена (Stripe / официальный сайт)
Дороже
Дешевле
Базовая
Одинаково
Нет цен
Расчётно в месяц ({currency})
В {currency}
Единая мировая
Мировой минимум
Выбранный регион
Публичные цены пересчитаны в валюту вашего языка только для справки; это не официальные сервисы платформ. Низкие цены обычно относятся к покупкам в приложении; списание зависит от региона учётной записи.
Загрузка продукта…
Загрузка…
Все
← Ко всем ИИ
Структура тарифа
Примечания к изменениям
Таблица обновлена
Статус
Канал покупки
Какой канал выбрать
Все регионы (10 самых дешёвых)
Тариф
Регион
Цена в магазине
по сравнению с США
Счёт
Топ-{n} самых дешёвых
История цен
Истории пока нет (записывается после обновления цен)
Пока {n} образец(ов) ({date} · {price}); для графика нужно не менее 2 дней
{label} · последние {n} дней с образцами
Региональные цены встроенных покупок App Store, отсортированные по возрастанию в {currency}; №1 — самая низкая.
Сортировка по расчётной месячной цене при оплате за {period} (цена в магазине может совпадать с месячным тарифом при другом цикле).
Мировой ориентир
Совпадает с мировой ценой в USD (не региональное предложение магазина)
Чат / LLM
Кодинг / разработка
Генерация изображений
Генерация видео
Музыка / аудио
Тексты / офис
Поиск / исследования
Дизайн / другое
Образование
Образ жизни / здоровье
ИИ-оборудование
Ежемесячно
Ежегодно
Еженедельно
Ежеквартально
Другое
Чтобы сэкономить, используйте покупки в приложении App Store: минимум около {appPrice} ({flag} {region}), примерно на {save}% ниже мировой веб-цены {webPrice}.
Минимум в App Store — около {appPrice}; мировая веб-цена — около {webPrice}: они близки.
Дешёвый регион App Store — около {appPrice} ({flag} {region}).
Веб/компьютер обычно имеют единую мировую цену около {webPrice} ({listPrice}), без выгодных регионов, как в App Store.
⚠ Локальная веб-цена в {flag} {region}, {listPrice} (≈{equiv}), выше ориентира США — не выбирайте этот регион для выгодной веб-подписки.
""",
    "th": """
ตัวค้นหาราคาสมาชิก AI · Jiumao Library
เปรียบเทียบราคาปลีกสมาชิก AI ทั่วโลกในสกุลเงินตามภาษาของคุณ
หน้าแรก
สมาชิกทั้งหมด
ตัวค้นหาราคาสมาชิก AI
เปรียบเทียบสมาชิก AI หลักผ่าน App Store เว็บ และเดสก์ท็อป พร้อมติดตามประวัติราคา
(อัปเดตทุกวัน)
อัปเดตแล้ว
ดู AI ทั้งหมด
สมาชิก AI ทั้งหมด
กรองตามหมวดหมู่ และค้นหาด้วยชื่อไทยหรืออังกฤษ
ค้นหา ChatGPT, Claude, Cursor…
ค้นหาผลิตภัณฑ์ AI
เว็บ
เดสก์ท็อป
App Store
เร็ว ๆ นี้
ยอดนิยม
ระดับฟรี
ไม่มีข้อมูล
ไม่พบผลิตภัณฑ์ที่ตรงกัน
ราคาเว็บทั่วโลก
ภูมิภาคที่ถูกที่สุดตอนนี้
ดูราคาต่ำทั้งหมด
รีเฟรชราคา
กำลังรีเฟรช…
อัปเดตราคาแล้ว
กำลังรีเฟรชช่องทางนี้…
ยังไม่มีราคาปลีกสำหรับช่องทางนี้ ลองใหม่ภายหลัง
เลือกประเทศ / ภูมิภาค
อันดับ #{n}
ถูกที่สุดตอนนี้
ต่ำสุด
ไม่มีราคาแพ็กเกจสำหรับช่องทางนี้
ยังไม่มีราคาเว็บ/เดสก์ท็อป กดรีเฟรชราคาเพื่อลองอีกครั้ง
ราคาเดียวทั่วโลก (Stripe / เว็บไซต์ทางการ)
สูงกว่า
ถูกกว่า
ราคาอ้างอิง
เท่ากัน
ไม่มีราคา
ประมาณการรายเดือน ({currency})
ใน {currency}
ราคาเดียวทั่วโลก
ต่ำสุดทั่วโลก
ภูมิภาคที่เลือก
ราคาปลีกสาธารณะแปลงเป็นสกุลเงินตามภาษาของคุณเพื่อการอ้างอิงเท่านั้น ไม่ใช่บริการทางการของแพลตฟอร์ม ราคาต่ำมักใช้กับการซื้อในแอป และการเรียกเก็บเงินขึ้นกับภูมิภาคบัญชีของคุณ
กำลังโหลดผลิตภัณฑ์…
กำลังโหลด…
ทั้งหมด
← กลับไปยัง AI ทั้งหมด
โครงสร้างแพ็กเกจ
หมายเหตุการเปลี่ยนแปลง
อัปเดตตารางแล้ว
สถานะ
ช่องทางซื้อ
ควรใช้ช่องทางใด
ทุกภูมิภาค (10 อันดับถูกที่สุด)
แพ็กเกจ
ภูมิภาค
ราคาหน้าร้าน
เทียบกับสหรัฐฯ
การเรียกเก็บเงิน
ต่ำสุด {n} อันดับ
ประวัติราคา
ยังไม่มีประวัติ (จะบันทึกหลังรีเฟรชราคา)
ขณะนี้มีตัวอย่าง {n} รายการ ({date} · {price}); ต้องมีอย่างน้อย 2 วันจึงจะแสดงกราฟได้
{label} · ตัวอย่างใน {n} วันล่าสุด
ราคาระดับภูมิภาคสำหรับการซื้อในแอปของ App Store เรียงจากต่ำไปสูงใน {currency}; อันดับ 1 ต่ำสุด
เรียงตามราคารายเดือนโดยประมาณสำหรับรอบบิล {period} (ราคาหน้าร้านอาจเท่ากับรายเดือนแม้รอบบิลต่างกัน)
เกณฑ์อ้างอิงทั่วโลก
เท่ากับราคา USD ทั่วโลก (ไม่ใช่ข้อเสนอภูมิภาค)
แชต / LLM
เขียนโค้ด / พัฒนา
สร้างภาพ
สร้างวิดีโอ
เพลง / เสียง
การเขียน / สำนักงาน
ค้นหา / วิจัย
ออกแบบ / อื่น ๆ
การศึกษา
ไลฟ์สไตล์ / สุขภาพ
ฮาร์ดแวร์ AI
รายเดือน
รายปี
รายสัปดาห์
รายไตรมาส
อื่น ๆ
หากต้องการประหยัด ให้ใช้การซื้อในแอปผ่าน App Store: ราคาต่ำสุดราว {appPrice} ({flag} {region}) ต่ำกว่าราคาเว็บทั่วโลก {webPrice} ราว {save}%.
ราคาต่ำสุดบน App Store ราว {appPrice}; เว็บทั่วโลกราว {webPrice} ซึ่งใกล้เคียงกัน
ภูมิภาคราคาต่ำของ App Store อยู่ที่ราว {appPrice} ({flag} {region})
เว็บ/เดสก์ท็อปส่วนใหญ่ใช้ราคาเดียวทั่วโลกราว {webPrice} ({listPrice}) ไม่มีภูมิภาคลดราคามากแบบ App Store
⚠ ราคาเว็บท้องถิ่นใน {flag} {region} คือ {listPrice} (≈{equiv}) สูงกว่าเกณฑ์สหรัฐฯ อย่าเลือกภูมิภาคนี้เพื่อหวังส่วนลดสมาชิกเว็บ
""",
    "hi": """
AI सदस्यता मूल्य खोजक · Jiumao Library
अपनी भाषा की स्थानीय मुद्रा में वैश्विक AI सदस्यताओं के सूची मूल्य की तुलना करें।
होम
सभी सदस्यताएँ
AI सदस्यता मूल्य खोजक
App Store, वेब और डेस्कटॉप चैनलों पर प्रमुख AI सदस्यताओं की तुलना करें और मूल्य इतिहास देखें।
(प्रतिदिन अपडेट)
अपडेट किया गया
सभी AI देखें
सभी AI सदस्यताएँ
श्रेणी के अनुसार फ़िल्टर करें; हिंदी या अंग्रेज़ी नाम खोजें।
ChatGPT, Claude, Cursor खोजें…
AI उत्पाद खोजें
वेब
डेस्कटॉप
App Store
जल्द आ रहा है
लोकप्रिय
मुफ़्त स्तर
लागू नहीं
कोई मेल खाता उत्पाद नहीं
वैश्विक वेब मूल्य
अभी सबसे सस्ता क्षेत्र
सभी कम कीमतें देखें
मूल्य रीफ़्रेश करें
रीफ़्रेश हो रहा है…
मूल्य अपडेट हो गए
इस चैनल को रीफ़्रेश किया जा रहा है…
इस चैनल के लिए अभी कोई सूची मूल्य नहीं है; बाद में फिर कोशिश करें
देश / क्षेत्र चुनें
रैंक #{n}
अभी सबसे कम
सबसे कम
इस चैनल के लिए कोई प्लान मूल्य नहीं
अभी कोई वेब/डेस्कटॉप मूल्य नहीं; फिर कोशिश के लिए मूल्य रीफ़्रेश करें
वैश्विक एकसमान मूल्य (Stripe / आधिकारिक साइट)
अधिक
कम
आधार
समान
कोई मूल्य नहीं
अनुमानित मासिक ({currency})
{currency} में
वैश्विक एकसमान
वैश्विक न्यूनतम
चयनित क्षेत्र
सार्वजनिक सूची मूल्य केवल संदर्भ के लिए आपकी भाषा की मुद्रा में बदले गए हैं; ये आधिकारिक प्लेटफ़ॉर्म सेवाएँ नहीं हैं। कम कीमतें आमतौर पर इन-ऐप खरीद पर लागू होती हैं; शुल्क आपके खाते के क्षेत्र के अनुसार लगता है।
उत्पाद लोड हो रहा है…
लोड हो रहा है…
सभी
← सभी AI पर वापस जाएँ
प्लान संरचना
बदलाव नोट
तालिका अपडेट की गई
स्थिति
खरीद चैनल
कौन-सा चैनल इस्तेमाल करें
सभी क्षेत्र (सबसे कम 10)
प्लान
क्षेत्र
स्टोर मूल्य
अमेरिका की तुलना में
बिल
सबसे कम {n}
मूल्य इतिहास
अभी कोई इतिहास नहीं (मूल्य रीफ़्रेश करने के बाद दर्ज होगा)
अब तक {n} नमूना ({date} · {price}); चार्ट के लिए कम से कम 2 दिन चाहिए
{label} · पिछले {n} नमूना दिन
App Store के क्षेत्रीय इन-ऐप खरीद मूल्य {currency} में कम से अधिक क्रम में हैं; #1 सबसे कम है।
{period} बिलिंग के अनुमानित मासिक मूल्य के अनुसार क्रमित (स्टोर मूल्य मासिक स्तर जैसा हो सकता है, जबकि बिलिंग चक्र अलग हो)।
वैश्विक आधार
वैश्विक USD मूल्य के समान (कोई क्षेत्रीय स्टोर ऑफ़र नहीं)
चैट / LLM
कोडिंग / विकास
छवि निर्माण
वीडियो निर्माण
संगीत / ऑडियो
लेखन / कार्यालय
खोज / शोध
डिज़ाइन / अन्य
शिक्षा
जीवनशैली / स्वास्थ्य
AI हार्डवेयर
मासिक
वार्षिक
साप्ताहिक
त्रैमासिक
अन्य
बचत के लिए App Store इन-ऐप खरीदें: सबसे कम मूल्य लगभग {appPrice} ({flag} {region}) है, जो वैश्विक वेब मूल्य {webPrice} से लगभग {save}% कम है।
App Store का न्यूनतम मूल्य लगभग {appPrice} है; वैश्विक वेब मूल्य लगभग {webPrice} है—दोनों करीब हैं।
App Store का कम कीमत वाला क्षेत्र लगभग {appPrice} ({flag} {region}) है।
वेब/डेस्कटॉप में प्रायः लगभग {webPrice} ({listPrice}) का वैश्विक एकसमान मूल्य होता है; App Store जैसे सस्ते क्षेत्र नहीं होते।
⚠ {flag} {region} का स्थानीय वेब मूल्य {listPrice} (≈{equiv}) अमेरिकी आधार से अधिक है; सस्ती वेब सदस्यता के लिए यह क्षेत्र न चुनें।
""",
}


def extract_store_block(source: str) -> tuple[int, int]:
    match = re.search(r"^  store: \{", source, re.MULTILINE)
    if not match:
        raise ValueError("store block not found")
    depth = 0
    quote: str | None = None
    escaped = False
    for index in range(match.start(), len(source)):
        char = source[index]
        if quote:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == quote:
                quote = None
            continue
        if char in ("'", '"', "`"):
            quote = char
        elif char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                if source[index + 1 : index + 3] != ",\n":
                    raise ValueError("store block has unexpected terminator")
                return match.start(), index + 3
    raise ValueError("unterminated store block")


def placeholders(value: str) -> set[str]:
    return set(re.findall(r"\{[^{}]+\}", value))


def make_block(values: list[str]) -> str:
    if len(values) != len(KEYS):
        raise ValueError(f"expected {len(KEYS)} values, got {len(values)}")
    lines = ["  store: {"]
    for key, value in zip(KEYS, values):
        escaped = value.replace("\\", "\\\\").replace("'", "\\'")
        lines.append(f"    {key}: '{escaped}',")
    lines.append("  },")
    return "\n".join(lines) + "\n"


def main() -> None:
    en_source = (LOCALES / "en.ts").read_text()
    en_start, en_end = extract_store_block(en_source)
    en_values = dict(re.findall(r"^    (\w+): '([^']*)',$", en_source[en_start:en_end], re.MULTILINE))

    for locale, text in STORE_TRANSLATIONS.items():
        values = [line for line in text.strip().splitlines()]
        if len(values) != len(KEYS):
            raise ValueError(f"{locale}: expected {len(KEYS)} values, got {len(values)}")
        translation = dict(zip(KEYS, values))
        for key in KEYS:
            if placeholders(translation[key]) != placeholders(en_values[key]):
                raise ValueError(f"{locale}.{key}: placeholder mismatch")
        path = LOCALES / f"{locale}.ts"
        source = path.read_text()
        start, end = extract_store_block(source)
        path.write_text(source[:start] + make_block(values) + source[end:])
        print(f"updated {path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
