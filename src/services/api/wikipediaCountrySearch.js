import {
  fetchWikimediaQuery,
  WIKIDATA_API_URL,
  WIKIPEDIA_API_URL,
} from './wikimediaApi.js';
import { isEarthPlace } from './wikipediaPlaceMapper.js';

const countrySearchCache = new Map();
const COUNTRY_ALIASES = new Map([
  ['america', 'United States'],
  ['u s', 'United States'],
  ['u.s.', 'United States'],
  ['us', 'United States'],
  ['u.s.a.', 'United States'],
  ['usa', 'United States'],
  ['united state', 'United States'],
  ['united states of america', 'United States'],
  ['uk', 'United Kingdom'],
  ['u.k.', 'United Kingdom'],
  ['great britain', 'United Kingdom'],
  ['uae', 'United Arab Emirates'],
  ['south korea', 'South Korea'],
  ['north korea', 'North Korea'],
  ['russia', 'Russia'],
]);
const NON_DESTINATION_ENTITY_TYPES = new Set([
  'Q7278',
  'Q56061',
  'Q82955',
  'Q7163',
  'Q327333',
  'Q35749',
  'Q11204',
  'Q7188',
  'Q15925198',
]);
const NON_DESTINATION_ARTICLE =
  /^(?:flag|coat of arms|national anthem|politics|government|foreign relations|international relations|elections?|list of|administrative divisions|demographics|economy|military of)\b/i;
const NON_DESTINATION_TITLE =
  /\b(?:congress|senate|house of representatives|supreme court|political party|government agency|cabinet|parliament|legislature|department of [A-Z]|armed forces)\b/i;
const NON_DESTINATION_SUMMARY =
  /\b(?:is a political party|is a politician|is a government agency|is the government of|is the national legislature|is the legislature of|is a legislative body|is (?:the )?(?:upper|lower) house of|political system of|politics of [A-Z]|election(?:s)? in [A-Z]|flag of [A-Z]|national anthem of [A-Z])\b/i;

