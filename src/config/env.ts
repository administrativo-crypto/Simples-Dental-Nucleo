import { config as loadDotEnv } from 'dotenv';
import path from 'path';

loadDotEnv();

interface AppConfig {
  simplesDental: {
    loginUrl: string;
    username: string;
    password: string;
    /** Limite opcional de pacientes a processar (util para testes). undefined = sem limite. */
    maxPatients?: number;
  };
  browser: {
    type: 'chromium' | 'firefox' | 'webkit';
    headless: boolean;
    slowMo: number;
    timeoutMs: number;
    storageStatePath: string;
  };
  log: {
    level: string;
    dir: string;
  };
  supabase: {
    enabled: boolean;
    url?: string;
    serviceKey?: string;
  };
  lovableSync: {
    enabled: boolean;
    url?: string;
    apiKey?: string;
  };
}

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value || value.trim().length === 0) {
    throw new Error(
      `Variavel de ambiente obrigatoria ausente: "${key}". Verifique o arquivo .env (use .env.example como referencia).`,
    );
  }
  return value;
}

function parseBrowserType(value: string | undefined): 'chromium' | 'firefox' | 'webkit' {
  const allowed = ['chromium', 'firefox', 'webkit'];
  const normalized = (value ?? 'chromium').toLowerCase();
  if (!allowed.includes(normalized)) {
    throw new Error(`BROWSER_TYPE invalido: "${value}". Use um dos valores: ${allowed.join(', ')}.`);
  }
  return normalized as 'chromium' | 'firefox' | 'webkit';
}

export const env: AppConfig = {
  simplesDental: {
    loginUrl: process.env.SIMPLES_DENTAL_LOGIN_URL ?? 'https://app.simplesdental.com/',
    username: requireEnv('SIMPLES_DENTAL_USERNAME'),
    password: requireEnv('SIMPLES_DENTAL_PASSWORD'),
    maxPatients: process.env.SIMPLES_DENTAL_MAX_PATIENTS
      ? Number(process.env.SIMPLES_DENTAL_MAX_PATIENTS)
      : undefined,
  },
  browser: {
    type: parseBrowserType(process.env.BROWSER_TYPE),
    headless: (process.env.BROWSER_HEADLESS ?? 'true').toLowerCase() !== 'false',
    slowMo: Number(process.env.BROWSER_SLOW_MO ?? 0),
    timeoutMs: Number(process.env.BROWSER_TIMEOUT_MS ?? 30000),
    storageStatePath: path.resolve(process.cwd(), process.env.STORAGE_STATE_PATH ?? './storage/session.json'),
  },
  log: {
    level: process.env.LOG_LEVEL ?? 'info',
    dir: path.resolve(process.cwd(), process.env.LOG_DIR ?? './logs'),
  },
  supabase: buildSupabaseConfig(),
  lovableSync: buildLovableSyncConfig(),
};

function buildSupabaseConfig(): AppConfig['supabase'] {
  const enabled = (process.env.ENABLE_SUPABASE_SYNC ?? 'false').toLowerCase() === 'true';
  if (!enabled) {
    return { enabled: false };
  }
  return {
    enabled: true,
    url: requireEnv('SUPABASE_URL'),
    serviceKey: requireEnv('SUPABASE_SERVICE_KEY'),
  };
}

function buildLovableSyncConfig(): AppConfig['lovableSync'] {
  const enabled = (process.env.ENABLE_LOVABLE_HTTP_SYNC ?? 'false').toLowerCase() === 'true';
  if (!enabled) {
    return { enabled: false };
  }
  return {
    enabled: true,
    url: requireEnv('LOVABLE_SYNC_URL'),
    apiKey: requireEnv('LOVABLE_SYNC_API_KEY'),
  };
}
