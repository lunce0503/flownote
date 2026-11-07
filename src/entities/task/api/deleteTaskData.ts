import axios from "axios";
<<<<<<< HEAD
import { API_BASE_URL2, authHeaders } from "../../../shared/api";

const updateTasksData = async (id : string) => {
    try {
            const response = await axios.delete(`${API_BASE_URL2}/api/tasks/${id}`, {
=======
import { API_CORE_BASE_URL, authHeaders } from "@/shared/api";

const deleteTasksData = async (id : string) => {
    try {
            const response = await axios.delete(`${API_CORE_BASE_URL}/api/tasks/${id}`, {
>>>>>>> 678fcbf (separate repository to flownote-service)
                headers: authHeaders(),
            });
            console.log("deleted task:", response.data);
        } catch (error) {
            console.error("Error fetching tasks:", error);
        }
};

<<<<<<< HEAD
export default updateTasksData;
=======
export default deleteTasksData;
>>>>>>> 678fcbf (separate repository to flownote-service)
