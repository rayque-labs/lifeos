# LifeOS Open Finance

Gateway pessoal, de leitura, para até cinco conexões Open Finance da Pluggy já autorizadas. Disponibiliza saldos e até 60 lançamentos recentes. A Toph exibe saldos com o comando **consultar saldos bancários**. Dados bancários ficam fora do histórico enviado ao modelo de chat. O comando de saldos exibe a resposta sem enviar os valores ao sintetizador de voz.

## Configuração

1. Em uma conta Pluggy com Open Finance regulado habilitado, conclua o consentimento no Pluggy Connect e anote o `itemId` de cada conexão. Use os fluxos de teste da Pluggy antes de conectar uma conta real.
2. Configure, somente no servidor, `PLUGGY_CLIENT_ID`, `PLUGGY_CLIENT_SECRET`, `PLUGGY_OPEN_FINANCE_ITEM_IDS` (lista de UUIDs separada por vírgula) e `LIFEOS_BANK_TOKEN` (token aleatório de leitura, que pode ser gerado com `openssl rand -hex 32`). O APK conhece apenas o token de leitura.
3. Dentro de `bank-server`, execute `pip install -r requirements.txt` e `uvicorn app:app --host 127.0.0.1 --port 8767`. Ponha o serviço atrás de um proxy HTTPS privado, acessível ao celular. Para testes web, adicione a origem completa da interface em `LIFEOS_BANK_ORIGINS`, separada por vírgulas. O APK usa `https://localhost`.
4. No LifeOS, abra **Configurações → Integrações → Open Finance · Somente leitura**. Informe URL e token. Salve e toque em **Consultar dados bancários**.

O único endpoint disponível é `GET /open-finance/snapshot`. O gateway aceita somente itens identificados como Open Finance pelo provedor. Contas e lançamentos são recuperados sob demanda, sem persistência no gateway. Para revogar, use o fluxo do provedor ou da instituição. Remover a configuração no APK apaga o acesso salvo naquele aparelho.
