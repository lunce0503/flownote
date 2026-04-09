import "@blocknote/core/fonts/inter.css";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import { useCreateBlockNote } from "@blocknote/react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Block } from "@blocknote/core";
import postNoteData from "../../../entities/blog/postNoteData";
import { v4 as uuidv4 } from "uuid";
import { useParams } from "react-router-dom";
import getNoteData from "../../../entities/blog/getNoteData";

interface BlockDataProps {
  id: string;
  title: string;
  content: Block[];
  created_at: Date;
}

const  BlockNote = () => {
  const { title } = useParams<{title:string}>();
  const editor = useCreateBlockNote();
  const [noteData,setNoteData] = useState<BlockDataProps | null>(null);
  const [isLoading,setIsLoading] = useState<boolean>(true);
  
  // 1. 페이지 진입 시 데이터 로드 로직
  useEffect(() => {
    const fetchData = async () => {
      if (title) {
        const decodedTitle = decodeURIComponent(title);
        try {
          setIsLoading(true);
          // 실제 환경에서는 여기서 API 호출을 합니다.
          // const data = await getNoteByTitle(decodedTitle);
          const data: BlockDataProps[] = await getNoteData();
          const targetData = data.find((note)=>note.title===decodedTitle)
          if (targetData){
            setNoteData(targetData);

          // 데이터에 내용(Block)이 있다면 에디터에 주입
            if (targetData.content.length > 0) {
              editor.replaceBlocks(editor.document, targetData.content);
            } else {
              setNoteData(null);
            }
          
          }
        } catch (error) {
          console.error("Failed to fetch note:", error);
        } finally {
          setIsLoading(false); // 로딩 해제 (이게 있어야 화면이 뜹니다!)
        }
      }
    };
    fetchData();
  }, [title, editor]);

  const handleTitle = (title:string) => {
    if (!noteData) return;
    setNoteData({
      ...noteData, 
      title: title
    }); 
  }


  const handleNoteData = () => {
    if (!noteData) return;
    const current = editor.document;
    const blockData : BlockDataProps= {
      ...noteData,
      content : current,
      created_at: new Date()
    } 
    postNoteData(blockData)
  }

  if (isLoading) return <div className="p-10 text-center text-stone-500">노트를 불러오는 중...</div>;
  if (!noteData) return <div className="p-10 text-center text-stone-500">노트를 찾을 수 없습니다.</div>;
  
  return (
    <div className="my-5 mx-1 bg-white rounded-xl p-4">
      <div className='note-header mb-2 bg-amber-100 text-stone-800 rounded-xl p-1'>
        <input 
          type="text" 
          className=" m-1 text-2xl"
          value={noteData && noteData.title}
          onChange={(e) => {handleTitle(e.target.value);}}
          placeholder="Title"
        />
      </div>
      
      <BlockNoteView 
        editor={editor} 
        onChange={handleNoteData}
        theme="light"
      />
      
    </div>
  );
}

export default BlockNote;
export type {BlockDataProps};