# Toph executor — primeira entrega

A conversa usa a API de IA já configurada para propor uma ferramenta validada. Não executa código livre produzido pelo modelo. Os comandos locais de arquivos e tarefas continuam funcionando sem IA.

## Capacidades desta entrega

- Android: autorizar uma pasta pelo seletor do sistema, listar e procurar itens diretamente nela.
- Criar subpasta e novos arquivos de texto (.txt, .md, .csv, .json), renomear um item.
- Organizar todos os arquivos soltos da pasta autorizada em subpastas por tipo, sem recursão. Limite de 200 itens por pasta.
- Prévia explícita e confirmação por botão para mudanças. Plano de arquivos de uso único com validade de cinco minutos. Conflitos de nomes bloqueados.
- Conferência de nome e conteúdo após criação, nome após renomeação, destino/tamanho/ausência na origem após movimentação.
- Cancelamento entre etapas. Operações já realizadas são mantidas e listadas. Sem desfazer automático.
- Criar tarefas com conferência por leitura e listar tarefas.
- Envio WhatsApp pela Evolution configurada, com número completo e texto na prévia. Retorno mostra aceitação e ID do servidor, sem afirmar entrega ou leitura. Não há repetição automática após timeout.
- Resultados de arquivos e integrações não entram automaticamente no histórico enviado ao provedor de IA. O pedido escrito e as notas de memória pertinentes podem ser enviados ao provedor configurado.

## Limites reais

Ainda não inclui exclusão/lixeira, comparação de fotos, busca recursiva, integração OAuth de Drive/Gmail/Notion/Spotify, automação de Instagram/Facebook, nem controle visual de outros aplicativos. O provedor de documentos precisa suportar movimentações. O seletor Android restringe determinadas pastas. Termux/Evolution/PostgreSQL/Redis precisam estar rodando para WhatsApp.

O executor é compartilhado pelo chat principal e pelo painel flutuante. Recriar a Activity descarta a prévia; faça o pedido de novo. Resultados e progresso ficam na conversa da sessão, sem registro persistente de auditoria nesta entrega.

## Testes

- `node --experimental-strip-types --test tests/*.test.mjs` no frontend valida ferramentas não permitidas, caminhos, tamanho, número WhatsApp, parâmetros extras e comandos negados.
- `javac` + `FileRulesTest` verificam classificação e MIME, também no workflow Android.
- Workflow roda lint, TypeScript/Vite, compilação Java Android, testes unitários Gradle, empacotamento, integridade ZIP e assinatura do APK.

## Aceitação no aparelho (pendente)

1. Crie uma pasta de teste com cópias de 2 PDFs, 1 foto, 1 planilha e um arquivo de texto. No chat, toque em Arquivos e autorize apenas essa pasta.
2. Peça “listar arquivos”, “crie uma pasta chamada IAC” e confirme. Confira a pasta no gerenciador Android.
3. Peça “crie o arquivo teste.txt com o texto Olá Rayque” usando a IA configurada. Confira a prévia, confirme e abra o arquivo.
4. Peça “organize meus documentos”. Confira todos os destinos, confirme e confira as subpastas.
5. Teste um nome existente: deve bloquear sem sobrescrever. Revogue o acesso e confirme que o app pede uma nova autorização.
6. Peça uma mensagem WhatsApp para um número de teste sob seu controle. Confira número/texto antes de confirmar e verifique recebimento separadamente.
7. Repita pelo painel flutuante. Teste cancelamento e retorno após alternar aplicativos.

A compilação e os testes automáticos não comprovam o comportamento no dispositivo físico. Não enviar mensagens reais como parte do CI.
