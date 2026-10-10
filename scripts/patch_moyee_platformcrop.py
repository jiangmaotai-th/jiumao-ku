#!/usr/bin/env python3
"""Replace moyee (...moyeeFallback) with full localized objects; polish platformCrop.

Locales: fr, de, es, pt, ru, th, hi
Source structure/keys: en.ts (meaning also from zh-CN)
Does not touch store/markdown blocks.
"""
from __future__ import annotations

import json
import re
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LOCALE_DIR = ROOT / "src" / "i18n" / "locales"
CACHE_PATH = ROOT / "scripts" / ".moyee_platformcrop_cache.json"
LOCALES = ("fr", "de", "es", "pt", "ru", "th", "hi")

# Strings that should remain identical across locales (brands / tech tokens / ratios)
KEEP_AS_IS = {
    "GIF",
    "YouTube",
    "YouTube Shorts",
    "YouTube 1080p",
    "YouTube 4K",
    "TikTok",
    "Instagram Reels",
    "Instagram Reel",
    "Instagram Story",
    "Instagram Feed",
    "Instagram Square",
    "LinkedIn",
    "Pinterest",
    "Facebook Reels",
    "X",
    "16:9",
    "9:16",
    "1:1",
    "4:5",
    "3:4",
    "1080p",
    "720p",
    "480p",
    "360p",
    "240p",
    "4K · 2160p",
    "MP3 / M4A / WAV / FLAC / OGG",
}


def ts_escape(s: str) -> str:
    return s.replace("\\", "\\\\").replace("'", "\\'")


def extract_section(text: str, name: str) -> tuple[int, int, str]:
    m = re.search(rf"\n  {name}: \{{", text)
    if not m:
        raise RuntimeError(f"section {name} not found")
    start = m.start() + 1  # at '  name'
    brace_start = m.end() - 1
    depth = 0
    end = None
    for i, ch in enumerate(text[brace_start:], brace_start):
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                j = i + 1
                if j < len(text) and text[j] == ",":
                    j += 1
                end = j
                break
    if end is None:
        raise RuntimeError(f"unclosed {name}")
    return start, end, text[start:end]


def parse_ts_object(src: str) -> dict:
    """Parse a TS object literal into nested dict/list of strings (single-quoted)."""
    # strip leading "name: {" and trailing "},"
    src = src.strip()
    if not src.endswith(","):
        body = src
    else:
        body = src
    # find first {
    i = body.index("{")
    j = body.rfind("}")
    inner = body[i + 1 : j]
    return _parse_props(inner)


def _parse_props(inner: str) -> dict:
    result: dict = {}
    pos = 0
    n = len(inner)
    while pos < n:
        while pos < n and inner[pos] in " \t\n\r,":
            pos += 1
        if pos >= n:
            break
        # skip spreads
        if inner.startswith("...", pos):
            # skip until comma or newline-ish end of spread
            m = re.match(r"\.\.\.[A-Za-z0-9_]+,?", inner[pos:])
            if not m:
                raise RuntimeError(f"bad spread at {pos}")
            pos += m.end()
            continue
        # key
        km = re.match(r"(?:'([^']+)'|([A-Za-z_][\w]*))\s*:", inner[pos:])
        if not km:
            raise RuntimeError(f"bad key near: {inner[pos:pos+40]!r}")
        key = km.group(1) or km.group(2)
        pos += km.end()
        while pos < n and inner[pos] in " \t\n\r":
            pos += 1
        if pos >= n:
            break
        if inner[pos] == "'":
            # string
            pos += 1
            buf = []
            while pos < n:
                ch = inner[pos]
                if ch == "\\":
                    buf.append(inner[pos : pos + 2])
                    pos += 2
                    continue
                if ch == "'":
                    pos += 1
                    break
                buf.append(ch)
                pos += 1
            raw = "".join(buf).replace("\\'", "'").replace("\\\\", "\\")
            result[key] = raw
        elif inner[pos] == "[":
            # string array
            depth = 0
            start = pos
            while pos < n:
                ch = inner[pos]
                if ch == "[":
                    depth += 1
                elif ch == "]":
                    depth -= 1
                    if depth == 0:
                        pos += 1
                        break
                pos += 1
            arr_src = inner[start:pos]
            items = []
            for sm in re.finditer(r"'((?:\\'|[^'])*)'", arr_src):
                items.append(sm.group(1).replace("\\'", "'").replace("\\\\", "\\"))
            result[key] = items
        elif inner[pos] == "{":
            depth = 0
            start = pos
            while pos < n:
                ch = inner[pos]
                if ch == "{":
                    depth += 1
                elif ch == "}":
                    depth -= 1
                    if depth == 0:
                        pos += 1
                        break
                pos += 1
            result[key] = _parse_props(inner[start + 1 : pos - 1])
        else:
            raise RuntimeError(f"bad value for {key}: {inner[pos:pos+40]!r}")
    return result


def emit_ts_object(name: str, data: dict, indent: str = "  ") -> str:
    lines = [f"{indent}{name}: {{"]
    lines.extend(_emit_props(data, indent + "  "))
    lines.append(f"{indent}}},")
    return "\n".join(lines)


def _emit_props(data: dict, indent: str) -> list[str]:
    lines: list[str] = []
    for key, val in data.items():
        key_out = f"'{key}'" if not re.match(r"^[A-Za-z_]\w*$", key) else key
        if isinstance(val, dict):
            lines.append(f"{indent}{key_out}: {{")
            lines.extend(_emit_props(val, indent + "  "))
            lines.append(f"{indent}}},")
        elif isinstance(val, list):
            lines.append(f"{indent}{key_out}: [")
            for item in val:
                lines.append(f"{indent}  '{ts_escape(item)}',")
            lines.append(f"{indent}],")
        else:
            lines.append(f"{indent}{key_out}: '{ts_escape(val)}',")
    return lines


def flatten(data, prefix="") -> dict[str, str]:
    out: dict[str, str] = {}
    for k, v in data.items():
        path = f"{prefix}{k}" if not prefix else f"{prefix}.{k}"
        if isinstance(v, dict):
            out.update(flatten(v, path))
        elif isinstance(v, list):
            for i, item in enumerate(v):
                out[f"{path}[{i}]"] = item
        else:
            out[path] = v
    return out


