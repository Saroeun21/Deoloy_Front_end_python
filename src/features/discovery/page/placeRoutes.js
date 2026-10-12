export function getPlaceDetailPath(item) {
  const id = encodeURIComponent(String(item.id));

  if (item.kind === 'place' && /^[1-9]\d*$/.test(String(item.id))) {
    return `/places/place/${id}`;
  }
  if (item.kind !== 'place') {
    return `/places/destination/${id}`;
  }
  return `/places/${id}`;
}
