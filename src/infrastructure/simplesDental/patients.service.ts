import { Page } from 'playwright';
import { PatientListItem } from '../../domain/entities/PatientListItem';
import { PATIENTS_SELECTORS } from './patients.selectors';
import { locateFirst, resolveSelector, existsQuick } from '../../shared/utils/playwrightHelpers';
import { cleanText, undefinedIfEmpty } from '../../shared/utils/text';
import { logger } from '../logging/Logger';
import { env } from '../../config/env';

/**
 * Responsavel apenas por: abrir o menu Pacientes e ler a tabela de listagem.
 * (Passo 1 da Sprint 02 — nao abre ficha individual, isso e responsabilidade
 * de PatientDetailsService.)
 */
export class PatientsListService {
  /**
   * Seletor de linha que REALMENTE bateu na pagina (descoberto em openMenu).
   * Usado em vez de assumir sempre o primeiro candidato da lista, para nao
   * repetir a busca com um seletor que nunca funcionou de fato.
   */
  private resolvedRowSelector: string | null = null;

  constructor(private readonly page: Page) {}

  async list(): Promise<PatientListItem[]> {
    await this.openMenu();

    const patients: PatientListItem[] = [];
    let pageIndex = 1;
    const maxPages = 50; // trava de seguranca contra loop infinito de paginacao

    while (pageIndex <= maxPages) {
      const rowsOnPage = await this.readCurrentPage();
      patients.push(...rowsOnPage);
      logger.info(`Pagina ${pageIndex} da listagem: ${rowsOnPage.length} paciente(s) lido(s).`);

      if (env.simplesDental.maxPatients && patients.length >= env.simplesDental.maxPatients) {
        logger.info(`Limite de SIMPLES_DENTAL_MAX_PATIENTS (${env.simplesDental.maxPatients}) atingido.`);
        break;
      }

      const advanced = await this.goToNextPage();
      if (!advanced) break;
      pageIndex += 1;
    }

    const finalList = env.simplesDental.maxPatients
      ? patients.slice(0, env.simplesDental.maxPatients)
      : patients;

    logger.info(`Total de pacientes coletados na listagem: ${finalList.length}.`);
    return finalList;
  }

  private async openMenu(): Promise<void> {
    const menuItem = await locateFirst(this.page, PATIENTS_SELECTORS.menuPacientes, env.browser.timeoutMs);
    if (!menuItem) {
      await this.captureDebugScreenshot('menu-pacientes-nao-encontrado');
      throw new Error(
        `Nao foi possivel localizar o menu "Pacientes" (URL atual: ${this.page.url()}). ` +
          'Ajuste PATIENTS_SELECTORS.menuPacientes em patients.selectors.ts.',
      );
    }

    const currentUrl = this.page.url();
    const alreadyOnPatientsPage = /pacientes/i.test(currentUrl);

    if (!alreadyOnPatientsPage) {
      await menuItem.click();
      await this.page.waitForLoadState('networkidle').catch(() => undefined);
    } else {
      logger.info('Já estava na página de Pacientes (sem precisar clicar no menu).');
    }

    // Descobre QUAL seletor de linha realmente bate nesta pagina, e guarda
    // para reutilizar sempre o mesmo em vez de assumir o primeiro da lista.
    const resolved = await resolveSelector(this.page, PATIENTS_SELECTORS.tableRows, env.browser.timeoutMs);
    if (!resolved) {
      await this.captureDebugScreenshot('tabela-pacientes-nao-encontrada');
      throw new Error(
        `A tabela de pacientes nao carregou (URL atual: ${this.page.url()}). Nenhum dos seletores em ` +
          'PATIENTS_SELECTORS.tableRows bateu. Ajuste esses seletores em patients.selectors.ts.',
      );
    }
    this.resolvedRowSelector = resolved;
    logger.info(`Seletor de linhas da tabela identificado: "${resolved}"`);
  }

  private async captureDebugScreenshot(label: string): Promise<void> {
    try {
      const fs = await import('fs');
      const path = await import('path');
      const { env: envConfig } = await import('../../config/env');
      if (!fs.existsSync(envConfig.log.dir)) {
        fs.mkdirSync(envConfig.log.dir, { recursive: true });
      }
      const filePath = path.join(envConfig.log.dir, `patients-debug-${label}-${Date.now()}.png`);
      await this.page.screenshot({ path: filePath, fullPage: true });
      logger.warn(`Screenshot de diagnostico salvo em: ${filePath}`);
    } catch (error) {
      logger.warn('Nao foi possivel salvar screenshot de diagnostico.', { error });
    }
  }

