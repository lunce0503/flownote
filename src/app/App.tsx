import React, { useRef, useState } from 'react'
import './App.css'

import Header from '../widgets/header'
import MainContent from '../widgets/mainContent'
import Sidebar from '../widgets/sidebar'
import Magic from './magic/magic'
import { count } from 'console'

function App() {
  

  return (
    <>
      {/* 마법을 그리는 웹 페이지*/}
      <div>
        <Magic />
      </div>

      
      {/* <div className="w-full h-32 p-1 m-10 bg-amber-100 text-neutral-950">
        <Header />
      </div>
      <div className="w-full h-32 p-10 m-10 bg-amber-100 text-neutral-950">
        <MainContent />
      </div>
      <div className="w-full h-32 p-10 m-10 bg-amber-100 text-neutral-950">
        <Sidebar />
      </div> */}
    </>
  )
}

export default App
