import { apiRequest } from "./httpClient.js";

export async function getDestinations(limit = 50) {
  const data = await apiRequest("/destinations");
  if (!Array.isArray(data)) {
    throw new Error("Expected a list from /destinations.");
  }
  return data.slice(0, limit);
}

export function getDestinationById(id) {
  return apiRequest(`/destinations/${encodeURIComponent(String(id))}`);
}

export async function getRecommendedPlaces(limit = 50) {
  const data = await apiRequest("/places");
  if (!Array.isArray(data)) {
    throw new Error("Expected a list from /places.");
  }
  return data.slice(0, limit);
}

export async function getSavedPlaces() {
  const data = await apiRequest("/saved-places");
  if (!Array.isArray(data)) {
    throw new Error("Expected a list from /saved-places.");
  }
  return data;
}
