/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Plus, Tag, Flag, Calendar, Bell, Sparkles, Zap, Copy, ChevronDown } from 'lucide-react';
import { Priority, TaskTemplate } from '../types';

interface TaskInputProps {
  onAdd: (text: string, priority: Priority, category: string, dueDate?: number, reminderTime?: number, subtasks?: string[], description?: string) => void;
  categories: string[];
  defaultCategory?: string;
  templates?: TaskTemplate[];
}

export const TaskInput: React.FC<TaskInputProps> = ({ onAdd, categories, defaultCategory, templates = [] }) => {
  const [text, setText] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [category, setCategory] = useState(defaultCategory || 'General');
  const [dueDate, setDueDate] = useState<string>('');
  const [reminder, setReminder] = useState<string>('');
  const [showOptions, setShowOptions] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  const applyTemplate = (template: TaskTemplate) => {
    setText(template.text);
    setPriority(template.priority);
    setCategory(template.category);
    setShowTemplates(false);
    
    // Auto-submit if the user clicks a template? 
    // Or just fill the form. Let's fill the form and show options so they can see what happened.
    setShowOptions(true);
  };

  const handleAIAnalyze = async () => {
    if (!text.trim()) return;
    setIsAnalyzing(true);
    try {
      const { analyzeTask } = await import('../services/geminiService');
      const result = await analyzeTask(text, categories);
      if (result) {
        setText(result.refinedText);
        setPriority(result.priority);
        if (categories.includes(result.category)) {
          setCategory(result.category);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  useEffect(() => {
    if (defaultCategory) {
      setCategory(defaultCategory);
    }
  }, [defaultCategory]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim()) {
      // Find if this text matches any template to include its subtasks
      const template = templates.find(t => t.text === text.trim());
      
      onAdd(
        text.trim(), 
        priority, 
        category, 
        dueDate ? new Date(dueDate).getTime() : undefined,
        reminder ? new Date(reminder).getTime() : undefined,
        template?.subtasks || [],
        template?.description || ''
      );
      setText('');
      setDueDate('');
      setReminder('');
      setShowOptions(false);
    }
  };

  return (
    <div className="relative z-20">
      <form
        onSubmit={handleSubmit}
        className={`bg-white rounded-2xl border border-slate-200 transition-all p-3 ${
          showOptions ? 'active-ring bg-slate-50' : 'card-shadow hover:border-slate-300'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
            <Plus className="w-5 h-5 text-slate-500" />
          </div>
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onFocus={() => setShowOptions(true)}
            placeholder="Plan your next prioritize..."
            className="flex-grow py-2 px-1 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none bg-transparent"
          />
          
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowTemplates(!showTemplates)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-50 text-slate-500 hover:bg-slate-100 transition-all border border-slate-200"
            >
              <Copy className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Templates</span>
              <ChevronDown className={`w-3 h-3 transition-transform ${showTemplates ? 'rotate-180' : ''}`} />
            </button>
            
            {showTemplates && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-slate-100 p-2 z-[60] animate-in fade-in zoom-in-95">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest p-2 border-b border-slate-50 mb-1">Quick Templates</p>
                {templates.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => applyTemplate(t)}
                    className="w-full text-left p-2.5 rounded-xl hover:bg-indigo-50 group transition-all flex flex-col gap-0.5"
                  >
                    <span className="text-xs font-bold text-slate-800 group-hover:text-indigo-700">{t.name}</span>
                    <span className="text-[10px] text-slate-400">{t.subtasks.length} subtasks • {t.category}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {text.trim() && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAIAnalyze}
                disabled={isAnalyzing}
                title="AI Smart Refine"
                className={`p-2 rounded-xl border transition-all ${
                  isAnalyzing 
                    ? 'bg-slate-50 text-slate-400 border-slate-200' 
                    : 'bg-white text-indigo-600 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50'
                }`}
              >
                {isAnalyzing ? (
                  <Zap className="w-5 h-5 animate-pulse" />
                ) : (
                  <Sparkles className="w-5 h-5" />
                )}
              </button>
              <button
                type="submit"
                className="bg-indigo-600 text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-all font-sans"
              >
                Add Task
              </button>
            </div>
          )}
        </div>

        {showOptions && (
          <div className="flex flex-wrap items-center gap-6 px-1 mt-4 pt-4 border-t border-slate-200 overflow-hidden animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-3">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-widest flex items-center gap-1.5">
                <Flag className="w-3 h-3" /> Priority
              </span>
              <div className="flex gap-1.5">
                {(['low', 'medium', 'high'] as Priority[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={`text-[10px] px-3 py-1 rounded-md font-bold uppercase tracking-wider transition-all border ${
                      priority === p
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="flex items-center gap-3 border-l border-slate-200 pl-6">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-widest flex items-center gap-1.5">
                <Tag className="w-3 h-3" /> List
              </span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="text-[10px] bg-white border border-slate-200 rounded-md px-3 py-1 focus:active-ring font-bold uppercase tracking-wider text-slate-600 outline-none"
              >
                <option value="General">General</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3 border-l border-slate-200 pl-6">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-widest flex items-center gap-1.5">
                <Calendar className="w-3 h-3" /> Due Date
              </span>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="text-[10px] bg-white border border-slate-200 rounded-md px-3 py-0.5 focus:active-ring font-bold text-slate-600 outline-none"
              />
            </div>

            <div className="flex items-center gap-3 border-l border-slate-200 pl-6">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-widest flex items-center gap-1.5">
                <Bell className="w-3 h-3" /> Reminder
              </span>
              <input
                type="datetime-local"
                value={reminder}
                onChange={(e) => setReminder(e.target.value)}
                className="text-[10px] bg-white border border-slate-200 rounded-md px-3 py-0.5 focus:active-ring font-bold text-slate-600 outline-none"
              />
            </div>
          </div>
        )}
      </form>
      
      {showOptions && (
        <div 
          className="fixed inset-0 -z-10" 
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowOptions(false);
          }}
        />
      )}
    </div>
  );
};
