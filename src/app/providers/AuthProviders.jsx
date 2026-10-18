import { useEffect, useState } from "react";
import authApi from "../../services/api/authapi.js";
import {
  getGoogleIdToken,
  isGooglePhotoUrl,
  readGooglePhotoUrl,
  signOutFromGoogle,
} from "../../services/api/firebaseAuth.js";
import { AuthContext } from "./authContext.js";

const ACCESS_TOKEN_KEY = "accessToken";
const UNAUTHORIZED_EVENT = "tripos:unauthorized";

function readAccessToken() {
  return typeof localStorage === "undefined"
    ? ""
    : localStorage.getItem(ACCESS_TOKEN_KEY) || "";
}

export function AuthProvider({ children }) {
  const [accessToken, setAccessToken] = useState(readAccessToken);
  const [googlePhotoUrl, setGooglePhotoUrl] = useState(readGooglePhotoUrl);
  const [welcomeEmailStatus, setWelcomeEmailStatus] = useState(null);

  useEffect(() => {
    function handleUnauthorized() {
      localStorage.removeItem(ACCESS_TOKEN_KEY);
      setAccessToken("");
    }

    window.addEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
    return () =>
      window.removeEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
  }, []);

  async function signIn(
    credentials,
    { sendWelcomeEmail = true, updateWelcomeEmailStatus = true } = {},
  ) {
    const result = await authApi.login({
      ...credentials,
      send_welcome_email: sendWelcomeEmail,
    });

    if (!result.access_token) {
      throw new Error("The login response did not include an access token.");
    }

    localStorage.setItem(ACCESS_TOKEN_KEY, result.access_token);
    localStorage.removeItem("googlePhotoUrl");
    setAccessToken(result.access_token);
    setGooglePhotoUrl("");
    if (updateWelcomeEmailStatus) {
      setWelcomeEmailStatus(
        result.welcome_email_status === "not_applicable"
          ? null
          : result.welcome_email_status,
      );
    }
  }

  async function signUp(userDetails) {
    const result = await authApi.register(userDetails);
    setWelcomeEmailStatus(result.welcome_email_status || null);
    await signIn(
      {
        email: userDetails.email,
        password: userDetails.password,
      },
      { sendWelcomeEmail: false, updateWelcomeEmailStatus: false },
    );
  }

  async function signInWithGoogle() {
    const googleAccount = await getGoogleIdToken();
    const result = await authApi.loginWithGoogle(googleAccount);
    if (!result.access_token) {
      throw new Error(
        "The Google sign-in response did not include an access token.",
      );
    }
    localStorage.setItem(ACCESS_TOKEN_KEY, result.access_token);
    setAccessToken(result.access_token);
    setWelcomeEmailStatus(
      result.welcome_email_status === "not_applicable"
        ? null
        : result.welcome_email_status,
    );
    const photoUrl = isGooglePhotoUrl(result.avatar_url)
      ? result.avatar_url
      : googleAccount.photoUrl;
    if (isGooglePhotoUrl(photoUrl)) {
      localStorage.setItem("googlePhotoUrl", photoUrl);
      setGooglePhotoUrl(photoUrl);
    } else {
      localStorage.removeItem("googlePhotoUrl");
      setGooglePhotoUrl("");
    }
  }

  function signOut() {
    void signOutFromGoogle().catch((error) => {
      console.error("Could not sign out from Google:", error);
    });
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem("googlePhotoUrl");
    setAccessToken("");
    setGooglePhotoUrl("");
    setWelcomeEmailStatus(null);
  }

  function dismissWelcomeEmailNotice() {
    setWelcomeEmailStatus(null);
  }

  return (
    <AuthContext.Provider
      value={{
        accessToken,
        googlePhotoUrl,
        signIn,
        signInWithGoogle,
        signUp,
        signOut,
        welcomeEmailStatus,
        dismissWelcomeEmailNotice,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}