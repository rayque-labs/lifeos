import test from 'node:test'
import assert from 'node:assert/strict'
import { validateDecision } from '../src/lib/execution-schema.ts'
import { parseFileAction } from '../src/lib/file-actions.ts'
const plan = action => JSON.stringify({ reply: 'Vou preparar uma prévia.', action })
test('rejects model tools that do not exist and malformed output', () => {
  for (const raw of ['done', '{}', 'null', plan({ kind: 'shell', command: 'rm -rf /' }), plan({kind:'files',operation:'delete',name:'foto.jpg'})]) assert.throws(()=>validateDecision(raw))
})
test('allows a conversational reply without executing', () => {
  assert.deepEqual(validateDecision('{"reply":"Como posso ajudar?","action":null}'),{reply:'Como posso ajudar?'})
})
test('rejects traversal, absolute paths, control characters and oversized names', () => {
  for(const name of ['../fotos','/sdcard/foto','a\\b','..','a\nb','a'.repeat(101)]) assert.throws(()=>validateDecision(plan({kind:'files',operation:'mkdir',name})))
})
test('preserves exact content and filename in a proposed new file', () => {
  const action={kind:'files',operation:'write',name:'oração.md',content:'# Notas\nGuardar café ☕'}
  assert.deepEqual(validateDecision(plan(action)).action,action)
})
test('rejects missing rename source and invented contact name', () => {
  assert.throws(()=>validateDecision(plan({kind:'files',operation:'rename',name:'novo.txt'})))
  assert.throws(()=>validateDecision(plan({kind:'whatsapp-send',phone:'mamãe',text:'oi'})))
})
test('requires complete message, accepts a formatted international prefix', () => {
  assert.throws(()=>validateDecision(plan({kind:'whatsapp-send',phone:'5511999999999',text:''})))
  assert.equal(validateDecision(plan({kind:'whatsapp-send',phone:'+5511999999999',text:'Teste'})).action.phone,'5511999999999')
})
test('strips untrusted extra fields rather than forwarding them to tools', () => {
  assert.deepEqual(validateDecision(plan({kind:'files',operation:'list',query:'pdf',url:'https://example.com',token:'bad',path:'/'})).action,{kind:'files',operation:'list',query:'pdf'})
})
test('local commands recognize normal Portuguese without a model',()=>{
  assert.equal(parseFileAction('organize meus documentos').operation,'organize')
  assert.equal(parseFileAction('crie uma pasta chamada IAC').name,'IAC')
  assert.equal(parseFileAction('procure o arquivo contrato').query,'contrato')
})
test('negations and restricted requests never trigger local organization',()=>{
  for(const text of ['não organize meus arquivos','organize apenas PDFs','exclua todas as fotos','como organizar arquivos?'])assert.equal(parseFileAction(text),null)
})
test('photo tool can only open review, never select or delete on model authority', () => {
  assert.deepEqual(validateDecision(plan({kind:'photos-review',ids:['1','2'],delete:true})).action,{kind:'photos-review'})
  for(const kind of ['photos-delete','photos-trash','photos-select'])assert.throws(()=>validateDecision(plan({kind,ids:['1']})))
})
