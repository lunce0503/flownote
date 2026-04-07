import axios from "axios";
import { API_BASE_URL2 } from "../../shared/api";
import type { Block } from "@blocknote/core";
import type { BlockDataProps } from "../../widgets/BlogWidget/BlockNote/BlockNote";

const updateNoteData = async (title: string, updatenoteData: BlockDataProps) => {
    try {
        const response = await axios.patch(`
            ${API_BASE_URL2}/api/notes/${title}`
            , updatenoteData
        );
        console.log("updated note:", response.data);
        return response.data;
    } catch (error) {
        console.error('Error updating note:', error);
        throw error;
    }   
};
export default updateNoteData;