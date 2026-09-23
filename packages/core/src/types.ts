export type ID = string;

export type SplitType = 'equal' | 'custom' | 'by_payer';
export type SettlementStatus = 'pending_confirmation' | 'confirmed' | 'rejected';
export type Role = 'owner' | 'member';
export type ReminderFrequency = 'once' | 'every_1_day' | 'every_2_days' | 'every_3_days' | 'weekly';

export interface User {
  id: ID;
  fullName: string;
  username: string;
  avatarUrl?: string | null;
  cardNumber?: string | null; // 16 digits, no dashes
  cardHolderName?: string | null;
  createdAt: string;
}

export interface Group {
  id: ID;
  name: string;
  description?: string | null;
  coverImageUrl?: string | null;
  createdBy: ID;
  inviteToken: string;
  createdAt: string;
}

export interface Membership {
  id: ID;
  groupId: ID;
  userId: ID;
  role: Role;
  joinedAt: string;
}

export interface ExpenseParticipant {
  userId: ID;
  amountOwed: number; // integer toman
}

export interface Expense {
  id: ID;
  groupId: ID;
  title: string;
  totalAmount: number; // integer toman
  paidBy: ID;
  paidAt: string;
  splitType: SplitType;
  participants: ExpenseParticipant[];
  receiptImageUrl?: string | null;
  notes?: string | null;
  status: 'open' | 'archived';
  createdBy: ID;
  createdAt: string;
  updatedAt?: string;
}

export interface Settlement {
  id: ID;
  groupId: ID;
  fromUser: ID;
  toUser: ID;
  amount: number;
  receiptImageUrl?: string | null;
  status: SettlementStatus;
  note?: string | null;
  rejectReason?: string | null;
  submittedAt: string;
  confirmedAt?: string | null;
}

export interface Reminder {
  id: ID;
  groupId: ID;
  targetUserId: ID;
  createdBy: ID;
  frequency: ReminderFrequency;
  active: boolean;
  lastSentAt?: string | null;
}

export type ActivityType =
  | 'expense_created'
  | 'expense_updated'
  | 'expense_deleted'
  | 'settlement_submitted'
  | 'settlement_confirmed'
  | 'settlement_rejected'
  | 'member_joined'
  | 'member_left'
  | 'member_removed'
  | 'group_created'
  | 'reminder_sent';

export interface Activity {
  id: ID;
  groupId: ID;
  actorId: ID;
  type: ActivityType;
  description: string;
  meta?: Record<string, unknown>;
  createdAt: string;
}

export interface Balance {
  userId: ID;
  balance: number; // >0 creditor, <0 debtor
}

export interface Transfer {
  from: ID;
  to: ID;
  amount: number;
}
