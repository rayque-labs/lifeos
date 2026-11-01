# Deploy do LifeOS

## Estado

O repositório contém `render.yaml` para preparar uma implantação inicial com API FastAPI, frontend estático e PostgreSQL. Nenhum serviço foi provisionado e nenhum deploy foi executado por este repositório.

## Antes de provisionar

1. Confirme que os testes backend passam em ambiente limpo.
2. Valide todas as migrações em PostgreSQL real.
3. Revise `docs/SECURITY.md` e resolva os itens impeditivos.
4. Faça backup de qualquer banco que contenha dados importantes.
5. Revise os planos e preços atuais do Render. O Blueprint declara `0.5c-512mb` para a API e `0.1c-256mb` para PostgreSQL, ambos planos pagos; não confirme a implantação sem conferir custos e limites no painel.
6. Confirme os nomes/domínios Render previstos no `render.yaml`. Se os nomes dos serviços forem alterados, ajuste `CORS_ORIGINS`, `FRONTEND_URL` e `VITE_API_URL`.

## Serviços previstos

- `lifeos-api`: serviço Python que executa `uvicorn main:app --host 0.0.0.0 --port $PORT`.
- `lifeos-web`: frontend React compilado para `frontend/dist`.
- `lifeos-db`: PostgreSQL gerenciado.

O serviço de API aplica `alembic upgrade head` no comando de pré-deploy. Isso só deve ser habilitado após revisão das migrações e confirmação de backup. Não use o arquivo SQLite local como banco de produção.

## Variáveis de ambiente

### API

- `ENVIRONMENT=production`
- `DATABASE_URL`: URL interna do PostgreSQL fornecida pelo Render.
- `JWT_SECRET`: segredo aleatório exclusivo, gerado pelo provedor ou por gerador criptográfico.
- `CORS_ORIGINS`: origem exata do frontend, incluindo `https://`.
- `FRONTEND_URL`: URL pública do frontend.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` e `SMTP_USE_TLS`: necessários para envio de recuperação de senha.

### Frontend

- `VITE_API_URL`: URL pública HTTPS da API. Variáveis `VITE_` são incorporadas ao bundle no momento do build e não podem conter segredos.

## Checklist após deploy

- [ ] `/health` responde com HTTP 200.
- [ ] `/docs` está acessível conforme a política de exposição escolhida.
- [ ] Cadastro e login funcionam.
- [ ] Token expirado/inválido não permite acesso a dados privados.
- [ ] Duas contas não conseguem acessar dados uma da outra.
- [ ] CRUD de tarefas, projetos, hábitos, notas, eventos e finanças funciona.
- [ ] Dashboard mostra dados da conta autenticada.
- [ ] Recuperação de senha envia e-mail e o token é de uso único.
- [ ] Migrações estão em `head`.
- [ ] CORS permite somente as origens necessárias.
- [ ] Logs não expõem senhas, tokens ou dados financeiros sensíveis.
- [ ] Backup e restauração do PostgreSQL foram testados.
- [ ] HTTPS está ativo no frontend e na API.

## Rollback

Antes de uma migração, faça backup do PostgreSQL. Em caso de falha de aplicação, reverta o deploy da aplicação sem tentar reverter automaticamente migrações de banco. Reversões de schema exigem avaliação da compatibilidade e plano explícito de recuperação de dados.
