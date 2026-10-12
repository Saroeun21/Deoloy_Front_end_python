import { createResourceApi } from './httpClient.js';

const savedItems = createResourceApi('saved-items');

export const fetchSavedItems = () => savedItems.list();

export const saveItem = (item) =>
  savedItems.create({
    item_type: item.item_type,
    item_key: String(item.item_key),
    title: item.title || item.name,
    description: item.description || item.desc || null,
    image: item.image || item.img || null,
    location: item.location || item.address || null,
    source_url: item.source_url || item.sourceUrl || null,
  });

export const removeSavedItem = (id) => savedItems.remove(id);

const savedItemApi = {
  list: fetchSavedItems,
  save: saveItem,
  remove: removeSavedItem,
};

export default savedItemApi;
