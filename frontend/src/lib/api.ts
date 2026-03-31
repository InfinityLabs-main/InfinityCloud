/**
 * Infinity Cloud — HTTP API клиент.
 * Обёртка над axios для взаимодействия с FastAPI backend.
 */
import axios from "axios";
import Cookies from "js-cookie";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: { "Content-Type": "application/json" },
});

// Interceptor — добавляем JWT токен к каждому запросу
api.interceptors.request.use((config) => {
  const token = Cookies.get("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor — обработка 401 (редирект на логин)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== "undefined") {
      Cookies.remove("access_token");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

// ═══════════════════════════════════════════════════
//  Типы
// ═══════════════════════════════════════════════════

export interface User {
  id: number;
  email: string;
  role: string;
  balance: number;
  is_active: boolean;
  created_at: string;
}

export interface Plan {
  id: number;
  name: string;
  slug: string;
  cpu_cores: number;
  ram_mb: number;
  disk_gb: number;
  bandwidth_tb: number;
  price_per_hour: number;
  price_per_month: number;
  is_active: boolean;
  sort_order: number;
}

export interface Server {
  id: number;
  user_id: number;
  plan_id: number;
  node_id: number | null;
  proxmox_vmid: number | null;
  hostname: string;
  os_template: string;
  status: string;
  rdns: string | null;
  ip_address: string | null;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: number;
  user_id: number;
  server_id: number | null;
  type: string;
  amount: number;
  balance_after: number;
  description: string | null;
  created_at: string;
}

export interface Node {
  id: number;
  name: string;
  hostname: string;
  port: number;
  total_cpu: number;
  total_ram_mb: number;
  total_disk_gb: number;
  used_cpu: number;
  used_ram_mb: number;
  used_disk_gb: number;
  is_active: boolean;
  max_vms: number;
}

// ═══════════════════════════════════════════════════
//  Авторизация
// ═══════════════════════════════════════════════════

export const authApi = {
  register: (email: string, password: string) =>
    api.post<User>("/auth/register", { email, password }),

  login: async (email: string, password: string) => {
    const resp = await api.post<{ access_token: string; token_type: string }>(
      "/auth/login",
      { email, password }
    );
    Cookies.set("access_token", resp.data.access_token, { expires: 1 });
    return resp.data;
  },

  me: () => api.get<User>("/auth/me"),

  logout: () => {
    Cookies.remove("access_token");
    if (typeof window !== "undefined") window.location.href = "/login";
  },
};

// ═══════════════════════════════════════════════════
//  Пользователь
// ═══════════════════════════════════════════════════

export const userApi = {
  getBalance: () => api.get<{ balance: number }>("/users/balance"),
  deposit: (amount: number) => api.post<Transaction>("/users/deposit", { amount }),
  getTransactions: (page = 1) =>
    api.get<{ items: Transaction[]; total: number }>("/users/transactions", {
      params: { page },
    }),
};

// ═══════════════════════════════════════════════════
//  Серверы
// ═══════════════════════════════════════════════════

export const serverApi = {
  list: () => api.get<{ items: Server[]; total: number }>("/servers"),

  get: (id: number) => api.get<Server>(`/servers/${id}`),

  create: (data: {
    plan_id: number;
    hostname: string;
    os_template: string;
    idempotency_key?: string;
  }) => api.post<Server>("/servers", data),

  action: (id: number, action: string) =>
    api.post<Server>(`/servers/${id}/action`, { action }),

  updateRdns: (id: number, rdns: string) =>
    api.put<Server>(`/servers/${id}/rdns`, { rdns }),

  delete: (id: number) => api.delete(`/servers/${id}`),
};

// ═══════════════════════════════════════════════════
//  Тарифы
// ═══════════════════════════════════════════════════

export const planApi = {
  list: () => api.get<Plan[]>("/plans"),
  get: (id: number) => api.get<Plan>(`/plans/${id}`),
};

// ═══════════════════════════════════════════════════
//  Консоль
// ═══════════════════════════════════════════════════

export const consoleApi = {
  getVnc: (serverId: number) =>
    api.get<{ url: string; ticket: string; port: string }>(
      `/console/${serverId}/vnc`
    ),
};

// ═══════════════════════════════════════════════════
//  Админ API
// ═══════════════════════════════════════════════════

export const adminApi = {
  // Тарифы
  createPlan: (data: Partial<Plan>) => api.post<Plan>("/admin/plans", data),
  updatePlan: (id: number, data: Partial<Plan>) =>
    api.put<Plan>(`/admin/plans/${id}`, data),
  deletePlan: (id: number) => api.delete(`/admin/plans/${id}`),

  // Ноды
  listNodes: () => api.get<Node[]>("/admin/nodes"),
  createNode: (data: Partial<Node>) => api.post<Node>("/admin/nodes", data),
  updateNode: (id: number, data: Partial<Node>) =>
    api.put<Node>(`/admin/nodes/${id}`, data),
  deleteNode: (id: number) => api.delete(`/admin/nodes/${id}`),
  testNode: (data: {
    hostname: string; port: number; api_user: string;
    api_token_name: string; api_token_value: string;
  }) => api.post<{ success: boolean; version?: string; release?: string; error?: string }>(
    "/admin/nodes/test", data
  ),

  // Серверы
  listServers: (page = 1) =>
    api.get<Server[]>("/admin/servers", { params: { page } }),
  serverAction: (id: number, action: string) =>
    api.post<Server>(`/admin/servers/${id}/action`, { action }),
  deleteServer: (id: number) => api.delete(`/admin/servers/${id}`),

  // Пользователи
  listUsers: (page = 1) =>
    api.get<User[]>("/admin/users", { params: { page } }),
  depositUser: (userId: number, amount: number) =>
    api.post<Transaction>(`/admin/users/${userId}/deposit`, { amount }),
  toggleUser: (userId: number, is_active: boolean) =>
    api.put<User>(`/admin/users/${userId}/toggle`, { is_active }),
  setUserRole: (userId: number, role: string) =>
    api.put<User>(`/admin/users/${userId}/role`, { role }),
  resetUserPassword: (userId: number, new_password: string) =>
    api.post(`/admin/users/${userId}/reset-password`, { new_password }),

  // Статистика
  getStats: () => api.get<{
    total_users: number; total_servers: number; active_servers: number;
    total_nodes: number; total_revenue: number;
    server_statuses: Record<string, number>;
    nodes_load: Array<{ id: number; name: string; cpu_usage: number; ram_usage: number; disk_usage: number }>;
    recent_logs: Array<{
      id: number; user_id: number; action: string;
      target_type: string; target_id: number; details: string | null; created_at: string;
    }>;
  }>("/admin/stats"),

  // Транзакции
  listTransactions: (page = 1) =>
    api.get<{ items: Transaction[]; total: number }>("/admin/transactions", {
      params: { page },
    }),

  // Логи
  listLogs: (page = 1) =>
    api.get("/admin/logs", { params: { page } }),
};

export default api;
