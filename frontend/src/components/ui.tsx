import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react'
import { LoaderCircle } from 'lucide-react'

export function Button({ children, variant = 'primary', busy, className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; busy?: boolean
}) {
  const styles = {
    primary: 'bg-[#244535] text-white hover:bg-[#315b45] focus:ring-[#b6db74]',
    secondary: 'bg-[#e9eee6] text-[#244535] hover:bg-[#dfe8dc] focus:ring-[#b6db74]',
    ghost: 'bg-transparent text-[#52665a] hover:bg-[#eff2ed] focus:ring-[#b6db74]',
    danger: 'bg-[#fff0ed] text-[#a44233] hover:bg-[#ffe2dd] focus:ring-[#f7b0a4]',
  }
  return <button {...props} disabled={props.disabled || busy} className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-55 ${styles[variant]} ${className}`}>
    {busy && <LoaderCircle size={16} className="animate-spin" />}{children}
  </button>
}

const fieldClass = 'w-full rounded-xl border border-[#dfe5dc] bg-white px-3.5 py-2.5 text-sm text-[#20352a] outline-none transition placeholder:text-[#a1aca3] focus:border-[#799c78] focus:ring-2 focus:ring-[#dce8d5]'
export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${fieldClass} ${props.className || ''}`} />
}
export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${fieldClass} min-h-28 resize-y ${props.className || ''}`} />
}
export function Select({ children, ...props }: InputHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return <select {...props} className={`${fieldClass} ${props.className || ''}`}>{children}</select>
}
export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <label className="grid gap-1.5 text-sm font-medium text-[#506257]">{label}{children}{hint && <span className="text-xs font-normal text-[#8b9990]">{hint}</span>}</label>
}
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-[#e7ebe4] bg-white p-5 shadow-[0_3px_18px_rgba(33,55,44,0.035)] sm:p-6 ${className}`}>{children}</section>
}
export function PageHeading({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><h1 className="text-2xl font-semibold tracking-tight text-[#1e3028] sm:text-[28px]">{title}</h1>{description && <p className="mt-1.5 max-w-2xl text-sm text-[#77857b]">{description}</p>}</div>{action}</div>
}
export function ErrorMessage({ message }: { message: string }) {
  return <p role="alert" className="rounded-xl border border-[#f4d0ca] bg-[#fff5f2] px-3.5 py-2.5 text-sm text-[#9e493d]">{message}</p>
}
export function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="rounded-2xl border border-dashed border-[#d9e1d8] px-6 py-12 text-center"><p className="font-semibold text-[#42564a]">{title}</p><p className="mx-auto mt-1.5 max-w-md text-sm text-[#8b9990]">{description}</p></div>
}
export function LoadingState() {
  return <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-[#75847a]"><LoaderCircle className="animate-spin" size={18} /> Carregando dados…</div>
}
export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'green' | 'amber' | 'red' | 'blue' }) {
  const tones = { neutral: 'bg-[#f0f2ef] text-[#657269]', green: 'bg-[#e9f4df] text-[#4b703a]', amber: 'bg-[#fff2d7] text-[#8d6a21]', red: 'bg-[#ffebe7] text-[#a04c3e]', blue: 'bg-[#e7f1f3] text-[#4c737a]' }
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${tones[tone]}`}>{children}</span>
}
