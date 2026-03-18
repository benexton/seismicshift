import React, { useState, useEffect } from 'react'

const BRAND = '#17638f'

const rollingWords = {
  infrastructure: ['warehouse.', 'factory.', 'power plant.'],
  residential:    ['home.', 'nest egg.', 'sanctuary.'],
  assets:         ['data centre.', 'medical equipment.', 'emergency systems.'],
}

export default function RollingWord({ category }) {
  const words = rollingWords[category]
  const [index, setIndex] = useState(0)
  const [visible, setVisible] = useState(true)

  useEffect(() => { setIndex(0); setVisible(true) }, [category])
  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false)
      setTimeout(() => { setIndex(i => (i + 1) % words.length); setVisible(true) }, 350)
    }, 3300)
    return () => clearInterval(interval)
  }, [category, words.length])

  return (
    <span
      className="inline-block"
      style={{
        color: BRAND,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(8px)',
        transition: 'opacity 0.35s ease, transform 0.35s ease',
      }}
    >
      {words[index]}
    </span>
  )
}