def should_keep(s: str) -> bool:
    if s in KEEP_AS_IS:
        return True
    # pure technical short tokens
    if re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9 .·\-/+]{0,24}", s) and s in KEEP_AS_IS:
        return True
    return False


_ph_re = re.compile(r"\{[^}]+\}")


def gtranslate(text: str, tl: str, cache: dict) -> str:
    if not text.strip():
        return text
    if should_keep(text):
        return text
    key = f"{tl}\0{text}"
    if key in cache:
        return cache[key]

    tokens: list[str] = []

    def hold(m: re.Match) -> str:
        tok = f"ZXQPH{len(tokens)}ZXQ"
        tokens.append(m.group(0))
        return tok

    q = _ph_re.sub(hold, text)
    url = "https://translate.googleapis.com/translate_a/single?" + urllib.parse.urlencode(
        {"client": "gtx", "sl": "en", "tl": tl, "dt": "t", "q": q}
    )
    for attempt in range(4):
        try:
            with urllib.request.urlopen(url, timeout=20) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            parts = data[0] or []
            out = "".join(p[0] for p in parts if p and p[0])
            for tok, original in zip([f"ZXQPH{i}ZXQ" for i in range(len(tokens))], tokens):
                out = out.replace(tok, original)
            # restore placeholders if translator mangled them
            for original in tokens:
                if original not in out:
                    # try spaced variants
                    pass
            cache[key] = out
            return out
        except Exception:
            time.sleep(0.4 * (attempt + 1))
    cache[key] = text
    return text


def translate_tree(data, tl: str, cache: dict):
    if isinstance(data, dict):
        return {k: translate_tree(v, tl, cache) for k, v in data.items()}
    if isinstance(data, list):
        return [translate_tree(v, tl, cache) for v in data]
    return gtranslate(data, tl, cache)


