import type { BlockNoteEditor } from "@blocknote/core";
import "@blocknote/core/fonts/inter.css";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import { useCreateBlockNote } from "@blocknote/react";
import { useRef, useState } from "react";
import type { Block } from "@blocknote/core";
import postNoteData from "../../../features/BlogFeatures/postNoteData";
import { v4 as uuidv4 } from "uuid";
interface BlockDataProps {
  id: string;
  title: string;
  content: Block[];
  created_at: Date;
}
const  BlockNote = () => {

  const editor = useCreateBlockNote();
  const [block,setBlock] = useState<Block[]>([]);
  const [noteTitle,setNoteTitle] = useState<string>("Title");
  const titleRef = useRef<HTMLDivElement>(null);

  const handleTitle = () => {
    if (titleRef.current) setNoteTitle(titleRef.current?.innerText);
    console.log(noteTitle);
  }

  const handleNoteData = () => {
    const current = editor.document;
    setBlock(current);
    const blockData : BlockDataProps= {
      id : uuidv4(),
      title : noteTitle,
      content : block,
      created_at: new Date()
    } 
    postNoteData(blockData)
    console.log(block);
  }
  return (
    <div className="my-5 mx-1">
      <div className='note-header mb-2 bg-[#1f1f1f] p-1'>
        <div 
          className="note-header-title m-1 text-2xl"
          contentEditable={true}
          suppressContentEditableWarning={true}
          ref={titleRef}
          onInput={handleTitle}
        >
          {noteTitle}
        </div>
      </div>
      
      <BlockNoteView editor={editor} 
        onChange={handleNoteData}/>
      
    </div>
  );
}

export default BlockNote;
export type {BlockDataProps};