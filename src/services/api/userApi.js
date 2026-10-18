import { apiRequest } from "./httpClient.js";

const userApi = {
  getCurrentUser() {
    return apiRequest("/users/me");
  },
  updateCurrentUser(profile) {
    return apiRequest("/users/me", {
      method: "PATCH",
      body: JSON.stringify(profile),
    });
  },
  uploadAvatar(file) {
    const formData = new FormData();
    formData.append("file", file);
    return apiRequest("/users/me/avatar", {
      method: "POST",
      body: formData,
    });
  },
};

export default userApi;
