import {BrowserRouter, Routes,Route } from 'react-router-dom';
import './App.css';

import Header from '../widgets/header.tsx';
import Magic from './routers/magic/magic.tsx';

import Home from './routers/Home';
import Blog from './routers/Blog/index.tsx';
import Social from './routers/Social/index.tsx';
import TaskRoute from './routers/Task/route.tsx';
import LoginRoute from './routers/Login/route.tsx';
import SignUpRoute from './routers/SignUp/routes.tsx';
import LolBanPickRoute from './routers/LolBanPick/route.tsx';
import CanvasRoute from './routers/Canvas/route.tsx';
import BlogDetail from './routers/BlogDetail/index.tsx';

const App = () => {
  return (
    <div className='App'>
      <div className='w-full'>
        <BrowserRouter>
          <Header />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/magic" element={<Magic />} />
            <Route path="/blog">
              <Route index element={<Blog />} />
              <Route path=":title" element={<BlogDetail />}></Route>
            </Route>
            <Route path="/social" element={<Social />}></Route>
            <Route path="/task" element={<TaskRoute />}></Route>
            <Route path="/login" element={<LoginRoute />}></Route>
            <Route path="/signup" element={<SignUpRoute/>}></Route>
            <Route path="/banpick" element={<LolBanPickRoute />}></Route>
            <Route path="/canvas" element={<CanvasRoute />}></Route>
          </Routes>
        </BrowserRouter>
      </div>
    </div>
  );
};

export default App;
