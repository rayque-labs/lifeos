import { initializeOfflineStorage, persistOfflineStorage } from '../lib/native-store'
import { useState, type ChangeEvent } from 'react'
import { Download, Upload } from 'lucide-react'
import { Button, Card } from './ui'

const PREFIX = 'lifeos:offline:v1:'
export function OfflineBackup() {
  const [message, setMessage] = useState('')
  const exportData = async () => {
    await initializeOfflineStorage()
    const records: Record<string, string> = {}
    for (let i=0; i<localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(PREFIX)) records[key] = localStorage.getItem(key) || ''
    }
    const blob = new Blob([JSON.stringify({ format:'lifeos-offline-v1', exported_at:new Date().toISOString(), records },null,2)],{type:'application/json'})
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href=url; a.download='lifeos-backup-'+new Date().toISOString().slice(0,10)+'.json'
    a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
    setMessage('Backup gerado. Guarde o arquivo em um local seguro.')
  }
  const importData = async (event: ChangeEvent<HTMLInputElement>) => {
    const file=event.target.files?.[0];if(!file)return
    try {
      await initializeOfflineStorage()
      if(file.size>5_000_000)throw new Error('Arquivo maior que 5 MB.')
      const parsed: unknown=JSON.parse(await file.text())
      if(!parsed||typeof parsed!=='object'||!('format' in parsed)||parsed.format!=='lifeos-offline-v1'||!('records' in parsed)||!parsed.records||typeof parsed.records!=='object')throw new Error('Formato de backup inválido.')
      const records=parsed.records as Record<string,unknown>
      if(!window.confirm('Importar substituirá os dados locais atuais. Deseja continuar?'))return
      for(const [key,value] of Object.entries(records)) {
        if(!key.startsWith(PREFIX)||typeof value!=='string')throw new Error('Backup contém dados inválidos.')
        JSON.parse(value)
      }
      const keys=Object.keys(localStorage).filter(key=>key.startsWith(PREFIX))
      for(const key of keys)localStorage.removeItem(key)
      for(const [key,value] of Object.entries(records))localStorage.setItem(key,value as string)
      await persistOfflineStorage()
      window.location.reload()
    }catch(error){setMessage(error instanceof Error?error.message:'Não foi possível importar o backup.')}
    finally{event.target.value=''}
  }
  return <Card><h2 className="font-semibold">Dados locais e backup</h2><p className="mt-2 text-sm opacity-75">Seus registros ficam neste aparelho. Exporte uma cópia antes de desinstalar o aplicativo ou limpar seus dados. O backup não é criptografado.</p>
    <div className="mt-4 flex flex-wrap items-center gap-3"><Button type="button" onClick={() => void exportData()}><Download size={16}/>Exportar backup</Button><label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2 text-sm"><Upload size={16}/>Importar backup<input className="sr-only" type="file" accept=".json,application/json" onChange={event=>void importData(event)}/></label></div>
    {message&&<p role="status" className="mt-3 text-sm">{message}</p>}
  </Card>
}
