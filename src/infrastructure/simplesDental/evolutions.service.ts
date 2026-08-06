import { Page } from 'playwright';
import { EvolutionEntry } from '../../domain/entities/EvolutionEntry';
import { PATIENTS_SELECTORS } from './patients.selectors';
import { locateFirst } from '../../shared/utils/playwrightHelpers';
import { logger } from '../logging/Logger';
import { env } from '../../config/env';

/**
 * Responsavel por: dentro da ficha do paciente JA ABERTA, acessar as
 * evolucoes clinicas e ler todas as entradas. (Passo 3 da Sprint 02.)
 *
 * CONFIRMADO em 06/08/2026: nesta conta, "Evoluções" NÃO é uma aba
 * separada — é um painel dentro da aba "Tratamentos". Cada evolução
 * aparece como: uma linha de DATA por extenso (ex: "19 de junho de
 * 2026"), seguida de um texto livre (o procedimento/nota) e depois o
 * profissional no formato "Dr(a). Nome Completo".
 *
 * Nao ha campo de HORA visivel nesta tela — fica sempre undefined.
 * Nao realiza download de anexos — apenas registra se existem (quando
 * for possivel identificar visualmente).
 */
const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];
// Data por extenso SEM abreviação (ex: "19 de junho de 2026"), para não
// confundir com a data de nascimento que usa mês abreviado com ponto
// (ex: "18 de fev. de 1962", já lida em PatientDetailsService).
const DATE_LINE_REGEX = new RegExp(`^\\d{1,2} de (${MESES.join('|')}) de \\d{4}$`, 'i');
const PROFESSIONAL_LINE_REGEX = /^Dr\.?\(?a?\)?\.?\s+/i;

export class EvolutionsService {
  async read(page: Page): Promise<EvolutionEntry[]> {
    try {
      return await this.readInternal(page);
    } catch (error) {
      // Falha na leitura de evolucoes NUNCA deve derrubar o paciente
      // inteiro — os dados da ficha (nome, CPF, etc.) ja foram lidos e
      // devem ser salvos mesmo que as evolucoes nao tenham sido lidas.
      logger.warn('Falha ao ler evoluções — paciente será salvo sem evoluções.', { error });
      return [];
    }
  }

  private async readInternal(page: Page): Promise<EvolutionEntry[]> {
    await this.dismissPromoModalIfPresent(page);

    const tratamentosTab = await locateFirst(
      page,
      [
        '[role="tab"]:text-is("Tratamentos")',
        'button:text-is("Tratamentos")',
        'a:text-is("Tratamentos")',
        'text=/^tratamentos$/i',
        '[role="tab"]:has-text("Tratamentos")',
        'button:has-text("Tratamentos")',
        'a:has-text("Tratamentos")',
      ],
      5000,
    );
    if (!tratamentosTab) {
      logger.warn('Aba "Tratamentos" não encontrada — não é possível acessar o painel de Evoluções.');
      await this.saveExplorationArtifacts(page, 'aba-tratamentos-nao-encontrada');
      return [];
    }

    await page.waitForTimeout(1000);
    await this.dismissPromoModalIfPresent(page);

    try {
      await tratamentosTab.click({ timeout: 10000 });
    } catch (clickError) {
      logger.warn('Clique normal na aba "Tratamentos" travou (provável overlay). Tentando clique forçado...', {
        error: clickError,
      });
      await tratamentosTab.click({ force: true, timeout: 5000 }).catch((forceError) => {
        logger.warn('Clique forçado na aba "Tratamentos" também falhou.', { error: forceError });
      });
    }
    await page.waitForLoadState('networkidle').catch(() => undefined);
    await page.waitForTimeout(500);
    await this.dismissPromoModalIfPresent(page);

    await this.saveExplorationArtifacts(page, 'painel-tratamentos-evolucoes');

    const emptyStateVisible = await page
      .locator('text=O paciente não possui evoluções')
      .first()
      .isVisible()
      .catch(() => false);

    if (emptyStateVisible) {
      logger.info('Painel de Evoluções confirmado — paciente não possui nenhuma evolução cadastrada.');
      return [];
    }

    const rawText = await page.locator('body').innerText().catch(() => '');
    const lines = rawText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const results = this.parseEvolutionsFromLines(lines);
    logger.info(`${results.length} evolução(ões) extraída(s) via parser de texto.`);
    return results;
  }

  /**
   * Percorre as linhas de texto da pagina procurando o padrão:
   * "DD de mês de AAAA" (data) -> texto livre (1+ linhas) -> "Dr(a). Nome"
   * (profissional). Cada ocorrência desse padrão vira uma EvolutionEntry.
   */
  private parseEvolutionsFromLines(lines: string[]): EvolutionEntry[] {
    const results: EvolutionEntry[] = [];

    for (let i = 0; i < lines.length; i++) {
      if (!DATE_LINE_REGEX.test(lines[i])) continue;
      const data = lines[i];

      const textoLinhas: string[] = [];
      let profissional: string | undefined;
      let j = i + 1;

      for (; j < lines.length && j < i + 10; j++) {
        const line = lines[j];
        if (DATE_LINE_REGEX.test(line)) break;
        if (line.toLowerCase() === 'sem assinatura') continue;
        if (PROFESSIONAL_LINE_REGEX.test(line)) {
          profissional = line.replace(PROFESSIONAL_LINE_REGEX, '').trim();
          j++;
          break;
        }
        textoLinhas.push(line);
      }

      const texto = textoLinhas.join(' ').trim();
      if (texto || profissional) {
        results.push({
          data,
          hora: undefined,
          profissional: profissional || undefined,
          procedimento: undefined,
          texto: texto || undefined,
          possuiAnexo: false,
        });
      }

      i = j - 1;
    }

    return results;
  }

  /** Fecha o popup promocional ("assine eletronicamente...") se estiver visível. */
  private async dismissPromoModalIfPresent(page: Page): Promise<void> {
    const closeButton = await locateFirst(page, PATIENTS_SELECTORS.promoModalClose, 1500);
    if (closeButton) {
      await closeButton.click().catch(() => undefined);
      logger.info('Popup promocional fechado.');
      await page.waitForTimeout(300);
    }
  }

  private async saveExplorationArtifacts(page: Page, label: string): Promise<void> {
    try {
      const fs = await import('fs');
      const path = await import('path');
      if (!fs.existsSync(env.log.dir)) {
        fs.mkdirSync(env.log.dir, { recursive: true });
      }
      const safeLabel = label.replace(/[^a-zA-Z0-9_-]/g, '_');
      const timestamp = Date.now();

      const screenshotPath = path.join(env.log.dir, `exploracao-${safeLabel}-${timestamp}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });

      const text = await page.locator('body').innerText().catch(() => '');
      const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
      const textPath = path.join(env.log.dir, `exploracao-${safeLabel}-${timestamp}.json`);
      fs.writeFileSync(textPath, JSON.stringify(lines, null, 2), 'utf-8');

      logger.info(`Diagnóstico salvo em: ${screenshotPath}`);
    } catch (error) {
      logger.warn(`Não foi possível salvar diagnóstico "${label}".`, { error });
    }
  }
}
