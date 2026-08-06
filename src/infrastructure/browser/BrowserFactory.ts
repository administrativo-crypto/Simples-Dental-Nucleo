import { Browser, BrowserContext, chromium, firefox, webkit } from 'playwright';
import { env } from '../../config/env';
import { logger } from '../logging/Logger';

/**
 * Responsavel por criar e encerrar instancias do navegador/contexto Playwright.
 * Isola o resto da aplicacao dos detalhes de inicializacao do Playwright.
 */
export class BrowserFactory {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;

  async launch(): Promise<BrowserContext> {
    const engine = { chromium, firefox, webkit }[env.browser.type];

    logger.info(`Iniciando navegador "${env.browser.type}" (headless=${env.browser.headless})`);

    this.browser = await engine.launch({
      headless: env.browser.headless,
      slowMo: env.browser.slowMo,
    });

    this.context = await this.browser.newContext();
    this.context.setDefaultTimeout(env.browser.timeoutMs);

    return this.context;
  }

  async close(): Promise<void> {
    try {
      await this.context?.close();
      await this.browser?.close();
      logger.info('Navegador encerrado.');
    } catch (error) {
      logger.warn('Falha ao encerrar o navegador (pode ja estar fechado).', { error });
    }
  }
}
