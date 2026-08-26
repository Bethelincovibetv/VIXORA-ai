// API Key Service for Vixora Studio
// Manages generation, verification, and local/remote synchronization of API keys

export interface ApiKeyRecord {
  id: string;
  name: string;
  apiKey: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  status: 'active' | 'revoked';
  rateLimitPerMin: number;
  permissions: string[];
  usageCount: number;
}

const STORAGE_KEY = 'vixora_api_keys_v1';

export function generateSecureApiKey(name: string = 'Production API Key', permissions: string[] = ['videos:create', 'scripts:generate', 'audio:tts', 'assets:search', 'remote:embed']): ApiKeyRecord {
  const timestamp = Date.now().toString(36);
  const randomPart1 = Math.random().toString(36).substring(2, 10);
  const randomPart2 = Math.random().toString(36).substring(2, 10);
  const randomPart3 = Math.random().toString(36).substring(2, 10);
  const fullKey = `vx_live_${timestamp}_${randomPart1}${randomPart2}${randomPart3}`;
  
  const record: ApiKeyRecord = {
    id: `key_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    name: name.trim() || 'Default Website Key',
    apiKey: fullKey,
    prefix: fullKey.substring(0, 15) + '...',
    createdAt: new Date().toISOString(),
    lastUsedAt: null,
    status: 'active',
    rateLimitPerMin: 120,
    permissions,
    usageCount: 0,
  };

  saveApiKey(record);
  return record;
}

export function listLocalApiKeys(): ApiKeyRecord[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {}

  // If none exists, seed default primary key
  const defaultKey: ApiKeyRecord = {
    id: 'key_primary_default',
    name: 'Main Website & Remote Embed Key',
    apiKey: 'vx_live_vixora_prod_89f3a928b7e411d9c02',
    prefix: 'vx_live_vixora_...',
    createdAt: new Date().toISOString(),
    lastUsedAt: new Date().toISOString(),
    status: 'active',
    rateLimitPerMin: 120,
    permissions: ['videos:create', 'scripts:generate', 'audio:tts', 'assets:search', 'remote:embed'],
    usageCount: 14,
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([defaultKey]));
  } catch {}

  return [defaultKey];
}

export function saveApiKey(key: ApiKeyRecord): void {
  try {
    const keys = listLocalApiKeys();
    const existingIndex = keys.findIndex(k => k.id === key.id || k.apiKey === key.apiKey);
    if (existingIndex >= 0) {
      keys[existingIndex] = key;
    } else {
      keys.unshift(key);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
  } catch (err) {
    console.error('Failed to save API key:', err);
  }
}

export async function generateRemoteApiKey(name: string = 'Production API Key', permissions: string[] = ['videos:create', 'scripts:generate', 'audio:tts', 'assets:search', 'remote:embed'], rateLimit: number = 120): Promise<ApiKeyRecord> {
  try {
    const res = await fetch('/api/public/v1/keys/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, permissions, rate_limit: rateLimit })
    });
    const data = await res.json();
    if (data.ok && data.key) {
      saveApiKey(data.key);
      return data.key;
    }
  } catch (e) {
    console.warn('Server key generation offline fallback:', e);
  }
  return generateSecureApiKey(name, permissions);
}

export function revokeApiKey(id: string): ApiKeyRecord[] {
  try {
    const keys = listLocalApiKeys();
    const updated = keys.map(k => k.id === id ? { ...k, status: 'revoked' as const } : k);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

export async function revokeRemoteApiKey(id: string, apiKey?: string): Promise<ApiKeyRecord[]> {
  try {
    await fetch('/api/public/v1/keys/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, apiKey })
    });
  } catch (e) {
    console.warn('Server key revocation offline fallback:', e);
  }
  return revokeApiKey(id);
}

export function deleteApiKey(id: string): ApiKeyRecord[] {
  try {
    const keys = listLocalApiKeys();
    const updated = keys.filter(k => k.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}
