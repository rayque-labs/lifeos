# Integrações no LifeOS para Android

## WhatsApp por código

A Evolution API v2 precisa estar rodando em um servidor HTTPS, com origem `https://localhost` autorizada para o APK. Use uma instância Baileys existente e uma chave autorizada para ela. Em **Configurações → Integrações → WhatsApp · Evolution API**, informe a URL base, instância, chave e número internacional. Toque em **Gerar código** e digite-o pelo menu **WhatsApp → Aparelhos conectados → Conectar aparelho → Conectar com número de telefone**. Volte e toque em **Ver status**. O código fica apenas na tela durante a sessão.

Use **Consultar conversas** para ver os chats sincronizados e trechos de texto recentes. Para escrever, expanda **Abrir rascunho no WhatsApp**, preencha o destinatário e o texto, e abra a conversa. O envio é feito pelo usuário no WhatsApp.

## Controle da tela

Para abrir apps compatíveis, diga “abrir calculadora” ou “abrir WhatsApp”. Para interagir com a tela, siga **Configurações → Integrações → Controle do Android → Configurar Acessibilidade** e habilite **Toph — controle do Android**.

Abra a Toph flutuante sobre o app e solicite um comando por vez, como “rolar para baixo no WhatsApp”, “tocar 50% 70% no WhatsApp”, ou “digitar Olá no WhatsApp”. Selecione o campo antes da digitação. A ação só é tentada se o app citado estiver em primeiro plano quando o painel fechar. Os controles de tela estão limitados a WhatsApp, Agenda, Calculadora e Keep. A navegação do Chrome está limitada à abertura do app.
