import { apiRequest } from "./httpClient.js";

export function registerUser(userData) {
  return apiRequest("/auth/register", {
    method: "POST",
    body: JSON.stringify(userData),
  });
}

export function loginUser(credentials) {
  return apiRequest("/auth/login", {
    method: "POST",
    body: JSON.stringify(credentials),
  });
}

export function loginWithGoogle({ idToken, photoUrl }) {
  return apiRequest("/auth/google", {
    method: "POST",
    body: JSON.stringify({ id_token: idToken, photo_url: photoUrl }),
  });
}

const authApi = {
  register: registerUser,
  login: loginUser,
  loginWithGoogle,
};

export default authApi;
