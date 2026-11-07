import axios from "axios";
<<<<<<< HEAD
import { API_BASE_URL2, authHeaders } from "../../../shared/api";
import type { TaskProps } from "../../../widgets/TaskWidget/TaskEliment";

const postTaskData = async (taskData: TaskProps) => {
    try {
        const response = await axios.post(`${API_BASE_URL2}/api/tasks`, taskData, {
            headers: authHeaders(),
        });
        console.log('Task posted successfully:', response.data);
    } catch (error) {
        console.error('Error posting task:', error);
=======
import { API_CORE_BASE_URL, authHeaders } from "@/shared/api";
import type { TaskProps } from "../model/types";

const postTaskData = async (taskData: TaskProps) => {
    try {
        const response = await axios.post(`${API_CORE_BASE_URL}/api/tasks`, taskData, {
            headers: authHeaders(),
        });
        console.log('Task posted successfully:', response.data);
        return response.data;
    } catch (error) {
        console.error('Error posting task:', error);
        throw error;
>>>>>>> 678fcbf (separate repository to flownote-service)
    }   
};
export default postTaskData;
