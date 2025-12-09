// src/pages/Home.jsx
import Navbar from '../components/Navbar.jsx'

import CarritoOverlay from '../components/CarritoOverlay.jsx'
import React from 'react'
import MenuAcordeon from '../components/home/MenuAcordeon.jsx'
export default function Home() {
  return (
    <>
      <div className="container mt-3">
        <MenuAcordeon />
      </div>
    </>
  )
}
