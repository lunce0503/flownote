import React, { useRef, useState } from 'react';
import {BrowserRouter, Routes,Route } from 'react-router-dom';
import './App.css';

import Header from '../widgets/header.tsx';
import MainContent from '../widgets/Blog/mainContent';
import Sidebar from '../widgets/Blog/sidebar';
import Magic from './routers/magic/magic.tsx';

import Home from './routers/Home';
import Blog from './routers/Blog/index.tsx';
import Library from './routers/Library/index.tsx';

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
          </Routes>
        </BrowserRouter>
      </div>
    </div>
  );
};

export default App;
