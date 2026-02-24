import { API_BASE_URL, DEFAULT_HEADERS } from "../../../shared/api/index";

// Todo 아이템의 인터페이스 정의 (TS 활용)
export interface Todo {
  id: number;
  task: string;
  is_completed: boolean;
  created_at: string;
}

export const todoApi = {
  // 1. 할 일 목록 조회
  async getTodos(): Promise<Todo[]> {
    const response = await fetch(`${API_BASE_URL}/todos`);
    if (!response.ok) throw new Error("Failed to fetch todos");
    return response.json();
  },

  // 2. 할 일 생성
  async createTodo(task: string): Promise<Todo> {
    const response = await fetch(`${API_BASE_URL}/todos`, {
      method: "POST",
      headers: DEFAULT_HEADERS,
      body: JSON.stringify({ task }),
    });
    if (!response.ok) throw new Error("Failed to create todo");
    return response.json();
  },

  // 3. 할 일 삭제
  async deleteTodo(id: number): Promise<{ message: string }> {
    const response = await fetch(`${API_BASE_URL}/todos/${id}`, {
      method: "DELETE",
    });
    if (!response.ok) throw new Error("Failed to delete todo");
    return response.json();
  }
};