import { searchPlacesInCountry, findCountry } from './wikipediaCountrySearch.js';
import {
  fetchWikimediaQuery,
  WIKIPEDIA_API_URL,
} from './wikimediaApi.js';
import {
  isEarthPlace,
  mapWikipediaPage,
} from './wikipediaPlaceMapper.js';

export async function searchWikipediaPlaces(query, signal, continuation) {
  const {
    countryName: continuedCountry,
    countrySearches,
    searchQuery,
    ...apiContinuation
  } = continuation || {};
  const country = await resolveCountry(query, continuedCountry, signal);

  if (country) {
    return searchCountryPlaces(country, countrySearches, signal);
  }

  return searchGeneralPlaces(query, searchQuery, apiContinuation, signal);
}

async function resolveCountry(query, currentCountry, signal) {
  if (currentCountry) return currentCountry;

  try {
    return await findCountry(query, signal);
  } catch (error) {
    console.warn(
      'Country detection is unavailable; searching place names instead:',
      error,
    );
    return null;
  }
}

async function searchCountryPlaces(country, searches, signal) {
  const result = await searchPlacesInCountry(country, signal, searches);
  const places = result.pages.map((page) => ({
    ...mapWikipediaPage(page, country.name),
    location: country.name,
  }));

  return {
    places,
    continuation: result.continuation.length
      ? { countryName: country, countrySearches: result.continuation }
      : null,
    countryName: country.name,
  };
}

async function searchGeneralPlaces(query, savedQuery, continuation, signal) {
  const searchQuery = savedQuery || query;
  const result = await fetchWikimediaQuery(
    WIKIPEDIA_API_URL,
    {
      generator: 'search',
      gsrsearch: searchQuery,
      gsrnamespace: '0',
      gsrlimit: '20',
      ...continuation,
    },
    signal,
  );
  const pages = Array.isArray(result.pages)
    ? result.pages.filter(isEarthPlace)
    : [];
  const places = pages
    .sort((left, right) => left.index - right.index)
    .map(mapWikipediaPage);

  return {
    places,
    continuation: result.continue
      ? { ...result.continue, searchQuery }
      : null,
    countryName: null,
  };
}

export async function getWikipediaPlaceById(pageId) {
  const result = await fetchWikimediaQuery(WIKIPEDIA_API_URL, {
    pageids: pageId,
  });
  const pages = Array.isArray(result.pages) ? result.pages : [];

  if (pages.length === 0 || !isEarthPlace(pages[0])) return null;

  return mapWikipediaPage(pages[0]);
}
