/**
 * Seletores da area de Pacientes do Simples Dental.
 *
 * Confirmados/ajustados em 05/08/2026 rodando o robo de verdade contra a
 * conta real. Onde o texto exato da tela ja e conhecido, o seletor reflete
 * isso; onde ainda nao foi confirmado, mantemos fallbacks genericos.
 */
export const PATIENTS_SELECTORS = {
  // Item de menu para abrir a listagem de pacientes
  menuPacientes: [
    'a:has-text("Pacientes")',
    'text=Pacientes',
    '[data-testid="menu-pacientes"]',
    'nav >> text=Pacientes',
  ],

  // Campo de busca/filtro na listagem (usado para localizar um paciente especifico)
  searchInput: [
    'input[placeholder*="busca" i]',
    'input[placeholder*="pesquis" i]',
    'input[type="search"]',
    '[data-testid="search-pacientes"]',
  ],

  // Tabela / linhas de pacientes
  tableRows: [
    'table tbody tr',
    '[role="table"] [role="row"]',
    '[data-testid="linha-paciente"]',
  ],

  // Botao/link de "proxima pagina" na paginacao da tabela
  nextPageButton: [
    'button[aria-label*="próxima" i]',
    'button:has-text("Próxima")',
    'a:has-text("Próxima")',
    '[data-testid="next-page"]',
  ],

  // Popup promocional que aparece na ficha do paciente ("Agora você pode
  // assinar eletronicamente..."), confirmado na tela real.
  promoModalClose: [
    'button[aria-label*="fechar" i]',
    'button[aria-label*="close" i]',
    '[role="dialog"] button:has-text("×")',
    '[role="dialog"] svg[class*="close" i]',
    '.modal button.close',
  ],

  // Nome do paciente no topo da ficha (perto do avatar)
  patientNameHeading: ['h1', 'h2', '[data-testid="paciente-nome"]'],

  // Rótulos EXATOS confirmados na aba "Sobre" da ficha do paciente. Usados
  // pelo parser de rótulo→valor (ver PatientDetailsService), que lê o texto
  // do bloco "Dados pessoais" inteiro e associa cada rótulo ao valor logo
  // em seguida — mais confiável do que um seletor CSS único aqui, já que
  // rótulo e valor ficam em elementos irmãos sem classe previsível.
  fieldLabels: {
    dataNascimento: ['Data de nascimento'],
    idade: ['Idade do paciente'],
    sexo: ['Sexo'],
    celular: ['Celular'],
    email: ['E-mail', 'Email'],
    endereco: ['Endereço'],
    bairro: ['Bairro'],
    cep: ['CEP'],
    cidade: ['Cidade'],
    uf: ['UF'],
    cpf: ['CPF'], // não aparece na aba Sobre observada, mantido para outras contas/planos
    observacoesGerais: ['Observações gerais'],
  },

  patientObservations: ['[data-testid="paciente-observacoes"]', 'text=/Observações/i'],
  activeTreatmentsList: ['[data-testid="tratamentos-ativos"] li', '.tratamentos-ativos li'],
  proceduresList: ['[data-testid="procedimentos"] li', '.procedimentos li'],

  // Abas dentro da ficha (confirmadas: "Sobre", uma que termina em "entos"
  // — provavelmente "Tratamentos" —, e "Débitos". "Evoluções" pode estar
  // escondida atrás do popup promocional ou dentro de outra aba — a
  // confirmar com um screenshot sem o popup no caminho).
  evolutionsTab: [
    'button:text-is("Evoluções")',
    'a:text-is("Evoluções")',
    '[role="tab"]:text-is("Evoluções")',
  ],
  evolutionEntries: ['[data-testid="evolucao-item"]', '.evolucao-item', 'article'],
  evolutionDate: ['[data-testid="evolucao-data"]', '.evolucao-data'],
  evolutionTime: ['[data-testid="evolucao-hora"]', '.evolucao-hora'],
  evolutionProfessional: ['[data-testid="evolucao-profissional"]', '.evolucao-profissional'],
  evolutionProcedure: ['[data-testid="evolucao-procedimento"]', '.evolucao-procedimento'],
  evolutionText: ['[data-testid="evolucao-texto"]', '.evolucao-texto', 'p'],
  evolutionAttachmentIndicator: ['[data-testid="evolucao-anexo"]', '.anexo, .attachment, svg[class*="clip" i]'],
};
