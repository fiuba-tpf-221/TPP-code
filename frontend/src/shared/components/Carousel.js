import React, { useEffect, useState } from 'react';
import './carousel.css';

// slides: [{ id, title, text, art?: <JSX/SVG>, image?: '/images/foto.jpg', alt? }]
// Ocupa todo su contenedor (el padre debe tener position: relative y alto).
export default function Carousel({ slides, interval = 6000, label }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (paused || reduced || slides.length < 2) return undefined;
    const id = setInterval(() => setIndex((i) => (i + 1) % slides.length), interval);
    return () => clearInterval(id);
  }, [paused, reduced, slides.length, interval, index]);

  return (
    <section className="carousel" aria-roledescription="carousel" aria-label={label}
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
      {slides.map((s, i) => (
        <div key={s.id} className={`carousel__slide${i === index ? ' is-active' : ''}`}
          role="group" aria-roledescription="slide" aria-label={`${i + 1} de ${slides.length}`}
          aria-hidden={i !== index}>
          <div className="carousel__art">
            {s.image ? <img src={s.image} alt={s.alt || ''} /> : s.art}
          </div>
          <div className="carousel__caption">
            <h2>{s.title}</h2>
            <p>{s.text}</p>
          </div>
        </div>
      ))}
      <div className="carousel__dots">
        {slides.map((s, i) => (
          <button key={s.id} type="button" className="carousel__dot"
            aria-label={`Ir a: ${s.title}`} aria-current={i === index} onClick={() => setIndex(i)} />
        ))}
      </div>
    </section>
  );
}
