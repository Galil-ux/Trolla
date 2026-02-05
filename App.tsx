
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  PlusIcon, 
  CalendarIcon, 
  UserGroupIcon, 
  Cog6ToothIcon, 
  ArrowDownTrayIcon, 
  ArrowUpTrayIcon, 
  ChevronLeftIcon, 
  ChevronRightIcon,
  EnvelopeIcon,
  SparklesIcon,
  TrashIcon,
  Bars3Icon,
  XMarkIcon,
  CheckIcon,
  SunIcon,
  MoonIcon,
  ExclamationTriangleIcon,
  WifiIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  isSameMonth, 
  isSameDay, 
  addDays, 
  parseISO,
  addMinutes,
  getDate,
  getMonth,
  getDay,
  isBefore,
  startOfDay
} from 'date-fns';
import { CalendarEvent, UserAccount, EventType, UserSettings, RecurrenceType } from './types';
import { EVENT_COLORS, STORAGE_KEY, DEFAULT_SETTINGS } from './constants';
import { smartParseEvent } from './services/geminiService';

const App: React.FC = () => {
  // --- State ---
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [accounts, setAccounts] = useState<UserAccount[]>([]);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSmartMode, setIsSmartMode] = useState(false);
  const [smartPrompt, setSmartPrompt] = useState('');
  const [isAIProcessing, setIsAIProcessing] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [newEmail, setNewEmail] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // --- Connectivity ---
  useEffect(() => {
    const handleStatus = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', handleStatus);
    window.addEventListener('offline', handleStatus);
    return () => {
      window.removeEventListener('online', handleStatus);
      window.removeEventListener('offline', handleStatus);
    };
  }, []);

  // --- Theme Application ---
  const isDark = settings.theme === 'dark';

  // --- Persistence ---
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        setEvents(data.events || []);
        setAccounts(data.accounts || []);
        setSettings(data.settings || DEFAULT_SETTINGS);
      } catch (e) {
        console.error("Error loading saved data", e);
      }
    } else {
      setAccounts([{
        id: 'default',
        name: 'My Calendar',
        email: 'primary@example.com',
        provider: 'personal',
        active: true
      }]);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ events, accounts, settings }));
  }, [events, accounts, settings]);

  // --- Recurrence Logic ---
  const getEventsForDay = useCallback((day: Date, allEvents: CalendarEvent[], activeAccountIds: string[]) => {
    return allEvents.filter(event => {
      if (!activeAccountIds.includes(event.accountId)) return false;

      const eventStart = parseISO(event.startTime);
      const dayStart = startOfDay(day);
      const eventDateStart = startOfDay(eventStart);

      // Don't show event before its start date
      if (isBefore(dayStart, eventDateStart)) return false;

      if (!event.recurrence || event.recurrence === RecurrenceType.NONE) {
        return isSameDay(eventStart, day);
      }

      switch (event.recurrence) {
        case RecurrenceType.DAILY:
          return true;
        case RecurrenceType.WEEKLY:
          return getDay(eventStart) === getDay(day);
        case RecurrenceType.MONTHLY:
          return getDate(eventStart) === getDate(day);
        case RecurrenceType.YEARLY:
          return getDate(eventStart) === getDate(day) && getMonth(eventStart) === getMonth(day);
        default:
          return false;
      }
    });
  }, []);

  // --- Handlers ---
  const handleAddAccount = () => {
    const trimmed = newEmail.trim();
    if (!trimmed || !trimmed.includes('@')) return;
    const newAcc: UserAccount = {
      id: Math.random().toString(36).substr(2, 9),
      name: trimmed.split('@')[0],
      email: trimmed,
      provider: 'personal',
      active: true
    };
    setAccounts(prev => [...prev, newAcc]);
    setNewEmail('');
  };

  const handleBackup = () => {
    const data = JSON.stringify({ events, accounts, settings }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chronos_backup_${format(new Date(), 'yyyy-MM-dd')}.json`;
    a.click();
  };

  const handleRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = JSON.parse(evt.target?.result as string);
        if (data.events && data.accounts) {
          setEvents(data.events);
          setAccounts(data.accounts);
          setSettings(data.settings || DEFAULT_SETTINGS);
          alert("Restore successful!");
        }
      } catch (err) {
        alert("Invalid backup file.");
      }
    };
    reader.readAsText(file);
  };

  const handleClearData = () => {
    if (confirm("Are you sure you want to clear all data? This cannot be undone.")) {
      setEvents([]);
      setAccounts([{
        id: 'default',
        name: 'My Calendar',
        email: 'primary@example.com',
        provider: 'personal',
        active: true
      }]);
      setSettings(DEFAULT_SETTINGS);
      localStorage.removeItem(STORAGE_KEY);
      setIsSettingsOpen(false);
    }
  };

  const handleSaveEvent = (eventData: Partial<CalendarEvent>) => {
    if (editingEvent?.id) {
      setEvents(prev => prev.map(e => e.id === editingEvent.id ? { ...e, ...eventData } as CalendarEvent : e));
    } else {
      const newEv: CalendarEvent = {
        id: Math.random().toString(36).substr(2, 9),
        title: eventData.title || 'New Event',
        description: eventData.description || '',
        startTime: eventData.startTime || new Date().toISOString(),
        endTime: eventData.endTime || addMinutes(new Date(eventData.startTime || new Date()), settings.defaultDuration).toISOString(),
        type: eventData.type || EventType.EVENT,
        accountId: eventData.accountId || accounts.find(a => a.active)?.id || 'default',
        color: eventData.color || EVENT_COLORS[0].value,
        recurrence: eventData.recurrence || RecurrenceType.NONE,
      };
      setEvents(prev => [...prev, newEv]);
    }
    setIsModalOpen(false);
    setEditingEvent(null);
  };

  const handleSmartAdd = async () => {
    if (!smartPrompt) return;
    setIsAIProcessing(true);
    const parsed = await smartParseEvent(smartPrompt);
    setIsAIProcessing(false);
    if (parsed) {
      handleSaveEvent({
        ...parsed,
        color: parsed.type === 'BIRTHDAY' ? '#f43f5e' : EVENT_COLORS[0].value
      });
      setSmartPrompt('');
      setIsSmartMode(false);
    } else {
      alert("AI couldn't parse that. Try something simpler like 'Lunch with John every Monday at 2pm'");
    }
  };

  // --- UI Components ---
  const renderHeader = () => {
    return (
      <header className={`flex items-center justify-between px-4 md:px-6 py-3 md:py-4 border-b sticky top-0 z-20 ${isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'}`}>
        <div className="flex items-center space-x-2 md:space-x-6">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className={`p-2 md:hidden rounded-lg transition-colors ${isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-600'}`}
          >
            <Bars3Icon className="w-6 h-6" />
          </button>
          
          <div className="flex items-center space-x-1 md:space-x-4">
            <div className="flex items-center space-x-1 mr-2">
              <button 
                onClick={() => setCurrentDate(subMonths(currentDate, 1))}
                className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'}`}
              >
                <ChevronLeftIcon className="w-5 h-5" />
              </button>
              <button 
                onClick={() => {
                  setCurrentDate(new Date());
                  setSelectedDate(new Date());
                }}
                className={`px-3 py-1 text-xs font-bold uppercase tracking-widest rounded-lg transition-all border ${isDark ? 'border-slate-800 hover:bg-slate-800' : 'border-slate-200 hover:bg-slate-50'}`}
              >
                Today
              </button>
              <button 
                onClick={() => setCurrentDate(addMonths(currentDate, 1))}
                className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'}`}
              >
                <ChevronRightIcon className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex flex-col md:flex-row md:items-baseline md:space-x-2">
              <h2 className="text-lg md:text-2xl font-bold tracking-tight leading-none min-w-[120px]">
                {format(currentDate, 'MMMM')}
              </h2>
              <span className={`text-sm md:text-lg font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                {format(currentDate, 'yyyy')}
              </span>
            </div>
          </div>

          {!isOnline && (
            <div className="hidden sm:flex items-center text-rose-500 text-[10px] font-bold uppercase tracking-widest bg-rose-500/10 px-2 py-1 rounded-full border border-rose-500/20">
              <WifiIcon className="w-3 h-3 mr-1" />
              Offline
            </div>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          {settings.enableAI && (
            <button 
              onClick={() => { setIsSmartMode(true); setIsModalOpen(true); }}
              className={`flex items-center justify-center w-9 h-9 md:w-auto md:px-4 md:py-2 rounded-xl transition-all font-medium border ${isDark ? 'bg-indigo-950/30 text-indigo-400 border-indigo-900 hover:bg-indigo-950/50' : 'bg-indigo-50 text-indigo-600 border-indigo-100 hover:bg-indigo-100'}`}
              title="AI Smart Add"
            >
              <SparklesIcon className="w-5 h-5 md:mr-2" />
              <span className="hidden md:inline">Smart Add</span>
            </button>
          )}
          <button 
            onClick={() => { 
              setIsSmartMode(false); 
              setEditingEvent(null);
              setIsModalOpen(true); 
            }}
            className="flex items-center justify-center w-9 h-9 md:w-auto md:px-4 md:py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all font-medium shadow-md shadow-indigo-200"
            title="New Event"
          >
            <PlusIcon className="w-5 h-5 md:mr-2" />
            <span className="hidden md:inline">New Event</span>
          </button>
        </div>
      </header>
    );
  };

  const renderCells = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: settings.startOfWeek as any });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: settings.startOfWeek as any });

    const rows = [];
    let days = [];
    let day = startDate;

    const activeAccountIds = accounts.filter(a => a.active).map(a => a.id);

    while (day <= endDate) {
      for (let i = 0; i < 7; i++) {
        const cloneDay = day;
        const formattedDate = format(day, 'd');
        const isSelected = isSameDay(day, selectedDate);
        const isCurrentMonth = isSameMonth(day, monthStart);
        const isToday = isSameDay(day, new Date());
        const isWeekend = day.getDay() === 0 || day.getDay() === 6;
        
        const dayEvents = getEventsForDay(cloneDay, events, activeAccountIds);

        const skipDay = !settings.showWeekends && isWeekend;

        if (!skipDay) {
            days.push(
              <div
                key={day.toString()}
                className={`min-h-[60px] md:min-h-[120px] p-0.5 md:p-2 border-r border-b relative group transition-all cursor-pointer flex flex-col ${
                  !isCurrentMonth ? (isDark ? 'bg-slate-900 opacity-20' : 'bg-slate-50/40 opacity-40') : (isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100')
                } ${isSelected ? (isDark ? 'bg-indigo-900/20 z-10 ring-2 ring-inset ring-indigo-500/40' : 'bg-indigo-50/50 z-10 ring-2 ring-inset ring-indigo-500/20') : (isDark ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50/30')}`}
                onClick={() => setSelectedDate(cloneDay)}
              >
                <div className="flex flex-col items-center md:items-start h-full">
                  <span className={`inline-flex items-center justify-center w-6 h-6 md:w-7 md:h-7 text-[10px] md:text-sm font-bold rounded-full transition-colors ${
                    isToday 
                      ? 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-100' 
                      : isSelected
                        ? (isDark ? 'bg-indigo-500/30 text-indigo-300' : 'bg-indigo-100 text-indigo-700')
                        : isCurrentMonth 
                          ? (isDark ? 'text-slate-300' : 'text-slate-700') 
                          : (isDark ? 'text-slate-600' : 'text-slate-300')
                  }`}>
                    {formattedDate}
                  </span>
                  
                  <div className="hidden md:block space-y-1 w-full mt-1 overflow-y-auto max-h-[85px] scrollbar-hide">
                    {dayEvents.map(event => (
                      <div key={event.id} onClick={(e) => { e.stopPropagation(); setEditingEvent(event); setIsModalOpen(true); }} style={{ borderLeftColor: event.color }} className={`px-2 py-0.5 text-[9px] border-l-[3px] rounded shadow-sm hover:shadow-md transition-shadow truncate flex items-center gap-1 ${isDark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-white border-slate-100 text-slate-700'}`}>
                        {event.recurrence && event.recurrence !== RecurrenceType.NONE && <ArrowPathIcon className="w-2.5 h-2.5 flex-shrink-0 text-indigo-400" />}
                        <span className="font-bold truncate">{event.title}</span>
                      </div>
                    ))}
                  </div>

                  <div className="md:hidden flex flex-wrap justify-center gap-0.5 mt-auto pb-1 w-full overflow-hidden px-1">
                    {dayEvents.slice(0, 3).map(event => (
                      <div key={event.id} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: event.color }} />
                    ))}
                    {dayEvents.length > 3 && (
                      <div className={`w-1 h-1 rounded-full ${isDark ? 'bg-slate-600' : 'bg-slate-300'}`} />
                    )}
                  </div>
                </div>
              </div>
            );
        }
        day = addDays(day, 1);
      }
      rows.push(<div className={`grid ${settings.showWeekends ? 'grid-cols-7' : 'grid-cols-5'}`} key={day.toString()}>{days}</div>);
      days = [];
    }
    return <div className={`flex-1 overflow-y-auto ${isDark ? 'bg-slate-950' : 'bg-slate-100/30'}`}>{rows}</div>;
  };

  const selectedDayEvents = useMemo(() => {
    const activeAccountIds = accounts.filter(a => a.active).map(a => a.id);
    return getEventsForDay(selectedDate, events, activeAccountIds)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [events, selectedDate, accounts, getEventsForDay]);

  return (
    <div className={`flex h-screen overflow-hidden relative font-sans ${isDark ? 'bg-slate-950 text-slate-100 dark' : 'bg-slate-50 text-slate-900'}`}>
      
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-30 md:hidden transition-opacity duration-300" onClick={() => setIsSidebarOpen(false)} />
      )}

      <aside className={`fixed inset-y-0 left-0 z-40 w-72 flex flex-col shadow-2xl transition-all duration-300 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 md:flex border-r ${isDark ? 'bg-slate-900 border-slate-800 text-slate-300' : 'bg-slate-900 text-slate-300 border-slate-800'}`}>
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-xl flex items-center justify-center shadow-lg">
              <CalendarIcon className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white tracking-tight">Chronos</span>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="md:hidden p-2 text-slate-500 hover:text-white">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-4 px-4 space-y-8 scrollbar-hide">
          <section>
            <div className="flex items-center justify-between mb-4 px-2">
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Accounts</h3>
              <UserGroupIcon className="w-4 h-4 text-slate-600" />
            </div>
            <div className="space-y-1.5 mb-4">
              {accounts.map(acc => (
                <div key={acc.id} className={`flex items-center px-3 py-2.5 rounded-xl cursor-pointer transition-all ${acc.active ? 'bg-slate-800 text-white shadow-lg' : 'hover:bg-slate-800/40'}`} onClick={() => setAccounts(prev => prev.map(a => a.id === acc.id ? { ...a, active: !a.active } : a))}>
                  <EnvelopeIcon className={`w-4 h-4 mr-3 ${acc.active ? 'text-indigo-400' : 'text-slate-600'}`} />
                  <div className="flex-1 truncate">
                    <p className="text-sm font-bold truncate">{acc.name}</p>
                    <p className="text-[10px] text-slate-500 truncate">{acc.email}</p>
                  </div>
                  <div className={`w-1.5 h-1.5 rounded-full ml-2 ${acc.active ? 'bg-indigo-500 animate-pulse' : 'bg-slate-700'}`} />
                </div>
              ))}
            </div>
            <div className="px-2">
              <div className="relative">
                <input type="email" placeholder="Connect email..." value={newEmail} onChange={(e) => setNewEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddAccount()} className="w-full bg-slate-800 border-none rounded-xl py-2.5 pl-3 pr-10 text-xs text-white focus:ring-2 focus:ring-indigo-500 placeholder-slate-600" />
                <button onClick={handleAddAccount} className="absolute right-2 top-1.5 p-1 bg-indigo-600 rounded-lg hover:bg-indigo-500 shadow-lg"><PlusIcon className="w-3.5 h-3.5 text-white" /></button>
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 px-2">Tools</h3>
            <div className="space-y-1.5">
              <button onClick={handleBackup} className="w-full flex items-center px-3 py-2.5 text-sm font-semibold rounded-xl hover:bg-slate-800 transition-all text-left">
                <ArrowUpTrayIcon className="w-4 h-4 mr-3 text-slate-600" /> Export Backup
              </button>
              <label className="w-full flex items-center px-3 py-2.5 text-sm font-semibold rounded-xl hover:bg-slate-800 transition-all cursor-pointer">
                <ArrowDownTrayIcon className="w-4 h-4 mr-3 text-slate-600" /> Import Data
                <input type="file" className="hidden" accept=".json" onChange={handleRestore} />
              </label>
            </div>
          </section>
        </div>

        <div className="p-4 border-t border-slate-800 bg-slate-900/50">
          <button onClick={() => setIsSettingsOpen(true)} className="w-full flex items-center px-4 py-3 text-sm font-bold text-slate-400 hover:text-white hover:bg-slate-800 rounded-2xl transition-all group">
            <Cog6ToothIcon className="w-5 h-5 mr-3 group-hover:rotate-45 transition-transform duration-500" /> App Settings
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        {renderHeader()}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          <div className={`flex-1 flex flex-col overflow-hidden border-b md:border-b-0 md:border-r ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
            <div className={`grid ${settings.showWeekends ? 'grid-cols-7' : 'grid-cols-5'} border-b ${isDark ? 'border-slate-800 bg-slate-900/40' : 'border-slate-100 bg-slate-50/50'}`}>
              {(settings.showWeekends ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']).map((day, idx) => (
                <div key={idx} className={`py-2 text-center text-[9px] md:text-[11px] font-black uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  {day}
                </div>
              ))}
            </div>
            {renderCells()}
          </div>

          <div className={`h-[400px] md:h-auto md:w-[360px] flex flex-col shadow-2xl z-10 ${isDark ? 'bg-slate-900 border-l border-slate-800' : 'bg-white border-l border-slate-100'}`}>
            <div className={`px-5 py-4 flex justify-between items-center border-b ${isDark ? 'bg-slate-950/30 border-slate-800' : 'bg-slate-50/50 border-slate-100'}`}>
              <div>
                <h4 className="text-sm font-black uppercase tracking-tight">{format(selectedDate, 'EEEE')}</h4>
                <p className={`text-[10px] font-bold uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>{format(selectedDate, 'MMMM d, yyyy')}</p>
              </div>
              <button onClick={() => { setEditingEvent({ id: '', title: '', description: '', startTime: selectedDate.toISOString(), endTime: addMinutes(selectedDate, settings.defaultDuration).toISOString(), type: EventType.EVENT, accountId: accounts.find(a => a.active)?.id || 'default', color: EVENT_COLORS[0].value, recurrence: RecurrenceType.NONE }); setIsModalOpen(true); }} className={`w-10 h-10 flex items-center justify-center rounded-2xl border shadow-sm transition-all hover:scale-105 active:scale-95 ${isDark ? 'bg-slate-800 text-indigo-400 border-slate-700 hover:bg-slate-700' : 'bg-white text-indigo-600 border-indigo-100 hover:bg-indigo-50'}`}>
                <PlusIcon className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4 scrollbar-hide">
              {selectedDayEvents.length === 0 ? (
                <div className="text-center py-12 px-6">
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                    <CalendarIcon className={`w-8 h-8 ${isDark ? 'text-slate-600' : 'text-slate-300'}`} />
                  </div>
                  <h5 className={`text-sm font-bold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Clear Schedule</h5>
                  <p className="text-xs text-slate-400 font-medium">No plans for this day yet.</p>
                </div>
              ) : (
                selectedDayEvents.map(event => (
                  <div key={event.id} onClick={() => { setEditingEvent(event); setIsModalOpen(true); }} className={`group relative flex items-stretch border rounded-2xl transition-all cursor-pointer hover:shadow-xl hover:-translate-y-0.5 overflow-hidden ${isDark ? 'bg-slate-800 border-slate-700 hover:border-indigo-500/50' : 'bg-white border-slate-100'}`}>
                    <div className="w-1.5" style={{ backgroundColor: event.color }} />
                    <div className="flex-1 p-4 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className={`text-sm font-black truncate ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{event.title}</p>
                        {event.recurrence && event.recurrence !== RecurrenceType.NONE && (
                          <div className={`px-1.5 py-0.5 rounded-md flex items-center gap-1 ${isDark ? 'bg-indigo-500/10' : 'bg-indigo-50'}`}>
                            <ArrowPathIcon className="w-3 h-3 text-indigo-500" />
                            <span className="text-[8px] font-black uppercase text-indigo-500">{event.recurrence}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center text-[10px] text-slate-500 font-bold uppercase tracking-wider space-x-2">
                        <span>{format(parseISO(event.startTime), 'h:mm a')}</span>
                        <span className="text-slate-300">•</span>
                        <span>{event.type}</span>
                      </div>
                    </div>
                    <div className="pr-3 flex flex-col justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={(e) => { e.stopPropagation(); setEvents(prev => prev.filter(ev => ev.id !== event.id)); }} className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all">
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>

      {isSettingsOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
           <div className={`w-full max-w-md rounded-3xl shadow-3xl overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200 ${isDark ? 'bg-slate-900 border border-slate-800' : 'bg-white border border-slate-100'}`}>
              <div className={`px-6 py-5 border-b flex justify-between items-center ${isDark ? 'bg-slate-950/40 border-slate-800' : 'bg-slate-50/50 border-slate-100'}`}>
                <h3 className={`text-lg font-black uppercase tracking-tight flex items-center ${isDark ? 'text-white' : 'text-slate-800'}`}>
                  <Cog6ToothIcon className="w-6 h-6 mr-3 text-indigo-600" /> Settings
                </h3>
                <button onClick={() => setIsSettingsOpen(false)} className={`p-2 rounded-xl transition-all ${isDark ? 'text-slate-500 hover:bg-slate-800 hover:text-white' : 'text-slate-400 hover:bg-slate-200 hover:text-slate-600'}`}>
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>
              <div className="p-6 space-y-8 overflow-y-auto max-h-[70vh] scrollbar-hide">
                <section className="space-y-4">
                   <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-b pb-2 border-slate-800/20">Preferences</h4>
                   <div className="flex items-center justify-between">
                      <div>
                        <h4 className={`text-sm font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>Appearance</h4>
                        <p className="text-[10px] text-slate-500 font-medium">Toggle Dark and Light mode</p>
                      </div>
                      <div className={`flex p-1 rounded-xl ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                        <button onClick={() => setSettings({...settings, theme: 'light'})} className={`p-1.5 rounded-lg transition-all ${!isDark ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}><SunIcon className="w-5 h-5" /></button>
                        <button onClick={() => setSettings({...settings, theme: 'dark'})} className={`p-1.5 rounded-lg transition-all ${isDark ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><MoonIcon className="w-5 h-5" /></button>
                      </div>
                   </div>
                   <div className="flex items-center justify-between">
                      <div>
                        <h4 className={`text-sm font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>Show Weekends</h4>
                        <p className="text-[10px] text-slate-500 font-medium">Show Saturday and Sunday</p>
                      </div>
                      <button onClick={() => setSettings({...settings, showWeekends: !settings.showWeekends})} className={`w-11 h-6 rounded-full transition-colors relative ${settings.showWeekends ? 'bg-indigo-600' : 'bg-slate-700'}`}>
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${settings.showWeekends ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                   </div>
                   <div className="flex items-center justify-between">
                      <div>
                        <h4 className={`text-sm font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>AI Assistant</h4>
                        <p className="text-[10px] text-slate-500 font-medium">Use Gemini for smart events</p>
                      </div>
                      <button onClick={() => setSettings({...settings, enableAI: !settings.enableAI})} className={`w-11 h-6 rounded-full transition-colors relative ${settings.enableAI ? 'bg-indigo-600' : 'bg-slate-700'}`}>
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${settings.enableAI ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                   </div>
                </section>
                <section className="space-y-4">
                   <h4 className="text-[10px] font-black text-rose-500 uppercase tracking-widest border-b pb-2 border-rose-500/20">Danger Zone</h4>
                   <button onClick={handleClearData} className="w-full flex items-center justify-center space-x-2 py-3 border-2 border-rose-500/20 text-rose-500 rounded-2xl hover:bg-rose-500 hover:text-white transition-all font-bold text-xs uppercase tracking-widest">
                      <ExclamationTriangleIcon className="w-4 h-4" />
                      <span>Factory Reset Calendar</span>
                   </button>
                </section>
              </div>
              <div className={`p-6 border-t flex flex-col gap-2 ${isDark ? 'bg-slate-950/40 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
                 <button onClick={() => setIsSettingsOpen(false)} className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-lg active:scale-95 ${isDark ? 'bg-white text-slate-900' : 'bg-slate-900 text-white shadow-slate-200'}`}>Save & Close</button>
              </div>
           </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className={`w-full h-full md:h-auto md:max-w-xl md:rounded-3xl shadow-2xl overflow-hidden flex flex-col ${isDark ? 'bg-slate-900 text-white' : 'bg-white'}`}>
            <div className={`px-6 py-5 border-b flex justify-between items-center flex-shrink-0 ${isDark ? 'bg-slate-950/40 border-slate-800' : 'bg-slate-50/50 border-slate-100'}`}>
              <h3 className="text-lg font-black uppercase tracking-tight flex items-center">
                {isSmartMode ? <SparklesIcon className="w-6 h-6 mr-3 text-indigo-600" /> : <PlusIcon className="w-6 h-6 mr-3 text-indigo-600" />}
                {isSmartMode ? 'Hybrid Smart AI' : (editingEvent?.id ? 'Modify Plan' : 'New Plan')}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className={`p-2 rounded-xl transition-all ${isDark ? 'text-slate-500 hover:bg-slate-800' : 'text-slate-400 hover:bg-slate-200'}`}>
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 md:max-h-[80vh] scrollbar-hide">
              {isSmartMode ? (
                <div className="space-y-5 animate-in slide-in-from-bottom-4 duration-300">
                  <div className={`p-4 border rounded-2xl transition-all ${isDark ? 'bg-indigo-950/20 border-indigo-900' : 'bg-indigo-50 border-indigo-100'} ${!isOnline ? 'border-amber-500/50 bg-amber-500/5' : ''}`}>
                    <div className="flex items-center justify-between mb-1">
                      <p className={`text-xs font-bold uppercase tracking-widest ${isDark ? 'text-indigo-400' : 'text-indigo-700'} ${!isOnline ? 'text-amber-500' : ''}`}>
                        {isOnline ? 'Cloud AI Ready' : 'Local Parser Active (Offline Mode)'}
                      </p>
                      {!isOnline && <WifiIcon className="w-4 h-4 text-amber-500" />}
                    </div>
                    <p className={`text-sm leading-relaxed font-medium ${isDark ? 'text-indigo-100' : 'text-indigo-900'} ${!isOnline ? 'text-amber-200/80' : ''}`}>
                      {isOnline ? 'Type naturally: "Gym every Monday at 8am"' : 'Local mode: Use simple recurring patterns like "Lunch daily at 1pm"'}
                    </p>
                  </div>
                  <div className="relative">
                    <textarea placeholder="Tell Chronos what's happening..." value={smartPrompt} onChange={(e) => setSmartPrompt(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && e.ctrlKey) handleSmartAdd(); }} className={`w-full h-40 p-4 border-2 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none text-base font-medium resize-none transition-all ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-100'}`} autoFocus />
                    {isAIProcessing && (
                      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-[2px] rounded-2xl flex items-center justify-center">
                         <div className="flex flex-col items-center">
                            <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-3" />
                            <p className="text-xs font-black text-white uppercase tracking-widest animate-pulse">
                              {isOnline ? 'Syncing with AI...' : 'Parsing Locally...'}
                            </p>
                         </div>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-3">
                    <button onClick={handleSmartAdd} disabled={isAIProcessing || !smartPrompt.trim()} className="w-full py-4 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 transition-all font-black uppercase tracking-widest text-xs disabled:opacity-40 shadow-xl shadow-indigo-100/20 active:scale-95">
                      {isOnline ? 'Smart Add with Gemini' : 'Quick Add (Local)'}
                    </button>
                    <button onClick={() => setIsSmartMode(false)} className={`w-full py-3 text-sm font-bold transition-all rounded-2xl ${isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-400 hover:text-slate-600'}`}>Manual Entry</button>
                  </div>
                </div>
              ) : (
                <EventForm isDark={isDark} initialData={editingEvent || undefined} accounts={accounts} defaultDuration={settings.defaultDuration} onSave={handleSaveEvent} onCancel={() => setIsModalOpen(false)} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const EventForm: React.FC<{isDark: boolean, initialData?: CalendarEvent, accounts: UserAccount[], defaultDuration: number, onSave: (d: any) => void, onCancel: () => void}> = ({ isDark, initialData, accounts, defaultDuration, onSave, onCancel }) => {
  const [formData, setFormData] = useState<Partial<CalendarEvent>>(
    initialData || { title: '', description: '', startTime: format(new Date(), "yyyy-MM-dd'T'HH:mm"), endTime: format(addMinutes(new Date(), defaultDuration), "yyyy-MM-dd'T'HH:mm"), type: EventType.EVENT, color: EVENT_COLORS[0].value, accountId: accounts.find(a => a.active)?.id || accounts[0]?.id || 'default', recurrence: RecurrenceType.NONE }
  );

  return (
    <div className="space-y-6">
      <div>
        <label className={`block text-[10px] font-black uppercase tracking-widest mb-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Title</label>
        <input type="text" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} className={`w-full px-5 py-4 border-2 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-bold text-lg ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-100'}`} placeholder="What's the plan?" autoFocus />
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label className={`block text-[10px] font-black uppercase tracking-widest mb-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Starts</label>
          <input type="datetime-local" value={formData.startTime?.substring(0, 16)} onChange={(e) => setFormData({ ...formData, startTime: new Date(e.target.value).toISOString() })} className={`w-full px-5 py-4 border-2 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none text-sm font-bold ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-100'}`} />
        </div>
        <div>
          <label className={`block text-[10px] font-black uppercase tracking-widest mb-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Ends</label>
          <input type="datetime-local" value={formData.endTime?.substring(0, 16)} onChange={(e) => setFormData({ ...formData, endTime: new Date(e.target.value).toISOString() })} className={`w-full px-5 py-4 border-2 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none text-sm font-bold ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-100'}`} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div>
          <label className={`block text-[10px] font-black uppercase tracking-widest mb-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Category</label>
          <select value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value as EventType })} className={`w-full px-5 py-4 border-2 rounded-2xl outline-none text-sm font-bold appearance-none ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-100'}`}>
            {Object.values(EventType).map(type => ( <option key={type} value={type}>{type}</option> ))}
          </select>
        </div>
        <div>
          <label className={`block text-[10px] font-black uppercase tracking-widest mb-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Repeat</label>
          <select value={formData.recurrence} onChange={(e) => setFormData({ ...formData, recurrence: e.target.value as RecurrenceType })} className={`w-full px-5 py-4 border-2 rounded-2xl outline-none text-sm font-bold appearance-none ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-100'}`}>
            {Object.values(RecurrenceType).map(rec => ( <option key={rec} value={rec}>{rec}</option> ))}
          </select>
        </div>
        <div>
          <label className={`block text-[10px] font-black uppercase tracking-widest mb-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Account</label>
          <select value={formData.accountId} onChange={(e) => setFormData({ ...formData, accountId: e.target.value })} className={`w-full px-5 py-4 border-2 rounded-2xl outline-none text-sm font-bold appearance-none ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-100'}`}>
            {accounts.map(acc => ( <option key={acc.id} value={acc.id}>{acc.name}</option> ))}
          </select>
        </div>
      </div>

      <div>
        <label className={`block text-[10px] font-black uppercase tracking-widest mb-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Theme Color</label>
        <div className="flex flex-wrap gap-4">
          {EVENT_COLORS.map(color => (
            <button key={color.value} type="button" onClick={() => setFormData({ ...formData, color: color.value })} className={`w-11 h-11 rounded-2xl transition-all relative ${formData.color === color.value ? 'ring-4 ring-offset-4 ring-indigo-500 scale-110 shadow-xl' : 'opacity-60 hover:opacity-100 hover:scale-105'}`} style={{ backgroundColor: color.value }}>
               {formData.color === color.value && <CheckIcon className="w-5 h-5 text-white absolute inset-0 m-auto" />}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row justify-end gap-3 pt-6 border-t border-slate-800/10">
        <button onClick={onCancel} className="w-full sm:w-auto px-8 py-4 text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-all">Cancel</button>
        <button onClick={() => onSave(formData)} className="w-full sm:w-auto px-12 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-indigo-100 active:scale-95">Save Event</button>
      </div>
    </div>
  );
};

export default App;
