# Banco de dados

## Configuração

O backend lê `DATABASE_URL` e `SQL_ECHO` do ambiente ou de um arquivo `.env` local. `DATABASE_URL` assume `sqlite:///./lifeos.db` para desenvolvimento. PostgreSQL usa SQLAlchemy com psycopg 3; URLs `postgres://` e `postgresql://` são normalizadas para o driver `postgresql+psycopg://`.

Não comite `.env`. Para produção, use a URL privada do PostgreSQL fornecida pela plataforma como variável de ambiente. Desative `SQL_ECHO` em produção para evitar logs de consultas e valores.

## Migrações

O startup da aplicação não cria tabelas. Migrações devem ser executadas explicitamente pelo operador ou pelo processo de release:

```bash
alembic upgrade head
alembic current
```

Crie novas revisões com:

```bash
alembic revision --autogenerate -m "descricao"
```

Revise o arquivo gerado antes de aplicar: autogenerate não substitui revisão humana. Em desenvolvimento isolado, `alembic downgrade -1` reverte uma revisão; em produção, faça backup e avalie o efeito no dado antes de qualquer downgrade.

## Banco SQLite preexistente

O repositório já pode conter `lifeos.db` local. Não aplique a revisão `20261101_0001` diretamente nesse banco, pois ela cria a tabela `tasks` e pode falhar caso a tabela já exista. Também não use `stamp head` sem verificar que todas as tabelas, colunas, índices e constraints existentes correspondem exatamente à revisão. Antes de alinhar esse arquivo:

1. Pare a aplicação e copie o arquivo para um local seguro.
2. Valide a integridade da cópia com `sqlite3 backup.db 'PRAGMA integrity_check;'`.
3. Compare `PRAGMA table_info(tasks)` e índices com a revisão.
4. Só então decida entre migrar com revisão específica de dados ou marcar a revisão como aplicada.

Nenhuma operação foi executada no arquivo `lifeos.db` durante a preparação desta configuração.

## Backup e restauração

Para SQLite, crie uma cópia consistente pelo comando `.backup` do cliente `sqlite3` enquanto a aplicação estiver parada, ou use a API de backup do SQLite. Para PostgreSQL, use `pg_dump --format=custom` e restaure em um banco vazio com `pg_restore`; guarde o dump criptografado e teste a restauração periodicamente. O armazenamento de backup deve ficar separado do serviço de aplicação e seguir a retenção definida pelo operador.

O provisionamento e teste de backups PostgreSQL em produção ainda dependem do serviço de hospedagem e ficam fora do estado atual do repositório.
