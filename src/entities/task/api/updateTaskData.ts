import axios from "axios";
<<<<<<< HEAD
import { API_BASE_URL2, authHeaders } from "../../../shared/api";
import type { TaskProps } from "../../../widgets/TaskWidget/TaskEliment";
=======
import { API_CORE_BASE_URL, authHeaders } from "@/shared/api";
import type { TaskProps } from "../model/types";
>>>>>>> 678fcbf (separate repository to flownote-service)

// 1. 수정할 데이터를 인자(updateData)로 받도록 수정
const updateTaskData = async (id: string, updateData: Partial<TaskProps>) => {
    try {
        // 2. axios.patch의 두 번째 인자로 데이터를 전달합니다.
        const response = await axios.patch(
<<<<<<< HEAD
            `${API_BASE_URL2}/api/tasks/${id}`, 
=======
            `${API_CORE_BASE_URL}/api/tasks/${id}`, 
>>>>>>> 678fcbf (separate repository to flownote-service)
            updateData,
            { headers: authHeaders() }
        );
        
        console.log("updated task:", response.data);
        return response.data;
<<<<<<< HEAD
    } catch (error: any) {
        // 상세한 에러 로그 확인
        console.error("Error updating tasks:", error.response?.data || error.message);
=======
    } catch (error: unknown) {
        const detail = axios.isAxiosError(error) ? error.response?.data ?? error.message : error;
        console.error("Error updating tasks:", detail);
>>>>>>> 678fcbf (separate repository to flownote-service)
        throw error;
    }
};

export default updateTaskData;
