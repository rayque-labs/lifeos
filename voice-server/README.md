# LifeOS Voice Lab — protótipo local

Este módulo é **experimental**. Usa o modelo XTTS-v2 (Coqui) para gerar uma nova frase em português a partir de uma amostra vocal **própria ou expressamente autorizada**. Não foi integrado ao APK. Não clona a voz da Miss Minutes nem concede licença sobre gravações de dubladores.

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
- **Não exponha esta API à internet**: não há autenticação nem controle de consumo. Execute apenas em localhost.
- A confirmação é declaratória, não uma verificação de identidade. Para uso público, implemente consentimento verificável, autenticação, limites de uso e proteção contra imitação indevida.
- O endpoint não armazena perfis; para cada frase, reenvie o áudio autorizado. Futuramente poderá haver perfis persistidos com consentimento e exclusão.
- Uma amostra com trilha sonora, múltiplos falantes ou ruído prejudica a qualidade. Use gravação original limpa.
- XTTS-v2 pode não produzir emoções com a expressividade desejada; a avaliação de qualidade ainda é necessária.
- **Nenhuma execução de modelo foi realizada neste commit.** É um ponto de partida verificável, não uma clonagem concluída.
