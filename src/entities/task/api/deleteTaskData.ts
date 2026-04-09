import axios from "axios";
import { API_BASE_URL2 } from "../../../shared/api";

const updateTasksData = async (id : string) => {
    try {
            const response = await axios.delete(`${API_BASE_URL2}/api/tasks/${id}`);
            console.log("deleted task:", response.data);
        } catch (error) {
            console.error("Error fetching tasks:", error);
        }
};

export default updateTasksData;