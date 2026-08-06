import { BrowserContext } from 'playwright';
import { IAuthRepository } from '../../domain/repositories/IAuthRepository';
import { Credentials } from '../../domain/entities/Credentials';
import { LoginResult } from '../../domain/entities/LoginResult';
import { env } from '../../config/env';
import { logger } from '../logging/Logger';
import { AuthenticationError } from '../../shared/errors/AuthenticationError';
import { firstVisible } from '../browser/selectorUtils';
import fs from 'fs';
import path from 'path';

/**
 * Seletores da tela de login do Simples Dental.
 *
 * IMPORTANTE: o Simples Dental e uma SPA (o HTML e renderizado via JavaScript),
 * entao os seletores abaixo sao "melhores palpites" baseados em padroes comuns
 * de formularios de login. Antes de rodar em producao, confirme/ajuste os
 * seletores reais gravando um fluxo com:
 *
 *   npx playwright codegen https://app.simplesdental.com/
 *
 * e substitua os valores abaixo pelos seletores reais encontrados.
 */
const SELECTORS = {
  usernameInput: [
    'input[name="username"]',
    'input[name="email"]',
    'input[type="email"]',
    'input[id*="user" i]',
    'input[placeholder*="usu" i]',
    'input[placeholder*="e-mail" i]',
  ],
  passwordInput: [
    'input[name="password"]',
    'input[type="password"]',
    'input[id*="senha" i]',
    'input[placeholder*="senha" i]',
  ],
  submitButton: [
    'button[type="submit"]',
    'button:has-text("Entrar")',
    'button:has-text("Login")',
    'text=Entrar',
  ],
  // Elemento que so existe apos login bem-sucedido (ex: menu principal, avatar do usuario).
  // Ajuste para um seletor confiavel do dashboard do Simples Dental.
  loggedInIndicator: [
    '[data-testid="dashboard"]',
    'text=Agenda',
    'nav',
  ],
  // Mensagem de erro exibida quando as credenciais estao incorretas.
  errorMessage: [
    'text=usuário ou senha inválid',
    'text=credenciais inválidas',
    '[role="alert"]',
    '.error, .alert-danger',
  ],
  // Banner de cookies (confirmado na tela real do Simples Dental).
  cookieAcceptButton: [
    'button:has-text("Aceitar todos os cookies")',
    'button:has-text("Aceitar")',
    'button:has-text("Accept")',
  ],
};

export class SimplesDentalAuthRepository implements IAuthRepository {
  constructor(private readonly context: BrowserContext) {}