# Curated overrides for quality / brand consistency (applied after MT)
OVERRIDES: dict[str, dict[str, str]] = {
    "fr": {
        "metaTitle": "Moyee Converte · Jiumao Library",
        "heroTitle": "Moyee Converte",
        "modeGif": "GIF",
        "footerBrand": "Moyee Converte web · maotaiworks.com",
        "processing": "Traitement…",
        "download": "Télécharger",
        "remove": "Supprimer",
        "downloadResult": "Télécharger le résultat",
        "startAll": "Tout démarrer",
        "startMerge": "Démarrer la fusion",
        "statusReady": "Prêt",
        "statusCompleted": "Terminé",
        "statusFailed": "Échec",
        "audioBadge": "Audio",
        "outputMarker": "Sortie",
        "webGuideTitle": "Guide web",
        "settingsTitle": "Réglages de sortie",
        "settingsNoSelection": "Sélectionnez une tâche pour modifier les paramètres.",
        "convertSettings": "Réglages de conversion",
        "advancedSettings": "Réglages avancés",
        "videoCodec": "Codec vidéo",
        "audioCodec": "Codec audio",
        "bitrate": "Débit",
        "videoBitrate": "Débit vidéo",
        "navVideo": "Vidéo",
        "navAudio": "Audio",
        "navOther": "Plus",
        "modeMusic": "Audio",
        "modeManual": "Guide",
        "queueLabel": "File",
        "reselectFile": "Resélectionner le fichier",
        "dropToPreview": "Déposez ou choisissez un fichier pour le prévisualiser ici",
        "leadConvert": "Convertissez les formats et appliquez des préréglages plateforme en local.",
        "leadCompress": "Réduisez la taille avec une qualité quasi sans perte.",
        "leadMusic": "Convertissez l’audio ou extrayez des pistes depuis une vidéo.",
        "leadMerge": "Joignez des clips dans l’ordre de la liste en un seul fichier.",
        "leadExtract": "Extrayez l’audio, un GIF ou une image de couverture depuis une vidéo.",
        "dropMergeHint": "Mode fusion : ajoutez au moins 2 vidéos dans l’ordre",
        "dropMusicHint": "Prend en charge les fichiers audio/vidéo courants (extraction de pistes)",
        "compressTitle": "Compression",
        "compressStandard": "Standard",
        "compressHighQuality": "Haute qualité",
        "compressMaxCompress": "Compression max",
        "qualityLabel": "Qualité {value}",
        "crfHint": "CRF ≈ {crf} · Conserver le conteneur d’origine {container}",
        "platformPresets": "Préréglages plateforme",
        "platformSpec": "Spécification en un clic",
        "platformCustom": "Personnalisé",
        "errorEngineLoadFailed": "Échec du chargement du moteur",
        "errorConvertFailed": "Échec de la conversion",
        "errorMergeNeedFiles": "Le mode fusion nécessite au moins 2 vidéos",
        "errorMergeFailed": "Échec de la fusion",
        "bannerMerging": "Fusion…",
        "bannerMergeCompleted": "Fusion terminée. La liste affiche les détails de sortie.",
        "bannerFilesAdded": "{count} fichier(s) ajouté(s). Traitement local, sans téléversement.",
        "bannerRunning": "Conversion dans le navigateur. Les gros fichiers peuvent prendre plus de temps.",
        "bannerCompleted": "Terminé. La liste affiche les détails de sortie ; le résultat est prêt à télécharger.",
    },
    "de": {
        "metaTitle": "Moyee Converte · Jiumao Library",
        "heroTitle": "Moyee Converte",
        "modeGif": "GIF",
        "footerBrand": "Moyee Converte Web · maotaiworks.com",
        "processing": "Verarbeitung…",
        "download": "Herunterladen",
        "remove": "Entfernen",
        "downloadResult": "Ergebnis herunterladen",
        "startAll": "Alle starten",
        "startMerge": "Zusammenfügen starten",
        "statusReady": "Bereit",
        "statusCompleted": "Fertig",
        "statusFailed": "Fehlgeschlagen",
        "navVideo": "Video",
        "navAudio": "Audio",
        "navOther": "Mehr",
        "modeMusic": "Audio",
        "modeManual": "Anleitung",
        "queueLabel": "Warteschlange",
        "settingsTitle": "Ausgabeeinstellungen",
        "convertSettings": "Konvertierungseinstellungen",
        "advancedSettings": "Erweiterte Einstellungen",
        "videoCodec": "Video-Codec",
        "audioCodec": "Audio-Codec",
        "bitrate": "Bitrate",
        "videoBitrate": "Video-Bitrate",
        "qualityLabel": "Qualität {value}",
        "crfHint": "CRF ≈ {crf} · Originalcontainer {container} behalten",
        "compressOriginalSize": "Originalgröße: {size}.",
        "compressEstimate": "Geschätzte Ausgabe: etwa {size}",
        "compressSourceBitrate": "Quellbitrate: {rate}",
        "platformPreviewBadge": "Vorschau als {platform} · {size}",
        "errorEngineLoadFailed": "Engine konnte nicht geladen werden",
        "errorConvertFailed": "Konvertierung fehlgeschlagen",
        "errorMergeNeedFiles": "Zusammenfügen benötigt mindestens 2 Videos",
        "errorMergeFailed": "Zusammenfügen fehlgeschlagen",
        "bannerFilesAdded": "{count} Datei(en) hinzugefügt. Verarbeitung bleibt lokal ohne Upload.",
        "bannerRunning": "Konvertierung im Browser. Große Dateien können länger dauern.",
        "bannerCompleted": "Fertig. Die Liste zeigt Ausgabedetails; Ergebnis zum Download bereit.",
        "bannerMerging": "Zusammenfügen…",
        "bannerMergeCompleted": "Zusammenfügen abgeschlossen. Die Liste zeigt Ausgabedetails.",
    },
    "es": {
        "metaTitle": "Moyee Converte · Jiumao Library",
        "heroTitle": "Moyee Converte",
        "modeGif": "GIF",
        "footerBrand": "Moyee Converte web · maotaiworks.com",
        "processing": "Procesando…",
        "download": "Descargar",
        "remove": "Eliminar",
        "downloadResult": "Descargar resultado",
        "startAll": "Iniciar todo",
        "startMerge": "Iniciar fusión",
        "statusReady": "Listo",
        "statusCompleted": "Hecho",
        "statusFailed": "Fallido",
        "navVideo": "Vídeo",
        "navAudio": "Audio",
        "navOther": "Más",
        "modeMusic": "Audio",
        "modeManual": "Guía",
        "queueLabel": "Cola",
        "settingsTitle": "Ajustes de salida",
        "convertSettings": "Ajustes de conversión",
        "advancedSettings": "Ajustes avanzados",
        "videoCodec": "Códec de vídeo",
        "audioCodec": "Códec de audio",
        "bitrate": "Tasa de bits",
        "videoBitrate": "Tasa de bits de vídeo",
        "qualityLabel": "Calidad {value}",
        "crfHint": "CRF ≈ {crf} · Mantener contenedor original {container}",
        "compressOriginalSize": "Tamaño original: {size}.",
        "compressEstimate": "Salida estimada: unos {size}",
        "compressSourceBitrate": "Tasa de bits de origen: {rate}",
        "platformPreviewBadge": "Vista previa como {platform} · {size}",
        "errorEngineLoadFailed": "Error al cargar el motor",
        "errorConvertFailed": "Error de conversión",
        "errorMergeNeedFiles": "El modo fusión necesita al menos 2 vídeos",
        "errorMergeFailed": "Error al fusionar",
        "bannerFilesAdded": "Se añadieron {count} archivo(s). El procesamiento es local, sin subida.",
        "bannerRunning": "Convirtiendo en el navegador. Los archivos grandes pueden tardar más.",
        "bannerCompleted": "Listo. La lista muestra los detalles de salida y el resultado se puede descargar.",
        "bannerMerging": "Fusionando…",
        "bannerMergeCompleted": "Fusión completa. La lista muestra los detalles de salida.",
    },
    "pt": {
        "metaTitle": "Moyee Converte · Jiumao Library",
        "heroTitle": "Moyee Converte",
        "modeGif": "GIF",
        "footerBrand": "Moyee Converte web · maotaiworks.com",
        "processing": "Processando…",
        "download": "Baixar",
        "remove": "Remover",
        "downloadResult": "Baixar resultado",
        "startAll": "Iniciar tudo",
        "startMerge": "Iniciar mesclagem",
        "statusReady": "Pronto",
        "statusCompleted": "Concluído",
        "statusFailed": "Falhou",
        "navVideo": "Vídeo",
        "navAudio": "Áudio",
        "navOther": "Mais",
        "modeMusic": "Áudio",
        "modeManual": "Guia",
        "queueLabel": "Fila",
        "settingsTitle": "Ajustes de saída",
        "convertSettings": "Ajustes de conversão",
        "advancedSettings": "Ajustes avançados",
        "videoCodec": "Codec de vídeo",
        "audioCodec": "Codec de áudio",
        "bitrate": "Bitrate",
        "videoBitrate": "Bitrate de vídeo",
        "qualityLabel": "Qualidade {value}",
        "crfHint": "CRF ≈ {crf} · Manter contentor original {container}",
        "compressOriginalSize": "Tamanho original: {size}.",
        "compressEstimate": "Saída estimada: cerca de {size}",
        "compressSourceBitrate": "Bitrate de origem: {rate}",
        "platformPreviewBadge": "Pré-visualização como {platform} · {size}",
        "errorEngineLoadFailed": "Falha ao carregar o motor",
        "errorConvertFailed": "Falha na conversão",
        "errorMergeNeedFiles": "O modo mesclar precisa de pelo menos 2 vídeos",
        "errorMergeFailed": "Falha na mesclagem",
        "bannerFilesAdded": "Adicionado(s) {count} ficheiro(s). Processamento local, sem upload.",
        "bannerRunning": "A converter no navegador. Ficheiros grandes podem demorar mais.",
        "bannerCompleted": "Concluído. A lista mostra os detalhes de saída e o resultado está pronto para descarregar.",
        "bannerMerging": "A mesclar…",
        "bannerMergeCompleted": "Mesclagem concluída. A lista mostra os detalhes de saída.",
    },
    "ru": {
        "metaTitle": "Moyee Converte · Jiumao Library",
        "heroTitle": "Moyee Converte",
        "modeGif": "GIF",
        "footerBrand": "Moyee Converte web · maotaiworks.com",
        "processing": "Обработка…",
        "download": "Скачать",
        "remove": "Удалить",
        "downloadResult": "Скачать результат",
        "startAll": "Запустить всё",
        "startMerge": "Начать объединение",
        "statusReady": "Готово",
        "statusCompleted": "Готово",
        "statusFailed": "Ошибка",
        "navVideo": "Видео",
        "navAudio": "Аудио",
        "navOther": "Ещё",
        "modeMusic": "Аудио",
        "modeManual": "Справка",
        "queueLabel": "Очередь",
        "settingsTitle": "Параметры вывода",
        "convertSettings": "Параметры преобразования",
        "advancedSettings": "Дополнительно",
        "videoCodec": "Видеокодек",
        "audioCodec": "Аудиокодек",
        "bitrate": "Битрейт",
        "videoBitrate": "Битрейт видео",
        "qualityLabel": "Качество {value}",
        "crfHint": "CRF ≈ {crf} · Сохранить исходный контейнер {container}",
        "compressOriginalSize": "Исходный размер: {size}.",
        "compressEstimate": "Ожидаемый результат: около {size}",
        "compressSourceBitrate": "Битрейт источника: {rate}",
        "platformPreviewBadge": "Превью как {platform} · {size}",
        "errorEngineLoadFailed": "Не удалось загрузить движок",
        "errorConvertFailed": "Ошибка преобразования",
        "errorMergeNeedFiles": "Для объединения нужно не менее 2 видео",
        "errorMergeFailed": "Ошибка объединения",
        "bannerFilesAdded": "Добавлено файлов: {count}. Обработка локальная, без загрузки.",
        "bannerRunning": "Преобразование в браузере. Большие файлы могут занять больше времени.",
        "bannerCompleted": "Готово. В списке — сведения о выводе; результат можно скачать.",
        "bannerMerging": "Объединение…",
        "bannerMergeCompleted": "Объединение завершено. В списке — сведения о выводе.",
    },
    "th": {
        "metaTitle": "Moyee Converte · Jiumao Library",
        "heroTitle": "Moyee Converte",
        "modeGif": "GIF",
        "footerBrand": "Moyee Converte เว็บ · maotaiworks.com",
        "processing": "กำลังประมวลผล…",
        "download": "ดาวน์โหลด",
        "remove": "ลบ",
        "downloadResult": "ดาวน์โหลดผลลัพธ์",
        "startAll": "เริ่มทั้งหมด",
        "startMerge": "เริ่มรวมไฟล์",
        "statusReady": "พร้อม",
        "statusCompleted": "เสร็จสิ้น",
        "statusFailed": "ล้มเหลว",
        "navVideo": "วิดีโอ",
        "navAudio": "เสียง",
        "navOther": "เพิ่มเติม",
        "modeMusic": "เสียง",
        "modeManual": "คู่มือ",
        "queueLabel": "คิว",
        "settingsTitle": "การตั้งค่าเอาต์พุต",
        "convertSettings": "การตั้งค่าการแปลง",
        "advancedSettings": "การตั้งค่าขั้นสูง",
        "videoCodec": "ตัวแปลงสัญญาณวิดีโอ",
        "audioCodec": "ตัวแปลงสัญญาณเสียง",
        "bitrate": "บิตเรต",
        "videoBitrate": "บิตเรตวิดีโอ",
        "qualityLabel": "คุณภาพ {value}",
        "crfHint": "CRF ≈ {crf} · คงคอนเทนเนอร์เดิม {container}",
        "compressOriginalSize": "ขนาดเดิม: {size}",
        "compressEstimate": "ขนาดโดยประมาณ: ประมาณ {size}",
        "compressSourceBitrate": "บิตเรตต้นทาง: {rate}",
        "platformPreviewBadge": "ตัวอย่างแบบ {platform} · {size}",
        "errorEngineLoadFailed": "โหลดเอนจินไม่สำเร็จ",
        "errorConvertFailed": "แปลงไม่สำเร็จ",
        "errorMergeNeedFiles": "โหมดรวมต้องมีวิดีโออย่างน้อย 2 ไฟล์",
        "errorMergeFailed": "รวมไฟล์ไม่สำเร็จ",
        "bannerFilesAdded": "เพิ่ม {count} ไฟล์แล้ว ประมวลผลในเครื่อง ไม่อัปโหลด",
        "bannerRunning": "กำลังแปลงในเบราว์เซอร์ ไฟล์ใหญ่อาจใช้เวลานานขึ้น",
        "bannerCompleted": "เสร็จแล้ว รายการแสดงรายละเอียดเอาต์พุต และดาวน์โหลดได้",
        "bannerMerging": "กำลังรวม…",
        "bannerMergeCompleted": "รวมเสร็จแล้ว รายการแสดงรายละเอียดเอาต์พุต",
    },
    "hi": {
        "metaTitle": "Moyee Converte · Jiumao Library",
        "heroTitle": "Moyee Converte",
        "modeGif": "GIF",
        "footerBrand": "Moyee Converte वेब · maotaiworks.com",
        "processing": "प्रोसेस हो रहा है…",
        "download": "डाउनलोड",
        "remove": "हटाएँ",
        "downloadResult": "परिणाम डाउनलोड करें",
        "startAll": "सभी शुरू करें",
        "startMerge": "मर्ज शुरू करें",
        "statusReady": "तैयार",
        "statusCompleted": "पूर्ण",
        "statusFailed": "विफल",
        "navVideo": "वीडियो",
        "navAudio": "ऑडियो",
        "navOther": "और",
        "modeMusic": "ऑडियो",
        "modeManual": "गाइड",
        "queueLabel": "कतार",
        "settingsTitle": "आउटपुट सेटिंग्स",
        "convertSettings": "कन्वर्ज़न सेटिंग्स",
        "advancedSettings": "उन्नत सेटिंग्स",
        "videoCodec": "वीडियो कोडेक",
        "audioCodec": "ऑडियो कोडेक",
        "bitrate": "बिटरेट",
        "videoBitrate": "वीडियो बिटरेट",
        "qualityLabel": "गुणवत्ता {value}",
        "crfHint": "CRF ≈ {crf} · मूल कंटेनर {container} रखें",
        "compressOriginalSize": "मूल आकार: {size}.",
        "compressEstimate": "अनुमानित आउटपुट: लगभग {size}",
        "compressSourceBitrate": "स्रोत बिटरेट: {rate}",
        "platformPreviewBadge": "{platform} के रूप में पूर्वावलोकन · {size}",
        "errorEngineLoadFailed": "इंजन लोड नहीं हो सका",
        "errorConvertFailed": "कन्वर्ज़न विफल",
        "errorMergeNeedFiles": "मर्ज मोड में कम से कम 2 वीडियो चाहिए",
        "errorMergeFailed": "मर्ज विफल",
        "bannerFilesAdded": "{count} फ़ाइल(ें) जोड़ी गईं। प्रोसेसिंग लोकल है, अपलोड नहीं।",
        "bannerRunning": "ब्राउज़र में कन्वर्ट हो रहा है। बड़ी फ़ाइलों में अधिक समय लग सकता है।",
        "bannerCompleted": "हो गया। सूची में आउटपुट विवरण हैं और परिणाम डाउनलोड के लिए तैयार है।",
        "bannerMerging": "मर्ज हो रहा है…",
        "bannerMergeCompleted": "मर्ज पूरा। सूची में आउटपुट विवरण हैं।",
    },
}

