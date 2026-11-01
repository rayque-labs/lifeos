# Arquitetura atual e alvo

## Estado atual (v0.2.0)

O fluxo implementado é HTTP → rotas FastAPI (`app/routes`) → serviços (`app/services`) → modelos SQLAlchemy (`app/models`) → sessão criada em `app/database/connection.py`. Schemas Pydantic em `app/schemas` validam entrada e serializam a resposta. Os testes usam `StaticPool` SQLite em memória e substituem a dependência `get_db`.

Os domínios implementados são contas e tarefas. Login emite JWT assinado, com expiração e uma versão de token consultada no usuário para revogação. Rotas de tarefa consultam e mutam apenas linhas cujo `user_id` corresponde à conta autenticada. O `user_id` é temporariamente anulável para preservar linhas legadas existentes; linhas antigas sem proprietário não aparecem nas rotas privadas.

## Riscos e decisões

- O schema não é mais criado no startup. Schema de produção deve avançar por migrações Alembic explícitas.
- Não migrar o arquivo SQLite existente automaticamente. Antes de importar dados, comparar o schema e produzir backup verificável.
- Preservar os contratos das rotas atuais ao adicionar autenticação e campos opcionais; qualquer mudança incompatível deve ser versionada/documentada.
- A configuração do banco será centralizada por ambiente, mantendo SQLite para testes e PostgreSQL como alvo de produção.
- Cada domínio deve separar modelo, schema, serviço e rotas; toda consulta e mutação autenticada deve ser escopada pelo usuário autenticado.
- Valores monetários serão `Decimal`/`NUMERIC`, datas armazenadas com semântica temporal explícita.

## Alvo de produção

React + TypeScript + Vite no frontend; FastAPI no backend; SQLAlchemy com Alembic; PostgreSQL gerenciado; variáveis de ambiente para configuração e segredos; health checks, CI e implantação preparada para Render. A infraestrutura externa só será alterada com autorização explícita.
