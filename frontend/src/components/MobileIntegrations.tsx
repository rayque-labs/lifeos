import { useEffect, useState } from 'react'
import { bankSnapshot, loadConnection, openWhatsAppDraft, removeConnection, storeConnection, whatsAppChats, whatsAppPairingCode, whatsAppStatus, type Connection, type FinanceSnapshot } from '../lib/mobile-integrations'
import { isAndroid } from '../lib/native-assistant'
import { Button, Card, Field, Input } from './ui'

const empty = { url: '', token: '', instance: '' }
const money = (amount: number, currency: string) => {
  try { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(amount) }
  catch { return `${amount.toFixed(2)} ${currency}` }
}

function Integration({ account, kind }: { account: string; kind: 'whatsapp' | 'open-finance' }) {
  const isWhatsApp = kind === 'whatsapp'
  const [config, setConfig] = useState<Connection>(empty)
  const [phone, setPhone] = useState('')
  const [recipient, setRecipient] = useState('')
  const [draft, setDraft] = useState('')
  const [code, setCode] = useState('')
  const [chats, setChats] = useState<Awaited<ReturnType<typeof whatsAppChats>>>([])
  const [snapshot, setSnapshot] = useState<FinanceSnapshot | null>(null)
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let active = true
    loadConnection(kind, account).then(value => { if (active && value) setConfig(value) })
      .catch(() => { if (active) setNotice('Não foi possível ler a conexão salva.') })
      .finally(() => { if (active) setReady(true) })
    return () => { active = false }
  }, [account, kind])

  const run = async (action: () => Promise<void>) => {
    if (busy) return
    setBusy(true)
    setNotice('')
    try { await action() }
    catch (error) { setNotice(error instanceof Error ? error.message : 'A integração falhou.') }
    finally { setBusy(false) }
  }
  const disabled = busy || !ready

  return <details className="space-y-3">
    <summary className="cursor-pointer font-semibold">{isWhatsApp ? 'WhatsApp · Evolution API' : 'Open Finance · Somente leitura'}</summary>
    <p className="text-sm opacity-75">{isWhatsApp ? 'Use sua instância Baileys da Evolution API v2 para parear pelo número.' :
      'Consulte saldos e lançamentos das contas autorizadas no seu servidor LifeOS.'}</p>
    <Field label={isWhatsApp ? 'URL da Evolution API' : 'URL do servidor financeiro'}>
      <Input value={config.url} type="url" disabled={disabled} placeholder={isAndroid && kind === 'whatsapp' ? 'http://127.0.0.1:8080' : 'https://…'} onChange={e => { setCode(''); setChats([]); setSnapshot(null); setConfig({ ...config, url: e.target.value }) }} />
    </Field>
    <Field label={isWhatsApp ? 'Chave da Evolution' : 'Token de leitura'}>
      <Input type="password" autoComplete="off" value={config.token} disabled={disabled} onChange={e => { setCode(''); setChats([]); setSnapshot(null); setConfig({ ...config, token: e.target.value }) }} />
    </Field>
    {isWhatsApp && <>
      <Field label="Instância Evolution"><Input value={config.instance ?? ''} disabled={disabled} onChange={e => { setCode(''); setChats([]); setConfig({ ...config, instance: e.target.value }) }} /></Field>
      <Field label="Seu número para parear"><Input type="tel" value={phone} disabled={disabled} placeholder="+55 DDD número" onChange={e => { setCode(''); setPhone(e.target.value) }} /></Field>
      <div className="flex flex-wrap gap-2">
        <Button disabled={disabled || !phone.trim()} onClick={() => void run(async () => { setCode(''); setCode(await whatsAppPairingCode(config, phone)) })}>Gerar código</Button>
        <Button variant="secondary" disabled={disabled} onClick={() => void run(async () => { setNotice(await whatsAppStatus(config)) })}>Ver status</Button>
      </div>
      {code && <div className="space-y-1">
        <p className="select-all text-center font-mono text-2xl font-bold tracking-widest text-[#c5ff4a]" aria-live="polite">{code}</p>
        <p className="text-sm opacity-75">No WhatsApp, abra Aparelhos conectados → Conectar aparelho → Conectar com número de telefone e digite o código.</p>
      </div>}
      <Button variant="secondary" disabled={disabled} onClick={() => void run(async () => {
        setChats([])
        const result = await whatsAppChats(config)
        setChats(result)
        if (!result.length) setNotice('Nenhuma conversa sincronizada pela Evolution.')
      })}>Consultar conversas</Button>
      {chats.length > 0 && <ul aria-label="Conversas sincronizadas" className="space-y-2">
        {chats.map(chat => <li key={chat.id} className="rounded-lg border border-white/10 p-2 text-sm">
          {chat.number ? <button type="button" className="font-semibold underline" onClick={() => setRecipient(chat.number ?? '')}>{chat.name}</button> : <strong>{chat.name}</strong>}
          {chat.preview && <p className="break-words opacity-75">{chat.preview}</p>}
        </li>)}
      </ul>}
      <details className="space-y-2">
        <summary className="cursor-pointer text-sm font-semibold">Abrir rascunho no WhatsApp</summary>
        <Field label="Número do destinatário"><Input type="tel" value={recipient} onChange={e => setRecipient(e.target.value)} /></Field>
        <Field label="Texto do rascunho"><Input value={draft} onChange={e => setDraft(e.target.value)} /></Field>
        <Button variant="secondary" disabled={busy || !draft.trim() || !recipient.trim()} onClick={() => void run(() => openWhatsAppDraft(recipient, draft))}>Abrir conversa com rascunho</Button>
      </details>
    </>}
    {!isWhatsApp && <>
      <Button disabled={disabled} onClick={() => void run(async () => {
        setSnapshot(null)
        setSnapshot(await bankSnapshot(config))
      })}>Consultar dados bancários</Button>
      {snapshot && <div aria-live="polite" className="space-y-3">
        {snapshot.accounts.length === 0 && <p className="text-sm">Sem contas disponíveis.</p>}
        {snapshot.accounts.map(account => <p key={account.id} className="text-sm">{account.name} · {account.balance === null ? 'Saldo indisponível' : money(account.balance, account.currency)}</p>)}
        {snapshot.transactions.length > 0 && <p className="font-semibold">Lançamentos recentes</p>}
        {snapshot.transactions.map(row => <p key={row.id} className="text-sm">{row.date.slice(0, 10).split('-').reverse().join('/')} · {row.description} · {money(row.amount, row.currency)}</p>)}
      </div>}
    </>}
    <div className="flex flex-wrap gap-2">
      <Button variant="secondary" disabled={disabled} onClick={() => void run(async () => {
        setConfig(await storeConnection(kind, account, config))
        setNotice('Conexão salva neste aparelho.')
      })}>Salvar conexão</Button>
      <Button variant="secondary" disabled={disabled} onClick={() => void run(async () => {
        await removeConnection(kind, account)
        setCode(''); setPhone(''); setChats([]); setSnapshot(null); setConfig(empty)
        setNotice('Configuração removida deste aparelho.')
      })}>Remover configuração</Button>
    </div>
    {notice && <p role="status" className="text-sm">{notice}</p>}
  </details>
}

export function MobileIntegrations({ account }: { account: string }) {
  return <Card className="space-y-4">
    <h2 className="font-semibold">Integrações</h2>
    {isAndroid && <details className="space-y-3">
      <summary className="cursor-pointer font-semibold">Controle do Android</summary>
      <p className="text-sm opacity-75">Peça à Toph para abrir um aplicativo ou pesquisar no Chrome. Por exemplo, diga “Pesquisar energia solar no Chrome”.</p>
    </details>}
    <Integration key={`whatsapp:${account}`} kind="whatsapp" account={account} />
    <Integration key={`open-finance:${account}`} kind="open-finance" account={account} />
  </Card>
}
