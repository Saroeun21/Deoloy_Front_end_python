import { getHomeDestinations } from "./homeApi.js";
import { fetchPlaces } from "./placeapi.js";
import { apiRequest } from "./httpClient.js";

export function getDestinations() {
  return getHomeDestinations();
}

export function getRecommendedPlaces() {
  return fetchPlaces();
}

export function createDestination(destinationData) {
  return apiRequest("/destinations", {
    method: "POST",
    body: JSON.stringify(destinationData),
  });
}
