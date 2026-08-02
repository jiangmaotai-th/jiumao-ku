/**
 * Hot Switch digital titles for the home row (fixed order).
 * gameId = preferred NA nsuid (string). nsuids keyed by region bucket.
 * Icons prefer JP eShop CDN (stable) with EU square as fallback in comments.
 */
export const HOT_TOP10 = [
  {
    gameId: '70010000063714',
    slug: 'zelda-totk',
    name: 'The Legend of Zelda: Tears of the Kingdom',
    nameZh: '塞尔达传说：王国之泪',
    publisher: 'Nintendo',
    icon: 'https://img-eshop.cdn.nintendo.net/i/1a637778f3ea270ca6ff053d0204073e555575099e82cb018ddb1877be0a0fde.jpg',
    nsuids: {
      na: '70010000063714',
      eu: '70010000063715',
      jp: '70010000063713',
      kr: '70010000063716',
      hk: '70010000063717',
    },
  },
  {
    gameId: '70010000000025',
    slug: 'zelda-botw',
    name: 'The Legend of Zelda: Breath of the Wild',
    nameZh: '塞尔达传说：旷野之息',
    publisher: 'Nintendo',
    icon: 'https://img-eshop.cdn.nintendo.net/i/66a1e231272eb0241d0aa0a81f9eb0416e9bd5b205759caaac71220aebdc3a84.jpg',
    nsuids: { na: '70010000000025', eu: '70010000000023', jp: '70010000000026' },
  },
  {
    gameId: '70010000000153',
    slug: 'mario-kart-8',
    name: 'Mario Kart 8 Deluxe',
    nameZh: '马里奥赛车8 豪华版',
    publisher: 'Nintendo',
    icon: 'https://img-eshop.cdn.nintendo.net/i/e681f02b84dd9f7207b2b00ec7803e39d242141af0fb681f0d27f2d824898373.jpg',
    nsuids: {
      na: '70010000000153',
      eu: '70010000000126',
      jp: '70010000000186',
    },
  },
  {
    gameId: '70010000027619',
    slug: 'animal-crossing',
    name: 'Animal Crossing: New Horizons',
    nameZh: '集合啦！动物森友会',
    publisher: 'Nintendo',
    icon: 'https://img-eshop.cdn.nintendo.net/i/e607c120cab2c59c5ebb491deaa1095e750ad795e8e1129c8f4f4f5bdefc6a92.jpg',
    nsuids: { na: '70010000027619', eu: '70010000027620', jp: '70010000027618' },
  },
  {
    gameId: '70010000000121',
    slug: 'mario-odyssey',
    name: 'Super Mario Odyssey',
    nameZh: '超级马力欧 奥德赛',
    publisher: 'Nintendo',
    icon: 'https://img-eshop.cdn.nintendo.net/i/155fc615dfb2fd8702542916b57f6bdd6c0ab5a103f44f7d84a7aacd2c4f222e.jpg',
    nsuids: {
      na: '70010000000121',
      eu: '70010000000127',
      jp: '70010000000828',
    },
  },
  {
    gameId: '70010000046395',
    slug: 'splatoon-3',
    name: 'Splatoon 3',
    nameZh: '斯普拉遁3',
    publisher: 'Nintendo',
    icon: 'https://img-eshop.cdn.nintendo.net/i/be6eb6c8e642eb104ab329de6fb840c0ba27106659d4c1ba054a38208f3200aa.jpg',
    nsuids: { na: '70010000046395', eu: '70010000046396', jp: '70010000046394' },
  },
  {
    gameId: '70010000012332',
    slug: 'smash-ultimate',
    name: 'Super Smash Bros. Ultimate',
    nameZh: '任天堂明星大乱斗 特别版',
    publisher: 'Nintendo',
    icon: 'https://img-eshop.cdn.nintendo.net/i/24d750a5c901181f24d2f248fff70a9ed93d632d8591e91e7df69d515a388a87.jpg',
    nsuids: {
      na: '70010000012332',
      eu: '70010000012331',
      jp: '70010000012085',
    },
  },
  {
    gameId: '70010000046405',
    slug: 'kirby-forgotten',
    name: 'Kirby and the Forgotten Land',
    nameZh: '星之卡比 探索发现',
    publisher: 'Nintendo',
    icon: 'https://img-eshop.cdn.nintendo.net/i/70d985e5ca0536e23ed2eba589446234ea607a9f2f98d78db2c931db5a7a3a1f.jpg',
    nsuids: { na: '70010000046405', eu: '70010000046406', jp: '70010000046404' },
  },
  {
    gameId: '70010000053966',
    slug: 'pokemon-scarlet',
    name: 'Pokémon Scarlet',
    nameZh: '宝可梦 朱',
    publisher: 'Nintendo / The Pokémon Company',
    icon: 'https://img-eshop.cdn.nintendo.net/i/cdc689ce85ab0951e7476f6a8ad2a239ae8e8652d84c743fd7d44ca4996d4966.jpg',
    nsuids: {
      na: '70010000053966',
      eu: '70010000053967',
      jp: '70010000053965',
    },
  },
  {
    gameId: '70010000042924',
    slug: 'metroid-dread',
    name: 'Metroid Dread',
    nameZh: '密特罗德 生存恐惧',
    publisher: 'Nintendo',
    icon: 'https://img-eshop.cdn.nintendo.net/i/61d61e484be39142979ffee66107e3d26f24a59b61403e6d99f2cfc20967b30e.jpg',
    nsuids: {
      na: '70010000042924',
      eu: '70010000042925',
      jp: '70010000042923',
    },
  },
]

export const SEED_GAMES = [...HOT_TOP10]
