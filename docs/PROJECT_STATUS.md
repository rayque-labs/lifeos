# LifeOS — estado do projeto

Atualizado em 2026-11-01 com base na inspeção do pacote Portfolio.zip e nas verificações executadas nesta sessão.

## Estado observado

- Backend FastAPI com autenticação, tarefas, projetos, hábitos, notas, calendário, finanças e dashboard.
- SQLAlchemy, Alembic e nove migrações encadeadas até `20261101_0009`.
- 37 funções de teste encontradas nos arquivos `tests/`.
- Frontend React 19, TypeScript, Vite, Tailwind CSS e Recharts.
- Configuração inicial de PostgreSQL via `DATABASE_URL` e driver psycopg 3.
- O arquivo ZIP contém `lifeos.db`, `.venv`, `node_modules` e arquivos gerados; estes itens não devem ser publicados no Git.

## Verificações executadas nesta sessão

| Verificação | Resultado |
|---|---|
| `npm run lint` | Executou sem erros; 10 avisos encontrados |
| `npm run build` antes de code splitting | Aprovado; bundle principal ~746 kB |
| `npm run build` após code splitting | Aprovado; bundle principal ~281 kB e páginas separadas |
| `python -m pytest -q` | Não executado: ambiente global não tem `pwdlib` |
| `.venv/bin/python -m pytest -q` | Não executado: pytest não está instalado nesse ambiente virtual do ZIP |
| Instalação de dependências Python | Bloqueada por ausência de conectividade de rede neste ambiente |
| PostgreSQL real | Não validado; não há serviço PostgreSQL disponível |

Não declarar testes backend, migrações PostgreSQL ou deploy como aprovados até executar essas etapas em ambiente adequado.

## Alterações realizadas nesta sessão

- Frontend: páginas carregadas sob demanda com `React.lazy` e `Suspense`.
- Criado workflow `.github/workflows/ci.yml` para testes backend, migrações, lint e build frontend.
- Criado `render.yaml` com serviços propostos para API, frontend estático e PostgreSQL; API configurada com plano pago para suportar pré-deploy e banco no menor plano pago atual, sujeito à revisão de preço no painel.
- Criado `docs/DEPLOY.md` com variáveis, pré-requisitos, checklist e rollback.
- README reescrito para refletir os módulos realmente presentes e as limitações conhecidas.
- `.gitignore` reforçado para excluir dependências e artefatos de build.

## Pendências impeditivas antes de produção

1. Instalar dependências e executar os 37 testes backend em Python 3.12 limpo.
2. Corrigir falhas encontradas e validar `alembic upgrade head` e `alembic check`.
3. Executar migrações e testes de integração em PostgreSQL real.
4. Revisar e reduzir os avisos de lint; adicionar testes automatizados de frontend.
5. Fazer testes ponta a ponta dos fluxos principais.
6. Implementar/validar rate limiting para autenticação e recuperação de senha.
7. Revisar CORS, headers de segurança, exposição de `/docs`, logs e configuração de produção.
8. Configurar SMTP e testar recuperação de senha real.
9. Revisar o `render.yaml` e custos atuais antes de provisionar.
10. Fazer deploy autorizado e validar o checklist de produção.

## Próxima ação exata

Em uma máquina com rede, no diretório do projeto:

```bash
python3.12 -m venv .venv-clean
. .venv-clean/bin/activate
python -m pip install -r requirements.txt
python -m pytest -q
DATABASE_URL=sqlite:///./ci-lifeos.db ENVIRONMENT=test JWT_SECRET=ci-only-secret-not-for-production-0000000000000000 alembic upgrade head
DATABASE_URL=sqlite:///./ci-lifeos.db ENVIRONMENT=test JWT_SECRET=ci-only-secret-not-for-production-0000000000000000 alembic check
cd frontend && npm ci && npm run lint && npm run build
```

## Restrições

Sem credenciais no chat, sem provisionamento pago, sem alterações em serviços externos, sem push e sem deploy sem autorização explícita. Não aplicar migrações em banco com dados reais sem backup e revisão.
