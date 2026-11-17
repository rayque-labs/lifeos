# Toph: sessão persistente e conceitos de ARTEMIS

Referências consultadas em 17/11/2026:
- https://github.com/google/artemis
- https://github.com/google/artemis/blob/main/mcp_server/rules.md
- https://ai.google.dev/gemini-api/docs/generate-content/google-search
- https://console.groq.com/docs/tool-use/built-in-tools/browser-search

## Conceitos e adaptação

ARTEMIS separa observação, operação e verificação; Pro usa plano e checkpoints,
Flash usa um ciclo reativo. O histórico de execução é independente de um balão
visual. Isso é referência arquitetural, não incorporação do código do ARTEMIS.
Não copiamos suas regras de agente para instruções do desenvolvedor.

Nesta etapa LifeOS passa a manter um ledger criptografado no aparelho, por conta,
compartilhado entre painel e chat principal. Preserva 120 mensagens; as últimas
32 elegíveis entram no contexto (a API ainda pode limitar a 16). Propostas,
retornos e falhas têm marcação distinta. A proposta não representa conclusão.
Tokens de confirmação de arquivos nunca são restaurados ou executados depois
que a janela é recriada. O usuário precisa pedir uma nova prévia com estado atual.

IDB serializa escritas de múltiplos WebViews. Mensagens possuem IDs próprios,
a limpeza gira a época e a chave, e respostas antigas não ressuscitam dados
apagados. AES-GCM autentica conta, época e ID como dados associados. Chaves são
não exportáveis. Isso protege o armazenamento em repouso, não contra código
malicioso executado na origem ou aparelho comprometido.

As até 30 memórias explícitas são recuperadas sem exigir que a pergunta repita
as mesmas palavras. Isso não é memória semântica ilimitada nem sincronização
entre dispositivos. Limpar conversa não apaga as notas; “Limpar memória” apaga
as notas. Desinstalar/limpar dados do app elimina ambas.

A ferramenta web-search consulta de verdade o provedor. Gemini usa google_search;
Groq GPT-OSS 20B/120B usa browser_search com tool_choice required, sem JSON
estruturado. A resposta de pesquisa não é interpretada como ferramenta de sistema.
Só links dos metadados do provedor são apresentados como fontes. Sem links,
a interface declara a ausência de fontes verificáveis. HTML de sugestões Google
fica em iframe sandbox sem scripts nem acesso à origem. Não há scraping de
sessões do Chrome, envio de histórico privado ou pesquisa gratuita garantida.
“Pesquise … no Chrome” continua sendo abertura de navegador, explicitamente.
Pesquisa automática pelo planejador usa consulta pública, sem enviar notas ao
endpoint de pesquisa. Modelos/provedores não suportados recebem orientação clara.

## Conversa sem abrir janela

Um serviço foreground microphone mantém SpeechRecognizer, TTS e um WebView
privado que carrega somente os assets locais do motor de conversa. A origem
https://localhost é a mesma do Capacitor, para compartilhar IndexedDB criptografado.
A ponte nativa só aceita readiness/resposta de voz; não expõe arquivos, shell ou
controle do aparelho. Navegações são bloqueadas; o documento local tem CSP sem
frames, sem scripts remotos e sem avaliação dinâmica. Não usa backend adicional.

“Conversar sem abrir janela” é habilitado nas configurações ao ativar a Toph,
com permissão do microfone pedida enquanto Activity está visível. Saudação ocorre
quando o usuário sai do LifeOS. Segurar o bonequinho ou a ação na notificação
pausa/retoma; “encerrar a Toph” encerra. Bloquear a tela, três silêncios ou erro
pausa a escuta. Não reinicia sozinho após morte do processo. O reconhecimento
pode usar a rede do serviço de voz Android, não é garantidamente offline.

Ao abrir o app/painel, o motor do bonequinho suspende seu microfone e cancela
requisição pendente para não disputar a fala com o painel. Ao recolher, retoma
se não estiver pausado. Histórico é compartilhado e BroadcastChannel atualiza
janelas abertas. Esta versão usa TTS pt-BR do Android fora do painel, não voz
clonada. O motor sem painel conversa, usa memória e pesquisa; ações de alteração
pedem abrir o painel e fazer novo pedido para prévia e confirmação. Não executa
alterações silenciosamente. Somente o build offline APK suporta esse motor;
versão conectada ao servidor pede abrir chat autenticado.

## Limites ainda não implementados

- Controle geral de outros apps (toque, digitação, rolagem com observação fresca)
  não foi adicionado. O APK atual não declara AccessibilityService. Leitura OCR
  com MediaProjection e abertura de apps não equivalem a operar sua interface.
- ARTEMIS original usa host com Python/ADB e helper. Não foi instalado no Termux
  nem incorporado ao APK; compatibilidade no Moto G34 não foi comprovada.
- Não existe loop geral autônomo planear/observar/agir/verificar entre apps.
  A adaptação aqui é a fundação persistente, propostas e registros de resultados.
- Integrações OAuth Drive/Gmail/Notion/Spotify continuam não implementadas.

## Validação

Testes automatizados de armazenamento reaberto, isolamento por conta, duas
janelas gravando, limpeza versus resposta atrasada, limite de retenção e contexto
sem resultados privados; adaptadores web com respostas simuladas verificam
parâmetros, metadados, URLs e erros. O bundle offline do motor de voz também é executado com APIs simuladas: persistência após recriação, contexto, memória, encaminhamento ao painel sem mutação e erro de credencial. Nenhuma chave real foi usada em testes.
Build TypeScript/Vite e workflow Android devem passar antes de publicar APK.

Teste manual pendente no telefone: conversar, recolher, reabrir, perguntar sobre
mensagem anterior; repetir no chat principal; limpar e reabrir; verificar uma
pesquisa Gemini/Groq real; confirmar que não duplica nenhuma ação ao reabrir.

Teste físico de voz pendente: ativar/sair do app, saudação, pergunta e resposta, recolher/abrir painel, não ouvir a própria fala, pausar/retomar/encerrar, bloquear tela e negar permissão. O ambiente de CI não possui o telefone do usuário.
