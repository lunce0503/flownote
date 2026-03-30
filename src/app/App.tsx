import {BrowserRouter, Routes,Route } from 'react-router-dom';
import './App.css';

import Header from '../widgets/header.tsx';
import Magic from './routers/magic/magic.tsx';

import Home from './routers/Home';
import Blog from './routers/Blog/index.tsx';
import Social from './routers/Social/index.tsx';
import TaskRoute from './routers/Task/route.tsx';

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
            <Route path="/social" element={<Social />}></Route>
            <Route path="/task" element={<TaskRoute />}></Route>
          </Routes>
        </BrowserRouter>
      </div>
    </div>
  );
};

export default App;
