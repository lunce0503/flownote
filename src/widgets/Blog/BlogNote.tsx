import React, { useState } from "react";

import BlogBlock from "./BlogBlock"; 
import { DragDropProvider } from "@dnd-kit/react";
import { move } from "@dnd-kit/helpers";
interface BlockPropers {
    id : string;
    index: number;
    type: 'text' | 'image' | 'video' | 'math' | null;
    size: number;
    posion: {x: number, y: number};
    data: string; // text content, image url, video url, latex code etc.
}
interface BlockPropersList extends Array<BlockPropers> {}

const BlogNote = () => {
    const [noteTitle,setNoteTitle] = useState("Blog note"); 
    const [blocks,setBlocks] = useState<BlockPropersList>([
        {id : "0", index: 0, type:'text', size:1, posion:{x: 0, y: 0}, data:'1'},
        {id : "1", index: 1, type:'text', size:1, posion:{x: 0, y: 0}, data:'2'},
        {id : "2", index: 2, type:'text', size:1, posion:{x: 0, y: 0}, data:'3'},
        {id : "3", index: 3, type:'text', size:1, posion:{x: 0, y: 0}, data:'4'},
        {id : "4", index: 4, type:'text', size:1, posion:{x: 0, y: 0}, data:'5'},
        {id : "5", index: 5, type:'text', size:1, posion:{x: 0, y: 0}, data:'6'},
        {id : "6", index: 6, type:'text', size:1, posion:{x: 0, y: 0}, data:'7'},
        {id : "7", index: 7, type:'text', size:1, posion:{x: 0, y: 0}, data:'8'},
        {id : "8", index: 8, type:'text', size:1, posion:{x: 0, y: 0}, data:'9'},
        {id : "9", index: 9, type:'text', size:1, posion:{x: 0, y: 0}, data:'10'},

    ]);

    
    return (
        <div>
            <DragDropProvider
                onDragEnd={(event)=>{
                    setBlocks((blocks) => move(blocks, event))
                }}>


                <div className='note-header'>
                    <div 
                        className="note-header-title"
                        contentEditable={true}
                    >
                        {noteTitle}
                    </div>
                    <div className="note-header-icon"></div>
                </div>


                <div className="note-content" 
                    style={{
                        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, 150px)', 
                        gridAutoRows: 150, gridAutoFlow: 'dense', gap: 18, 
                        padding: '0 30px', maxWidth: 900, marginInline: 'auto',
                        justifyContent: 'center'
                }}>
                    {blocks.map((blocks) =>(
                        <BlogBlock 
                            key={blocks.id}
                            blockProps={blocks}
                            onRemove={()=>{}}
                        />
                ))}
                </div>
                
            </DragDropProvider>
        </div>
    );
}

export default BlogNote;