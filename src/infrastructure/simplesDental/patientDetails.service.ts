import { Page } from 'playwright';
import { PatientListItem } from '../../domain/entities/PatientListItem';
import { PatientDetails } from '../../domain/entities/PatientDetails';
import { PATIENTS_SELECTORS } from './patients.selectors';
import { locateFirst } from '../../shared/utils/playwrightHelpers';
import { cleanText } from '../../shared/utils/text';
import { env } from '../../config/env';
import { logger } from '../logging/Logger';

/**
 * Responsavel por: abrir a ficha de UM paciente (a partir da listagem ja
 * carregada) e extrair seus dados completos. (Passo 2 da Sprint 02.)
 *
 * A ficha real do Simples Dental mostra os dados como pares "rótulo" numa
 * linha e "valor" na linha seguinte (ex: "Data de nascimento" / "20 de
 * ..."), sem uma classe CSS previsível ligando os dois. Por isso o parser
 * principal (parseLabelValueBlock) le todo o texto do bloco "Dados
 * pessoais" e associa cada rótulo conhecido ao texto que vem logo depois,
 * em vez de depender de seletores CSS especificos por campo.
 */
export class PatientDetailsService {
  constructor(private readonly page: Page) {}

  async open(patient: PatientListItem): Promise<{ page: Page; details: PatientDetails }> {
    const searchInput = await locateFirst(this.page, PATIENTS_SELECTORS.searchInput, 2000);
    if (searchInput && patient.nome) {
      // Busca sempre por NOME (não CPF) — o CPF formatado com pontos/traço
      // pode não bater com o campo de busca do site, e o nome já provou
      // funcionar de forma confiável.
      await searchInput.fill(patient.nome);
      await this.page.waitForTimeout(500);
    }

    const row = await locateFirst(this.page, [patient.rowSelector], env.browser.timeoutMs);
    if (!row) {
      throw new Error(
        `Nao foi possivel reabrir a linha do paciente "${patient.nome}" na listagem para acessar a ficha.`,
      );
    }

    const targetPage = await this.clickToOpenPatient(row, patient.nome);
    await this.dismissPromoModal(targetPage);
    await this.captureDebugScreenshot(targetPage, `ficha-${patient.nome.slice(0, 20)}`);

    const details = await this.readDetails(targetPage, patient);
    return { page: targetPage, details };
  }

  private async clickToOpenPatient(row: import('playwright').Locator, patientName: string): Promise<Page> {
    const urlBefore = this.page.url();

    const strategies: Array<{ label: string; locator: import('playwright').Locator }> = [
      { label: 'link do nome', locator: row.locator('a').first() },
      { label: 'último ícone/ação da linha', locator: row.locator('a, button').last() },
      { label: 'linha inteira', locator: row },
    ];

    for (const strategy of strategies) {
      const isVisible = await strategy.locator.isVisible().catch(() => false);
      if (!isVisible) {
        logger.info(`Paciente "${patientName}": estratégia "${strategy.label}" não está visível, pulando.`);
        continue;
      }

      const popupPromise = this.page.context().waitForEvent('page', { timeout: 4000 }).catch(() => null);

      try {
        await strategy.locator.click({ timeout: 5000 });
      } catch (clickError) {
        logger.info(`Paciente "${patientName}": clique via "${strategy.label}" falhou.`, { error: clickError });
        continue;
      }

      const popup = await popupPromise;
      if (popup) {
        await popup.waitForLoadState('domcontentloaded').catch(() => undefined);
        logger.info(`Paciente "${patientName}": clique via "${strategy.label}" abriu uma nova aba.`);
        return popup;
      }

      await this.page.waitForLoadState('networkidle').catch(() => undefined);
      await this.page.waitForTimeout(500);

      if (this.page.url() !== urlBefore) {
        logger.info(`Paciente "${patientName}": clique via "${strategy.label}" navegou para ${this.page.url()}.`);
        return this.page;
      }
    }

    logger.warn(
      `Paciente "${patientName}": nenhuma estratégia de clique mudou a URL ou abriu aba nova. ` +
        'Lendo a página atual mesmo assim.',
    );
    return this.page;
  }

  /** Fecha o popup promocional ("assine eletronicamente...") se aparecer. */
  private async dismissPromoModal(page: Page): Promise<void> {
    const closeButton = await locateFirst(page, PATIENTS_SELECTORS.promoModalClose, 3000);
    if (closeButton) {
      await closeButton.click().catch(() => undefined);
      logger.info('Popup promocional da ficha fechado.');
      await page.waitForTimeout(300);
    }
  }

