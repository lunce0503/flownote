import { API_BASE_URL } from "../../../shared/api";
import axios from "axios";
import type { ChatMessage } from "../../../shared/ui/ChatBlock";

const postChatData = async (chatData: ChatMessage) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/api/chat/`, chatData);
    console.log('Chat data posted successfully:', response.data);
    return response.data;
  } catch (error) {
    console.error("Error posting chat data:", error);
    throw error;
  }
};

export default postChatData;
