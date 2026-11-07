<<<<<<< HEAD
import { API_BASE_URL, authHeaders } from "../../../shared/api";
=======
import { API_CORE_BASE_URL, authHeaders } from "@/shared/api";
>>>>>>> 678fcbf (separate repository to flownote-service)
import axios from "axios";

const getChatData = async () => {
  try {
<<<<<<< HEAD
    const response = await axios.get(`${API_BASE_URL}/api/chat/`, {
=======
    const response = await axios.get(`${API_CORE_BASE_URL}/api/chat`, {
>>>>>>> 678fcbf (separate repository to flownote-service)
      headers: authHeaders(),
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching chat data:", error);
    throw error;
  }
};

export default getChatData;
