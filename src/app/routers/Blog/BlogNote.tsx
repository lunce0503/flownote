import React, { useState } from "react";

import BlogBlock from "./BlogBlock"; 

// 블로그 노트
// 여기서 노트는 블로그의 글을 편집하는 곳을 의미
const BlogNote = () => {
    const [noteTitle,setNoteTitle] = useState("Blog note"); 
    const [blocks,setBlocks] = useState([
        {id : 0, type:'text', size:1, posion:{x: 0, y: 0}, data:'dddd'},
        {id : 1, type:'text', size:1, posion:{x: 0, y: 0}, data:'h'},
        {id : 2, type:'text', size:1, posion:{x: 0, y: 0}, data:''},
        {id : 3, type:'text', size:1, posion:{x: 0, y: 0}, data:''},
        
    ])

    return (
        <div>
            <div className='note-header'>
                <div 
                    className="note-header-title"
                    contentEditable={true}
                >
                    {noteTitle}
                </div>
                <div className="note-header-icon"></div>
            </div>
            <div className='note-content flex'>
                {/* 페이지안에 들어갈 내용 */}
                {blocks.map((props) =>(
                    <BlogBlock 
                        key={props.id}
                        Props={props}
                        onRemove={()=>{}}
                    />
                ))}
                
                {/* 페이지 번호 컨트롤러 */}
            </div>
        </div>
    );
}

export default BlogNote;