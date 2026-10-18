const BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || "/api/v1"
).replace(/\/+$/, "");
const UNAUTHORIZED_EVENT = "tripos:unauthorized";

export function resolveApiUrl(path) {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }
  const apiOrigin = new URL(BASE_URL, window.location.origin).origin;
  return new URL(path, `${apiOrigin}/`).toString();
}

function getAuthHeaders() {
  const token =
    typeof localStorage === "undefined"
      ? null
      : localStorage.getItem("accessToken");

  return token ? { Authorization: `Bearer ${token}` } : {};
}

function formatErrorDetail(responseBody) {
  if (!responseBody) {
    return "";
  }

  try {
    const errorData = JSON.parse(responseBody);
    const detail = errorData.detail;
    if (typeof detail === "string") {
      return detail;
    }
    return detail === undefined ? responseBody : JSON.stringify(detail);
  } catch {
    return responseBody;
  }
}

export async function apiRequest(path, options = {}) {
  const hasBody = options.body !== undefined;
  const isFormData =
    typeof FormData !== "undefined" && options.body instanceof FormData;
  let response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: {
        ...getAuthHeaders(),
        ...(hasBody && !isFormData
          ? { "Content-Type": "application/json" }
          : {}),
        ...options.headers,
      },
    });
  } catch (error) {
    const reason = error instanceof Error ? ` ${error.message}` : "";
    throw new Error(
      `Cannot reach the Komsan API at ${BASE_URL}. Check that the backend is running.${reason}`,
    );
  }

  if (!response.ok) {
    const detail = formatErrorDetail(await response.text());
    if (
      response.status === 401 &&
      path !== "/auth/login" &&
      path !== "/auth/google"
    ) {
      localStorage.removeItem("accessToken");
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    }
    const serverHint =
      response.status >= 500
        ? " The backend could not complete the request; check its configuration and logs."
        : "";
    throw new Error(
      `API request failed (HTTP ${response.status})${
        detail ? `: ${detail}` : "."
      }${serverHint}`,
    );
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export function createResourceApi(path) {
  const collectionPath = `/${path}`;

  function itemPath(id) {
    return `${collectionPath}/${encodeURIComponent(String(id))}`;
  }

  return {
    list() {
      return apiRequest(collectionPath);
    },
    getById(id) {
      return apiRequest(itemPath(id));
    },
    create(data) {
      return apiRequest(collectionPath, {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    update(id, data) {
      return apiRequest(itemPath(id), {
        method: "PATCH",
        body: JSON.stringify(data),
      });
    },
    async remove(id) {
      const result = await apiRequest(itemPath(id), { method: "DELETE" });
      return result === null ? true : result;
    },
  };
}
