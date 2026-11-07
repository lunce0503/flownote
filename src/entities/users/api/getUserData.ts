import axios from "axios";
<<<<<<< HEAD
import { API_BASE_URL2 } from "../../../shared/api";

const getUserData = async () => {
    try {
            const response = await axios.get(`${API_BASE_URL2}/api/users`);
=======
import { API_CORE_BASE_URL } from "@/shared/api";

const getUserData = async () => {
    try {
            const response = await axios.get(`${API_CORE_BASE_URL}/api/users`);
>>>>>>> 678fcbf (separate repository to flownote-service)
            console.log("Fetched users:", response.data);
            return response.data;
        } catch (error) {
            console.error("Error fetching users:", error);
            return [];
        }
};

<<<<<<< HEAD
export default getUserData;
=======
export default getUserData;
>>>>>>> 678fcbf (separate repository to flownote-service)
