# Segurança

## Implementado

- Senhas processadas com Argon2 por `pwdlib`; texto puro não é persistido nem devolvido.
- Tokens JWT HS256 têm expiração e usam um segredo fora do código. Em ambiente `production`, `JWT_SECRET` precisa ter ao menos 32 caracteres e não pode ser o placeholder do `.env.example`.
- Logout e troca de senha incrementam `token_version`, revogando tokens anteriores.
- As tarefas têm `user_id`; listagem, leitura, atualização e exclusão são filtradas pela conta autenticada. Tentativas de acessar outro usuário respondem `404`.
- Endpoints de autenticação devolvem erros genéricos de credencial inválida.
- Recuperação de senha usa token aleatório de uso único, expiração, hash SHA-256 no banco e adaptador SMTP configurável; a redefinição revoga sessões existentes.
- Segredos locais devem ficar em `.env`, ignorado pelo Git.

## Limitações abertas

- Não há rate limiting para login, cadastro ou recuperação; também falta verificação de e-mail.
- CORS ainda não foi restringido para os domínios do frontend.
- Tarefas antigas recebem `user_id = NULL` na migração aditiva e ficam inacessíveis pelas rotas autenticadas; são preservadas até uma decisão explícita de importação/associação. Não associe dados antigos automaticamente a uma conta arbitrária.
- Falta executar auditoria automatizada completa de dependências e hardening operacional antes da produção.
- Não use a API atual na internet até concluir CORS, limitação de tentativas, fluxo de recuperação e revisão de produção.

Gere o segredo de produção com um gerador criptográfico (por exemplo `openssl rand -hex 32`) e configure-o diretamente no painel seguro do provedor. Não o envie pelo chat, logs ou repositório.

## Revisão pré-produção (pendente)

- O frontend mantém o access token em `sessionStorage`. Isso reduz persistência após fechar a sessão, mas tokens continuam acessíveis a JavaScript da mesma origem; uma vulnerabilidade XSS pode comprometê-los. Antes de produção, revisar CSP, sanitização, dependências e a estratégia de sessão.
- Não foi identificado rate limiting nos endpoints de cadastro, login e recuperação. Implementar limitação apropriada antes de expor publicamente, preferencialmente com armazenamento compartilhado quando houver múltiplas instâncias.
- Configurar `CORS_ORIGINS` com somente a origem HTTPS do frontend. Não usar curingas em produção.
- Avaliar headers de segurança, política de exposição da documentação OpenAPI, limites de payload e política de logs.
- Verificar a validade dos tokens, expiração, rotação de segredo e tratamento de `JWT_SECRET` em produção.
- Executar análise automatizada das dependências e corrigir vulnerabilidades relevantes antes do lançamento.
- Validar recuperação de senha com SMTP real. Respostas não devem revelar se um endereço está cadastrado.

Os itens desta seção são tarefas de lançamento, não controles que tenham sido comprovados como concluídos nesta sessão.