PLATFORM_CROP: dict[str, dict] = {
    "fr": {
        "metaTitle": "Recadrage vidéo plateforme · Jiumao Library",
        "metaDescription": "Recadrez selon les ratios plateforme et exportez avec format et débit recommandés — localement dans le navigateur.",
        "heroTitle": "Recadrage vidéo",
        "heroLead": "Recadrez à toute taille ou ratio plateforme, puis exportez avec les réglages recommandés",
        "dropTitle": "Déposez ou choisissez une vidéo",
        "dropHint": "MP4 / MOV / WebM et formats courants",
        "noFile": "Aucun fichier sélectionné",
        "reselect": "Resélectionner le fichier",
        "settingsTitle": "Réglages de recadrage",
        "aspectRatio": "Ratio d’aspect",
        "standardGroup": "Standard",
        "exportSummary": "Export : {size} · {format} · {bitrate}",
        "showAdvanced": "Modifier format / débit / taille",
        "hideAdvanced": "Masquer les réglages de sortie",
        "container": "Conteneur",
        "bitrate": "Débit vidéo",
        "maxEdge": "Côté max",
        "width": "Largeur",
        "height": "Hauteur",
        "start": "Démarrer",
        "processing": "Traitement…",
        "download": "Télécharger",
        "privacyNote": "Sur l’appareil｜Recadrage et conversion dans le navigateur, sans téléversement.",
        "errorGeneric": "Échec du traitement. Réessayez.",
        "preset": {
            "free": "Recadrage libre",
            "youtube": "YouTube",
            "youtubeShorts": "YouTube Shorts",
            "tiktok": "TikTok",
            "douyin": "Douyin",
            "kuaishou": "Kuaishou",
            "xiaohongshu": "Xiaohongshu",
            "wechatChannels": "Chaînes WeChat",
            "weibo": "Weibo",
            "taobao": "Taobao carré",
            "taobaoPortrait": "Taobao portrait",
            "instagramPost": "Instagram Feed",
            "instagramStory": "Instagram Story",
            "instagramReel": "Instagram Reel",
            "linkedin": "LinkedIn",
            "x": "X",
            "std169": "16:9",
            "std916": "9:16",
            "std11": "1:1",
            "std45": "4:5",
            "std34": "3:4",
        },
    },
    "de": {
        "metaTitle": "Plattform-Videozuschnitt · Jiumao Library",
        "metaDescription": "Auf Plattformformate zuschneiden und mit empfohlenem Format und Bitrate exportieren — lokal im Browser.",
        "heroTitle": "Videozuschnitt",
        "heroLead": "Auf beliebige Größe oder Plattformverhältnis zuschneiden und mit empfohlenen Einstellungen exportieren",
        "dropTitle": "Video ablegen oder auswählen",
        "dropHint": "MP4 / MOV / WebM und gängige Formate",
        "noFile": "Keine Datei ausgewählt",
        "reselect": "Datei neu wählen",
        "settingsTitle": "Zuschnitteinstellungen",
        "aspectRatio": "Seitenverhältnis",
        "standardGroup": "Standard",
        "exportSummary": "Export: {size} · {format} · {bitrate}",
        "showAdvanced": "Format / Bitrate / Größe bearbeiten",
        "hideAdvanced": "Ausgabeeinstellungen ausblenden",
        "container": "Container",
        "bitrate": "Video-Bitrate",
        "maxEdge": "Längste Seite",
        "width": "Breite",
        "height": "Höhe",
        "start": "Starten",
        "processing": "Verarbeitung…",
        "download": "Herunterladen",
        "privacyNote": "Auf dem Gerät｜Zuschnitt und Konvertierung im Browser, ohne Upload.",
        "errorGeneric": "Verarbeitung fehlgeschlagen. Bitte erneut versuchen.",
        "preset": {
            "free": "Freier Zuschnitt",
            "youtube": "YouTube",
            "youtubeShorts": "YouTube Shorts",
            "tiktok": "TikTok",
            "douyin": "Douyin",
            "kuaishou": "Kuaishou",
            "xiaohongshu": "Xiaohongshu",
            "wechatChannels": "WeChat-Kanäle",
            "weibo": "Weibo",
            "taobao": "Taobao quadratisch",
            "taobaoPortrait": "Taobao Hochformat",
            "instagramPost": "Instagram Feed",
            "instagramStory": "Instagram Story",
            "instagramReel": "Instagram Reel",
            "linkedin": "LinkedIn",
            "x": "X",
            "std169": "16:9",
            "std916": "9:16",
            "std11": "1:1",
            "std45": "4:5",
            "std34": "3:4",
        },
    },
    "es": {
        "metaTitle": "Recorte de vídeo por plataforma · Jiumao Library",
        "metaDescription": "Recorta a ratios de plataforma y exporta con formato y tasa de bits recomendados — localmente en el navegador.",
        "heroTitle": "Recorte de vídeo",
        "heroLead": "Recorta a cualquier tamaño o ratio de plataforma y exporta con ajustes recomendados",
        "dropTitle": "Suelta o elige un vídeo",
        "dropHint": "MP4 / MOV / WebM y formatos habituales",
        "noFile": "Ningún archivo seleccionado",
        "reselect": "Volver a elegir archivo",
        "settingsTitle": "Ajustes de recorte",
        "aspectRatio": "Relación de aspecto",
        "standardGroup": "Estándar",
        "exportSummary": "Exportar: {size} · {format} · {bitrate}",
        "showAdvanced": "Editar formato / tasa de bits / tamaño",
        "hideAdvanced": "Ocultar ajustes de salida",
        "container": "Contenedor",
        "bitrate": "Tasa de bits de vídeo",
        "maxEdge": "Lado máximo",
        "width": "Ancho",
        "height": "Alto",
        "start": "Iniciar",
        "processing": "Procesando…",
        "download": "Descargar",
        "privacyNote": "En el dispositivo｜Recorte y conversión en el navegador, sin subida.",
        "errorGeneric": "Error de procesamiento. Inténtalo de nuevo.",
        "preset": {
            "free": "Recorte libre",
            "youtube": "YouTube",
            "youtubeShorts": "YouTube Shorts",
            "tiktok": "TikTok",
            "douyin": "Douyin",
            "kuaishou": "Kuaishou",
            "xiaohongshu": "Xiaohongshu",
            "wechatChannels": "Canales WeChat",
            "weibo": "Weibo",
            "taobao": "Taobao cuadrado",
            "taobaoPortrait": "Taobao vertical",
            "instagramPost": "Instagram Feed",
            "instagramStory": "Instagram Story",
            "instagramReel": "Instagram Reel",
            "linkedin": "LinkedIn",
            "x": "X",
            "std169": "16:9",
            "std916": "9:16",
            "std11": "1:1",
            "std45": "4:5",
            "std34": "3:4",
        },
    },
    "pt": {
        "metaTitle": "Recorte de vídeo por plataforma · Jiumao Library",
        "metaDescription": "Recorte para proporções de plataforma e exporte com formato e bitrate recomendados — localmente no navegador.",
        "heroTitle": "Recorte de vídeo",
        "heroLead": "Recorte para qualquer tamanho ou proporção de plataforma e exporte com ajustes recomendados",
        "dropTitle": "Solte ou escolha um vídeo",
        "dropHint": "MP4 / MOV / WebM e formatos comuns",
        "noFile": "Nenhum arquivo selecionado",
        "reselect": "Escolher arquivo de novo",
        "settingsTitle": "Ajustes de recorte",
        "aspectRatio": "Proporção",
        "standardGroup": "Padrão",
        "exportSummary": "Exportar: {size} · {format} · {bitrate}",
        "showAdvanced": "Editar formato / bitrate / tamanho",
        "hideAdvanced": "Ocultar ajustes de saída",
        "container": "Contêiner",
        "bitrate": "Bitrate de vídeo",
        "maxEdge": "Lado máximo",
        "width": "Largura",
        "height": "Altura",
        "start": "Iniciar",
        "processing": "Processando…",
        "download": "Baixar",
        "privacyNote": "No dispositivo｜Recorte e conversão no navegador, sem upload.",
        "errorGeneric": "Falha no processamento. Tente de novo.",
        "preset": {
            "free": "Recorte livre",
            "youtube": "YouTube",
            "youtubeShorts": "YouTube Shorts",
            "tiktok": "TikTok",
            "douyin": "Douyin",
            "kuaishou": "Kuaishou",
            "xiaohongshu": "Xiaohongshu",
            "wechatChannels": "Canais WeChat",
            "weibo": "Weibo",
            "taobao": "Taobao quadrado",
            "taobaoPortrait": "Taobao vertical",
            "instagramPost": "Instagram Feed",
            "instagramStory": "Instagram Story",
            "instagramReel": "Instagram Reel",
            "linkedin": "LinkedIn",
            "x": "X",
            "std169": "16:9",
            "std916": "9:16",
            "std11": "1:1",
            "std45": "4:5",
            "std34": "3:4",
        },
    },
    "ru": {
        "metaTitle": "Обрезка видео под платформы · Jiumao Library",
        "metaDescription": "Обрезайте под соотношения платформ и экспортируйте с рекомендуемым форматом и битрейтом — локально в браузере.",
        "heroTitle": "Обрезка видео",
        "heroLead": "Обрезайте до любого размера или соотношения платформы и экспортируйте с рекомендуемыми настройками",
        "dropTitle": "Перетащите или выберите видео",
        "dropHint": "MP4 / MOV / WebM и другие распространённые форматы",
        "noFile": "Файл не выбран",
        "reselect": "Выбрать файл заново",
        "settingsTitle": "Параметры обрезки",
        "aspectRatio": "Соотношение сторон",
        "standardGroup": "Стандарт",
        "exportSummary": "Экспорт: {size} · {format} · {bitrate}",
        "showAdvanced": "Изменить формат / битрейт / размер",
        "hideAdvanced": "Скрыть параметры вывода",
        "container": "Контейнер",
        "bitrate": "Битрейт видео",
        "maxEdge": "Макс. сторона",
        "width": "Ширина",
        "height": "Высота",
        "start": "Старт",
        "processing": "Обработка…",
        "download": "Скачать",
        "privacyNote": "На устройстве｜Обрезка и конвертация в браузере, без загрузки.",
        "errorGeneric": "Ошибка обработки. Попробуйте снова.",
        "preset": {
            "free": "Свободная обрезка",
            "youtube": "YouTube",
            "youtubeShorts": "YouTube Shorts",
            "tiktok": "TikTok",
            "douyin": "Douyin",
            "kuaishou": "Kuaishou",
            "xiaohongshu": "Xiaohongshu",
            "wechatChannels": "Каналы WeChat",
            "weibo": "Weibo",
            "taobao": "Taobao квадрат",
            "taobaoPortrait": "Taobao портрет",
            "instagramPost": "Instagram Feed",
            "instagramStory": "Instagram Story",
            "instagramReel": "Instagram Reel",
            "linkedin": "LinkedIn",
            "x": "X",
            "std169": "16:9",
            "std916": "9:16",
            "std11": "1:1",
            "std45": "4:5",
            "std34": "3:4",
        },
    },
    "th": {
        "metaTitle": "ครอปวิดีโอตามแพลตฟอร์ม · Jiumao Library",
        "metaDescription": "ครอปตามอัตราส่วนแพลตฟอร์มแล้วส่งออกด้วยรูปแบบและบิตเรตที่แนะนำ — ประมวลผลในเบราว์เซอร์",
        "heroTitle": "ครอปวิดีโอ",
        "heroLead": "ครอปได้ทุกขนาดหรืออัตราส่วนแพลตฟอร์ม แล้วส่งออกด้วยการตั้งค่าที่แนะนำ",
        "dropTitle": "วางหรือเลือกวิดีโอ",
        "dropHint": "รองรับ MP4 / MOV / WebM และรูปแบบทั่วไป",
        "noFile": "ยังไม่ได้เลือกไฟล์",
        "reselect": "เลือกไฟล์ใหม่",
        "settingsTitle": "การตั้งค่าครอป",
        "aspectRatio": "อัตราส่วนภาพ",
        "standardGroup": "มาตรฐาน",
        "exportSummary": "ส่งออก: {size} · {format} · {bitrate}",
        "showAdvanced": "แก้ไขรูปแบบ / บิตเรต / ขนาด",
        "hideAdvanced": "ซ่อนการตั้งค่าเอาต์พุต",
        "container": "คอนเทนเนอร์",
        "bitrate": "บิตเรตวิดีโอ",
        "maxEdge": "ด้านยาวสุด",
        "width": "กว้าง",
        "height": "สูง",
        "start": "เริ่ม",
        "processing": "กำลังประมวลผล…",
        "download": "ดาวน์โหลด",
        "privacyNote": "บนอุปกรณ์｜ครอปและแปลงในเบราว์เซอร์ ไม่มีการอัปโหลด",
        "errorGeneric": "ประมวลผลไม่สำเร็จ โปรดลองอีกครั้ง",
        "preset": {
            "free": "ครอปอิสระ",
            "youtube": "YouTube",
            "youtubeShorts": "YouTube Shorts",
            "tiktok": "TikTok",
            "douyin": "Douyin",
            "kuaishou": "Kuaishou",
            "xiaohongshu": "Xiaohongshu",
            "wechatChannels": "ช่อง WeChat",
            "weibo": "Weibo",
            "taobao": "Taobao สี่เหลี่ยม",
            "taobaoPortrait": "Taobao แนวตั้ง",
            "instagramPost": "Instagram Feed",
            "instagramStory": "Instagram Story",
            "instagramReel": "Instagram Reel",
            "linkedin": "LinkedIn",
            "x": "X",
            "std169": "16:9",
            "std916": "9:16",
            "std11": "1:1",
            "std45": "4:5",
            "std34": "3:4",
        },
    },
    "hi": {
        "metaTitle": "प्लेटफ़ॉर्म वीडियो क्रॉप · Jiumao Library",
        "metaDescription": "प्लेटफ़ॉर्म अनुपात में क्रॉप करें और अनुशंसित प्रारूप व बिटरेट से निर्यात करें — ब्राउज़र में लोकल।",
        "heroTitle": "वीडियो क्रॉप",
        "heroLead": "किसी भी आकार या प्लेटफ़ॉर्म अनुपात में क्रॉप करें, फिर अनुशंसित सेटिंग्स से निर्यात करें",
        "dropTitle": "वीडियो छोड़ें या चुनें",
        "dropHint": "MP4 / MOV / WebM और सामान्य प्रारूप",
        "noFile": "कोई फ़ाइल चयनित नहीं",
        "reselect": "फ़ाइल फिर चुनें",
        "settingsTitle": "क्रॉप सेटिंग्स",
        "aspectRatio": "आस्पेक्ट रेशियो",
        "standardGroup": "मानक",
        "exportSummary": "निर्यात: {size} · {format} · {bitrate}",
        "showAdvanced": "प्रारूप / बिटरेट / आकार संपादित करें",
        "hideAdvanced": "आउटपुट सेटिंग्स छिपाएँ",
        "container": "कंटेनर",
        "bitrate": "वीडियो बिटरेट",
        "maxEdge": "अधिकतम किनारा",
        "width": "चौड़ाई",
        "height": "ऊँचाई",
        "start": "शुरू करें",
        "processing": "प्रोसेस हो रहा है…",
        "download": "डाउनलोड",
        "privacyNote": "डिवाइस पर｜क्रॉप और कन्वर्ज़न ब्राउज़र में, बिना अपलोड।",
        "errorGeneric": "प्रोसेसिंग विफल। कृपया फिर कोशिश करें।",
        "preset": {
            "free": "मुक्त क्रॉप",
            "youtube": "YouTube",
            "youtubeShorts": "YouTube Shorts",
            "tiktok": "TikTok",
            "douyin": "Douyin",
            "kuaishou": "Kuaishou",
            "xiaohongshu": "Xiaohongshu",
            "wechatChannels": "WeChat चैनल्स",
            "weibo": "Weibo",
            "taobao": "Taobao वर्ग",
            "taobaoPortrait": "Taobao पोर्ट्रेट",
            "instagramPost": "Instagram Feed",
            "instagramStory": "Instagram Story",
            "instagramReel": "Instagram Reel",
            "linkedin": "LinkedIn",
            "x": "X",
            "std169": "16:9",
            "std916": "9:16",
            "std11": "1:1",
            "std45": "4:5",
            "std34": "3:4",
        },
    },
}


