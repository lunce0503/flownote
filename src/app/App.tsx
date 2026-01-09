import React, { useRef, useState } from 'react';
import {BrowserRouter, Routes,Route } from 'react-router-dom';
import './App.css';

import Header from '../widgets/header';
import MainContent from '../widgets/mainContent';
import Sidebar from '../widgets/sidebar';
import Magic from './routers/magic/magic.tsx';

import Home from './routers/Home';
import Blog from './routers/Blog/Blog';
import Library from './routers/Library/Library.tsx';
import DndRoot from './routers/Test/DnDRoot.tsx'
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
            <Route path="/library" element={<Library />}></Route>
            <Route path="/test" element={<DndRoot/>}/>
          </Routes>
            
        </BrowserRouter>
      </div>
    </div>
  );
};

export default App;
