const API_BASE_URL = "http://localhost:8000";

export const chatService = {

  async getChats() {
    const response = await fetch(`${API_BASE_URL}/chat`);
    return response.json();
  },

  async createChat(chat: string) {
    const response = await fetch(`${API_BASE_URL}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat }),
    });
    return response.json();
  }
};