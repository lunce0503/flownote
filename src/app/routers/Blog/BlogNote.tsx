import React, { useState } from "react";

import BlogBlock from "./BlogBlock"; 

// 블로그 노트
// 여기서 노트는 블로그의 글을 편집하는 곳을 의미
const BlogNote = () => {
    const [noteTitle,setNoteTitle] = useState("Blog note"); 
    
    return (
        <div>
            <div className='note-header'>
                <div className="note-header-title">{noteTitle}</div>
                <div className="note-header-icon"></div>
            </div>
            <div className='note-content'>
                {/* 페이지안에 들어갈 내용 */}
                <BlogBlock />
                {/* 페이지 번호 컨트롤러 */}
            </div>
        </div>
    );
}

export default BlogNote;