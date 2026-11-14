// Cliente HTTP da aplicação: centraliza URL da API, token e tratamento de erros.
const BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
const TOKEN_KEY = "agendai_token";

export const tokenStore = {
  get() {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token) {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* navegação privada: segue sem persistir */
    }
  },
  clear() {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignora */
    }
  },
};

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

function extractMessage(data) {
  if (!data) return null;
  if (typeof data.detail === "string") return data.detail;
  if (Array.isArray(data.detail) && data.detail.length) {
    const first = data.detail[0];
    return String(first.msg || "").replace(/^Value error, /, "") || null;
  }
  return null;
}

export async function api(path, { method = "GET", body, params, auth = true } = {}) {
  let url = `${BASE_URL}/api${path}`;
  if (params) {
    const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "");
    const query = new URLSearchParams(entries).toString();
    if (query) url += `?${query}`;
  }

  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const token = tokenStore.get();
  if (auth && token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError("Sem conexão com o servidor. Confira se a API está rodando.", 0);
  }

  if (response.status === 204) return null;
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 401 && auth && token) {
      tokenStore.clear();
      window.dispatchEvent(new Event("agendai:logout"));
    }
    throw new ApiError(extractMessage(data) || "Algo deu errado. Tente de novo.", response.status, data);
  }
  return data;
}
