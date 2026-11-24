import { STORAGE_KEYS } from '../constants';

export function safeGet(key: string): string | null {
  try { return window.localStorage.getItem(key); } catch { return null; }
}

export function safeSet(key: string, value: string): boolean {
  try { window.localStorage.setItem(key, value); return true; } catch { return false; }
}

/** crypto.randomUUID есть не везде (HTTP, старые браузеры), поэтому есть запасной путь. */
export function createUuid(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  const bytes = new Uint8Array(16);
  if (c && typeof c.getRandomValues === 'function') c.getRandomValues(bytes);
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const h = Array.from(bytes, b => b.toString(16).padStart(2, '0'));
  return `${h.slice(0, 4).join('')}-${h.slice(4, 6).join('')}-${h.slice(6, 8).join('')}-${h.slice(8, 10).join('')}-${h.slice(10).join('')}`;
}

// Если localStorage недоступен, id живёт до перезагрузки страницы.
let memoryDeviceId: string | null = null;

export function getDeviceId(): { id: string; persistent: boolean } {
  const stored = safeGet(STORAGE_KEYS.device);
  if (stored) return { id: stored, persistent: true };
  const id = memoryDeviceId ?? createUuid();
  memoryDeviceId = id;
  return { id, persistent: safeSet(STORAGE_KEYS.device, id) };
}
