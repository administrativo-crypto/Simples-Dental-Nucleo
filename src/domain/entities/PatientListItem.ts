/**
 * Representa um paciente conforme aparece na TABELA de listagem
 * (dados resumidos, antes de abrir a ficha individual).
 */
export interface PatientListItem {
  nome: string;
  codigo?: string;
  cpf?: string;
  telefone?: string;
  status?: string;
  /** Idade exibida na listagem (ex: "55 anos"). Confirmado na tela real do Simples Dental. */
  idade?: string;
  /** Dentista/profissional responsável, exibido na 2ª coluna da listagem real. */
  responsavel?: string;
  /**
   * Seletor usado internamente para reabrir a linha exata deste paciente
   * na tabela de listagem (necessário porque o Simples Dental é uma SPA
   * e nem sempre expõe uma URL direta por paciente).
   * Não faz parte do JSON de saída — é um detalhe de navegação.
   */
  rowSelector: string;
}
