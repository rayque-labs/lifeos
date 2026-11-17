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

Inclui agora revisão de duplicatas exatas e lixeira de fotos, descritas abaixo. Ainda não inclui exclusão definitiva, comparação visual de fotos semelhantes, busca recursiva, integração OAuth de Drive/Gmail/Notion/Spotify, automação de Instagram/Facebook, nem controle visual de outros aplicativos. O provedor de documentos precisa suportar movimentações. O seletor Android restringe determinadas pastas. Termux/Evolution/PostgreSQL/Redis precisam estar rodando para WhatsApp.

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


## Fotos duplicadas — segunda entrega

No chat normal ou flutuante, toque em **Fotos duplicadas**, ou peça **encontre fotos duplicadas**. O planejador só pode abrir a revisão, nunca escolher fotos ou acionar a lixeira por conta própria.

- Android 11 ou superior, MediaStore. Solicita READ_MEDIA_IMAGES (ou READ_EXTERNAL_STORAGE até API 32) e respeita o acesso parcial do Android 14+. ACCESS_MEDIA_LOCATION permite ler os bytes originais sem redigir metadados, evitando agrupar fotos que diferem apenas nos dados EXIF. Nenhum dado de localização é interpretado ou enviado.
- Compara SHA-256 de arquivos originais de mesmo tamanho. Até 500 imagens recentes acessíveis, 32 MiB por imagem, 300 MiB lidos por análise. Imagens maiores, ilegíveis ou fora do orçamento não são comparadas. A interface informa cobertura parcial e itens ignorados.
- Uma imagem por grupo fica protegida na seleção (menor ID do MediaStore, sem alegar que é o original da câmera). As demais começam desmarcadas. O usuário seleciona até 100 cópias.
- O nativo valida a seleção contra um resultado de análise de uso único e validade de dez minutos. Recalcula o hash das imagens escolhidas e da imagem preservada antes de solicitar a operação. Se conteúdo, tamanho ou data mudarem, exige nova análise.
- MediaStore.createTrashRequest abre a confirmação do sistema. Nenhuma chamada de exclusão definitiva, MANAGE_MEDIA ou acesso irrestrito ao armazenamento.
- Após a confirmação, consulta IS_TRASHED e separa resultados verificados de resultados desconhecidos. Cancelamento do diálogo não é relatado como sucesso. Mover para a lixeira não garante liberação imediata de espaço.
- Fotos, nomes e miniaturas permanecem no aparelho e não são incluídos na conversa enviada ao modelo. Dados da análise ficam somente em memória da sessão.

Testes adicionais: PhotoRulesTest valida seleção que preserva uma cópia, rejeição de IDs fora da análise/repetidos, limite de seleção, hash conhecido, conteúdos diferentes com mesmo tamanho, arquivo alterado, limite de leitura e cancelamento. Teste TypeScript rejeita ferramentas de exclusão/seleção emitidas pelo modelo.

Aceitação no aparelho ainda pendente: duplicar uma foto de teste; analisar com acesso parcial e completo; revisar os dois nomes/miniatura; cancelar o diálogo do Android e conferir que ambas permanecem; analisar novamente e confirmar apenas a cópia; verificar a lixeira e restaurar pela galeria. Testar permissão negada, app recriado, arquivo alterado após análise e uma imagem sem duplicata. Não usar fotos únicas para o primeiro teste.
