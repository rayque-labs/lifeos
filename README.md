# LifeOS

LifeOS é uma plataforma de gerenciamento pessoal que reúne tarefas, projetos, hábitos, notas, calendário e finanças em uma única aplicação.

## Estado do projeto

O repositório contém uma API FastAPI, autenticação com JWT e Argon2, persistência SQLAlchemy com migrações Alembic e uma interface web React/TypeScript. Os módulos principais estão implementados. A versão ainda está em validação pré-produção: o build do frontend foi executado neste pacote, mas os testes Python e a integração com PostgreSQL precisam ser executados em um ambiente com as dependências e o banco disponíveis.

### Funcionalidades

- Cadastro, login, perfil, alteração e recuperação de senha (recuperação depende de SMTP configurado).
- Tarefas com prioridade, status, categoria, vencimento, filtros e recorrência.
- Projetos com objetivos, prazos e progresso calculado a partir das tarefas.
- Hábitos com frequência, check-ins e histórico.
- Notas com tags, categorias, pesquisa e fixação.
- Calendário com eventos e vínculo opcional com tarefas.
- Finanças com contas, categorias, transações, saldos e resumos usando `Decimal`.
- Dashboard com dados agregados da conta autenticada.

## Arquitetura

- Backend: Python, FastAPI, SQLAlchemy e Pydantic.
- Banco: SQLite para desenvolvimento/testes e PostgreSQL recomendado para produção.
- Migrações: Alembic.
- Autenticação: JWT e hash Argon2.
- Frontend: React, TypeScript, Vite, Tailwind CSS e Recharts.
- Testes backend: Pytest e HTTPX.

Consulte [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), [`docs/API.md`](docs/API.md), [`docs/DATABASE.md`](docs/DATABASE.md) e [`docs/SECURITY.md`](docs/SECURITY.md).

## Requisitos

- Python 3.12 ou versão compatível com as dependências fixadas.
- Node.js 22 ou compatível com Vite 8.
- npm.
- PostgreSQL apenas para validar/operar o ambiente de produção.

## Execução local

### Backend

```bash
python -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
cp .env.example .env
alembic upgrade head
python -m uvicorn main:app --reload
```

API: `http://127.0.0.1:8000`
OpenAPI: `http://127.0.0.1:8000/docs`
Health check: `http://127.0.0.1:8000/health`

### Frontend

Em outro terminal:

```bash
cd frontend
npm ci
npm run dev
```

Frontend: `http://localhost:5173`.

Defina `VITE_API_URL` no ambiente de build do frontend quando a API não estiver em `http://localhost:8000`.

## Testes e qualidade

Backend:

```bash
python -m pytest -q
alembic upgrade head
alembic check
```

Frontend:

```bash
cd frontend
npm ci
npm run lint
npm run build
```

O workflow `.github/workflows/ci.yml` executa essas verificações no GitHub Actions. Avisos de lint devem ser revisados mesmo quando o comando termina sem erros.

## Configuração

Copie `.env.example` para `.env` e ajuste os valores locais. Nunca versione `.env` nem credenciais. Em produção, configure `ENVIRONMENT=production`, um `JWT_SECRET` exclusivo com pelo menos 32 caracteres, `DATABASE_URL`, `CORS_ORIGINS` e `FRONTEND_URL` diretamente no painel do provedor.

A API não cria nem altera o schema automaticamente ao iniciar. Use Alembic para aplicar migrações. **Não aplique a migração inicial diretamente a um `lifeos.db` preexistente sem inspecionar e fazer backup.** Veja [`docs/DATABASE.md`](docs/DATABASE.md).

## Deploy

A configuração inicial proposta para Render está em [`render.yaml`](render.yaml), e o procedimento está em [`docs/DEPLOY.md`](docs/DEPLOY.md). O arquivo é uma configuração de infraestrutura, não uma prova de deploy. Revise os planos e custos no painel antes de provisionar qualquer recurso.

## Limitações conhecidas antes da versão 1.0

- Testes Python e validação PostgreSQL precisam ser repetidos em ambiente com dependências disponíveis.
- O frontend ainda precisa de testes automatizados de componentes/fluxos e validação manual ponta a ponta.
- O lint do frontend atualmente emite avisos que precisam de revisão.
- Rate limiting, verificação de e-mail e hardening operacional ainda precisam ser concluídos antes de expor a API publicamente.
- SMTP precisa de configuração e teste real para recuperação de senha.
- Não há deploy de produção realizado.

## Sua própria IA (BYOK — Bring Your Own Key)

O LifeOS foi pensado para que **cada usuário escolha seu provedor e use sua própria cota de API**, sem depender de uma assinatura do LifeOS para conversar. Os recursos de agenda e organização não exigem IA.

### Como escolher a API

1. Compare modelos e cotas no painel oficial de Gemini, Groq ou OpenRouter. As condições de gratuidade e limites mudam; confira antes de usar.
2. Crie sua própria chave de API no provedor escolhido. **Nunca publique a chave em prints, GitHub, mensagens ou arquivos compartilhados.**
3. Para testar a compatibilidade OpenAI, use o script `agent-server/test_provider.py` e variáveis de ambiente `LIFEOS_LLM_BASE_URL`, `LIFEOS_LLM_MODEL` e `LIFEOS_LLM_API_KEY`. Veja [o guia de testes](docs/AI_API_FREE_TIER.md).
4. Comece com um modelo rápido e econômico; prefira contexto curto, memória resumida e chamadas apenas quando necessário. Verifique políticas de privacidade antes de enviar conteúdo sensível.

**Estado atual:** o teste de API existe, mas a tela de conexão BYOK e o chat integrado ao APK **ainda não estão prontos**. O usuário não deve inserir chaves em campos genéricos do aplicativo. A integração final precisará de armazenamento seguro de credenciais no Android e conexão direta segura ou gateway por usuário, sem publicar chaves no APK ou em logs. Uma API individual não elimina os limites impostos pelo provedor.

### Personalizar a voz do agente

Em **Configurações → Voz do agente**, é possível escolher uma voz de síntese disponível no aparelho e ouvir um teste. Também é possível carregar um áudio de referência para **reprodução local temporária**. Esse áudio não é enviado a um serviço nem transforma a voz em sintetizador.

**Clonagem de voz ainda não foi implementada.** Para gerar frases inéditas com uma voz clonada, precisaremos integrar um motor compatível e exigir consentimento explícito da pessoa cuja voz será utilizada. Não use gravações de terceiros, dubladores ou personagens sem autorização.

## Licença

Consulte [`LICENSE`](LICENSE).
