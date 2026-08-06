import { Credentials } from '../entities/Credentials';
import { LoginResult } from '../entities/LoginResult';

/**
 * Porta (interface) que define o contrato de autenticacao.
 * A camada de dominio/aplicacao depende apenas desta abstracao,
 * nunca da implementacao concreta (Playwright).
 */
export interface IAuthRepository {
  login(credentials: Credentials): Promise<LoginResult>;
}
