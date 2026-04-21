import { GoogleGenAI, Type } from "@google/genai";
import { Task, Priority } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function suggestSubtasks(taskText: string, description: string = '') {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Break down this task into 3-5 actionable subtasks. Use the title and description for context.
      Title: "${taskText}"
      ${description ? `Description: "${description}"` : ''}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.STRING,
            description: "An actionable subtask string"
          }
        },
        systemInstruction: "You are an expert productivity assistant. Provide clear, concise, and actionable steps."
      }
    });

    const text = response.text;
    if (!text) return [];
    return JSON.parse(text) as string[];
  } catch (error) {
    console.error("Error suggesting subtasks:", error);
    return [];
  }
}

export async function analyzeTask(taskText: string, categories: string[]) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analyze this task and suggest its priority and category (from existing folders): "${taskText}"`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            priority: {
              type: Type.STRING,
              enum: ["high", "medium", "low"],
              description: "Suggested priority level"
            },
            category: {
              type: Type.STRING,
              description: "Suggested category from the list"
            },
            refinedText: {
              type: Type.STRING,
              description: "A more professional or clearer version of the task text"
            }
          },
          required: ["priority", "category", "refinedText"]
        },
        systemInstruction: `You are a task management AI. Existing categories are: ${categories.join(", ")}. If none match perfectly, choose the closest or 'General'.`
      }
    });

    const text = response.text;
    if (!text) return null;
    return JSON.parse(text) as { priority: Priority; category: string; refinedText: string };
  } catch (error) {
    console.error("Error analyzing task:", error);
    return null;
  }
}

export async function getAIInsights(tasks: Task[]) {
  try {
    const incompleteTasks = tasks.filter(t => !t.completed).map(t => ({
      text: t.text,
      priority: t.priority,
      dueDate: t.dueDate ? new Date(t.dueDate).toLocaleDateString() : 'N/A'
    }));

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Based on these tasks, give me 3 quick bullets of productivity insights or advice: ${JSON.stringify(incompleteTasks)}`,
      config: {
        systemInstruction: "You are a performance coach. Be encouraging, precise, and professional. Keep response very brief (max 150 chars total)."
      }
    });

    return response.text;
  } catch (error) {
    console.error("Error getting AI insights:", error);
    return "Focus on your high priority tasks first to maintain momentum.";
  }
}

export async function summarizeDescription(description: string) {
  if (!description || description.length < 100) return description;
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Summarize this task description into a very short, one-sentence punchy summary (max 80 chars): ${description}`,
      config: {
        systemInstruction: "You are a summarization assistant. Be concise and capture the core essence of the task."
      }
    });

    return response.text;
  } catch (error) {
    console.error("Error summarizing description:", error);
    return description.slice(0, 77) + "...";
  }
}

export async function suggestPriority(taskText: string, description: string = '') {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Suggest a priority level (high, medium, or low) for this task based on its title and description.
      Title: "${taskText}"
      Description: "${description}"`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            priority: {
              type: Type.STRING,
              enum: ["high", "medium", "low"],
              description: "Suggested priority level"
            },
            reasoning: {
              type: Type.STRING,
              description: "Brief reason for this priority"
            }
          },
          required: ["priority"]
        },
        systemInstruction: "You are a task prioritization expert. Carefully weigh urgency and importance."
      }
    });

    const text = response.text;
    if (!text) return null;
    return JSON.parse(text) as { priority: Priority; reasoning?: string };
  } catch (error) {
    console.error("Error suggesting priority:", error);
    return null;
  }
}