  private async captureDebugScreenshot(page: Page, label: string): Promise<void> {
    try {
      const fs = await import('fs');
      const path = await import('path');
      if (!fs.existsSync(env.log.dir)) {
        fs.mkdirSync(env.log.dir, { recursive: true });
      }
      const safeLabel = label.replace(/[^a-zA-Z0-9_-]/g, '_');
      const filePath = path.join(env.log.dir, `patient-detail-${safeLabel}-${Date.now()}.png`);
      await page.screenshot({ path: filePath, fullPage: true });
      logger.info(`Screenshot da ficha salvo em: ${filePath}`);
    } catch (error) {
      logger.warn('Não foi possível salvar screenshot da ficha.', { error });
    }
  }

  private async readDetails(page: Page, listItem: PatientListItem): Promise<PatientDetails> {
    const nomeLocator = await locateFirst(page, PATIENTS_SELECTORS.patientNameHeading, 3000);
    const nome = nomeLocator ? cleanText(await nomeLocator.textContent().catch(() => '')) : '';

    // Le TODO o texto visivel da pagina e faz o parse rótulo->valor.
    const rawInnerText = await page.locator('body').innerText().catch(() => '');
    const fullText = cleanText(rawInnerText);
    const lines = rawInnerText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const dataNascimento = this.extractValueForLabel(lines, PATIENTS_SELECTORS.fieldLabels.dataNascimento);
    const telefone = this.extractValueForLabel(lines, PATIENTS_SELECTORS.fieldLabels.celular);
    const email = this.extractValueForLabel(lines, PATIENTS_SELECTORS.fieldLabels.email);
    // CPF raramente aparece na aba "Sobre" — usa o valor já capturado na
    // listagem (patient.cpf) como fonte primária, com o da ficha como bônus.
    const cpfFromFicha = this.extractValueForLabel(lines, PATIENTS_SELECTORS.fieldLabels.cpf);
    const cpf = listItem.cpf || cpfFromFicha || undefined;
    const observacoes = this.extractValueForLabel(lines, PATIENTS_SELECTORS.fieldLabels.observacoesGerais);

    await this.dumpLinesForDebug(lines, listItem.nome);

    const tratamentosAtivos = await this.readList(page, PATIENTS_SELECTORS.activeTreatmentsList);
    const procedimentos = await this.readList(page, PATIENTS_SELECTORS.proceduresList);

    if (!nome && !fullText) {
      logger.warn('Não foi possível ler nenhum texto da ficha do paciente.');
    }

    return {
      nome: nome || listItem.nome || 'Nome não identificado',
      cpf,
      dataNascimento: dataNascimento || undefined,
      telefone: telefone || listItem.telefone || undefined,
      email: email || undefined,
      tratamentosAtivos,
      procedimentos,
      observacoes: observacoes || undefined,
    };
  }

  /**
   * Procura, entre as linhas de texto da pagina, uma que bata exatamente
   * (ignorando maiusculas/minusculas) com algum dos rótulos candidatos, e
   * retorna a PRIMEIRA linha seguinte que NÃO seja, ela mesma, outro
   * rótulo conhecido (alguns campos têm o rótulo duplicado no DOM, ex.
   * para acessibilidade — pular esses evita devolver o rótulo como se
   * fosse o valor).
   */
  private extractValueForLabel(lines: string[], labelCandidates: string[]): string {
    const allKnownLabels = new Set(
      Object.values(PATIENTS_SELECTORS.fieldLabels)
        .flat()
        .map((l) => l.toLowerCase()),
    );

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase();
      const matches = labelCandidates.some((label) => line === label.toLowerCase());
      if (!matches) continue;

      for (let j = i + 1; j < lines.length && j < i + 5; j++) {
        const candidate = lines[j];
        const candidateLower = candidate.toLowerCase();
        if (allKnownLabels.has(candidateLower)) {
          continue; // e outro rotulo (duplicado), nao e o valor — pula
        }
        return candidate;
      }
    }
    return '';
  }

  private async dumpLinesForDebug(lines: string[], patientName: string): Promise<void> {
    try {
      const fs = await import('fs');
      const path = await import('path');
      if (!fs.existsSync(env.log.dir)) {
        fs.mkdirSync(env.log.dir, { recursive: true });
      }
      const safeLabel = patientName.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 20);
      const filePath = path.join(env.log.dir, `ficha-linhas-${safeLabel}-${Date.now()}.json`);
      fs.writeFileSync(filePath, JSON.stringify(lines, null, 2), 'utf-8');
      logger.info(`Linhas de texto da ficha salvas em: ${filePath} (para diagnóstico)`);
    } catch (error) {
      logger.warn('Não foi possível salvar o dump de linhas para diagnóstico.', { error });
    }
  }

  private async readList(page: Page, selectors: string[]): Promise<string[]> {
    for (const selector of selectors) {
      try {
        const items = page.locator(selector);
        const count = await items.count();
        if (count === 0) continue;
        const values: string[] = [];
        for (let i = 0; i < count; i++) {
          const text = cleanText(await items.nth(i).textContent());
          if (text) values.push(text);
        }
        return values;
      } catch {
        // tenta o proximo seletor
      }
    }
    return [];
  }
}
