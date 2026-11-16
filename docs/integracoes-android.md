# Integrações no LifeOS para Android

## WhatsApp por código

A Evolution API v2 precisa estar rodando em um servidor HTTPS, com origem `https://localhost` autorizada para o APK. Use uma instância Baileys existente e uma chave autorizada para ela. Em **Configurações → Integrações → WhatsApp · Evolution API**, informe a URL base, instância, chave e número internacional. Toque em **Gerar código** e digite-o pelo menu **WhatsApp → Aparelhos conectados → Conectar aparelho → Conectar com número de telefone**. Volte e toque em **Ver status**. O código fica apenas na tela durante a sessão.

Use **Consultar conversas** para ver os chats sincronizados e trechos de texto recentes. Para escrever, expanda **Abrir rascunho no WhatsApp**, preencha o destinatário e o texto, e abra a conversa. O envio é feito pelo usuário no WhatsApp.

## Controle da tela

Para abrir apps compatíveis, diga “abrir calculadora” ou “abrir WhatsApp”. Para interagir com a tela, siga **Configurações → Integrações → Controle do Android → Configurar Acessibilidade** e habilite **Toph — controle do Android**.

Abra a Toph flutuante sobre o app e solicite um comando por vez, como “rolar para baixo no WhatsApp”, “tocar 50% 70% no WhatsApp”, ou “digitar Olá no WhatsApp”. Selecione o campo antes da digitação. A ação só é tentada se o app citado estiver em primeiro plano quando o painel fechar. Os controles de tela estão disponíveis em WhatsApp, Agenda, Calculadora, Keep, Chrome e Instagram. Também é possível abrir Facebook ou Facebook Lite, pesquisar termos no Chrome e abrir um perfil pelo @ no Instagram.

Na Toph flutuante, toque em **Analisar a tela** para listar textos e elementos acionáveis que o app subjacente disponibiliza ao Android. O resumo é local, não entra nas mensagens enviadas ao provedor de IA e não usa capturas ou OCR. Para acionar um botão pelo nome, experimente “tocar em Pesquisar no Instagram”.
