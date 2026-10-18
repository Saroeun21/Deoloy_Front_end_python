const RESEARCHED_DAILY_BUDGETS_USD = [
  { pattern: /\b(japan|kyoto)\b/i, amount: 110 },
  { pattern: /\b(france|paris)\b/i, amount: 302 },
  { pattern: /\b(indonesia|bali)\b/i, amount: 80 },
  { pattern: /\bsingapore\b/i, amount: 181 },
  { pattern: /\b(vietnam|da nang|danang)\b/i, amount: 56 },
  { pattern: /\b(iceland|reykjavik|reykjavík)\b/i, amount: 307 },
];

const DAILY_BUDGET_RANGES_USD = [
  { pattern: /\b(vietnam|cambodia|laos|nepal|india)\b/i, range: [35, 75] },
  { pattern: /\b(thailand|indonesia|philippines|malaysia|sri lanka)\b/i, range: [45, 95] },
  { pattern: /\b(portugal|greece|turkey|mexico|brazil|poland)\b/i, range: [65, 135] },
  { pattern: /\b(japan|south korea|korea|spain|italy|germany)\b/i, range: [90, 180] },
  { pattern: /\b(united states|u\.s\.a?\.?|canada|australia|new zealand)\b/i, range: [120, 240] },
  { pattern: /\b(switzerland|norway|iceland|denmark|sweden)\b/i, range: [160, 320] },
];

function estimateDailyBudget(countryName, page) {
  const placeText = `${countryName || ''} ${page.title || ''} ${page.extract || ''}`;
  const researched = RESEARCHED_DAILY_BUDGETS_USD.find(({ pattern }) =>
    pattern.test(placeText),
  );
  if (researched) return researched.amount;

  const countryRange = DAILY_BUDGET_RANGES_USD.find(({ pattern }) =>
    pattern.test(placeText),
  );
  const [min, max] = countryRange?.range || [70, 160];
  return { min, max };
}

export function isEarthPlace(page) {
  return (
    page.ns === 0 &&
    Array.isArray(page.coordinates) &&
    page.coordinates.some(
      (coordinate) =>
        (!coordinate.globe || coordinate.globe === 'earth') &&
        coordinate.type !== 'event' &&
        coordinate.type !== 'astronomical object',
    )
  );
}

const NON_PLACE_TITLE =
  /\b(?:flag|coat of arms|national anthem|politics|government|foreign relations|international relations|elections?|political parties?|parliaments?|legislatures?|supreme courts?|congress|senate|house of representatives|cabinet|military|armed forces|list of|administrative divisions|demographics|economy of)\b/i;
const NON_PLACE_SUMMARY =
  /\b(?:flag of|coat of arms of|national anthem of|politics of|government of|elections? in|foreign relations of|international relations of|demographics of|economy of|military of|is (?:a|an|the) politician|is (?:a|an|the) political party|is (?:a|an|the) government agency|is (?:a|an|the) legislative body)\b/i;
const NON_PLACE_COORDINATE_TYPE =
  /^(?:country|sovereign state|state|administrative region|administrative division|political unit)$/i;
const NON_PLACE_IMAGE =
  /(?:^|[_\-/ ])(?:flag|coat[_\-/ ]of[_\-/ ]arms|national[_\-/ ]emblem)(?:[_\-/ .]|$)/i;

export function isPlaceArticle(page) {
  if (!isEarthPlace(page) || !page.thumbnail?.source) return false;

  const title = String(page.title || '').trim();
  const summary = String(page.extract || '').trim();
  let imageName = page.pageimage || page.thumbnail.source;
  try {
    imageName = decodeURIComponent(new URL(imageName, 'https://en.wikipedia.org').pathname);
  } catch (error) {
    if (!(error instanceof TypeError)) throw error;
  }
  const coordinates = page.coordinates.filter(
    (coordinate) => !coordinate.globe || coordinate.globe === 'earth',
  );
  return (
    !NON_PLACE_TITLE.test(title) &&
    !NON_PLACE_SUMMARY.test(summary) &&
    !NON_PLACE_IMAGE.test(imageName) &&
    !coordinates.every((coordinate) =>
      NON_PLACE_COORDINATE_TYPE.test(coordinate.type || ''),
    )
  );
}

export function mapWikipediaPage(page, countryName) {
  const coordinate = page.coordinates?.find(
    (point) => !point.globe || point.globe === 'earth',
  );
  const placeType = coordinate?.type
    ? coordinate.type.charAt(0).toLocaleUpperCase() + coordinate.type.slice(1)
    : 'Place';

  return {
    id: `wiki-${page.pageid}`,
    title: page.title,
    desc:
      page.extract ||
      'Explore this place and learn more about its history and highlights.',
    img: page.thumbnail?.source,
    category: placeType,
    type: placeType,
    estimated_daily_cost_usd: estimateDailyBudget(countryName, page),
    daily_cost_is_estimate: true,
    latitude: coordinate?.lat,
    longitude: coordinate?.lon,
    source: 'Wikipedia',
    sourceUrl: `https://en.wikipedia.org/?curid=${page.pageid}`,
  };
}
