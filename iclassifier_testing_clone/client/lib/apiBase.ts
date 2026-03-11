const trimTrailingSlashes = (value: string) => value.replace(/\/+$/, "");

const normalizedBasePath = (() => {
  const rawBase = String(import.meta.env.BASE_URL || "/");
  if (rawBase === "/") return "";
  const cleaned = rawBase.replace(/^\/+|\/+$/g, "");
  return cleaned ? `/${cleaned}` : "";
})();

const explicitApiBase = String(import.meta.env.VITE_API_URL || "").trim();
const explicitAppBase = String(import.meta.env.VITE_BASE_PATH || "").trim();

export const APP_BASE_PATH = explicitAppBase
  ? explicitAppBase.replace(/\/+$/, "") || "/"
  : normalizedBasePath || "/";

export const API_BASE_URL = explicitApiBase
  ? trimTrailingSlashes(explicitApiBase)
  : `${normalizedBasePath}/api`;

export const apiUrl = (path: string) => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
};
