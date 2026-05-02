import { API_BASE_URL } from "../../../shared/api";
import axios from "axios";

const getChatData = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/api/chat/`);
    return response.data;
  } catch (error) {
    console.error("Error fetching chat data:", error);
    throw error;
  }
};

export default getChatData;
