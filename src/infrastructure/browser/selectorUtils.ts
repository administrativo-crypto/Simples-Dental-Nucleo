import { Locator, Page } from 'playwright';

/**
 * Tenta localizar o primeiro seletor visivel de uma lista de candidatos.
 * Util quando nao se tem certeza absoluta de qual seletor a pagina vai usar
 * (ex: SPA sem HTML estatico para inspecionar previamente).
 *
 * Cada seletor da lista recebe apenas uma fatia do tempo total (minimo
 * 4s, maximo 8s por tentativa) em vez do timeoutMs inteiro, para nao
 * multiplicar a espera quando ha varios candidatos e o primeiro nao bate
 * (ex: 6 seletores x 30s cada seria 3 minutos no pior caso).
 */
export async function firstVisible(
  page: Page,
  selectors: string[],
  timeoutMs: number,
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
