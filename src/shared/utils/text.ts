/** Remove espacos extras, quebras de linha e normaliza texto vindo do DOM. */
export function cleanText(value: string | null | undefined): string {
  if (!value) return '';
  return value.replace(/\s+/g, ' ').trim();
}

/** Mantem apenas digitos (util para CPF e telefone). */
export function onlyDigits(value: string | null | undefined): string {
  if (!value) return '';
  return value.replace(/\D+/g, '');
}

/** Retorna undefined em vez de string vazia, para nao poluir o JSON final. */
export function undefinedIfEmpty(value: string): string | undefined {
  return value.length > 0 ? value : undefined;
}
