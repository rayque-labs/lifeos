# Execução assistida na tela — 17/11/2026

## Fluxo implementado

1. Ativar “Toph · Execução assistida” em Acessibilidade, manualmente.
2. Abrir um app suportado e tocar no bonequinho para abrir o painel.
3. Usar “Executar na tela”, informar objetivo e ler os controles.
4. Revisar o recorte (até 70 elementos de uma árvore de até 350 nós) e autorizar
   seu envio ao provedor configurado. Não são enviadas imagens nem valores de
   campos editáveis. Tela com campo de senha encontrado é recusada.
5. A IA propõe UMA ação sem token nativo. O código valida alvo e capacidade.
6. Confirmar a ação. O executor nativo consome o token único, verifica prazo de
   120 segundos, pacote, hash da tela, elemento, rótulo, limites e capacidades.
7. Executar via AccessibilityNodeInfo.performAction, sem coordenadas arbitrárias,
   shell, gestos globais ou fallback de toque às cegas.
8. Observar novamente após 900 ms. Aceitação pelo app e mudança de tela são
   registros separados, nunca prova automática de conclusão. Digitação também
   tenta conferir o texto após atualizar o nó. Falhas não são repetidas.
9. Pedir a próxima proposta ou encerrar. Limite de 8 ações por sessão. Mensagens
   do registro são persistidas criptografadas no chat. Tokens e prévias de tela
   não são restaurados ou executados automaticamente após recriação do painel.

## Apps

Chrome, Instagram, Facebook/Facebook Lite, WhatsApp/Business, Spotify, Keep,
Agenda Google e Calculadora Google. A lista está validada no código nativo.
Abrir Spotify foi adicionado ao roteador de aplicativos.

## Consentimento e privacidade

Não há captura contínua de eventos de acessibilidade. onAccessibilityEvent não
coleta conteúdo. O serviço não pede SMS, leitor de notificações, ADB nem root.
Declara sua função de automação como isAccessibilityTool=false. BIND_ACCESSIBILITY_SERVICE
restringe quem pode vincular ao serviço. A tela só é enviada à IA após marcar a
opção correspondente e tocar em Planejar. A resposta da IA é JSON validado como
dados; instruções encontradas na tela são explicitamente não confiáveis.

Todo toque requer revisão: ações de enviar/publicar/excluir não são distinguidas
com garantia por palavras em um rótulo. É por isso que esta primeira versão não
executa sequências de cliques sem confirmação. Senhas, CAPTCHA, login, permissões
e operações financeiras são orientadas para execução manual pelo planejador.
O bloqueio nativo de senhas é independente do modelo. A lista de apps não impede
que uma página sensível esteja aberta no Chrome: o usuário deve revisar o recorte
antes de enviá-lo e confirmar somente a ação pretendida.

## Limitações verificáveis

Nenhum teste no Moto G34 ou serviço de acessibilidade físico foi realizado neste
ambiente. APIs de plataforma são compiladas no CI; testes cobrem validador, limites,
apps, freshness e incompatibilidade de ações. Telas dinâmicas, controles sem
semântica e transições lentas podem bloquear uma proposta ou deixar verificação
indisponível. Não considera leitura parcial como inventário completo da tela.

Este APK passa a declarar Acessibilidade e pode ser bloqueado pelo Play Protect
ou políticas do aparelho. Não há tentativa de ocultar essa declaração ou contornar
uma proteção Android. O APK anterior sem executor continua disponível. Distribuição
em Play Store exige avaliação própria das políticas aplicáveis; não foi solicitada.
