import { getApp, getApps, initializeApp } from "firebase/app";
import {
  getAuth,
  getAdditionalUserInfo,
  GoogleAuthProvider,
  getRedirectResult,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export function isGooglePhotoUrl(value) {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      (hostname === "googleusercontent.com" ||
        hostname.endsWith(".googleusercontent.com"))
    );
  } catch {
    return false;
  }
}

export function readGooglePhotoUrl() {
  if (typeof localStorage === "undefined") return "";
  const photoUrl = localStorage.getItem("googlePhotoUrl") || "";
  return isGooglePhotoUrl(photoUrl) ? photoUrl : "";
}

function getFirebaseAuth() {
  const missingSettings = Object.entries(firebaseConfig)
    .filter(([, value]) => !value)
    .map(([name]) => name);
  if (missingSettings.length > 0) {
    throw new Error(
      `Google sign-in is missing Firebase settings: ${missingSettings.join(", ")}.`,
    );
  }

  const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  return getAuth(app);
}

function createGoogleProvider() {
  const provider = new GoogleAuthProvider();
  provider.addScope("profile");
  provider.setCustomParameters({ prompt: "select_account" });

  return provider;
}

function shouldUseGoogleRedirect() {
  if (typeof navigator === "undefined") return false;

  const userAgent = navigator.userAgent || "";
  return (
    /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent) ||
    (navigator.maxTouchPoints > 1 && /Macintosh/i.test(userAgent))
  );
}

async function getGoogleAccount(result) {
  const credential = GoogleAuthProvider.credentialFromResult(result);
  const providerProfile = result.user.providerData.find(
    (profile) => profile.providerId === "google.com",
  );
  const additionalProfile = getAdditionalUserInfo(result)?.profile;
  let photoUrl =
    result.user.photoURL ||
    providerProfile?.photoURL ||
    (typeof additionalProfile?.picture === "string"
      ? additionalProfile.picture
      : null);
  if (!isGooglePhotoUrl(photoUrl) && credential?.accessToken) {
    try {
      const response = await fetch(
        "https://www.googleapis.com/oauth2/v3/userinfo",
        {
          headers: { Authorization: `Bearer ${credential.accessToken}` },
        },
      );
      if (!response.ok) {
        throw new Error(`Google profile request failed (HTTP ${response.status}).`);
      }
      const profile = await response.json();
      if (isGooglePhotoUrl(profile.picture)) {
        photoUrl = profile.picture;
      }
    } catch (error) {
      console.warn("Could not retrieve Google profile photo:", error);
    }
  }
  return {
    idToken: await result.user.getIdToken(true),
    photoUrl: isGooglePhotoUrl(photoUrl) ? photoUrl : null,
  };
}

export async function getGoogleIdToken() {
  const auth = getFirebaseAuth();
  const provider = createGoogleProvider();
  let result;

  if (shouldUseGoogleRedirect()) {
    await signInWithRedirect(auth, provider);
    return null;
  }

  try {
    result = await signInWithPopup(auth, provider);
  } catch (error) {
    if (error?.code !== "auth/popup-blocked") {
      throw error;
    }

    await signInWithRedirect(auth, provider);
    return null;
  }

  return getGoogleAccount(result);
}

export async function getGoogleRedirectIdToken() {
  if (Object.values(firebaseConfig).some((value) => !value)) {
    return null;
  }

  const result = await getRedirectResult(getFirebaseAuth());
  return result ? getGoogleAccount(result) : null;
}

export async function signOutFromGoogle() {
  if (getApps().length > 0) {
    await signOut(getAuth(getApp()));
  }
}
