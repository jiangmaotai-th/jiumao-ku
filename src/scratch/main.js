import sdk from "@playabl/sdk";
import { applyDocumentMeta, initLocale, t } from "../i18n";
import { trackView } from "../analytics";
import { createGame } from "./game/game.js";
import tweaksManifest from "./tweaks.json";
import assetsManifest from "./assets.json";
import "./styles.css";

initLocale();
document.title = t("scratch.metaTitle");
const desc = document.querySelector('meta[name="description"]');
if (desc) desc.setAttribute("content", t("scratch.metaDescription"));
else applyDocumentMeta();
trackView("daily-scratch");

const app = document.querySelector("#app");
const ready = await sdk.ready();
const tweaks = await sdk.tweaks.init(tweaksManifest);
const assets = Object.keys(assetsManifest).length > 0
  ? await sdk.assets.register(assetsManifest)
  : undefined;

const game = createGame({ mount: app, sdk, ready, tweaks, assets });
game.start();