  private async readCurrentPage(): Promise<PatientListItem[]> {
    if (!this.resolvedRowSelector) {
      throw new Error('readCurrentPage chamado antes de openMenu identificar o seletor da tabela.');
    }

    const rows = this.page.locator(this.resolvedRowSelector);
    const count = await rows.count().catch(() => 0);

    const items: PatientListItem[] = [];
    for (let i = 0; i < count; i++) {
      const row = rows.nth(i);

      // Pula linhas de CABEÇALHO da tabela (ex: "Nome", "CPF", "Celular...").
      // Cabeçalhos normalmente usam <th> ou role="columnheader" em vez de
      // <td>/role="cell" — se a linha só tem esses, não é um paciente.
      const headerCellCount = await row.locator('th, [role="columnheader"]').count().catch(() => 0);
      if (headerCellCount > 0) {
        continue;
      }

      const rowText = cleanText(await row.textContent());
      if (!rowText) continue;

      // Extracao "melhor esforco" por coluna. Tenta <td> (tabela HTML
      // classica) e, se nao houver, tenta [role="cell"] (grids baseados em
      // div, comuns em SPAs modernas). Ajuste conforme a estrutura real.
      let cells = row.locator('td');
      let cellCount = await cells.count().catch(() => 0);
      if (cellCount === 0) {
        cells = row.locator('[role="cell"], [role="gridcell"]');
        cellCount = await cells.count().catch(() => 0);
      }

      // Se a linha nao tem NENHUMA celula reconhecivel, provavelmente nao e
      // uma linha de dados de verdade (pode ser outro tipo de cabecalho,
      // separador, etc). Pula em vez de usar o texto inteiro como "nome".
      if (cellCount === 0) {
        logger.warn(`Linha da tabela sem células reconhecíveis, pulando: "${rowText.slice(0, 80)}..."`);
        continue;
      }

      const nome = cleanText(await cells.nth(0).textContent());
      // Mapeamento confirmado na tela real do Simples Dental (05/08/2026):
      // [0] Nome | [1] Responsável (dentista) | [2] Idade | [3] CPF | [4] Telefone | [5] Ação ("Conversar")
      const responsavel = cellCount > 1 ? undefinedIfEmpty(cleanText(await cells.nth(1).textContent())) : undefined;
      const idade = cellCount > 2 ? undefinedIfEmpty(cleanText(await cells.nth(2).textContent())) : undefined;
      const cpf = cellCount > 3 ? undefinedIfEmpty(cleanText(await cells.nth(3).textContent())) : undefined;
      const telefone = cellCount > 4 ? undefinedIfEmpty(cleanText(await cells.nth(4).textContent())) : undefined;

      if (!nome) continue;

      if (items.length === 0) {
        // Log de diagnostico APENAS do primeiro paciente real encontrado,
        // mostrando o texto bruto de cada coluna — util para confirmar se
        // a ordem das colunas bate com a tabela real, ou se precisa
        // reordenar os indices acima.
        const rawCells: string[] = [];
        for (let c = 0; c < cellCount; c++) {
          rawCells.push(cleanText(await cells.nth(c).textContent()));
        }
        logger.info(`Diagnóstico — colunas da primeira linha de dados: ${JSON.stringify(rawCells)}`);
      }

      items.push({
        nome,
        cpf,
        telefone,
        idade,
        responsavel,
        // Seletor "melhor esforco" para reabrir esta linha depois.
        // Assume que o nome e suficientemente unico na listagem.
        rowSelector: `${this.resolvedRowSelector}:has-text("${nome.replace(/"/g, '')}")`,
      });
    }
    return items;
  }

  private async goToNextPage(): Promise<boolean> {
    const nextButton = await locateFirst(this.page, PATIENTS_SELECTORS.nextPageButton, 2000);
    if (!nextButton || !this.resolvedRowSelector) return false;

    const isDisabled = await nextButton.getAttribute('disabled').catch(() => null);
    const ariaDisabled = await nextButton.getAttribute('aria-disabled').catch(() => null);
    if (isDisabled !== null || ariaDisabled === 'true') return false;

    await nextButton.click();
    await this.page.waitForLoadState('networkidle').catch(() => undefined);
    return existsQuick(this.page, this.resolvedRowSelector, 5000);
  }
}
