import React, { useRef, useState } from 'react';
import {BrowserRouter, Routes,Route } from 'react-router-dom';
import './App.css';

import Header from '../widgets/header';
import MainContent from '../widgets/mainContent';
import Sidebar from '../widgets/sidebar';
import Magic from './routers/magic/magic';

import Home from './routers/Home';
import Blog from './routers/Blog/Blog';
import Books from './routers/Libary/Books';
// import { GoogleGenAI } from "@google/genai";

// const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
// const ai = new GoogleGenAI({apiKey: API_KEY});

// async function main() {
//   const response = await ai.models.generateContent({
//     model: "gemini-2.5-flash",
//     contents: "오늘은 무엇을 할까?",
//   });
//   console.log(response.text);
// }

// main();

const App = () => {
  return (
    <div className='App'>
      <div className='w-full'>
        <BrowserRouter>
          <Header />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/magic" element={<Magic />} />
            <Route path="/blog" element={<Blog />}></Route>
            {/* <Route path="/books" element={<Books />}></Route> */}
          </Routes>
            
        </BrowserRouter>
      </div>
    </div>
  );
};

export default App;
