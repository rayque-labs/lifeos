# LifeOS — experimento com APIs de IA

## Estratégia
LifeOS básico deve continuar útil sem IA: tarefas, agenda, lembretes, finanças manuais e configurações. A amiga digital terá interface própria e poderá usar provedores intercambiáveis. Planos pagos devem adicionar recursos, não retirar dados do usuário.

## Primeiro experimento
1. Escolher um provedor com API de chat no formato OpenAI-compatible (por exemplo, Groq ou OpenRouter). Confirmar modelo e limites no painel do provedor; não presumir gratuidade ilimitada.
2. No terminal, definir LIFEOS_LLM_BASE_URL, LIFEOS_LLM_MODEL e LIFEOS_LLM_API_KEY em variáveis de ambiente (não em arquivos versionados).
3. Executar `python agent-server/test_provider.py` localmente. O script envia apenas uma frase fictícia em português.
4. Avaliar latência, naturalidade, tom, estabilidade, custo e limites por minuto/dia. Não enviar dados pessoais reais durante o teste.
5. Só depois criar endpoint autenticado no backend: autenticação por usuário, cotas, consentimento explícito, isolamento de memória, rate limiting e proteção contra abuso.

## Modelo comercial
- Grátis: funções locais completas e conversas com cotas transparentes, quando disponíveis.
- Pago: integrações e automações mais complexas, limites maiores e recursos adicionais.
- Evitar prometer IA ilimitada com cota gratuita de terceiros.

## Segurança
Nunca colocar chave de provedor em APK, frontend, GitHub ou logs. Nunca expor proxy público anônimo. Os endpoints de chat e ações do scaffold permanecem desabilitados até a autenticação estar pronta.
