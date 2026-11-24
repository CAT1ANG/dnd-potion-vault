import type { ApiRequest, ClaimTarget } from '../types';
import { api } from './api';

export function parseClaimTarget(params: URLSearchParams): ClaimTarget | null {
  const token = params.get('p');
  if (token) return { kind: 'token', token };
  const itemId = params.get('s');
  if (itemId) return { kind: 'share', itemId };
  const batch = params.get('b');
  if (batch) return { kind: 'batch', token: batch };
  return null;
}

export function parseClaimTargetFromUrl(raw: string, base: string): ClaimTarget | null {
  try {
    return parseClaimTarget(new URLSearchParams(new URL(raw, base).hash.slice(1)));
  } catch {
    return null;
  }
}

function toRequest(target: ClaimTarget, deviceId: string): ApiRequest {
  switch (target.kind) {
    case 'token': return { action: 'claim', token: target.token, deviceId };
    case 'share': return { action: 'claim_share', itemId: target.itemId, deviceId };
    case 'batch': return { action: 'claim_batch', token: target.token, deviceId };
  }
}

/** Забирает зелье(я) и возвращает текст уведомления. */
export async function claimTarget(target: ClaimTarget, deviceId: string): Promise<string> {
  const data = await api<{ transferred?: boolean; count?: number }>(toRequest(target, deviceId));
  if (target.kind === 'batch') return `Набор из ${data.count || 0} зелий добавлен в инвентарь.`;
  return data.transferred ? 'Зелье перешло в ваш инвентарь от другого игрока.' : 'Зелье добавлено в инвентарь.';
}
