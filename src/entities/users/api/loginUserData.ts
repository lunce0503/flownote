import axios from "axios";
<<<<<<< HEAD
import { API_BASE_URL2 } from "../../../shared/api";
=======
import { API_CORE_BASE_URL } from "@/shared/api";
>>>>>>> 678fcbf (separate repository to flownote-service)

interface LoginUserData {
  email: string;
  password: string;
}

interface LoginUserResponse {
  token: string;
  user: {
    id: string;
    username: string;
    email: string;
    nickname: string;
  };
}

const loginUserData = async (loginData: LoginUserData): Promise<LoginUserResponse> => {
<<<<<<< HEAD
  const response = await axios.post(`${API_BASE_URL2}/api/users/login`, loginData);
=======
  const response = await axios.post(`${API_CORE_BASE_URL}/api/users/login`, loginData);
>>>>>>> 678fcbf (separate repository to flownote-service)
  return response.data;
};

export default loginUserData;
