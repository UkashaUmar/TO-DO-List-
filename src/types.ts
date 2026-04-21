/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Priority = 'low' | 'medium' | 'high';

export interface Subtask {
  id: string;
  text: string;
  completed: boolean;
}

export interface Task {
  id: string;
  text: string;
  description?: string;
  summary?: string;
  completed: boolean;
  priority: Priority;
  category: string;
  ownerId?: string;
  collaborators?: string[];
  createdAt: number;
  updatedAt?: number;
  dueDate?: number;
  reminderTime?: number;
  subtasks: Subtask[];
}

export type FilterType = 'all' | 'active' | 'completed';
export type TimeFilterType = 'all' | 'today' | 'upcoming' | 'someday';
export type SortType = 'date' | 'due-date' | 'priority' | 'alphabetical';

export interface TaskTemplate {
  id: string;
  name: string;
  text: string;
  description?: string;
  priority: Priority;
  category: string;
  subtasks: string[];
}

export interface Comment {
  id: string;
  userId: string;
  userName: string;
  userPhoto?: string;
  text: string;
  createdAt: number;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  settings: {
    theme: 'light' | 'dark' | 'system';
    notifications: boolean;
    defaultCategory: string;
  };
  createdAt: string;
}
