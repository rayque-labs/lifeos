# LifeOS Voice Lab — protótipo local

Este módulo é **experimental**. Usa o modelo XTTS-v2 (Coqui) para gerar uma nova frase em português a partir de uma amostra vocal **própria ou expressamente autorizada**. Não clona a voz da Miss Minutes nem concede licença sobre gravações de dubladores.

## Requisitos
- Computador Linux/Windows com Python 3.10 e memória suficiente; GPU compatível é recomendada. Não foi testado no Galaxy A10.
- Verifique **a licença do modelo XTTS-v2** antes de uso comercial ou distribuição. Código aberto não implica autorização comercial para os pesos do modelo.
- Instale uma versão de PyTorch compatível com o seu hardware, seguindo a documentação oficial, antes das demais dependências.

## Executar
```bash
cd voice-server
python3.10 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --host 127.0.0.1 --port 8766
```

Abra `http://127.0.0.1:8766/docs`. Em `POST /preview`, envie WAV de 3–30 segundos, fala limpa sem música, uma frase nova com até 350 caracteres e `permission_confirmed=true`. A resposta é WAV. O áudio temporário é apagado após a geração. A primeira execução pode baixar pesos grandes e demorar.

Teste com `curl`:
```bash
curl -f -X POST http://127.0.0.1:8766/preview \
  -F "audio=@minha_voz_autorizada.wav;type=audio/wav" \
  -F "text=Ei, você marcou um compromisso. Vamos nessa?" \
  -F "permission_confirmed=true" --output teste.wav
```

## Limitações e segurança
- Mantenha o servidor em localhost. Para acesso do APK use um proxy privado com TLS e configure o token de acesso. O motor processa uma solicitação de cada vez.
- A confirmação é declaratória, não uma verificação de identidade. Para uso público, implemente consentimento verificável, autenticação, limites de uso e proteção contra imitação indevida.
- O endpoint não armazena perfis; para cada frase, reenvie o áudio autorizado. Futuramente poderá haver perfis persistidos com consentimento e exclusão.
- Uma amostra com trilha sonora, múltiplos falantes ou ruído prejudica a qualidade. Use gravação original limpa.
- XTTS-v2 pode não produzir emoções com a expressividade desejada; a avaliação de qualidade ainda é necessária.
- A integração é testada com o motor simulado. Use `/preview` com uma gravação real autorizada para validar o modelo e a qualidade no seu hardware.

## Usar com a Toph

A geração roda no computador ou servidor onde você iniciou o Voice Lab. A chave de chat da Groq é configurada separadamente.

1. Rode o servidor e confirme que `GET /health` responde. Faça o teste com `/preview` acima para confirmar a primeira geração; `/health` sozinho não carrega o XTTS.
2. Para acessar a partir do celular, configure um proxy HTTPS com certificado válido na sua rede privada, encaminhando ao Voice Lab em `127.0.0.1:8766`. Defina `LIFEOS_VOICE_TOKEN` com um segredo aleatório antes de iniciar o servidor (por exemplo, gere com `openssl rand -hex 32`). Use o mesmo token no aplicativo. Restrinja o acesso ao seu dispositivo ou à VPN.
3. No APK, abra **Configurações → Voz do assistente → Voz clonada · LifeOS**. Informe a URL base do proxy, o token e uma gravação WAV autorizada. Salve e toque em **Ouvir teste**.
4. Para testar em um navegador no mesmo computador, use `http://127.0.0.1:8766`. Se a origem da interface tiver porta, inclua a origem completa em `LIFEOS_VOICE_ORIGINS`, por exemplo `https://localhost,http://localhost:4173`. O APK Capacitor usa `https://localhost`, já permitido por padrão.

A gravação fica criptografada no aparelho e é enviada ao seu servidor para cada geração. O servidor apaga os arquivos temporários. Alterar o servidor ou token no app exige salvar a configuração com a gravação.
