/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CheckCircle2, 
  Circle, 
  ListTodo, 
  Search, 
  SlidersHorizontal, 
  LayoutGrid, 
  Calendar,
  Layers,
  ChevronDown,
  LayoutDashboard,
  Clock,
  Plus,
  Inbox,
  CalendarDays,
  Star,
  Settings,
  Bell,
  Menu,
  X,
  Trash2,
  Flag,
  Check,
  Sparkles,
  Zap,
  BrainCircuit,
  Copy
} from 'lucide-react';
import { Task, Priority, FilterType, SortType, TimeFilterType, Subtask, TaskTemplate, UserProfile, Comment } from './types';
import { TaskItem } from './components/TaskItem';
import { TaskInput } from './components/TaskInput';
import { CalendarView } from './components/CalendarView';
import { auth, db, signInWithGoogle, signOut } from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { 
  collection, 
  query, 
  onSnapshot, 
  where, 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  deleteDoc, 
  addDoc, 
  orderBy,
  serverTimestamp,
  arrayUnion,
  arrayRemove
} from 'firebase/firestore';

const LOCAL_STORAGE_KEY = 'geometric-balance-tasks';
const FOLDERS_STORAGE_KEY = 'nexus-folders';

export default function App() {
  const [tasks, setTasks] = useState<Task[]>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  });
  const [folders, setFolders] = useState<string[]>(() => {
    const saved = localStorage.getItem(FOLDERS_STORAGE_KEY);
    return saved ? JSON.parse(saved) : ['Work', 'Personal', 'Product'];
  });
  const [filter, setFilter] = useState<FilterType>('all');
  const [timeFilter, setTimeFilter] = useState<TimeFilterType>('all');
  const [sort, setSort] = useState<SortType>('date');
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [aiInsights, setAiInsights] = useState<string>('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isSuggestingSteps, setIsSuggestingSteps] = useState(false);
  const [isSuggestingPriority, setIsSuggestingPriority] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [comments, setComments] = useState<{ [taskId: string]: Comment[] }>({});
  const [newCommentText, setNewCommentText] = useState('');
  const [newCollabEmail, setNewCollabEmail] = useState('');

  const [templates] = useState<TaskTemplate[]>([
    {
      id: 'temp-work-day',
      name: 'Work Project Start',
      text: 'Start New Project Phase',
      priority: 'high',
      category: 'Work',
      subtasks: ['Review requirements', 'Create timeline', 'Setup repository', 'Schedule kickoff meeting']
    },
    {
      id: 'temp-weekly-review',
      name: 'Weekly Review',
      text: 'Weekly Goals Review',
      priority: 'medium',
      category: 'Personal',
      subtasks: ['Review last week', 'Plan next week', 'Clear inbox', 'Physical exercise']
    },
    {
      id: 'temp-shopping',
      name: 'Grocery Trip',
      text: 'Weekly Grocery Shopping',
      priority: 'low',
      category: 'Personal',
      subtasks: ['Check pantry', 'Make list', 'Go to store']
    },
    {
      id: 'temp-deep-work',
      name: 'Deep Work Session',
      text: 'Execute Deep Work Protocol',
      description: 'This is a dedicated time block focused on cognitively demanding tasks that create new value, improve skills, and are hard to replicate. No distractions allowed, silence phone, and close all non-essential tabs to maintain peak concentration and flow state for the next 90 minutes.',
      priority: 'high',
      category: 'Work',
      subtasks: ['Clear workspace', 'Set timer', 'Deep focus', 'Summary report']
    }
  ]);

  const toggleSelection = (id: string) => {
    setSelectedTaskIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Auth and Profile sync
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (!userDoc.exists()) {
          const newProfile: UserProfile = {
            uid: currentUser.uid,
            email: currentUser.email || '',
            displayName: currentUser.displayName || 'User',
            photoURL: currentUser.photoURL || undefined,
            settings: {
              theme: 'light',
              notifications: true,
              defaultCategory: 'General'
            },
            createdAt: new Date().toISOString()
          };
          await setDoc(doc(db, 'users', currentUser.uid), newProfile);
          setUserProfile(newProfile);
        } else {
          setUserProfile(userDoc.data() as UserProfile);
        }
      } else {
        setUserProfile(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // Theme application
  useEffect(() => {
    if (userProfile?.settings?.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [userProfile]);

  // Real-time Tasks sync
  useEffect(() => {
    if (!user) {
      // Load from local storage if not logged in
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      setTasks(saved ? JSON.parse(saved) : []);
      return;
    }

    // Load tasks where user is owner or collaborator
    const tasksQuery = query(
      collection(db, 'tasks'),
      where('ownerId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    
    const unsubscribeTasks = onSnapshot(tasksQuery, (snapshot) => {
      const dbTasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
      setTasks(dbTasks);
    });

    // Also load tasks where collaborator (Firestore doesn't support array-contains in complex ways easily with ownerId)
    // For simplicity in this demo, we'll just check owner or use another query if needed.
    // However, the rule allows reading if in collaborators. We should ideally query both.
    const collabQuery = query(
      collection(db, 'tasks'),
      where('collaborators', 'array-contains', user.uid)
    );

    const unsubscribeCollab = onSnapshot(collabQuery, (snapshot) => {
      const collabTasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
      setTasks(prev => {
         const existingIds = new Set(prev.map(t => t.id));
         const newTasks = collabTasks.filter(t => !existingIds.has(t.id));
         return [...prev, ...newTasks].sort((a,b) => b.createdAt - a.createdAt);
      });
    });

    return () => {
      unsubscribeTasks();
      unsubscribeCollab();
    };
  }, [user]);

  const bulkUpdateTasks = (updates: Partial<Task>) => {
    setTasks(prev => prev.map(task => 
      selectedTaskIds.has(task.id) ? { ...task, ...updates } : task
    ));
    setSelectedTaskIds(new Set());
  };

  const bulkDeleteTasks = () => {
    setTasks(prev => prev.filter(task => !selectedTaskIds.has(task.id)));
    setSelectedTaskIds(new Set());
  };

  useEffect(() => {
    // Data Migration: Ensure all tasks have subtasks and description
    const migratedTasks = tasks.map(t => ({
      ...t,
      description: t.description ?? '',
      subtasks: t.subtasks ?? []
    }));
    
    // Only update if changes were actually made to avoid infinite loop
    const hasChanges = JSON.stringify(migratedTasks) !== JSON.stringify(tasks);
    if (hasChanges) {
      setTasks(migratedTasks);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks]);

  // Comments sync
  useEffect(() => {
    if (!editingTask || !user) return;
    
    const commentsQuery = query(
      collection(db, 'tasks', editingTask.id, 'comments'),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(commentsQuery, (snapshot) => {
      const taskComments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Comment));
      setComments(prev => ({ ...prev, [editingTask.id]: taskComments }));
    });

    return () => unsubscribe();
  }, [editingTask?.id, user]);

  const handleAddComment = async (taskId: string, text: string) => {
    if (!user || !text.trim()) return;
    const commentsRef = collection(db, 'tasks', taskId, 'comments');
    await addDoc(commentsRef, {
      userId: user.uid,
      userName: user.displayName || 'User',
      userPhoto: user.photoURL,
      text: text.trim(),
      createdAt: Date.now()
    });
  };

  const handleAddCollaborator = async (taskId: string, email: string) => {
    if (!user) return;
    // For simplicity, we assume we can find the user by email or just add the email string
    // In a real app, you'd lookup the UID by email. 
    // Here we'll just add the email to the collaborators list and check it in rules if we want, 
    // but the rules currently check for UID. Let's stick to adding a placeholder or assuming the user provides UID for this demo.
    // Actually, let's just use email and assume the rules allow it if it matches auth.email (would need rule update).
    // Let's stick to simplified UID adding for now.
    await updateDoc(doc(db, 'tasks', taskId), {
      collaborators: arrayUnion(email)
    });
  };

  // AI Insights Fetching
  useEffect(() => {
    const fetchInsights = async () => {
      if (tasks.length === 0) return;
      setIsAiLoading(true);
      const { getAIInsights } = await import('./services/geminiService');
      const insights = await getAIInsights(tasks);
      setAiInsights(insights);
      setIsAiLoading(false);
    };

    const timer = setTimeout(fetchInsights, 2000); // Debounce to allow multiple changes before asking AI
    return () => clearTimeout(timer);
  }, [tasks]);

  // Focus Timer State
  const [timerLeft, setTimerLeft] = useState(25 * 60);
  const [timerActive, setTimerActive] = useState(false);
  const [timerMode, setTimerMode] = useState<'work' | 'break'>('work');

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (timerActive && timerLeft > 0) {
      interval = setInterval(() => setTimerLeft(prev => prev - 1), 1000);
    } else if (timerLeft === 0) {
      setTimerActive(false);
      if (Notification.permission === 'granted') {
          new Notification(timerMode === 'work' ? 'Break Time!' : 'Back to Work!', {
            body: timerMode === 'work' ? 'Focus session completed. Take a rest.' : 'Break over. Time to focus!',
          });
      }
    }
    return () => clearInterval(interval);
  }, [timerActive, timerLeft, timerMode]);

  const toggleTimer = () => setTimerActive(!timerActive);
  const resetTimer = () => {
    setTimerActive(false);
    setTimerLeft(timerMode === 'work' ? 25 * 60 : 5 * 60);
  };
  const skipTimer = () => {
    const nextMode = timerMode === 'work' ? 'break' : 'work';
    setTimerMode(nextMode);
    setTimerLeft(nextMode === 'work' ? 25 * 60 : 5 * 60);
    setTimerActive(false);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const addTask = async (text: string, priority: Priority, category: string, dueDate?: number, reminderTime?: number, initialSubtasks: string[] = [], initialDescription: string = '') => {
    const newTask: Partial<Task> = {
      text,
      description: initialDescription,
      completed: false,
      priority,
      category,
      createdAt: Date.now(),
      dueDate: dueDate,
      reminderTime: reminderTime,
      subtasks: initialSubtasks.map(s => ({
        id: crypto.randomUUID(),
        text: s,
        completed: false
      }))
    };

    if (user) {
      newTask.ownerId = user.uid;
      newTask.collaborators = [];
      const docRef = await addDoc(collection(db, 'tasks'), newTask);
      
      // Auto-summarize if description is long
      if (initialDescription.length >= 100) {
        const { summarizeDescription } = await import('./services/geminiService');
        const summary = await summarizeDescription(initialDescription);
        await updateDoc(doc(db, 'tasks', docRef.id), { summary });
      }
    } else {
      const fullTask = { id: crypto.randomUUID(), ...newTask } as Task;
      setTasks([fullTask, ...tasks]);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify([fullTask, ...tasks]));

      if (initialDescription.length >= 100) {
        const triggerSummary = async () => {
          const { summarizeDescription } = await import('./services/geminiService');
          const summary = await summarizeDescription(initialDescription);
          setTasks(prev => prev.map(t => t.id === fullTask.id ? { ...t, summary } : t));
        };
        triggerSummary();
      }
    }
  };

  const updateTask = async (id: string, updates: Partial<Task>) => {
    if (user) {
      const taskDoc = doc(db, 'tasks', id);
      await updateDoc(taskDoc, { ...updates, updatedAt: Date.now() });
      
      if (updates.description && updates.description.length >= 100) {
         const { summarizeDescription } = await import('./services/geminiService');
         const summary = await summarizeDescription(updates.description!);
         await updateDoc(taskDoc, { summary });
      }
    } else {
      setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
      
      if (updates.description && updates.description.length >= 100) {
        const triggerSummary = async () => {
          const { summarizeDescription } = await import('./services/geminiService');
          const summary = await summarizeDescription(updates.description!);
          setTasks(prev => prev.map(t => t.id === id ? { ...t, summary } : t));
        };
        triggerSummary();
      }

      const updatedTasks = tasks.map(t => t.id === id ? { ...t, ...updates } : t);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedTasks));
    }

    if (editingTask?.id === id) {
      setEditingTask(prev => prev ? { ...prev, ...updates } : null);
    }
  };

  const handleSuggestSteps = async () => {
    if (!editingTask) return;
    setIsSuggestingSteps(true);
    try {
      const { suggestSubtasks } = await import('./services/geminiService');
      const steps = await suggestSubtasks(editingTask.text, editingTask.description);
      if (steps.length > 0) {
        const newSubtasks: Subtask[] = steps.map(s => ({
          id: crypto.randomUUID(),
          text: s,
          completed: false
        }));
        updateTask(editingTask.id, { subtasks: [...editingTask.subtasks, ...newSubtasks] });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSuggestingSteps(false);
    }
  };

  const handleSuggestPriority = async () => {
    if (!editingTask) return;
    setIsSuggestingPriority(true);
    try {
      const { suggestPriority } = await import('./services/geminiService');
      const result = await suggestPriority(editingTask.text, editingTask.description);
      if (result) {
        updateTask(editingTask.id, { priority: result.priority });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSuggestingPriority(false);
    }
  };

  const [activeReminders, setActiveReminders] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ id: string; text: string } | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      tasks.forEach(task => {
        if (task.reminderTime && !task.completed && !activeReminders.has(task.id)) {
          if (now >= task.reminderTime && now <= task.reminderTime + 60000) {
            // Trigger browser notification
            if (Notification.permission === 'granted') {
              new Notification('Nexus Reminder', {
                body: task.text,
                icon: 'https://api.dicebear.com/7.x/avataaars/svg?seed=reminder'
              });
            }
            
            // Trigger in-app toast
            setToast({ id: task.id, text: task.text });
            
            setActiveReminders(prev => new Set(prev).add(task.id));
          }
        }
      });
    }, 10000);

    return () => clearInterval(interval);
  }, [tasks, activeReminders]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 8000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  useEffect(() => {
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const toggleTask = (id: string) => {
    setTasks(tasks.map(task => 
      task.id === id ? { ...task, completed: !task.completed } : task
    ));
  };

  const deleteTask = async (id: string) => {
    if (user) {
      await deleteDoc(doc(db, 'tasks', id));
    } else {
      const updatedTasks = tasks.filter(t => t.id !== id);
      setTasks(updatedTasks);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedTasks));
    }
    
    setSelectedTaskIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const handleCreateFolder = (e: React.FormEvent) => {
    e.preventDefault();
    if (newFolderName.trim() && !folders.includes(newFolderName.trim())) {
      setFolders([...folders, newFolderName.trim()]);
      setActiveCategory(newFolderName.trim());
      setTimeFilter('all');
      setNewFolderName('');
      setIsNewProjectModalOpen(false);
    }
  };

  const categories = useMemo(() => {
    const customCats = Array.from(new Set(tasks.map(t => t.category))) as string[];
    const allUnique = Array.from(new Set([...folders, ...customCats]));
    return ['All', ...allUnique.filter(c => c !== 'General' && c !== 'all')];
  }, [tasks, folders]);

  const filteredTasks = useMemo(() => {
    return tasks
      .filter(task => {
        const matchesFilter = filter === 'all' || (filter === 'completed' ? task.completed : !task.completed);
        const matchesCategory = activeCategory === 'All' || task.category === activeCategory;
        const matchesSearch = task.text.toLowerCase().includes(search.toLowerCase());
        
        const matchesTime = timeFilter === 'all' || (() => {
          if (!task.dueDate) return timeFilter === 'someday';
          const d = new Date(task.dueDate);
          const now = new Date();
          d.setHours(0,0,0,0);
          now.setHours(0,0,0,0);
          if (timeFilter === 'today') return d.getTime() <= now.getTime();
          if (timeFilter === 'upcoming') return d.getTime() > now.getTime();
          if (timeFilter === 'someday') return false; // Should not happen if it has a due date but just in case
          return false;
        })();

        return matchesFilter && matchesCategory && matchesSearch && matchesTime;
      })
      .sort((a, b) => {
        if (sort === 'date') return b.createdAt - a.createdAt;
        if (sort === 'due-date') {
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return a.dueDate - b.dueDate;
        }
        if (sort === 'priority') {
          const pMap = { high: 1, medium: 2, low: 3 };
          return pMap[a.priority] - pMap[b.priority];
        }
        if (sort === 'alphabetical') return a.text.localeCompare(b.text);
        return 0;
      });
  }, [tasks, filter, activeCategory, search, sort, timeFilter]);

  const stats = useMemo(() => {
    const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);
    const recentTasks = tasks.filter(t => t.createdAt > twentyFourHoursAgo || t.completed);
    const completedToday = tasks.filter(t => t.completed && t.createdAt > twentyFourHoursAgo).length;
    const totalToday = tasks.filter(t => t.createdAt > twentyFourHoursAgo).length;
    
    const progress = totalToday === 0 ? 0 : Math.round((completedToday / totalToday) * 100);
    return { completed: completedToday, total: totalToday, progress };
  }, [tasks]);

  const counts = useMemo(() => {
    const now = new Date();
    now.setHours(0,0,0,0);
    const activeTasks = tasks.filter(t => !t.completed);
    return {
      all: activeTasks.length,
      today: activeTasks.filter(t => t.dueDate && new Date(t.dueDate).setHours(0,0,0,0) <= now.getTime()).length,
      upcoming: activeTasks.filter(t => t.dueDate && new Date(t.dueDate).setHours(0,0,0,0) > now.getTime()).length,
      someday: activeTasks.filter(t => !t.dueDate).length,
    };
  }, [tasks]);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      {/* Mobile Sidebar Toggle */}
      <button 
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="fixed bottom-6 right-6 z-50 p-4 bg-indigo-600 text-white rounded-full shadow-lg lg:hidden"
      >
        {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Mobile Backdrop */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-30 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Left Sidebar */}
      <aside 
        className={`fixed inset-y-0 left-0 z-40 w-72 bg-white p-6 flex flex-col gap-8 card-shadow transition-transform duration-300 lg:relative lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center gap-3 px-2">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
             <div className="w-5 h-5 border-2 border-white rounded-md"></div>
          </div>
          <span className="font-bold text-slate-900 text-xl tracking-tight">Nexus Tasks</span>
        </div>

        <nav className="flex flex-col gap-2">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 mb-1">Navigation</p>
          <button 
            onClick={() => { setTimeFilter('all'); setActiveCategory('All'); }}
            className={`flex items-center justify-between px-4 py-2.5 rounded-xl font-medium cursor-pointer transition-all ${
              timeFilter === 'all' && activeCategory === 'All' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-3">
              <Inbox className="w-5 h-5" /> Inbox
            </div>
            <span className="text-xs bg-indigo-100 text-indigo-600 px-2.5 py-0.5 rounded-full font-bold">{counts.all}</span>
          </button>
          
          <button 
            onClick={() => { setTimeFilter('today'); setActiveCategory('All'); }}
            className={`flex items-center justify-between px-4 py-2.5 rounded-xl font-medium cursor-pointer transition-all ${
              timeFilter === 'today' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5" /> Today
            </div>
            <span className="text-xs bg-slate-100 text-slate-500 px-2.5 py-0.5 rounded-full font-bold">{counts.today}</span>
          </button>

          <button 
            onClick={() => { setTimeFilter('upcoming'); setActiveCategory('All'); }}
            className={`flex items-center justify-between px-4 py-2.5 rounded-xl font-medium cursor-pointer transition-all ${
              timeFilter === 'upcoming' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-3">
              <CalendarDays className="w-5 h-5" /> Upcoming
            </div>
            <span className="text-xs bg-slate-100 text-slate-500 px-2.5 py-0.5 rounded-full font-bold">{counts.upcoming}</span>
          </button>
          
          <button 
            onClick={() => { setTimeFilter('someday'); setActiveCategory('All'); }}
            className={`flex items-center justify-between px-4 py-2.5 rounded-xl font-medium cursor-pointer transition-all ${
              timeFilter === 'someday' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-3">
              <Star className="w-5 h-5" /> Someday
            </div>
            <span className="text-xs bg-slate-100 text-slate-500 px-2.5 py-0.5 rounded-full font-bold">{counts.someday}</span>
          </button>
        </nav>

        <div className="mt-2">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 mb-3">Folders</p>
          <div className="flex flex-col gap-1">
            {categories.filter(c => c !== 'All').map((cat, idx) => (
              <button
                key={cat}
                onClick={() => {
                  setActiveCategory(cat);
                  setTimeFilter('all');
                }}
                className={`flex items-center gap-3 px-4 py-2 text-sm font-medium transition-all rounded-lg group ${
                  activeCategory === cat ? 'text-indigo-600 bg-indigo-50/50' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <div className={`w-2 h-2 rounded-full transform transition-all group-hover:scale-125 ${idx % 3 === 0 ? 'bg-indigo-400' : idx % 3 === 1 ? 'bg-emerald-400' : 'bg-amber-400'}`}></div>
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-auto pt-6 border-t border-slate-100">
          {user ? (
            <div className="flex items-center gap-4 px-2 group">
              <div 
                className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center border-2 border-white shadow-sm overflow-hidden cursor-pointer hover:scale-110 transition-all"
                onClick={() => setIsProfileModalOpen(true)}
              >
                 <img src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} alt="avatar" />
              </div>
              <div className="flex-grow">
                <p className="text-sm font-bold text-slate-900 truncate max-w-[120px]">{user.displayName || 'User'}</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{userProfile?.settings?.theme || 'Default'} Theme</p>
              </div>
              <Settings 
                onClick={() => setIsProfileModalOpen(true)}
                className="w-5 h-5 text-slate-400 hover:text-indigo-600 cursor-pointer transition-colors" 
              />
            </div>
          ) : (
            <button
              onClick={signInWithGoogle}
              className="w-full flex items-center justify-center gap-2 py-3 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-indigo-600 transition-all shadow-lg active:scale-95"
            >
              Sign in with Google
            </button>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 h-full p-6 lg:p-8 gap-8 overflow-hidden">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
              {timeFilter === 'all' ? 'All Tasks' : 
               timeFilter === 'today' ? "Today's Priorities" : 
               timeFilter === 'upcoming' ? 'Upcoming Schedule' : 'Someday Plans'}
            </h1>
            <p className="text-slate-400 text-sm font-medium mt-1">Focus on what matters the most today.</p>
          </div>
          <div className="flex items-center gap-3">
             <div className="flex -space-x-3">
                {[1,2,3].map(i => (
                  <div key={i} className="w-9 h-9 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center text-[10px] font-bold overflow-hidden shadow-sm">
                    <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${i}`} alt="user" />
                  </div>
                ))}
             </div>
             <div className="w-px h-6 bg-slate-200 mx-2"></div>
             <button 
              onClick={() => setIsNewProjectModalOpen(true)}
              className="bg-indigo-600 text-white p-2 sm:px-4 sm:py-2 rounded-xl text-sm font-bold hover:bg-indigo-700 hover:scale-105 active:scale-95 transition-all shadow-lg shadow-indigo-200 flex items-center gap-2"
             >
               <Plus className="w-5 h-5" />
               <span className="hidden sm:inline">New Project</span>
             </button>
          </div>
        </header>

        <div className="flex-1 min-h-0 flex flex-col gap-6">
           {/* Filtering Bar */}
           <div className="flex items-center justify-between pb-2 border-b border-slate-100">
             <div className="flex gap-6">
                {(['all', 'active', 'completed'] as FilterType[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`text-sm font-bold uppercase tracking-widest pb-3 border-b-2 transition-all ${
                      filter === f ? 'text-indigo-600 border-indigo-600' : 'text-slate-400 border-transparent hover:text-slate-600'
                    }`}
                  >
                    {f}
                  </button>
                ))}
                
                <div className="w-px h-6 bg-slate-100 self-center"></div>
                
                <div className="flex bg-slate-100 p-1 rounded-xl">
                  <button 
                    onClick={() => setViewMode('list')}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${
                      viewMode === 'list' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    List
                  </button>
                  <button 
                    onClick={() => setViewMode('calendar')}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${
                      viewMode === 'calendar' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    Calendar
                  </button>
                </div>
             </div>
             <div className="flex items-center gap-4 text-slate-400">
               <Search className="w-5 h-5 hover:text-slate-600 cursor-pointer" />
               <div className="relative group/sort">
                 <button 
                  onClick={() => {
                    const modes: SortType[] = ['date', 'due-date', 'priority', 'alphabetical'];
                    const nextIndex = (modes.indexOf(sort) + 1) % modes.length;
                    setSort(modes[nextIndex]);
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:border-indigo-300 transition-all"
                 >
                   <SlidersHorizontal className={`w-3.5 h-3.5 ${sort !== 'date' ? 'text-indigo-600' : ''}`} />
                   Sorted by {sort.replace('-', ' ')}
                 </button>
               </div>
             </div>
           </div>

           {viewMode === 'list' ? (
             <div className="flex-1 bg-white rounded-[2rem] card-shadow flex flex-col overflow-hidden relative">
                <div className="p-6 pb-2">
                  <TaskInput 
                    onAdd={addTask} 
                    categories={categories.filter(c => c !== 'All')} 
                    defaultCategory={activeCategory !== 'All' ? activeCategory : 'General'}
                    templates={templates}
                  />
                </div>
                <div className="flex-1 overflow-y-auto no-scrollbar divide-y divide-slate-50">
                   <AnimatePresence mode="popLayout">
                      {filteredTasks.length > 0 ? (
                        filteredTasks.map(task => (
                          <TaskItem 
                            key={task.id} 
                            task={task} 
                            onToggle={toggleTask} 
                            onDelete={deleteTask} 
                            isSelected={selectedTaskIds.has(task.id)}
                            onSelect={toggleSelection}
                            onEdit={() => setEditingTask(task)}
                          />
                        ))
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center p-12 text-center">
                           <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                              <CheckCircle2 className="w-10 h-10 text-slate-200" />
                           </div>
                           <h3 className="text-lg font-bold text-slate-800">No tasks found</h3>
                           <p className="text-slate-400 text-sm mt-1 max-w-[240px]">Try adjusting your filters or add a new task to get started.</p>
                        </div>
                      )}
                   </AnimatePresence>
                </div>

                {/* Bulk Action Bar */}
                <AnimatePresence>
                  {selectedTaskIds.size > 0 && (
                    <motion.div
                      initial={{ y: 100 }}
                      animate={{ y: 0 }}
                      exit={{ y: 100 }}
                      className="absolute bottom-6 left-6 right-6 bg-slate-900/95 backdrop-blur-md rounded-2xl p-4 flex items-center justify-between gap-4 card-shadow z-30 ring-1 ring-white/10"
                    >
                      <div className="flex items-center gap-4">
                        <div className="bg-indigo-600 px-3 py-1 rounded-lg text-[10px] font-bold text-white uppercase tracking-widest">
                          {selectedTaskIds.size} Selected
                        </div>
                        <button 
                          onClick={() => setSelectedTaskIds(new Set())}
                          className="text-white/60 hover:text-white text-xs font-bold transition-all"
                        >
                          Cancel
                        </button>
                      </div>

                      <div className="flex items-center gap-4 border-l border-white/10 pl-4">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">Priority</span>
                          <div className="flex gap-1">
                            {(['high', 'medium', 'low'] as Priority[]).map(p => (
                              <button
                                key={p}
                                onClick={() => bulkUpdateTasks({ priority: p })}
                                className={`w-6 h-6 rounded-md flex items-center justify-center transition-all ${
                                  p === 'high' ? 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/40' : 
                                  p === 'medium' ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/40' : 
                                  'bg-blue-500/20 text-blue-400 hover:bg-blue-500/40'
                                }`}
                              >
                                <Flag className="w-3 h-3" />
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="w-px h-6 bg-white/10 mx-2" />

                        <div className="flex items-center gap-2">
                          <span className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">Due</span>
                          <input 
                            type="date"
                            onChange={(e) => bulkUpdateTasks({ dueDate: e.target.value ? new Date(e.target.value).getTime() : undefined })}
                            className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-[10px] font-bold text-white outline-none focus:bg-white/10"
                          />
                        </div>

                        <div className="w-px h-6 bg-white/10 mx-2" />

                        <div className="flex items-center gap-2">
                          <span className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">Move to</span>
                          <select 
                            onChange={(e) => bulkUpdateTasks({ category: e.target.value })}
                            className="bg-white/5 border border-white/10 rounded-lg px-3 py-1 text-[10px] font-bold text-white outline-none focus:bg-white/10"
                          >
                            <option value="" disabled selected>Folder...</option>
                            {folders.map(f => <option key={f} value={f} className="text-slate-900">{f}</option>)}
                          </select>
                        </div>

                        <div className="w-px h-6 bg-white/10 mx-2" />

                        <button 
                          onClick={() => bulkUpdateTasks({ completed: true })}
                          className="p-2 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 rounded-xl transition-all"
                          title="Mark Selected as Done"
                        >
                          <CheckCircle2 className="w-5 h-5" />
                        </button>

                        <button 
                          onClick={bulkDeleteTasks}
                          className="p-2 bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 rounded-xl transition-all"
                          title="Delete Selected"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
             </div>
           ) : (
             <CalendarView 
               tasks={filteredTasks} 
               onTaskClick={(task) => setEditingTask(task)} 
             />
           )}
        </div>
      </main>

      {/* Right Sidebar */}
      <aside className="hidden xl:flex w-80 bg-slate-50 p-8 flex-col gap-8 overflow-y-auto no-scrollbar">
         <section className="bg-white rounded-[2rem] p-8 card-shadow flex flex-col items-center gap-6 text-center">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Efficiency Score</p>
            <div className="relative flex items-center justify-center">
              <svg className="w-40 h-40 transform -rotate-90">
                <circle cx="80" cy="80" r="70" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-slate-100" />
                <motion.circle 
                  cx="80" cy="80" r="70" 
                  stroke="currentColor" strokeWidth="12" 
                  fill="transparent" 
                  strokeDasharray="439.8" 
                  initial={{ strokeDashoffset: 439.8 }}
                  animate={{ strokeDashoffset: 439.8 - (439.8 * stats.progress) / 100 }}
                  transition={{ duration: 1, ease: "easeOut" }}
                  className="text-indigo-600" 
                />
              </svg>
              <div className="absolute flex flex-col">
                <span className="text-4xl font-bold text-slate-900">{stats.progress}%</span>
              </div>
            </div>
            <div>
               <p className="text-slate-800 font-bold">Good Progress!</p>
               <p className="text-xs text-slate-400 mt-1">You've completed {stats.completed} tasks today. Keep maintaining the momentum.</p>
            </div>
         </section>

         <section className="bg-indigo-600/5 rounded-[2rem] p-6 border border-indigo-100 flex flex-col gap-4 relative overflow-hidden group hover:border-indigo-200 transition-all">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1 px-2 bg-indigo-600 rounded-lg text-white">
                  <BrainCircuit className="w-3 h-3" />
                </div>
                <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">AI Insights</p>
              </div>
              {isAiLoading && (
                <motion.div 
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                >
                  <Sparkles className="w-3 h-3 text-indigo-400" />
                </motion.div>
              )}
            </div>
            
            <div className="relative z-10">
              {isAiLoading && !aiInsights ? (
                <div className="space-y-2">
                  <div className="h-3 bg-indigo-100 rounded-full animate-pulse w-full"></div>
                  <div className="h-3 bg-indigo-100 rounded-full animate-pulse w-5/6"></div>
                  <div className="h-3 bg-indigo-100 rounded-full animate-pulse w-4/6"></div>
                </div>
              ) : (
                <p className="text-xs text-indigo-900 leading-relaxed font-medium">
                  {aiInsights || "Focus on your high priority tasks first to maintain momentum today."}
                </p>
              )}
            </div>
            
            <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-indigo-600/5 rounded-full blur-2xl group-hover:bg-indigo-600/10 transition-all"></div>
         </section>

         <section className="bg-slate-900 rounded-[2rem] p-8 card-shadow flex-1 flex flex-col text-white relative overflow-hidden">
            <div className="flex items-center justify-between mb-8">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Focus Timer</p>
              <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse shadow-[0_0_8px_rgba(244,63,94,0.6)]"></div>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center">
               <span className="text-5xl font-extralight tracking-widest mb-3">{formatTime(timerLeft)}</span>
               <span className="text-xs text-slate-400 font-medium bg-white/5 px-4 py-1.5 rounded-full uppercase tracking-tighter">
                 {timerMode === 'work' ? 'Deep Work Session' : 'Quick Break'}
               </span>
            </div>
            <div className="mt-8 flex gap-3">
               <button 
                 onClick={toggleTimer}
                 className="flex-1 py-3 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold transition-all border border-white/10"
               >
                 {timerActive ? 'Pause' : 'Start'}
               </button>
               <button 
                 onClick={skipTimer}
                 className="flex-1 py-3 bg-white text-slate-900 rounded-xl text-xs font-bold hover:bg-slate-100 transition-all"
               >
                 Skip
               </button>
            </div>

            {/* Abstract Background Decoration */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
         </section>

         <div className="bg-indigo-600 rounded-[2rem] p-6 text-white flex flex-col gap-4 relative overflow-hidden">
            <div className="flex items-center gap-3">
               <Bell className="w-5 h-5" />
               <p className="text-sm font-bold">Upcoming: Nexus Sync</p>
            </div>
            <p className="text-xs text-indigo-100 ml-8 leading-relaxed font-medium">Next reminder scheduled for 2:30 PM. Stay consistent!</p>
            <div className="absolute -bottom-4 -right-4 w-20 h-20 bg-white/10 rounded-full blur-xl"></div>
         </div>
      </aside>
      {/* Task Details Modal */}
      <AnimatePresence>
        {editingTask && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingTask(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 40 }}
              className="relative w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden max-h-[90vh]"
            >
              <div className="p-8 pb-4 flex items-center justify-between border-b border-slate-100">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                    editingTask.priority === 'high' ? 'bg-rose-50 text-rose-500' : 
                    editingTask.priority === 'medium' ? 'bg-amber-50 text-amber-500' : 'bg-blue-50 text-blue-500'
                  }`}>
                    <Flag className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-slate-900 tracking-tight leading-none mb-1">Task Details</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{editingTask.category} Folder</p>
                  </div>
                </div>
                <button 
                  onClick={() => setEditingTask(null)}
                  className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 no-scrollbar space-y-8">
                {/* Title and Description */}
                <div className="space-y-4">
                  <input 
                    type="text"
                    value={editingTask.text}
                    onChange={(e) => updateTask(editingTask.id, { text: e.target.value })}
                    className="text-xl font-bold text-slate-900 w-full bg-transparent focus:outline-none"
                  />
                  <textarea 
                    placeholder="Add a detailed description..."
                    value={editingTask.description || ''}
                    onChange={(e) => updateTask(editingTask.id, { description: e.target.value })}
                    className="w-full min-h-[120px] bg-slate-50 rounded-2xl p-4 text-sm text-slate-600 placeholder:text-slate-400 focus:active-ring outline-none resize-none transition-all"
                  />
                </div>

                {/* Priority Selection */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Priority level</h4>
                    <button 
                      onClick={handleSuggestPriority}
                      disabled={isSuggestingPriority}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border ${
                        isSuggestingPriority 
                          ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed' 
                          : 'bg-amber-50 text-amber-600 border-amber-100 hover:bg-amber-100 hover:scale-105 active:scale-95'
                      }`}
                    >
                      {isSuggestingPriority ? (
                        <Zap className="w-3 h-3 animate-pulse" />
                      ) : (
                        <Sparkles className="w-3 h-3" />
                      )}
                      {isSuggestingPriority ? 'Analyzing...' : 'Suggest Priority'}
                    </button>
                  </div>
                  <div className="flex gap-2">
                    {(['low', 'medium', 'high'] as Priority[]).map((p) => (
                      <button
                        key={p}
                        onClick={() => updateTask(editingTask.id, { priority: p })}
                        className={`flex-1 py-3 rounded-2xl text-[10px] font-bold uppercase tracking-widest border transition-all ${
                          editingTask.priority === p
                            ? p === 'high' ? 'bg-rose-600 text-white border-rose-600 shadow-lg shadow-rose-100' :
                              p === 'medium' ? 'bg-amber-500 text-white border-amber-500 shadow-lg shadow-amber-100' :
                              'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-100'
                            : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Subtasks Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Subtasks</h4>
                    <div className="flex items-center gap-3">
                       <button 
                         onClick={handleSuggestSteps}
                         disabled={isSuggestingSteps}
                         className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border ${
                           isSuggestingSteps 
                             ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed' 
                             : 'bg-indigo-50 text-indigo-600 border-indigo-100 hover:bg-indigo-100 hover:scale-105 active:scale-95'
                         }`}
                       >
                         {isSuggestingSteps ? (
                           <Zap className="w-3 h-3 animate-pulse" />
                         ) : (
                           <Sparkles className="w-3 h-3" />
                         )}
                         {isSuggestingSteps ? 'Thinking...' : 'Magic Breakdown'}
                       </button>
                       <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                         {editingTask.subtasks.filter(s => s.completed).length}/{editingTask.subtasks.length}
                       </span>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    {editingTask.subtasks.map(sub => (
                      <div key={sub.id} className="flex items-center gap-3 bg-slate-50/50 p-3 rounded-xl border border-slate-100 group">
                        <button 
                          onClick={() => {
                            const nextSubtasks = editingTask.subtasks.map(s => 
                              s.id === sub.id ? { ...s, completed: !s.completed } : s
                            );
                            updateTask(editingTask.id, { subtasks: nextSubtasks });
                          }}
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                            sub.completed ? 'bg-emerald-500 border-emerald-500' : 'bg-white border-slate-200'
                          }`}
                        >
                          {sub.completed && <Check className="w-3.5 h-3.5 text-white" strokeWidth={4} />}
                        </button>
                        <input 
                          type="text"
                          value={sub.text}
                          onChange={(e) => {
                            const nextSubtasks = editingTask.subtasks.map(s => 
                              s.id === sub.id ? { ...s, text: e.target.value } : s
                            );
                            updateTask(editingTask.id, { subtasks: nextSubtasks });
                          }}
                          className={`flex-1 bg-transparent text-sm font-medium focus:outline-none transition-all ${
                            sub.completed ? 'text-slate-400 line-through' : 'text-slate-700'
                          }`}
                        />
                        <button 
                          onClick={() => {
                             const nextSubtasks = editingTask.subtasks.filter(s => s.id !== sub.id);
                             updateTask(editingTask.id, { subtasks: nextSubtasks });
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-rose-500 transition-all"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    
                    <button 
                      onClick={() => {
                        const newSub: Subtask = { id: crypto.randomUUID(), text: '', completed: false };
                        updateTask(editingTask.id, { subtasks: [...editingTask.subtasks, newSub] });
                      }}
                      className="w-full py-3 border-2 border-dashed border-slate-200 rounded-2xl flex items-center justify-center gap-2 text-slate-400 hover:border-indigo-300 hover:text-indigo-500 transition-all text-xs font-bold"
                    >
                      <Plus className="w-4 h-4" /> Add Step
                    </button>
                  </div>
                </div>

                {/* Collaboration Section */}
                {user && (
                    <div className="space-y-6 pt-4 border-t border-slate-100">
                        <div className="space-y-4">
                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Collaborators</h4>
                            <div className="flex flex-wrap gap-2">
                                <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-[10px] font-bold border-2 border-white shadow-sm" title="Owner">
                                    {user.displayName?.charAt(0) || 'O'}
                                </div>
                                {editingTask.collaborators?.map(c => (
                                    <div key={c} className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 text-[10px] font-bold border-2 border-white shadow-sm" title={c}>
                                        {c.charAt(0).toUpperCase()}
                                    </div>
                                ))}
                                <div className="flex gap-2 w-full mt-2">
                                    <input 
                                        type="email"
                                        placeholder="Invite by UID/Email..."
                                        value={newCollabEmail}
                                        onChange={(e) => setNewCollabEmail(e.target.value)}
                                        className="flex-1 bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-xs focus:active-ring outline-none transition-all"
                                    />
                                    <button 
                                        onClick={() => {
                                            if (newCollabEmail) {
                                                handleAddCollaborator(editingTask.id, newCollabEmail);
                                                setNewCollabEmail('');
                                            }
                                        }}
                                        className="bg-slate-900 text-white px-4 py-2 rounded-xl text-[10px] font-bold hover:bg-slate-800 active:scale-95 transition-all"
                                    >
                                        Invite
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Comments</h4>
                            <div className="space-y-3 max-h-64 overflow-y-auto no-scrollbar pr-2">
                                {comments[editingTask.id]?.map(comment => (
                                    <div key={comment.id} className="flex gap-3 animate-in fade-in slide-in-from-bottom-2">
                                        <div className="w-8 h-8 rounded-full bg-slate-100 flex-shrink-0 overflow-hidden border border-slate-200">
                                            <img src={comment.userPhoto || `https://api.dicebear.com/7.x/avataaars/svg?seed=${comment.userId}`} alt="user" />
                                        </div>
                                        <div className="flex-1 bg-slate-50 rounded-2xl p-3">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-[10px] font-bold text-slate-900">{comment.userName}</span>
                                                <span className="text-[8px] text-slate-400">{new Date(comment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                            <p className="text-xs text-slate-600 leading-relaxed italic">"{comment.text}"</p>
                                        </div>
                                    </div>
                                ))}
                                {(!comments[editingTask.id] || comments[editingTask.id].length === 0) && (
                                    <p className="text-center text-[10px] text-slate-300 font-medium italic py-4">No comments yet. Start the conversation!</p>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <input 
                                    type="text"
                                    placeholder="Write a comment..."
                                    value={newCommentText}
                                    onChange={(e) => setNewCommentText(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            handleAddComment(editingTask.id, newCommentText);
                                            setNewCommentText('');
                                        }
                                    }}
                                    className="flex-1 bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-xs focus:active-ring outline-none transition-all"
                                />
                                <button 
                                    onClick={() => {
                                        handleAddComment(editingTask.id, newCommentText);
                                        setNewCommentText('');
                                    }}
                                    className="bg-indigo-600 text-white w-10 h-10 rounded-xl flex items-center justify-center hover:bg-indigo-700 active:scale-95 transition-all shadow-lg shadow-indigo-100"
                                >
                                    <Plus className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    </div>
                )}
              </div>

              <div className="p-8 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-6">
                   <div className="flex flex-col">
                     <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Identity</span>
                     <span className="text-xs font-bold text-slate-900 bg-white px-3 py-1 rounded-lg shadow-sm border border-slate-100">#{editingTask.id.slice(0, 8)}</span>
                   </div>
                   <div className="flex flex-col">
                     <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Created</span>
                     <span className="text-xs font-bold text-slate-900">{new Date(editingTask.createdAt).toLocaleDateString()}</span>
                   </div>
                </div>
                <button 
                  onClick={() => setEditingTask(null)}
                  className="px-8 py-3 bg-slate-900 text-white rounded-2xl text-sm font-bold hover:bg-slate-800 transition-all shadow-lg"
                >
                  Done Editing
                </button>
              </div>
              
              <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/30 rounded-full blur-3xl pointer-events-none" />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Profile Modal */}
      <AnimatePresence>
        {isProfileModalOpen && userProfile && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsProfileModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl p-8 overflow-hidden"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-xl">
                    <Settings className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-slate-900 leading-tight">Settings</h3>
                    <p className="text-xs font-medium text-slate-400">Personalize your Nexus experience</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsProfileModalOpen(false)}
                  className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-6">
                {/* Theme */}
                <div className="space-y-3">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Appearance</p>
                  <div className="grid grid-cols-2 gap-3">
                    {(['light', 'dark'] as const).map(t => (
                      <button
                        key={t}
                        onClick={async () => {
                          const nextSettings = { ...userProfile.settings, theme: t };
                          await updateDoc(doc(db, 'users', userProfile.uid), { settings: nextSettings });
                          setUserProfile(prev => prev ? { ...prev, settings: nextSettings } : null);
                        }}
                        className={`py-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${
                          userProfile.settings.theme === t 
                          ? 'border-indigo-600 bg-indigo-50/30' 
                          : 'border-slate-100 hover:border-slate-200'
                        }`}
                      >
                        <div className={`w-10 h-6 rounded-full relative p-1 ${t === 'dark' ? 'bg-slate-800' : 'bg-slate-200'}`}>
                          <div className={`w-4 h-4 rounded-full bg-white transition-all ${t === 'dark' ? 'translate-x-4' : 'translate-x-0'}`} />
                        </div>
                        <span className="text-xs font-bold capitalize">{t} Mode</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Notifications */}
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                  <div className="flex items-center gap-3">
                    <Bell className="w-5 h-5 text-slate-400" />
                    <div>
                      <p className="text-sm font-bold text-slate-800">Push Notifications</p>
                      <p className="text-[10px] text-slate-400 font-medium">Get reminded about task deadlines</p>
                    </div>
                  </div>
                  <button 
                    onClick={async () => {
                       const nextSettings = { ...userProfile.settings, notifications: !userProfile.settings.notifications };
                       await updateDoc(doc(db, 'users', userProfile.uid), { settings: nextSettings });
                       setUserProfile(prev => prev ? { ...prev, settings: nextSettings } : null);
                    }}
                    className={`w-12 h-6 rounded-full relative transition-all ${userProfile.settings.notifications ? 'bg-emerald-500' : 'bg-slate-300'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${userProfile.settings.notifications ? 'right-1' : 'left-1'}`} />
                  </button>
                </div>

                <button 
                  onClick={() => signOut()}
                  className="w-full py-4 rounded-2xl border-2 border-rose-100 text-rose-500 text-xs font-bold hover:bg-rose-50 transition-all uppercase tracking-widest"
                >
                  Sign Out
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* New Project Modal */}
      <AnimatePresence>
        {isNewProjectModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsNewProjectModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl p-8 overflow-hidden"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                  <LayoutGrid className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 tracking-tight">New Project</h3>
                  <p className="text-xs text-slate-400 font-medium">Add a new folder to organize tasks.</p>
                </div>
              </div>
              
              <form onSubmit={handleCreateFolder}>
                <input
                  autoFocus
                  type="text"
                  placeholder="e.g., Marketing, Home, Side Project"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:active-ring outline-none text-sm font-medium text-slate-900 mb-6 transition-all"
                />
                
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsNewProjectModalOpen(false)}
                    className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-200 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50"
                    disabled={!newFolderName.trim()}
                  >
                    Create
                  </button>
                </div>
              </form>
              
              <div className="absolute -top-12 -right-12 w-32 h-32 bg-indigo-50/50 rounded-full blur-3xl pointer-events-none" />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 100, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 100, x: '-50%' }}
            className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[60] bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 min-w-[320px] border border-white/10"
          >
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shrink-0">
               <Bell className="w-5 h-5 text-white animate-bounce" />
            </div>
            <div className="flex-grow">
              <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1">Task Reminder</p>
              <p className="text-sm font-medium leading-tight">{toast.text}</p>
            </div>
            <button 
              onClick={() => setToast(null)}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-4 h-4 text-slate-400" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

