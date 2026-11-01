export type User = { id: number; email: string; full_name: string }
export type Task = {
  id: number; title: string; description: string | null; priority: 'low' | 'medium' | 'high';
  category: string | null; project_id: number | null; due_at: string | null;
  status: 'pending' | 'in_progress' | 'completed'; completed: boolean;
  recurrence_rule: 'none' | 'daily' | 'weekly' | 'monthly';
}
export type Project = {
  id: number; title: string; description: string | null; objective: string | null;
  deadline: string | null; status: string; priority: string; progress: number;
  total_tasks: number; completed_tasks: number;
}
export type Habit = {
  id: number; name: string; description: string | null; frequency: 'daily' | 'weekly';
  target_per_week: number; active: boolean; current_streak: number;
  consistency_percentage: number; log_count_30_days: number; checked_in_today?: boolean;
}
export type Note = {
  id: number; title: string; content: string; category: string | null;
  tags: string[]; pinned: boolean; created_at: string; updated_at: string;
}
export type CalendarEvent = {
  id: number; task_id: number | null; title: string; description: string | null;
  starts_at: string; ends_at: string; all_day: boolean;
}
export type Account = { id: number; name: string; currency: string; opening_balance: string; balance: string }
export type Category = { id: number; name: string; kind: 'income' | 'expense' }
export type Transaction = {
  id: number; account_id: number; category_id: number | null; kind: 'income' | 'expense';
  title: string; amount: string; occurred_on: string; description: string | null;
}
export type FinanceSummary = { month: string; currencies: Array<{
  currency: string; income: string; expenses: string; net: string;
  categories: Array<{ category: string; kind: 'income' | 'expense'; total: string }>
}> }
export type Dashboard = {
  generated_at: string;
  tasks: { total: number; pending: number; in_progress: number; completed: number; overdue: number; due_today: number };
  projects: { active: number; average_progress: number };
  habits_today: Habit[];
  upcoming_events: CalendarEvent[];
  finance: { accounts: Account[]; monthly: FinanceSummary };
}
