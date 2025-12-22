import React from "react";
import home from'../shared/assets/home.png';
import blog from '../shared/assets/blog.png';
import books from '../shared/assets/books.png';

export default function Header() {
    return (
        <>
            <h1>FlowNote</h1>
            <div className="header-hotbar">
                {/* <a href="./">Home</a>
                <a href="./blog">Blog<a>
                <a href="./">Home</a>
                <a href="./">Home</a> */}
                <img src={home} style={{ width: '50px', height: 'auto' }}/>
                <img src={blog} alt="blog-icon" style={{ width: '50px', height: 'auto' }}/>
                <img src={books} alt="books-icon" style={{ width: '50px', height: 'auto' }}/>
            </div>
            <br />
        </>
    );
} 