/**
 * Auth helpers — проверка токена, получение роли.
 */
import Cookies from "js-cookie";

export function getToken(): string | undefined {
  return Cookies.get("access_token");
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

/** Декодирует payload JWT (без верификации — только для UI) */
export function decodeToken(): { sub: string; role: string; exp: number } | null {
  const token = getToken();
  if (!token) return null;
  try {
    const payload = token.split(".")[1];
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

export function isAdmin(): boolean {
  const decoded = decodeToken();
  return decoded?.role === "admin";
}
