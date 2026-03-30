import { API_BASE_URL,DEFAULT_HEADERS } from "../../../shared/api";

export const chatService = {

  async getChats() {
    const response = await fetch(`${API_BASE_URL}/chat`);
    return response.json();
  },

  async createChat(chat: string) {
    const response = await fetch(`${API_BASE_URL}/chat`, {
      method: "POST",
      headers: DEFAULT_HEADERS,
      body: JSON.stringify({ chat }),
    });
    return response.json();
  }
};