def apply_overrides(tree: dict, locale: str) -> dict:
    ov = OVERRIDES.get(locale, {})
    out = dict(tree)
    for k, v in ov.items():
        if k in out and not isinstance(out[k], (dict, list)):
            out[k] = v
    return out


def ensure_placeholders(en_val: str, tr_val: str) -> str:
    en_ph = _ph_re.findall(en_val)
    if not en_ph:
        return tr_val
    # if any missing, append or restore from en
    missing = [p for p in en_ph if p not in tr_val]
    if not missing:
        return tr_val
    # fallback: put missing placeholders at end
    return tr_val + " " + " ".join(missing)


def translate_tree_safe(en_tree, tl: str, cache: dict):
    def walk(en_node, tr_node=None):
        if isinstance(en_node, dict):
            return {k: walk(v) for k, v in en_node.items()}
        if isinstance(en_node, list):
            return [walk(v) for v in en_node]
        tr = gtranslate(en_node, tl, cache)
        return ensure_placeholders(en_node, tr)

    return walk(en_tree)


def strip_moyee_import_if_unused(text: str) -> str:
    if "...moyeeFallback" in text or "moyeeFallback" in text:
        # still used elsewhere?
        uses = len(re.findall(r"moyeeFallback", text))
        if uses <= 1:  # only in import
            text = re.sub(
                r"import \{ moyeeFallback, switchAppFallback \} from '\./fallbacks'\n",
                "import { switchAppFallback } from './fallbacks'\n",
                text,
                count=1,
            )
            text = re.sub(
                r"import \{ switchAppFallback, moyeeFallback \} from '\./fallbacks'\n",
                "import { switchAppFallback } from './fallbacks'\n",
                text,
                count=1,
            )
    return text


