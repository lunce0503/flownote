import axios from "axios";
<<<<<<< HEAD
import { API_BASE_URL2 } from "../../../shared/api";
import type { UserDataProps } from "../../../widgets/SignUpWidget";

const postUserData = async (userData : UserDataProps) => {
    try {
        const response = await axios.post(`${API_BASE_URL2}/api/users`, userData);
        console.log('User data posted successfully:', response.data);
    } catch (error) {
        console.error('Error posting user data:', error);
    }  
};

export default postUserData;
=======
import { API_CORE_BASE_URL } from "@/shared/api";
import type { UserDataProps } from "../model/types";

const postUserData = async (userData : UserDataProps) => {
    if (!API_CORE_BASE_URL) {
        throw new Error("사용자 API 기본 URL이 설정되지 않았습니다.");
    }
    const response = await axios.post(`${API_CORE_BASE_URL}/api/users`, userData);
    return response.data;
};

export default postUserData;
>>>>>>> 678fcbf (separate repository to flownote-service)
