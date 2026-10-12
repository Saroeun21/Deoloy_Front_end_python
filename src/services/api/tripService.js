import tripApi from "./tripapi.js";

export async function getTrips(limit = 50) {
  const trips = await tripApi.list();
  if (!Array.isArray(trips)) {
    throw new Error("Expected a list from /trips.");
  }
  return trips.slice(0, limit);
}

export function createTrip(tripData) {
  return tripApi.create(tripData);
}

export async function deleteTrip(tripId) {
  await tripApi.remove(tripId);
  return true;
}
