import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { ScreenshotData } from '@/utils/screenshotUtils';

interface ScreenshotViewerProps {
  screenshot: ScreenshotData | null;
  className?: string;
  mouseCoordinates?: { x: number; y: number } | null;
}

export function ScreenshotViewer({
  screenshot,
  className = '',
  mouseCoordinates = null,
}: ScreenshotViewerProps) {
  const [currentScreenshot, setCurrentScreenshot] = useState(screenshot);
  const [cursorPosition, setCursorPosition] = useState<{ x: number; y: number } | null>(null);
  const [containerDimensions, setContainerDimensions] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    if (screenshot?.id !== currentScreenshot?.id) {
      setCurrentScreenshot(screenshot);
    }
  }, [screenshot, currentScreenshot]);

  useEffect(() => {
    if (mouseCoordinates) {
      setCursorPosition(mouseCoordinates);
    }
  }, [mouseCoordinates]);

  useEffect(() => {
    const updateContainerDimensions = () => {
      const container = document.getElementById('screenshot-container');
      if (container) {
        setContainerDimensions({
          width: container.offsetWidth,
          height: container.offsetHeight,
        });
      }
    };

    updateContainerDimensions();
    window.addEventListener('resize', updateContainerDimensions);
    return () => window.removeEventListener('resize', updateContainerDimensions);
  }, []);

  if (!currentScreenshot) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 ${className}`}>
        <div className="text-center text-gray-500">
          <div className="mb-2 text-4xl">📷</div>
          <p className="text-sm">No screenshots available</p>
          <p className="text-xs mt-1">Screenshots will appear here when the task has run</p>
        </div>
      </div>
    );
  }

  // Calculate the scale factor for cursor position
  let scaledX = 0;
  let scaledY = 0;
  if (containerDimensions && cursorPosition) {
    // The screenshot is 1280x960
    const screenshotWidth = 1280;
    const screenshotHeight = 960;

    // Calculate scale factors
    const scaleX = containerDimensions.width / screenshotWidth;
    const scaleY = containerDimensions.height / screenshotHeight;

    // Apply scaling to cursor position
    scaledX = cursorPosition.x * scaleX;
    scaledY = cursorPosition.y * scaleY;
  }

  return (
    <div
      id="screenshot-container"
      className={`relative overflow-hidden ${className}`}
    >
      <Image
        src={`data:image/png;base64,${currentScreenshot.base64Data}`}
        alt="Task screenshot"
        fill
        className="object-contain"
        priority
      />

      {/* Cursor overlay */}
      {cursorPosition && containerDimensions && (
        <div
          className="absolute pointer-events-none"
          style={{
            left: `${scaledX}px`,
            top: `${scaledY}px`,
            transform: 'translate(-50%, -50%)',
            zIndex: 50,
          }}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="drop-shadow-lg"
          >
            <path
              d="M3 3L10.46 19.46L12.58 12.58L19.46 10.46L3 3Z"
              fill="#FF0000"
              stroke="#FFFFFF"
              strokeWidth="1"
            />
          </svg>
        </div>
      )}
    </div>
  );
}
