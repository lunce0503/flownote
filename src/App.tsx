import React, { useState } from 'react'
import './App.css'

import Header from './widgets/header'
import MainContent from './widgets/mainContent'
import Sidebar from './widgets/sidebar'
function App() {

  return (
    <>
      <div className="header">
        <Header />
      </div>
      <div className="main-content">
        <MainContent />
      </div>
      <div className="sidebar">
        <Sidebar />
      </div>
    </>
  )
}

export default App
