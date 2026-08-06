import { Page, Locator } from 'playwright';
import { EvolutionEntry } from '../../domain/entities/EvolutionEntry';
import { PATIENTS_SELECTORS } from './patients.selectors';
import { locateFirst, resolveSelector } from '../../shared/utils/playwrightHelpers';
import { cleanText } from '../../shared/utils/text';
import { logger } from '../logging/Logger';
import { env } from '../../config/env';

/**
 * Responsavel por: dentro da ficha do paciente JA ABERTA, acessar as
 * evolucoes clinicas e ler todas as entradas. (Passo 3 da Sprint 02.)
 *
 * CONFIRMADO em 06/08/2026: nesta conta, "Evoluções" NÃO é uma aba
 * separada — é um painel dentro da aba "Tratamentos" (ao lado do
 * formulário "Adicionar tratamento"). Quando o paciente não tem nenhuma
 * evolução, o painel mostra o texto "O paciente não possui evoluções".
 *
 * Nao realiza download de anexos — apenas registra se existem.
 */
export class EvolutionsService {
  async read(page: Page): Promise<EvolutionEntry[]> {
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

    await tratamentosTab.click();
    await page.waitForLoadState('networkidle').catch(() => undefined);
    await page.waitForTimeout(500);
    await this.dismissPromoModalIfPresent(page);

    // Salva sempre um screenshot + dump de texto deste painel, mesmo
    // quando vazio — útil para calibrar os seletores de entrada assim
    // que processarmos um paciente que realmente tenha evoluções.
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

    // Ainda nao calibramos o seletor de "entrada de evolucao" real (so
    // vimos o painel vazio ate agora). Tenta os candidatos genericos; se
    // nao bater, loga um aviso claro e retorna vazio sem derrubar o resto.
    const resolvedEntrySelector = await resolveSelector(page, PATIENTS_SELECTORS.evolutionEntries, 4000);
    if (!resolvedEntrySelector) {
      logger.warn(
        'Painel de Evoluções não está vazio, mas nenhum seletor de entrada bateu. ' +
          'Ajuste PATIENTS_SELECTORS.evolutionEntries com base no screenshot salvo.',
      );
      return [];
    }

    const entries = page.locator(resolvedEntrySelector);
    const count = await entries.count().catch(() => 0);

    const results: EvolutionEntry[] = [];
    for (let i = 0; i < count; i++) {
      const entry = entries.nth(i);

      const data = await this.firstMatchingText(entry, PATIENTS_SELECTORS.evolutionDate);
      const hora = await this.firstMatchingText(entry, PATIENTS_SELECTORS.evolutionTime);
      const profissional = await this.firstMatchingText(entry, PATIENTS_SELECTORS.evolutionProfessional);
      const procedimento = await this.firstMatchingText(entry, PATIENTS_SELECTORS.evolutionProcedure);
      const texto = await this.firstMatchingText(entry, PATIENTS_SELECTORS.evolutionText);
      const possuiAnexo = await this.anyMatchVisible(entry, PATIENTS_SELECTORS.evolutionAttachmentIndicator);

      results.push({
        data: data || undefined,
        hora: hora || undefined,
        profissional: profissional || undefined,
        procedimento: procedimento || undefined,
        texto: texto || undefined,
        possuiAnexo,
      });
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

  /** Tenta cada seletor candidato dentro do escopo (uma evolucao) e retorna o primeiro texto nao-vazio. */
  private async firstMatchingText(scope: Locator, selectors: string[]): Promise<string> {
    for (const selector of selectors) {
      try {
        const text = cleanText(await scope.locator(selector).first().textContent({ timeout: 1000 }));
        if (text) return text;
      } catch {
        // tenta o proximo seletor
      }
    }
    return '';
  }

  /** Tenta cada seletor candidato e retorna true se algum estiver visivel dentro do escopo. */
  private async anyMatchVisible(scope: Locator, selectors: string[]): Promise<boolean> {
    for (const selector of selectors) {
      try {
        const visible = await scope.locator(selector).first().isVisible({ timeout: 500 });
        if (visible) return true;
      } catch {
        // tenta o proximo seletor
      }
    }
    return false;
  }
}