function normalizeCountryName(name) {
  return name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/[.'’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function isPoliticalArticle(page, entities) {
  const title = page.title.trim();
  const summary = (page.extract || '').slice(0, 500);
  const entity = entities.get(page.pageprops.wikibase_item);
  const instanceIds = (entity?.claims?.P31 || [])
    .map((claim) => claim.mainsnak?.datavalue?.value?.id)
    .filter(Boolean);
  return (
    instanceIds.some((id) => NON_DESTINATION_ENTITY_TYPES.has(id)) ||
    instanceIds.some((id) => NON_DESTINATION_ENTITY_TYPES.has(id)) ||
    NON_DESTINATION_ARTICLE.test(title) ||
    NON_DESTINATION_TITLE.test(title) ||
    NON_DESTINATION_SUMMARY.test(summary)
  );
}

export async function findCountry(query, signal) {
  const normalizedQuery = normalizeCountryName(query);
  if (countrySearchCache.has(normalizedQuery)) {
    return countrySearchCache.get(normalizedQuery);
  }

  const canonicalName =
    COUNTRY_ALIASES.get(query.trim().toLocaleLowerCase()) ||
    COUNTRY_ALIASES.get(normalizedQuery) ||
    query.trim();
  const normalizedCanonicalName = normalizeCountryName(canonicalName);
  const searchPromise = fetchCountry(
    canonicalName,
    normalizedCanonicalName,
    signal,
  );
  countrySearchCache.set(normalizedQuery, searchPromise);

  try {
    return await searchPromise;
  } catch (error) {
    countrySearchCache.delete(normalizedQuery);
    throw error;
  }
}

async function fetchCountry(query, normalizedQuery, signal) {
  const searchParams = new URLSearchParams({
    action: 'wbsearchentities',
    search: query,
    language: 'en',
    type: 'item',
    limit: '10',
    format: 'json',
    origin: '*',
  });
  const response = await fetch(`${WIKIDATA_API_URL}?${searchParams}`, { signal });

  if (!response.ok) {
    throw new Error(`Country search failed (HTTP ${response.status}).`);
  }

  const data = await response.json();
  const matches = (data.search || []).filter((item) =>
    /\bcountry\b|\bsovereign state\b|\bisland nation\b/i.test(
      item.description || '',
    ),
  );
  const queryWords = normalizedQuery.split(' ');
  const country =
    matches.find(
      (item) => normalizeCountryName(item.label || '') === normalizedQuery,
    ) ||
    (queryWords.length > 1
      ? matches.find((item) => {
          const labelWords = normalizeCountryName(item.label || '').split(' ');
          return (
            labelWords.length === queryWords.length &&
            queryWords.every(
              (word, index) =>
                labelWords[index] === word ||
                (index === queryWords.length - 1 &&
                  word.length >= 3 &&
                  (labelWords[index].startsWith(word) ||
                    labelWords[index] === `${word}s`)),
            )
          );
        })
      : null);

  return country ? { id: country.id, name: country.label } : null;
}

async function fetchWikidataEntities(entityIds, signal) {
  const uniqueIds = [...new Set(entityIds)];
  const entityGroups = [];

  for (let index = 0; index < uniqueIds.length; index += 50) {
    const searchParams = new URLSearchParams({
      action: 'wbgetentities',
      ids: uniqueIds.slice(index, index + 50).join('|'),
      props: 'claims',
      format: 'json',
      origin: '*',
    });
    const response = await fetch(`${WIKIDATA_API_URL}?${searchParams}`, {
      signal,
    });

    if (!response.ok) {
      throw new Error(`Place verification failed (HTTP ${response.status}).`);
    }

    const data = await response.json();
    entityGroups.push(...Object.values(data.entities || {}));
  }

  return new Map(entityGroups.map((entity) => [entity.id, entity]));
}

async function filterPagesByCountry(pages, countryId, signal) {
  const candidates = pages.filter(
    (page) => isEarthPlace(page) && page.pageprops?.wikibase_item,
  );
  const candidateIds = candidates.map((page) => page.pageprops.wikibase_item);
  const entities = await fetchWikidataEntities(candidateIds, signal);

  for (let depth = 0; depth < 1; depth += 1) {
    const parentIds = [...entities.values()].flatMap((entity) =>
      (entity.claims?.P131 || [])
        .map((claim) => claim.mainsnak?.datavalue?.value?.id)
        .filter((id) => id && !entities.has(id)),
    );
    if (parentIds.length === 0) break;

    const parentEntities = await fetchWikidataEntities(parentIds, signal);
    for (const [id, entity] of parentEntities) entities.set(id, entity);
  }

  function belongsToCountry(entityId, seen = new Set()) {
    if (entityId === countryId) return true;
    if (!entityId || seen.has(entityId)) return false;
    seen.add(entityId);

    const entity = entities.get(entityId);
    const countryIds = (entity?.claims?.P17 || [])
      .map((claim) => claim.mainsnak?.datavalue?.value?.id)
      .filter(Boolean);
    if (countryIds.includes(countryId)) return true;

    return (entity?.claims?.P131 || []).some((claim) =>
      belongsToCountry(claim.mainsnak?.datavalue?.value?.id, seen),
    );
  }

  return candidates.filter(
    (page) =>
      belongsToCountry(page.pageprops.wikibase_item) &&
      !isPoliticalArticle(page, entities),
  );
}

export async function searchPlacesInCountry(
  country,
  signal,
  searches = [
    `famous landmarks in ${country.name}`,
    `top tourist attractions in ${country.name}`,
    `tourist attractions in ${country.name}`,
    `national parks in ${country.name}`,
    `UNESCO World Heritage Sites in ${country.name}`,
    `best places to visit in ${country.name}`,
  ],
) {
  const results = await Promise.all(
    searches.map((search) => fetchCountrySearch(search, signal)),
  );
  const candidates = new Map();

  results.forEach(({ pages }, searchIndex) => {
    pages.forEach((page) => {
      if (
        isEarthPlace(page) &&
        normalizeCountryName(page.title) !==
          normalizeCountryName(country.name) &&
        !candidates.has(page.pageid)
      ) {
        candidates.set(page.pageid, {
          ...page,
          searchRank: searchIndex * 100 + page.index,
        });
      }
    });
  });

  const pages = await filterPagesByCountry(
    [...candidates.values()],
    country.id,
    signal,
  );

  return {
    pages: pages.sort((left, right) => left.searchRank - right.searchRank),
    continuation: results
      .filter((result) => result.continuation)
      .map(({ query, continuation }) => ({ query, continuation })),
  };
}

async function fetchCountrySearch(search, signal) {
  const query = search.query || search;
  const result = await fetchWikimediaQuery(
    WIKIPEDIA_API_URL,
    {
      generator: 'search',
      gsrsearch: query,
      gsrnamespace: '0',
      gsrlimit: '20',
      prop: 'coordinates|pageimages|extracts|pageprops',
      coprop: 'type|globe',
      ...(search.continuation || {}),
    },
    signal,
  );

  return {
    pages: Array.isArray(result.pages) ? result.pages : [],
    query,
    continuation: result.continue,
  };
}
