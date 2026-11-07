import axios from "axios";
<<<<<<< HEAD

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const API_BASE_URL2 = import.meta.env.VITE_API_BASE_URL2;
const API_AI_BASE_URL = import.meta.env.VITE_AI_BASE_URL ?? API_BASE_URL;
const AUTH_TOKEN_KEY = "flownote_auth_token";
const AUTH_USER_KEY = "flownote_auth_user";
=======
import { requireBrowserReachableUrl, resolveBrowserReachableUrl } from "./cloudUrl";
import { installDeviceTransport } from '../lib/deviceTransport';

const API_BASE_URL = requireBrowserReachableUrl("VITE_API_BASE_URL", import.meta.env.VITE_API_BASE_URL);
const API_BASE_URL2 = resolveBrowserReachableUrl(import.meta.env.VITE_API_BASE_URL2) ?? API_BASE_URL;
const API_CORE_BASE_URL = resolveBrowserReachableUrl(import.meta.env.VITE_CORE_API_URL) ?? API_BASE_URL2;
const API_AI_BASE_URL = resolveBrowserReachableUrl(import.meta.env.VITE_AI_BASE_URL) ?? API_BASE_URL;
// Sync now lives on the gateway; obsolete Next/SSE configuration is ignored.
const API_SYNC_BASE_URL = resolveBrowserReachableUrl(import.meta.env.VITE_CANVAS_SOCKET_URL) ?? API_BASE_URL;
const AUTH_TOKEN_KEY = "flownote_auth_token";
const AUTH_USER_KEY = "flownote_auth_user";
axios.defaults.headers.common["X-Flownote-Web"] = "1";
installDeviceTransport();
>>>>>>> 678fcbf (separate repository to flownote-service)

type AuthUser = {
  id: string;
  username: string;
  email: string;
  nickname: string;
<<<<<<< HEAD
=======
  role?: "USER" | "ADMIN";
>>>>>>> 678fcbf (separate repository to flownote-service)
};

const DEFAULT_HEADERS = {
  "Content-Type": "application/json",
};

<<<<<<< HEAD
const getAuthToken = () => localStorage.getItem(AUTH_TOKEN_KEY);

const setAuthToken = (token: string) => {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
=======
// Browser state is not a credential. The server session lives in an HttpOnly cookie.
const getAuthToken = () => {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  const user = getAuthUser();
  return user ? `web:${user.id}` : null;
};

const setAuthToken = () => {
  localStorage.removeItem(AUTH_TOKEN_KEY);
>>>>>>> 678fcbf (separate repository to flownote-service)
};

const getAuthUser = (): AuthUser | null => {
  const storedUser = localStorage.getItem(AUTH_USER_KEY);
  if (!storedUser) return null;

  try {
    return JSON.parse(storedUser) as AuthUser;
  } catch {
    localStorage.removeItem(AUTH_USER_KEY);
    return null;
  }
};

const setAuthUser = (user: AuthUser) => {
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
};

const clearAuthToken = () => {
  localStorage.removeItem(AUTH_TOKEN_KEY);
};

const clearAuth = () => {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
};

const isAuthenticated = () => Boolean(getAuthToken() && getAuthUser());

<<<<<<< HEAD
const authHeaders = () => {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
=======
const authHeaders = (): Record<string, string> => {
  return { "X-Flownote-Web": "1" };
>>>>>>> 678fcbf (separate repository to flownote-service)
};

export {
  API_BASE_URL,
  API_BASE_URL2,
<<<<<<< HEAD
  API_AI_BASE_URL,
=======
  API_CORE_BASE_URL,
  API_AI_BASE_URL,
  API_SYNC_BASE_URL,
  requireBrowserReachableUrl,
  resolveBrowserReachableUrl,
>>>>>>> 678fcbf (separate repository to flownote-service)
  DEFAULT_HEADERS,
  axios,
  getAuthToken,
  setAuthToken,
  getAuthUser,
  setAuthUser,
  clearAuthToken,
  clearAuth,
  isAuthenticated,
  authHeaders,
};
export type { AuthUser };
