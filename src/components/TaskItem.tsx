/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, Trash2, Calendar, Flag, EllipsisVertical, Bell, CheckCircle2, Sparkles } from 'lucide-react';
import { Task } from '../types';

interface TaskItemProps {
  task: Task;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onEdit: () => void;
}

const priorityColors = {
  low: 'text-blue-500 bg-blue-50',
  medium: 'text-amber-500 bg-amber-50',
  high: 'text-rose-500 bg-rose-50',
};

export const TaskItem: React.FC<TaskItemProps> = ({ task, onToggle, onDelete, isSelected, onSelect, onEdit }) => {
  const completedSubtasks = task.subtasks?.filter(s => s.completed).length || 0;
  const totalSubtasks = task.subtasks?.length || 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      onClick={(e) => {
        // Prevent edit modal from opening when clicking controls
        if ((e.target as HTMLElement).closest('button')) return;
        onEdit();
      }}
      className={`group flex items-start gap-4 p-6 transition-all border-b border-slate-100 cursor-pointer ${
        task.completed ? 'opacity-60 bg-slate-50/30' : 'bg-white hover:bg-slate-50/50'
      } ${isSelected ? 'bg-indigo-50/50 ring-1 ring-inset ring-indigo-100' : ''}`}
    >
      <div className="flex flex-col gap-3 mt-1">
        <button
          onClick={() => onSelect(task.id)}
          className={`flex-shrink-0 w-5 h-5 rounded-full border-2 transition-all flex items-center justify-center ${
            isSelected
              ? 'bg-indigo-600 border-indigo-600'
              : 'bg-white border-slate-200 hover:border-indigo-300'
          }`}
        >
          {isSelected && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
        </button>

        <button
          onClick={() => onToggle(task.id)}
          className={`flex-shrink-0 w-6 h-6 rounded-md border-2 transition-all flex items-center justify-center ${
            task.completed
              ? 'bg-emerald-500 border-emerald-500'
              : 'bg-white border-slate-300 hover:border-emerald-400'
          }`}
        >
          <AnimatePresence>
            {task.completed && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
              >
                <Check className="w-4 h-4 text-white" strokeWidth={4} />
              </motion.div>
            )}
          </AnimatePresence>
        </button>
      </div>

      <div className="flex-grow min-w-0">
        <h3
          className={`font-medium transition-all ${
            task.completed ? 'line-through text-slate-800' : 'text-slate-900'
          }`}
        >
          {task.text}
        </h3>
        {task.summary && !task.completed && (
          <p className="text-xs text-indigo-500 mt-1 font-medium bg-indigo-50/50 px-2 py-1 rounded-lg border border-indigo-100 flex items-center gap-1.5 w-fit italic">
            <Sparkles className="w-3 h-3" />
            {task.summary}
          </p>
        )}
        <div className="flex items-center gap-4 mt-3">
          <span
            className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${
              task.completed 
                ? 'bg-slate-100 text-slate-500' 
                : task.priority === 'high' 
                  ? 'bg-rose-100 text-rose-600' 
                  : task.priority === 'medium' 
                    ? 'bg-amber-100 text-amber-600' 
                    : 'bg-blue-100 text-blue-600'
            }`}
          >
            {task.completed ? 'Completed' : `${task.priority} Priority`}
          </span>

          {totalSubtasks > 0 && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-indigo-50 text-[10px] font-bold text-indigo-600">
              <CheckCircle2 className="w-3 h-3" />
              {completedSubtasks}/{totalSubtasks}
            </div>
          )}

          {task.dueDate && (
            <div className={`flex items-center gap-1.5 text-xs font-bold ${
              !task.completed && task.dueDate < Date.now() ? 'text-rose-500' : 'text-slate-400'
            }`}>
              <Calendar className="w-3 h-3" />
              {new Date(task.dueDate).toLocaleDateString(undefined, { 
                month: 'short', 
                day: 'numeric' 
              })}
            </div>
          )}

          {task.reminderTime && (
            <div className="flex items-center gap-1.5 text-xs text-indigo-500 font-bold">
              <Bell className="w-3 h-3" />
              {new Date(task.reminderTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
          
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            {task.category}
          </span>
        </div>
      </div>

      <div className="flex flex-col items-end gap-2">
        <button
          onClick={() => onDelete(task.id)}
          className="p-2 text-slate-300 hover:text-rose-500 transition-colors"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </div>
    </motion.div>
  );
};
