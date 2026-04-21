/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
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
  eachDayOfInterval 
} from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Task } from '../types';

interface CalendarViewProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({ tasks, onTaskClick }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const calendarDays = eachDayOfInterval({
    start: startDate,
    end: endDate,
  });

  const getTasksForDay = (day: Date) => {
    return tasks.filter(task => task.dueDate && isSameDay(new Date(task.dueDate), day));
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-[2rem] card-shadow overflow-hidden">
      {/* Calendar Header */}
      <div className="p-6 flex items-center justify-between border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
            <CalendarIcon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              {format(currentMonth, 'MMMM yyyy')}
            </h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Monthly Overview</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={prevMonth}
            className="p-2 rounded-xl hover:bg-slate-50 text-slate-400 hover:text-slate-900 transition-all"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setCurrentMonth(new Date())}
            className="px-4 py-2 text-xs font-bold text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
          >
            Today
          </button>
          <button 
            onClick={nextMonth}
            className="p-2 rounded-xl hover:bg-slate-50 text-slate-400 hover:text-slate-900 transition-all"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Days of Week */}
      <div className="grid grid-cols-7 bg-slate-50/50 border-b border-slate-100">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="py-3 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 overflow-y-auto no-scrollbar grid grid-cols-7">
        {calendarDays.map((day, idx) => {
          const dayTasks = getTasksForDay(day);
          const isSelectedMonth = isSameMonth(day, monthStart);
          const isToday = isSameDay(day, new Date());

          return (
            <div 
              key={day.toISOString()} 
              className={`min-h-[120px] p-2 border-r border-b border-slate-50 flex flex-col gap-1 transition-all ${
                !isSelectedMonth ? 'bg-slate-50/20' : 'bg-white'
              } ${idx % 7 === 6 ? 'border-r-0' : ''}`}
            >
              <div className="flex justify-between items-center mb-1">
                <span className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-lg ${
                  isToday 
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100' 
                    : isSelectedMonth ? 'text-slate-900' : 'text-slate-300'
                }`}>
                  {format(day, 'd')}
                </span>
              </div>
              
              <div className="flex flex-col gap-1 overflow-y-auto no-scrollbar max-h-[80px]">
                {dayTasks.map(task => (
                  <motion.button
                    layoutId={task.id}
                    key={task.id}
                    onClick={() => onTaskClick(task)}
                    className={`text-left px-2 py-1 rounded-md text-[9px] font-bold truncate transition-all ${
                      task.completed 
                        ? 'bg-slate-100 text-slate-400 line-through' 
                        : task.priority === 'high' 
                          ? 'bg-rose-50 text-rose-600 border-l-2 border-rose-500' 
                          : task.priority === 'medium' 
                            ? 'bg-amber-50 text-amber-600 border-l-2 border-amber-500' 
                            : 'bg-blue-50 text-blue-600 border-l-2 border-blue-500'
                    }`}
                  >
                    {task.text}
                  </motion.button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
