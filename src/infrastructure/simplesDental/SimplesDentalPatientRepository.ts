import { Page } from 'playwright';
import { IPatientRepository } from '../../domain/repositories/IPatientRepository';
import { PatientListItem } from '../../domain/entities/PatientListItem';
import { PatientDetails } from '../../domain/entities/PatientDetails';
import { EvolutionEntry } from '../../domain/entities/EvolutionEntry';
import { PatientsListService } from './patients.service';
import { PatientDetailsService } from './patientDetails.service';
import { EvolutionsService } from './evolutions.service';

/**
 * Implementacao concreta de IPatientRepository usando Playwright.
 * Apenas orquestra os 3 servicos especializados — nao contem logica
 * de scraping por si so (Single Responsibility Principle).
 */
export class SimplesDentalPatientRepository implements IPatientRepository {
  private readonly listService: PatientsListService;
  private readonly detailsService: PatientDetailsService;
  private readonly evolutionsService: EvolutionsService;
  /** URL da listagem de pacientes, capturada na construção — usada para
   * VOLTAR à listagem depois de cada paciente (ver getPatientDetails). */
  private readonly listingUrl: string;

  constructor(private readonly listingPage: Page) {
    this.listService = new PatientsListService(listingPage);
    this.detailsService = new PatientDetailsService(listingPage);
    this.evolutionsService = new EvolutionsService();
    this.listingUrl = listingPage.url();
  }

  async listPatients(): Promise<PatientListItem[]> {
    return this.listService.list();
  }

  async getPatientDetails(
    patient: PatientListItem,
  ): Promise<{ details: PatientDetails; evolucoes: EvolutionEntry[] }> {
    // A ficha pode abrir na MESMA aba (listingPage) ou numa aba NOVA —
    // detailsService.open() descobre isso e retorna a page correta a usar.
    const { page: fichaPage, details } = await this.detailsService.open(patient);

    // Le as evolucoes na MESMA aba onde a ficha esta aberta, antes de fechar.
    const evolucoes = await this.evolutionsService.read(fichaPage);

    if (fichaPage !== this.listingPage) {
      // Abriu numa aba separada — fecha ela agora que terminamos de ler.
      await fichaPage.close().catch(() => undefined);
    } else {
      // Navegou na MESMA aba (saiu da listagem) — precisa VOLTAR para a
      // listagem antes do próximo paciente, senão a busca/clique do
      // próximo paciente falha (a tabela não existe mais na tela atual).
      await this.listingPage.goto(this.listingUrl, { waitUntil: 'domcontentloaded' }).catch(() => undefined);
      await this.listingPage.waitForLoadState('networkidle').catch(() => undefined);
    }

    return { details, evolucoes };
  }
}
