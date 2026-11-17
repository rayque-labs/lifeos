import { useEffect, useRef, useState } from 'react'
import { nativePhotos, formatBytes, type PhotoScan } from '../lib/photo-cleanup'

export function PhotoCleanup({ onClose }: { onClose: () => void }) {
 const [scan, setScan] = useState<PhotoScan | null>(null)
 const [selected, setSelected] = useState<string[]>([])
 const [status, setStatus] = useState('')
 const [busy, setBusy] = useState<'scan' | 'trash' | null>(null)
 const [error, setError] = useState('')
 const [progress, setProgress] = useState('')
 const locked = useRef(false)
 const active = useRef(true)
 useEffect(() => {
  active.current = true
  const handle = nativePhotos.addListener('progress', p => { if (active.current) setProgress(`${p.hashed} arquivos comparados · ${p.examined} imagens consultadas`) })
  return () => { active.current = false; void handle.then(h => h.remove()).catch(() => {}); void nativePhotos.cancel().catch(() => {}); void nativePhotos.discard().catch(() => {}) }
 }, [])
 const analyze = async (reselect = false) => {
  if (locked.current) return
  locked.current = true; setBusy('scan'); setError(''); setScan(null); setSelected([]); setStatus(''); setProgress('Solicitando acesso e analisando…')
  try { const value = await nativePhotos.scan({ reselect }); if (active.current) { setScan(value); setStatus(value.groups.length ? 'Confira as cópias encontradas abaixo.' : 'Nenhuma duplicata exata encontrada entre as imagens analisadas.') } }
  catch (e) { if (active.current) setError(e instanceof Error ? e.message : 'Não consegui analisar as fotos.') }
  finally { locked.current = false; if (active.current) { setBusy(null); setProgress('') } }
 }
 const trash = async () => {
  if (!scan || !selected.length || locked.current) return
  locked.current = true; setBusy('trash'); setError(''); setStatus('Conferindo os arquivos novamente. Depois, confirme ou cancele na janela do Android.')
  try {
   const result = await nativePhotos.trash({ token: scan.token, ids: selected })
   if (!active.current) return
   setScan(null); setSelected([])
   setStatus(result.cancelled ? 'Você cancelou a confirmação do Android.' : `${result.verified} imagens verificadas na lixeira.${result.unknown ? ` Não consegui verificar ${result.unknown} imagens. Confira a galeria antes de repetir.` : ''} O espaço pode continuar ocupado enquanto os arquivos estiverem na lixeira.`)
  } catch (e) { if (active.current) { setError(e instanceof Error ? e.message : 'Não consegui concluir. Confira a galeria antes de repetir.'); setScan(null); setSelected([]) } }
  finally { locked.current = false; if (active.current) setBusy(null) }
 }
 const selectedBytes = scan?.groups.flatMap(g => g.items).filter(p => selected.includes(p.id)).reduce((n, p) => n + p.size, 0) ?? 0
 return <section aria-label="Limpeza de fotos" className="rounded-2xl border border-[#45454a] bg-[#151617] p-4 text-sm">
  <div className="flex items-center justify-between gap-3"><h2 className="font-semibold">Fotos duplicadas</h2><button type="button" disabled={!!busy} onClick={onClose} className="rounded-lg border border-[#45454a] px-3 py-1 disabled:opacity-40">Fechar</button></div>
  <p className="my-3 text-[#a3a5a9]">Comparação local dos arquivos originais. Suas fotos não são enviadas à IA. O Android pedirá acesso às fotos e aos metadados originais para distinguir arquivos que só diferem nesses dados.</p>
  <p className="mb-3 text-[#a3a5a9]">Analisa até 500 imagens recentes acessíveis e lê até 300 MB por análise. Imagens acima de 32 MB são ignoradas. Não avalia se uma foto é bonita ou importante.</p>
  <button type="button" disabled={!!busy} onClick={() => void analyze()} className="rounded-xl bg-[#C5FF4A] px-4 py-2 font-semibold text-[#101010] disabled:opacity-40">Autorizar e analisar fotos</button>
  {busy === 'scan' && <button type="button" onClick={() => { void nativePhotos.cancel(); setProgress('Cancelando a análise…') }} className="ml-2 rounded-xl border border-[#45454a] px-4 py-2">Cancelar</button>}
  {progress && <p role="status" className="mt-3">{progress}</p>}
  {status && <p role="status" className="mt-3 whitespace-pre-wrap">{status}</p>}
  {error && <p role="alert" className="mt-3 text-[#ff8990]">{error}</p>}
  {scan?.partial && <button type="button" disabled={!!busy} onClick={() => void analyze(true)} className="mt-3 rounded-xl border border-[#45454a] px-4 py-2">Alterar fotos permitidas</button>}
  {scan && <>
   <p className="my-3 text-[#a3a5a9]">{scan.examined} imagens consultadas · {scan.hashed} arquivos comparados · {scan.skipped} ignorados. Cópias detectadas ocupam {formatBytes(scan.duplicateBytes)}.</p>
   {(scan.partial || scan.limited || scan.skipped > 0) && <p className="mb-3 text-[#C5FF4A]">Análise parcial. {scan.partial ? 'O Android permitiu acesso somente a algumas fotos. ' : ''}{scan.limited ? 'O limite desta análise foi atingido. ' : ''}O resultado não representa a galeria inteira.</p>}
   <div className="max-h-80 space-y-3 overflow-y-auto">{scan.groups.map(group => <fieldset key={group.items[0].id} className="rounded-xl border border-[#45454a] p-3"><legend className="px-1">{group.items.length} arquivos iguais</legend>{group.thumbnail && <img src={group.thumbnail} alt="Prévia das imagens deste grupo" className="mb-2 h-24 w-24 rounded-lg object-contain"/>}{group.items.map(photo => <label key={photo.id} className="my-2 flex items-start gap-2"><input type="checkbox" disabled={photo.keep || !!busy || (!selected.includes(photo.id) && selected.length >= 100)} checked={selected.includes(photo.id)} onChange={e => setSelected(old => e.target.checked ? [...old, photo.id] : old.filter(id => id !== photo.id))} className="mt-1 accent-[#C5FF4A]"/><span className="min-w-0 break-words">{photo.name}<span className="block text-xs text-[#a3a5a9]">{photo.path} · {formatBytes(photo.size)}{photo.keep ? ' · Preservar esta imagem' : ''}</span></span></label>)}</fieldset>)}</div>
   {!!scan.groups.length && <div className="mt-3"><p className="mb-2">{selected.length} cópias selecionadas · {formatBytes(selectedBytes)}. Uma imagem de cada grupo será preservada.</p><button type="button" disabled={!!busy || !selected.length} onClick={() => void trash()} className="rounded-xl bg-[#C5FF4A] px-4 py-2 text-[#101010] disabled:opacity-40">Revisar no Android e enviar à lixeira</button><p className="mt-2 text-xs text-[#a3a5a9]">Não há exclusão definitiva nesta tela. Consulte a lixeira da sua galeria para restaurar imagens, conforme o prazo exibido pelo Android. Mover para a lixeira pode não liberar espaço imediatamente.</p></div>}
  </>}
 </section>
}
