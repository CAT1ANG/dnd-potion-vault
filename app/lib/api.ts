import type { ApiRequest, InventoryItem } from '../types';

export const API = '/api/prototype';
export const NETWORK_ERROR = 'Не удалось связаться с лабораторией';

export class ApiError extends Error {
  status: number; // 0 = сеть недоступна
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export const isAbort = (error: unknown) => error instanceof DOMException && error.name === 'AbortError';

export function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export async function api<T>(body: ApiRequest, signal?: AbortSignal): Promise<T> {
  let response: Response;
  try {
    response = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (isAbort(error)) throw error;
    throw new ApiError(NETWORK_ERROR, 0);
  }
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new ApiError(data.error || NETWORK_ERROR, response.status);
  return data;
}

export async function fetchInventory(deviceId: string, signal?: AbortSignal): Promise<InventoryItem[]> {
  const response = await fetch(`${API}?deviceId=${encodeURIComponent(deviceId)}`, { cache: 'no-store', signal });
  const data = (await response.json().catch(() => ({}))) as { items?: InventoryItem[]; error?: string };
  if (!response.ok) throw new ApiError(data.error || 'Не удалось обновить инвентарь', response.status);
  return data.items ?? [];
}
