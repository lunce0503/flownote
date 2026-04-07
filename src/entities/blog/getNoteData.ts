import axios from "axios";
import { API_BASE_URL2 } from "../../shared/api";

const getNoteData = async () => {
    try {
        const response = await axios.get(`${API_BASE_URL2}/api/notes`);
        console.log("Fetched notes:", response.data);
        return response.data;
    } catch (error) {
        console.error("Error fetching notes:", error);
        return [];
    }
};

export default getNoteData;