export function getSavedItemKey(item) {
  if (!item || item.id === undefined || item.id === null) return '';
  const id = String(item.id);
  const type = item.kind === 'destination'
    ? 'destination'
    : id.startsWith('wiki-')
      ? 'wikipedia'
      : 'place';
  return `${type}:${id}`;
}
