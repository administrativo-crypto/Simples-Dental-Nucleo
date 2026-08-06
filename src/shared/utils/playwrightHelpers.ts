import { Locator, Page } from 'playwright';

/**
 * Tenta localizar o primeiro seletor visivel de uma lista de candidatos.
 * Util quando nao temos 100% de certeza de qual seletor a pagina usa
 * (comum em SPAs onde o HTML nao pode ser inspecionado sem executar JS).
 *
 * Cada seletor recebe apenas uma fatia do timeout total (4-8s), para nao
 * multiplicar a espera quando ha varios candidatos na lista.
 */
export async function locateFirst(
  page: Page,
  selectors: string[],
  timeoutMs = 5000,
): Promise<Locator | null> {
  const perAttemptTimeout = Math.min(8000, Math.max(4000, Math.floor(timeoutMs / selectors.length)));

  for (const selector of selectors) {
    try {
      const locator = page.locator(selector).first();
      await locator.waitFor({ state: 'visible', timeout: perAttemptTimeout });
      return locator;
    } catch {
      // tenta o proximo seletor da lista
    }
  }
  return null;
}

/**
 * Igual a locateFirst, mas retorna qual SELETOR (string) deu match,
 * em vez do Locator. Util quando o mesmo seletor precisa ser reusado
 * depois (ex: para contar/repetir buscas), para nao acabar usando por
 * engano o primeiro seletor da lista quando outro foi o que realmente
 * funcionou.
 */
export async function resolveSelector(
  page: Page,
  selectors: string[],
  timeoutMs = 5000,
): Promise<string | null> {
  const perAttemptTimeout = Math.min(8000, Math.max(4000, Math.floor(timeoutMs / selectors.length)));

  for (const selector of selectors) {
    try {
      await page.locator(selector).first().waitFor({ state: 'visible', timeout: perAttemptTimeout });
      return selector;
    } catch {
      // tenta o proximo seletor da lista
    }
  }
  return null;
}

/** Igual a locateFirst, mas nao lanca nem espera muito - usado para checagens rapidas. */
export async function existsQuick(page: Page, selector: string, timeoutMs = 1500): Promise<boolean> {
  try {
    await page.locator(selector).first().waitFor({ state: 'visible', timeout: timeoutMs });
    return true;
  } catch {
    return false;
  }
}
