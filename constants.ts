
import { UserSettings } from './types';

export const EVENT_COLORS = [
  { name: 'Indigo', value: '#6366f1' },
  { name: 'Rose', value: '#f43f5e' },
  { name: 'Emerald', value: '#10b981' },
  { name: 'Amber', value: '#f59e0b' },
  { name: 'Sky', value: '#0ea5e9' },
  { name: 'Violet', value: '#8b5cf6' },
];

export const STORAGE_KEY = 'CHRONOS_CALENDAR_DATA_V2';

export const DEFAULT_SETTINGS: UserSettings = {
  defaultDuration: 60,
  startOfWeek: 0,
  showWeekends: true,
  theme: 'light',
  enableAI: true,
};
