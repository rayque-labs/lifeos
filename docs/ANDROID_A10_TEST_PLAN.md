# LifeOS — teste presencial no Galaxy A10

Objetivo: validar o APK real antes de integrar um servidor de IA. Não utilizar dados bancários reais nem conceder permissões de leitura de mensagens durante este teste.

## Preparação
- [ ] Confirmar modelo exato, versão Android, espaço livre e bateria em boas condições.
- [ ] Baixar o APK **somente** do artefato de uma execução GitHub Actions bem-sucedida na branch `design/monolith-v2`.
- [ ] Registrar número da execução, commit e data do APK testado.
- [ ] Instalar e abrir sem erros. Não presumir que o build passou antes de verificar.
- [ ] Desativar otimizações de bateria apenas se necessário para um teste específico, e documentar o motivo.

## Interface e armazenamento
- [ ] Splash: aparece uma vez, sem tela duplicada.
- [ ] Barra superior: menu e controles clicáveis, inclusive perto do recorte/status bar.
- [ ] Barra inferior: ícones e botão central clicáveis sem sobreposição com navegação Android.
- [ ] Calendário: criar, editar, navegar entre mês/semana e reabrir o app.
- [ ] Dados offline: fechar o app, reabrir e verificar persistência.
- [ ] Configurações: alterar nome do usuário e nome do agente; reabrir e confirmar.

## Agente proativo
- [ ] Preferências persistem após reiniciar o app.
- [ ] Acesso de uso: tela de permissão Android abre e estado é atualizado.
- [ ] Sem permissão: nenhuma leitura silenciosa nem erro que trave a interface.
- [ ] Com permissão: teste manual mostra minutos e eventual sugestão.
- [ ] Responder 'Boa ideia', 'Agora não' e 'Não é útil'.
- [ ] Histórico: contagem, exportação JSON e exclusão.
- [ ] Horário de silêncio (8h–22h): verificar em teste controlado, sem mudar relógio para simular produção.
- [ ] Não pressupor notificação em segundo plano: recurso ainda não implementado.

## Alarmes
- [ ] Agendar evento a 3–5 minutos no futuro.
- [ ] Verificar vibração e atraso de ~2 segundos antes da fala, **se** implementados no APK.
- [ ] Verificar tela cheia, funcionamento com tela bloqueada e permissões Android.
- [ ] Se qualquer item falhar, registrar comportamento real; não marcar como implementado.

## Relato de bugs
Para cada falha: tela, passos, esperado, observado, versão Android, commit, vídeo/captura (sem dados pessoais) e se ocorre após reiniciar.

## Critérios para avançar
Build validado + instalação + navegação + persistência + alarmes básicos sem travamentos. Só depois integrar chat com IA/servidor e ampliar permissões.