def replace_section(text: str, name: str, new_block: str) -> str:
    start, end, _ = extract_section(text, name)
    return text[:start] + new_block + text[end:]


def count_identical(en_flat: dict, loc_flat: dict) -> tuple[int, int]:
    identical = sum(1 for k, v in en_flat.items() if loc_flat.get(k) == v)
    return identical, len(en_flat)


def main() -> None:
    en_text = (LOCALE_DIR / "en.ts").read_text(encoding="utf-8")
    _, _, en_moyee_src = extract_section(en_text, "moyee")
    en_moyee = parse_ts_object(en_moyee_src)
    # Drop spread if any
    en_moyee.pop("moyeeFallback", None)

    cache: dict = {}
    if CACHE_PATH.exists():
        cache = json.loads(CACHE_PATH.read_text(encoding="utf-8"))

    print("en moyee keys (flat):", len(flatten(en_moyee)))

    # Pre-translate unique strings in parallel per locale
    unique_en = sorted(set(flatten(en_moyee).values()) - KEEP_AS_IS)

    def warm(locale: str):
        for s in unique_en:
            gtranslate(s, locale, cache)

    with ThreadPoolExecutor(max_workers=4) as ex:
        futs = [ex.submit(warm, loc) for loc in LOCALES]
        for f in as_completed(futs):
            f.result()

    CACHE_PATH.write_text(json.dumps(cache, ensure_ascii=False, indent=0), encoding="utf-8")
    print("cache entries:", len(cache))

    results = []
    for loc in LOCALES:
        path = LOCALE_DIR / f"{loc}.ts"
        text = path.read_text(encoding="utf-8")

        moyee_tr = translate_tree_safe(en_moyee, loc, cache)
        moyee_tr = apply_overrides(moyee_tr, loc)
        # re-ensure placeholders after overrides
        en_flat = flatten(en_moyee)
        tr_flat = flatten(moyee_tr)
        for k, ev in en_flat.items():
            if k in tr_flat:
                tr_flat[k] = ensure_placeholders(ev, tr_flat[k])

        # rebuild tree from flattened? easier: walk again with overrides already applied
        def fix_tree(en_node, tr_node):
            if isinstance(en_node, dict):
                return {k: fix_tree(en_node[k], tr_node[k]) for k in en_node}
            if isinstance(en_node, list):
                return [ensure_placeholders(a, b) for a, b in zip(en_node, tr_node)]
            return ensure_placeholders(en_node, tr_node)

        moyee_tr = fix_tree(en_moyee, moyee_tr)

        # key parity check
        if set(flatten(moyee_tr)) != set(flatten(en_moyee)):
            missing = set(flatten(en_moyee)) - set(flatten(moyee_tr))
            extra = set(flatten(moyee_tr)) - set(flatten(en_moyee))
            raise RuntimeError(f"{loc} key mismatch missing={missing} extra={extra}")

        moyee_block = emit_ts_object("moyee", moyee_tr)
        text = replace_section(text, "moyee", moyee_block)

        pc_block = emit_ts_object("platformCrop", PLATFORM_CROP[loc])
        text = replace_section(text, "platformCrop", pc_block)

        text = strip_moyee_import_if_unused(text)
        path.write_text(text, encoding="utf-8")

        # verify by re-parse
        text2 = path.read_text(encoding="utf-8")
        assert "...moyeeFallback" not in extract_section(text2, "moyee")[2]
        loc_moyee = parse_ts_object(extract_section(text2, "moyee")[2])
        loc_pc = parse_ts_object(extract_section(text2, "platformCrop")[2])
        mi, mt = count_identical(flatten(en_moyee), flatten(loc_moyee))
        pi, pt = count_identical(flatten(parse_ts_object(extract_section(en_text, "platformCrop")[2])), flatten(loc_pc))
        results.append((loc, mi, mt, pi, pt))
        print(f"{loc}: moyee identical={mi}/{mt}  platformCrop identical={pi}/{pt}")

    CACHE_PATH.write_text(json.dumps(cache, ensure_ascii=False, indent=0), encoding="utf-8")
    print("\nDONE")
    for row in results:
        print(row)


if __name__ == "__main__":
    main()
