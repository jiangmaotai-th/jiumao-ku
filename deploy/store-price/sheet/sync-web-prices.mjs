#!/usr/bin/env node
/** Re-seed web-prices.json from official table (incl. sheet price patches). */
import {
  loadWebPricesBundle,
  saveWebPricesBundle,
  ensureOfficialSeed,
} from '../web-scrape/store.mjs'

const bundle = loadWebPricesBundle()
const seeded = ensureOfficialSeed(bundle)
saveWebPricesBundle(bundle)
console.log(JSON.stringify({ seeded: seeded.length, sample: seeded.slice(0, 20) }, null, 2))
