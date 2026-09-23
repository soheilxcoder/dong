import type { Activity, Expense, Group, Membership, Reminder, Settlement, SplitType, User } from '@dong/core';

export interface RegisterInput {
  fullName: string; username: string; password: string;
  securityQuestion?: string; securityAnswer?: string; cardNumber?: string;
}
export interface ExpenseInput {
  title: string; totalAmount: number; paidBy: string; paidAt: string; splitType: SplitType;
  participants: { userId: string; amountOwed: number }[]; receiptImageUrl?: string | null; notes?: string | null;
}
export interface GroupDetail {
  group: Group; members: (Membership & { user: User })[]; expenses: Expense[]; settlements: Settlement[];
}

export class AppError extends Error {
  constructor(public code: string, message: string) { super(message); }
}

/** Every backend (local IndexedDB or remote API) implements this. */
export interface DataAdapter {
  readonly kind: 'local' | 'api';
  // auth
  register(input: RegisterInput): Promise<User>;
  login(username: string, password: string): Promise<User>;
  logout(): Promise<void>;
  me(): Promise<User | null>;
  getSecurityQuestion(username: string): Promise<string | null>;
  resetPassword(username: string, answer: string, newPassword: string): Promise<void>;
  updateMe(patch: Partial<Pick<User, 'fullName' | 'avatarUrl' | 'cardNumber' | 'cardHolderName'>>): Promise<User>;
  changePassword(oldPw: string, newPw: string): Promise<void>;
  // groups
  myGroups(): Promise<GroupDetail[]>;
  createGroup(name: string, description?: string, coverImageUrl?: string | null): Promise<Group>;
  updateGroup(id: string, patch: Partial<Pick<Group, 'name' | 'description' | 'coverImageUrl'>>): Promise<Group>;
  getGroup(id: string): Promise<GroupDetail>;
  groupByInvite(token: string): Promise<{ group: Group; memberCount: number } | null>;
  joinGroup(token: string): Promise<Group>;
  regenerateInvite(groupId: string): Promise<string>;
  removeMember(groupId: string, userId: string): Promise<void>;
  leaveGroup(groupId: string): Promise<void>;
  /** local-only: add a member that has no account (managed by payer) */
  addLocalMember?(groupId: string, fullName: string): Promise<User>;
  // expenses
  addExpense(groupId: string, input: ExpenseInput): Promise<Expense>;
  updateExpense(id: string, input: ExpenseInput): Promise<Expense>;
  deleteExpense(id: string): Promise<void>;
  // settlements
  submitSettlement(groupId: string, toUser: string, amount: number, receiptImageUrl?: string | null, note?: string | null, fromUser?: string): Promise<Settlement>;
  confirmSettlement(id: string): Promise<void>;
  rejectSettlement(id: string, reason: string): Promise<void>;
  cancelSettlement(id: string): Promise<void>;
  // activity / reminders
  activity(groupId: string): Promise<Activity[]>;
  sendReminder(groupId: string, targetUserId: string, amount: number): Promise<void>;
  reminders(groupId: string): Promise<Reminder[]>;
  // demo
  loadDemo?(): Promise<void>;
  /** subscribe to data changes */
  subscribe(cb: () => void): () => void;
}
