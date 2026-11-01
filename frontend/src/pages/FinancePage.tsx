import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { ArrowDownRight, ArrowUpRight, Landmark, Plus, Tag, Trash2, TrendingUp, Wallet } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Badge, Button, Card, EmptyState, ErrorMessage, Field, Input, LoadingState, PageHeading, Select } from '../components/ui'
import { get, patch, post, remove } from '../lib/api'
import type { Account, Category, FinanceSummary, Transaction } from '../lib/types'

const chartColors = ['#83a96b', '#c99c59', '#7d9aab', '#ae8ebc', '#d17d67', '#7f9f91']
const today = () => new Date().toISOString().slice(0, 10)
const monthNow = () => new Date().toISOString().slice(0, 7)
const currencyText = (value: string, currency: string) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(Number(value))

type TxDraft = { accountId: string; categoryId: string; kind: 'income' | 'expense'; title: string; amount: string; date: string }
const blankTx = (): TxDraft => ({ accountId: '', categoryId: '', kind: 'expense', title: '', amount: '', date: today() })

export function FinancePage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [summary, setSummary] = useState<FinanceSummary | null>(null)
  const [month, setMonth] = useState(monthNow())
  const [selectedCurrency, setSelectedCurrency] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showAccount, setShowAccount] = useState(false)
  const [showCategory, setShowCategory] = useState(false)
  const [showTransaction, setShowTransaction] = useState(false)
  const [accountName, setAccountName] = useState('')
  const [accountCurrency, setAccountCurrency] = useState('BRL')
  const [openingBalance, setOpeningBalance] = useState('0.00')
  const [categoryName, setCategoryName] = useState('')
  const [categoryKind, setCategoryKind] = useState<'income' | 'expense'>('expense')
  const [draft, setDraft] = useState<TxDraft>(blankTx())
  const [editing, setEditing] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [nextAccounts, nextCategories, nextTransactions, nextSummary] = await Promise.all([
        get<Account[]>('/finance/accounts'), get<Category[]>('/finance/categories'),
        get<Transaction[]>('/finance/transactions?limit=50'), get<FinanceSummary>(`/finance/summary/monthly?month=${month}`),
      ])
      setAccounts(nextAccounts); setCategories(nextCategories); setTransactions(nextTransactions); setSummary(nextSummary)
      if (!selectedCurrency) setSelectedCurrency(nextSummary.currencies[0]?.currency || nextAccounts[0]?.currency || 'BRL')
      else if (!nextAccounts.some(account => account.currency === selectedCurrency) && !nextSummary.currencies.some(item => item.currency === selectedCurrency)) setSelectedCurrency(nextSummary.currencies[0]?.currency || nextAccounts[0]?.currency || 'BRL')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível carregar as finanças.') }
    finally { setLoading(false) }
  }, [month, selectedCurrency])
  useEffect(() => { void load() }, [load])

  const selectedSummary = summary?.currencies.find(item => item.currency === selectedCurrency)
  const expenses = selectedSummary?.categories.filter(item => item.kind === 'expense') || []
  const pieData = expenses.map(item => ({ name: item.category, value: Number(item.total) })).filter(item => item.value > 0)
  const categoryOptions = categories.filter(category => category.kind === draft.kind)
  const closeTransaction = () => { setShowTransaction(false); setEditing(null); setDraft(blankTx()) }
  const createAccount = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError('')
    try { await post('/finance/accounts', { name: accountName, currency: accountCurrency, opening_balance: openingBalance }); setAccountName(''); setShowAccount(false); await load() }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível criar a conta.') }
    finally { setBusy(false) }
  }
  const createCategory = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError('')
    try { await post('/finance/categories', { name: categoryName, kind: categoryKind }); setCategoryName(''); setShowCategory(false); await load() }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível criar a categoria.') }
    finally { setBusy(false) }
  }
  const submitTransaction = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError('')
    const payload = { account_id: Number(draft.accountId), category_id: draft.categoryId ? Number(draft.categoryId) : null, kind: draft.kind, title: draft.title, amount: draft.amount, occurred_on: draft.date }
    try { if (editing) await patch(`/finance/transactions/${editing}`, payload); else await post('/finance/transactions', payload); closeTransaction(); await load() }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível salvar a transação.') }
    finally { setBusy(false) }
  }
  const editTransaction = (transaction: Transaction) => {
    setEditing(transaction.id); setDraft({ accountId: String(transaction.account_id), categoryId: transaction.category_id ? String(transaction.category_id) : '', kind: transaction.kind, title: transaction.title, amount: transaction.amount, date: transaction.occurred_on }); setShowTransaction(true)
  }
  const deleteTransaction = async (transaction: Transaction) => {
    if (!window.confirm(`Excluir a transação “${transaction.title}”?`)) return
    try { await remove(`/finance/transactions/${transaction.id}`); await load() }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível excluir a transação.') }
  }
  const deleteCategory = async (category: Category) => {
    if (!window.confirm(`Excluir a categoria “${category.name}”? O histórico será mantido sem categoria.`)) return
    try { await remove(`/finance/categories/${category.id}`); await load() }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível excluir a categoria.') }
  }

  const table = useMemo(() => transactions.map(transaction => ({ ...transaction, account: accounts.find(account => account.id === transaction.account_id), category: categories.find(category => category.id === transaction.category_id) })), [transactions, accounts, categories])
  if (loading && !summary) return <LoadingState />
  return <>
    <PageHeading title="Finanças" description="Receitas, despesas e saldos sem misturar moedas." action={<div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={() => setShowCategory(value => !value)}><Tag size={15} />Categoria</Button><Button variant="secondary" onClick={() => setShowAccount(value => !value)}><Landmark size={15} />Conta</Button><Button onClick={() => { setDraft({ ...blankTx(), accountId: accounts[0] ? String(accounts[0].id) : '' }); setEditing(null); setShowTransaction(value => !value) }} disabled={!accounts.length}><Plus size={16} />Transação</Button></div>} />
    {error && <div className="mb-4"><ErrorMessage message={error} /></div>}
    {(showAccount || showCategory || showTransaction) && <Card className="mb-5 !border-[#dce7d8]">
      {showAccount && <form onSubmit={createAccount} className="grid gap-3 border-b border-[#eef1ec] pb-4 md:grid-cols-4"><Field label="Nome da conta"><Input required maxLength={120} value={accountName} onChange={event => setAccountName(event.target.value)} placeholder="Conta principal" /></Field><Field label="Moeda"><Select value={accountCurrency} onChange={event => setAccountCurrency(event.target.value)}>{['BRL', 'USD', 'EUR', 'GBP', 'CAD', 'JPY'].map(code => <option key={code}>{code}</option>)}</Select></Field><Field label="Saldo inicial"><Input type="number" step="0.01" value={openingBalance} onChange={event => setOpeningBalance(event.target.value)} /></Field><div className="flex items-end"><Button type="submit" busy={busy}>Salvar conta</Button></div></form>}
      {showCategory && <form onSubmit={createCategory} className="grid gap-3 border-b border-[#eef1ec] py-4 md:grid-cols-3"><Field label="Nome da categoria"><Input required maxLength={80} value={categoryName} onChange={event => setCategoryName(event.target.value)} placeholder="Alimentação" /></Field><Field label="Tipo"><Select value={categoryKind} onChange={event => setCategoryKind(event.target.value as 'income' | 'expense')}><option value="expense">Despesa</option><option value="income">Receita</option></Select></Field><div className="flex items-end"><Button type="submit" busy={busy}>Salvar categoria</Button></div></form>}
      {showTransaction && <form onSubmit={submitTransaction} className="grid gap-3 pt-4 md:grid-cols-3"><Field label="Descrição"><Input required maxLength={160} value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })} placeholder="Ex.: Mercado" /></Field><Field label="Tipo"><Select value={draft.kind} onChange={event => setDraft({ ...draft, kind: event.target.value as TxDraft['kind'], categoryId: '' })}><option value="expense">Despesa</option><option value="income">Receita</option></Select></Field><Field label="Valor"><Input type="number" inputMode="decimal" min="0.01" step="0.01" required value={draft.amount} onChange={event => setDraft({ ...draft, amount: event.target.value })} placeholder="0,00" /></Field><Field label="Conta"><Select required value={draft.accountId} onChange={event => setDraft({ ...draft, accountId: event.target.value })}><option value="">Escolha uma conta</option>{accounts.map(account => <option key={account.id} value={account.id}>{account.name} · {account.currency}</option>)}</Select></Field><Field label="Categoria"><Select value={draft.categoryId} onChange={event => setDraft({ ...draft, categoryId: event.target.value })}><option value="">Sem categoria</option>{categoryOptions.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</Select></Field><Field label="Data"><Input type="date" required value={draft.date} onChange={event => setDraft({ ...draft, date: event.target.value })} /></Field><div className="flex gap-2 md:col-span-3"><Button type="submit" busy={busy}>{editing ? 'Salvar alterações' : 'Salvar transação'}</Button><Button type="button" variant="secondary" onClick={closeTransaction}>Cancelar</Button></div></form>}
    </Card>}
    {loading ? <LoadingState /> : <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{accounts.map(account => <Card key={account.id} className="!p-4 sm:!p-5"><div className="flex items-start justify-between"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eaf0e7] text-[#648063]"><Wallet size={19} /></span><Badge>{account.currency}</Badge></div><p className="mt-4 text-sm font-medium text-[#7b897f]">{account.name}</p><p className="mt-1 text-2xl font-semibold text-[#30483a]">{currencyText(account.balance, account.currency)}</p><p className="mt-1 text-[11px] text-[#9aa49c]">Saldo atual calculado pelas transações</p></Card>)}<button onClick={() => setShowAccount(true)} className="flex min-h-36 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[#d6dfd5] bg-white/55 text-sm font-semibold text-[#718576] transition hover:border-[#9eb692] hover:bg-white"><Plus size={18} />Adicionar conta</button></div>
      <Card className="mt-5 !p-4 sm:!p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="font-semibold text-[#30483a]">Resumo do mês</h2><p className="mt-1 text-xs text-[#89968c]">Receitas e despesas agrupadas por moeda.</p></div><div className="flex gap-2"><Field label="Mês"><Input type="month" value={month} onChange={event => setMonth(event.target.value)} /></Field><Field label="Moeda"><Select value={selectedCurrency} onChange={event => setSelectedCurrency(event.target.value)}>{Array.from(new Set([...(summary?.currencies.map(item => item.currency) || []), ...accounts.map(account => account.currency)])).map(currency => <option key={currency}>{currency}</option>)}</Select></Field></div></div>
        {selectedSummary ? <><div className="mt-4 grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-[#f4f8f0] p-4"><p className="flex items-center gap-1.5 text-xs text-[#7c8d7a]"><ArrowUpRight size={14} />Receitas</p><p className="mt-1 text-xl font-semibold text-[#547b48]">{currencyText(selectedSummary.income, selectedCurrency)}</p></div><div className="rounded-xl bg-[#fff7f1] p-4"><p className="flex items-center gap-1.5 text-xs text-[#978476]"><ArrowDownRight size={14} />Despesas</p><p className="mt-1 text-xl font-semibold text-[#b36b4e]">{currencyText(selectedSummary.expenses, selectedCurrency)}</p></div><div className="rounded-xl bg-[#f3f5f2] p-4"><p className="flex items-center gap-1.5 text-xs text-[#829087]"><TrendingUp size={14} />Saldo do mês</p><p className={`mt-1 text-xl font-semibold ${Number(selectedSummary.net) >= 0 ? 'text-[#476c43]' : 'text-[#a95746]'}`}>{currencyText(selectedSummary.net, selectedCurrency)}</p></div></div>
          <div className="mt-5 grid gap-5 lg:grid-cols-2"><div><p className="mb-2 text-xs font-semibold text-[#758379]">Movimento por categoria</p>{selectedSummary.categories.length ? <div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={selectedSummary.categories.map(item => ({ ...item, value: Number(item.total) }))} margin={{ top: 8, right: 8, left: -20, bottom: 4 }}><CartesianGrid stroke="#edf0eb" vertical={false} /><XAxis dataKey="category" tick={{ fontSize: 10, fill: '#829087' }} /><YAxis tick={{ fontSize: 10, fill: '#829087' }} /><Tooltip formatter={(value) => currencyText(String(value), selectedCurrency)} /><Legend /><Bar dataKey="value" name="Total" fill="#83a96b" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer></div> : <EmptyState title="Sem transações neste mês" description="Quando você registrar uma receita ou despesa, o gráfico aparecerá aqui." />}</div><div><p className="mb-2 text-xs font-semibold text-[#758379]">Despesas por categoria</p>{pieData.length ? <div className="h-64"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={pieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={88} paddingAngle={3}>{pieData.map((entry, index) => <Cell key={entry.name} fill={chartColors[index % chartColors.length]} />)}</Pie><Tooltip formatter={value => currencyText(String(value), selectedCurrency)} /></PieChart></ResponsiveContainer></div> : <EmptyState title="Sem despesas categorizadas" description="Registre despesas com categoria para visualizar a distribuição." />}</div></div>
        </> : <div className="mt-4"><EmptyState title="Sem transações neste mês" description="Este resumo será preenchido quando você registrar movimentos." /></div>}
      </Card>
      <div className="mt-5 grid gap-5 xl:grid-cols-[.7fr_1.3fr]"><Card><div className="mb-3 flex items-center justify-between"><div><h2 className="font-semibold text-[#30483a]">Categorias</h2><p className="mt-1 text-xs text-[#89968c]">Receitas e despesas.</p></div><Button variant="ghost" onClick={() => setShowCategory(true)}><Plus size={15} />Nova</Button></div>{categories.length ? <div className="space-y-2">{categories.map(category => <div key={category.id} className="flex items-center gap-2 rounded-lg bg-[#f8f9f6] px-3 py-2"><span className="flex-1 text-sm text-[#506257]">{category.name}</span><Badge tone={category.kind === 'income' ? 'green' : 'amber'}>{category.kind === 'income' ? 'Receita' : 'Despesa'}</Badge><button aria-label={`Excluir ${category.name}`} onClick={() => void deleteCategory(category)} className="rounded-md p-1.5 text-[#a1aaa2] hover:bg-[#fff0ed] hover:text-[#a34d3f]"><Trash2 size={14} /></button></div>)}</div> : <EmptyState title="Sem categorias" description="Crie categorias para organizar seus movimentos." />}</Card>
        <Card><div className="mb-3 flex items-center justify-between"><div><h2 className="font-semibold text-[#30483a]">Transações recentes</h2><p className="mt-1 text-xs text-[#89968c]">Movimentos reais das suas contas.</p></div><Button variant="ghost" onClick={() => { setDraft({ ...blankTx(), accountId: accounts[0] ? String(accounts[0].id) : '' }); setEditing(null); setShowTransaction(true) }} disabled={!accounts.length}><Plus size={15} />Adicionar</Button></div>{table.length ? <div className="overflow-x-auto"><table className="w-full min-w-[570px] text-left text-sm"><thead><tr className="border-b border-[#edf0eb] text-[10px] uppercase tracking-wide text-[#9aa49c]"><th className="pb-2 font-semibold">Movimento</th><th className="pb-2 font-semibold">Categoria</th><th className="pb-2 font-semibold">Data</th><th className="pb-2 text-right font-semibold">Valor</th><th /></tr></thead><tbody>{table.map(transaction => <tr key={transaction.id} className="border-b border-[#f1f3ef] last:border-0"><td className="py-3"><p className="font-medium text-[#465b4c]">{transaction.title}</p><p className="text-[10px] text-[#9aa49c]">{transaction.account?.name || 'Conta'}</p></td><td className="py-3 text-xs text-[#819087]">{transaction.category?.name || 'Sem categoria'}</td><td className="py-3 text-xs text-[#819087]">{new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(new Date(`${transaction.occurred_on}T12:00:00`))}</td><td className={`py-3 text-right font-semibold ${transaction.kind === 'income' ? 'text-[#5a8050]' : 'text-[#b26a50]'}`}>{transaction.kind === 'income' ? '+' : '−'}{currencyText(transaction.amount, transaction.account?.currency || 'BRL')}</td><td className="py-3 text-right"><button onClick={() => editTransaction(transaction)} aria-label={`Editar ${transaction.title}`} className="rounded-md p-1.5 text-[#96a198] hover:bg-[#edf2eb]">Editar</button><button onClick={() => void deleteTransaction(transaction)} aria-label={`Excluir ${transaction.title}`} className="rounded-md p-1.5 text-[#a4aaa5] hover:bg-[#fff0ed] hover:text-[#a34d3f]"><Trash2 size={14} /></button></td></tr>)}</tbody></table></div> : <EmptyState title="Nenhuma transação" description="Registre uma receita ou despesa para iniciar seu histórico." />}</Card></div>
    </>}
  </>
}
