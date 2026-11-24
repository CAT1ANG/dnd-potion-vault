// Общие типы. Импортируйте этот же файл в route handler (/api/prototype),
// чтобы клиент и сервер не расходились.

export type Potion = {
  id: string; category: string; name: string; fullName: string; rarity: string;
  color: string; shape: string; interaction: string; range: string; formula: string;
};
export type InventoryItem = { id: string; claimedAt: string; potion: Potion };
export type PrintItem = { id: string; number: number; potion: Potion; url: string; qr: string };
export type PrintBundle = { url: string; qr: string; itemCount: number };
export type Outcome = { amount: number; dice: number[]; bonus: number; formula: string };
export type ConsumeResult = { potion: Potion; outcome: Outcome };
export type ShareCode = { itemId: string; url: string; qr: string };

export type ClaimTarget =
  | { kind: 'token'; token: string }
  | { kind: 'share'; itemId: string }
  | { kind: 'batch'; token: string };

export type ApiRequest =
  | { action: 'claim'; token: string; deviceId: string }
  | { action: 'claim_share'; itemId: string; deviceId: string }
  | { action: 'claim_batch'; token: string; deviceId: string }
  | { action: 'create_batch'; items: { potionId: string; quantity: number }[] }
  | { action: 'share'; itemId: string; deviceId: string }
  // requestId делает повтор безопасным: сервер должен вернуть тот же результат
  | { action: 'consume'; itemId: string; deviceId: string; requestId: string };
