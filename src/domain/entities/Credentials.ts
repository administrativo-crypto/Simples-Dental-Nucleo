/**
 * Entidade de dominio que representa as credenciais de acesso.
 * Nao possui nenhuma dependencia de infraestrutura (Playwright, dotenv, etc).
 */
export class Credentials {
  private constructor(
    public readonly username: string,
    public readonly password: string,
  ) {}

  static create(username: string, password: string): Credentials {
    if (!username || username.trim().length === 0) {
      throw new Error('Usuario nao pode ser vazio.');
    }
    if (!password || password.trim().length === 0) {
      throw new Error('Senha nao pode ser vazia.');
    }
    return new Credentials(username.trim(), password);
  }
}
