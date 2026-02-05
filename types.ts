
export enum EventType {
  EVENT = 'EVENT',
  BIRTHDAY = 'BIRTHDAY',
  MEETING = 'MEETING',
  TASK = 'TASK'
}

export enum RecurrenceType {
  NONE = 'NONE',
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  YEARLY = 'YEARLY'
}

export interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  startTime: string; // ISO string
  endTime: string;   // ISO string
  type: EventType;
  accountId: string;
  color: string;
  recurrence?: RecurrenceType;
}

export interface UserAccount {
  id: string;
  email: string;
  provider: 'gmail' | 'outlook' | 'personal';
  name: string;
  active: boolean;
}

export interface UserSettings {
  defaultDuration: number; // in minutes
  startOfWeek: number; // 0 for Sunday, 1 for Monday
  showWeekends: boolean;
  theme: 'light' | 'dark' | 'system';
  enableAI: boolean;
}

export interface CalendarState {
  events: CalendarEvent[];
  accounts: UserAccount[];
  settings: UserSettings;
}