  async login(credentials: Credentials): Promise<LoginResult> {
    const page = await this.context.newPage();

    try {
      logger.info(`Navegando para a tela de login: ${env.simplesDental.loginUrl}`);
      await page.goto(env.simplesDental.loginUrl, { waitUntil: 'domcontentloaded' });

      // Fecha o banner de cookies, se aparecer, para nao interceptar cliques
      // nos campos/botao de login logo em seguida.
      const cookieButton = await firstVisible(page, SELECTORS.cookieAcceptButton, 3000);
      if (cookieButton) {
        await cookieButton.click();
        logger.info('Banner de cookies fechado.');
      }

      const usernameField = await firstVisible(page, SELECTORS.usernameInput, env.browser.timeoutMs);
      if (!usernameField) {
        throw new AuthenticationError(
          'Nao foi possivel localizar o campo de usuario/e-mail na tela de login. Ajuste SELECTORS.usernameInput em SimplesDentalAuthRepository.ts.',
        );
      }
      await usernameField.fill(credentials.username);
      logger.info('Campo de usuario preenchido.');

      const passwordField = await firstVisible(page, SELECTORS.passwordInput, env.browser.timeoutMs);
      if (!passwordField) {
        throw new AuthenticationError(
          'Nao foi possivel localizar o campo de senha na tela de login. Ajuste SELECTORS.passwordInput em SimplesDentalAuthRepository.ts.',
        );
      }
      await passwordField.fill(credentials.password);
      logger.info('Campo de senha preenchido.');

      const submitButton = await firstVisible(page, SELECTORS.submitButton, env.browser.timeoutMs);
      if (!submitButton) {
        throw new AuthenticationError(
          'Nao foi possivel localizar o botao de submit da tela de login. Ajuste SELECTORS.submitButton em SimplesDentalAuthRepository.ts.',
        );
      }

      await Promise.all([
        page.waitForLoadState('networkidle').catch(() => undefined),
        submitButton.click(),
      ]);
      logger.info('Formulario de login submetido, aguardando resposta...');

      const errorLocator = await firstVisible(page, SELECTORS.errorMessage, 4000);
      if (errorLocator) {
        const errorText = (await errorLocator.textContent())?.trim() ?? 'Credenciais invalidas.';
        logger.error(`Falha no login: ${errorText}`);
        return LoginResult.failure(errorText);
      }

      const loggedInLocator = await firstVisible(page, SELECTORS.loggedInIndicator, env.browser.timeoutMs);
      const urlChangedFromLogin = !page.url().includes('/login');

      if (!loggedInLocator && !urlChangedFromLogin) {
        const debugPath = await this.captureDebugScreenshot(page, 'sem-indicador-dashboard');
        throw new AuthenticationError(
          `Nao foi possivel confirmar que o login foi concluido: nenhum indicador de dashboard foi ` +
            `encontrado E a URL continua parecendo a de login (${page.url()}). Print salvo em: ${debugPath}. ` +
            `Provavelmente as credenciais estao erradas ou ha um passo extra (ex: 2FA) nao tratado.`,
        );
      }

      if (!loggedInLocator && urlChangedFromLogin) {
        // A URL mudou (saiu de /login), entao o login quase certamente
        // funcionou — so o seletor de "indicador de dashboard" que esta
        // desatualizado. Loga um screenshot mesmo assim, para facilitar
        // o ajuste fino do seletor depois, mas NAO trata como falha.
        const debugPath = await this.captureDebugScreenshot(page, 'login-ok-sem-indicador');
        logger.warn(
          `Indicador de dashboard nao encontrado, mas a URL mudou para "${page.url()}" — tratando como login ` +
            `bem-sucedido. Print salvo em ${debugPath}: use-o para achar um seletor melhor e atualizar ` +
            `SELECTORS.loggedInIndicator.`,
        );
      }

      await this.persistSession();
      logger.info('Login realizado com sucesso.');
      return LoginResult.success();
    } catch (error) {
      logger.error('Erro durante o processo de login.', { error });
      if (!(error instanceof AuthenticationError)) {
        // Erros nao previstos (ex: falha de rede) tambem merecem um screenshot.
        await this.captureDebugScreenshot(page, 'erro-inesperado');
      }
      if (error instanceof AuthenticationError) {
        return LoginResult.failure(error.message);
      }
      return LoginResult.failure('Erro inesperado durante o login. Veja logs/error.log para detalhes.');
    } finally {
      await page.close();
    }
  }

  /**
   * Salva um screenshot da pagina atual em logs/ para diagnostico —
   * util quando um seletor nao bate e precisamos ver o que a tela
   * realmente mostrava naquele momento.
   */
  private async captureDebugScreenshot(page: import('playwright').Page, label: string): Promise<string> {
    const fileName = `login-debug-${label}-${Date.now()}.png`;
    const filePath = path.join(env.log.dir, fileName);
    try {
      if (!fs.existsSync(env.log.dir)) {
        fs.mkdirSync(env.log.dir, { recursive: true });
      }
      await page.screenshot({ path: filePath, fullPage: true });
      logger.warn(`Screenshot de diagnostico salvo em: ${filePath}`);
    } catch (error) {
      logger.warn('Nao foi possivel salvar o screenshot de diagnostico.', { error });
    }
    return filePath;
  }

  /**
   * Salva o estado da sessao (cookies + localStorage) em disco,
   * permitindo reaproveitar o login em execucoes futuras sem repetir o processo.
   */
  private async persistSession(): Promise<void> {
    const storagePath = env.browser.storageStatePath;
    const dir = path.dirname(storagePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    await this.context.storageState({ path: storagePath });
    logger.info(`Sessao salva em: ${storagePath}`);
  }
}
