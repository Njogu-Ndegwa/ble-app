'use client';

import { useState, useCallback, useEffect, TouchEvent } from 'react';
import Image from 'next/image';

interface OnboardingSlide {
  id: number;
  image: string;
  title: string;
  description: string;
}

const slides: OnboardingSlide[] = [
  {
    id: 0,
    image: '/assets/Attendant.png',
    title: 'Swap Attendant',
    description: 'Process battery swaps quickly and efficiently. Scan batteries, verify customer ownership, and confirm payments in seconds.',
  },
  {
    id: 1,
    image: '/assets/Sales.png',
    title: 'Sales Representative',
    description: 'Register new customers, set up subscription plans, and assign batteries. Grow the network one rider at a time.',
  },
  {
    id: 2,
    image: '/assets/Rider.png',
    title: 'Rider App',
    description: 'Self-service battery swapping for riders. Find nearby stations, check battery status, and swap on the go.',
  },
  {
    id: 3,
    image: '/assets/Keypad.png',
    title: 'Keypad',
    description: 'Enter codes to interact with Oves BLE devices. A universal interface for authentication and device access across the network.',
  },
];

interface OnboardingCarouselProps {
  onComplete: () => void;
}

export default function OnboardingCarousel({ onComplete }: OnboardingCarouselProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [previousSlide, setPreviousSlide] = useState<number | null>(null);
  const [touchStartX, setTouchStartX] = useState(0);
  const totalSlides = slides.length;

  const goToSlide = useCallback((index: number) => {
    if (index === currentSlide) return;
    
    setPreviousSlide(currentSlide);
    
    // Small delay to allow prev class animation
    setTimeout(() => {
      setCurrentSlide(index);
      setPreviousSlide(null);
    }, 50);
  }, [currentSlide]);

  const nextSlide = useCallback(() => {
    if (currentSlide < totalSlides - 1) {
      goToSlide(currentSlide + 1);
    } else {
      // Last slide - finish onboarding
      onComplete();
    }
  }, [currentSlide, totalSlides, goToSlide, onComplete]);

  const handleSkip = useCallback(() => {
    onComplete();
  }, [onComplete]);

  // Touch handlers for swipe support
  const handleTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    setTouchStartX(e.changedTouches[0].screenX);
  };

  const handleTouchEnd = (e: TouchEvent<HTMLDivElement>) => {
    const touchEndX = e.changedTouches[0].screenX;
    const diff = touchStartX - touchEndX;
    
    if (Math.abs(diff) > 50) {
      if (diff > 0 && currentSlide < totalSlides - 1) {
        // Swipe left - next
        goToSlide(currentSlide + 1);
      } else if (diff < 0 && currentSlide > 0) {
        // Swipe right - previous
        goToSlide(currentSlide - 1);
      }
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' && currentSlide < totalSlides - 1) {
        goToSlide(currentSlide + 1);
      } else if (e.key === 'ArrowLeft' && currentSlide > 0) {
        goToSlide(currentSlide - 1);
      } else if (e.key === 'Enter') {
        nextSlide();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentSlide, totalSlides, goToSlide, nextSlide]);

  const isLastSlide = currentSlide === totalSlides - 1;

  return (
    <div className="onboarding-container">
      {/* Header with Logo */}
      <div className="onboarding-header">
        <Image 
          src="/assets/Logo-Oves.png" 
          alt="Oves" 
          width={128}
          height={32}
          className="onboarding-logo"
          priority
        />
      </div>

      {/* Slides */}
      <div 
        className="onboarding-slides"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {slides.map((slide, index) => {
          let slideClass = 'onboarding-slide';
          if (index === currentSlide) {
            slideClass += ' active';
          } else if (index === previousSlide) {
            slideClass += ' prev';
          }

          return (
            <div key={slide.id} className={slideClass} data-slide={index}>
              <div className="onboarding-image">
                <Image 
                  src={slide.image} 
                  alt={slide.title}
                  width={160}
                  height={160}
                  priority={index <= 1}
                />
              </div>
              <div className="onboarding-content">
                <h2 className="onboarding-title">{slide.title}</h2>
                <p className="onboarding-desc">{slide.description}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination Dots */}
      <div className="onboarding-dots">
        {slides.map((_, index) => (
          <div
            key={index}
            className={`onboarding-dot ${index === currentSlide ? 'active' : ''}`}
            onClick={() => goToSlide(index)}
            role="button"
            tabIndex={0}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>

      {/* Actions */}
      <div className="onboarding-actions">
        <button className="onboarding-btn" onClick={nextSlide}>
          <span>{isLastSlide ? 'Get Started' : 'Next'}</span>
          <svg 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          >
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        </button>
      </div>

      {/* Skip Button */}
      <div className="onboarding-skip">
        <button onClick={handleSkip}>Skip intro</button>
      </div>
    </div>
  );
}

