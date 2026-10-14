import { apiRequest, createResourceApi } from "./httpClient.js";

const memoryPhotos = createResourceApi("memory-photos");

export const fetchMemoryPhotos = () => memoryPhotos.list();
export const fetchMemoryPhotoById = (id) => memoryPhotos.getById(id);
export const createMemoryPhoto = (photoData) => memoryPhotos.create(photoData);
export const uploadMemoryPhoto = ({ memoryId, file, caption }) => {
  const formData = new FormData();
  formData.append("memory_id", String(memoryId));
  formData.append("file", file);
  if (caption) formData.append("caption", caption);
  return apiRequest("/memory-photos/upload", {
    method: "POST",
    body: formData,
  });
};
export const updateMemoryPhoto = (id, photoData) =>
  memoryPhotos.update(id, photoData);
export const deleteMemoryPhoto = (id) => memoryPhotos.remove(id);

const memoryPhotoApi = {
  list: fetchMemoryPhotos,
  getById: fetchMemoryPhotoById,
  create: createMemoryPhoto,
  upload: uploadMemoryPhoto,
  update: updateMemoryPhoto,
  remove: deleteMemoryPhoto,
};

export default memoryPhotoApi;