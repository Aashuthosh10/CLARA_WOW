import React, { useState, useEffect, useRef } from 'react';
import { Location } from './locationsDatabase';
import './MapNavigator.css';

interface MapNavigatorProps {
  locationData: Location | null;
  destinationPoint?: { x: number; y: number } | null;
  currentFloor?: number;
  onFloorChange?: (floor: number) => void;
  onClose?: () => void;
}

const RECEPTION_POINT = { x: 120, y: 350 }; // Reception coordinates (ground floor)

const MapNavigator: React.FC<MapNavigatorProps> = ({
  locationData,
  destinationPoint,
  currentFloor = 0,
  onFloorChange,
  onClose
}) => {
  const [animationStep, setAnimationStep] = useState(0);
  const [pathPoints, setPathPoints] = useState<Array<{ x: number; y: number }>>([]);
  const svgRef = useRef<SVGSVGElement>(null);
  const [floor, setFloor] = useState(currentFloor);

  useEffect(() => {
    if (locationData) {
      setFloor(locationData.floor);
      if (onFloorChange) {
        onFloorChange(locationData.floor);
      }
    }
  }, [locationData, onFloorChange]);

  useEffect(() => {
    if (destinationPoint && floor === (locationData?.floor ?? 0)) {
      const path = calculatePath(destinationPoint, floor);
      setPathPoints(path);
      setAnimationStep(0);
      animatePath(path);
    } else {
      setPathPoints([]);
      setAnimationStep(0);
    }
  }, [destinationPoint, floor, locationData]);

  const calculatePath = (destination: { x: number; y: number }, floorNum: number): Array<{ x: number; y: number }> => {
    // Start from reception (ground floor) or adjust if on different floor
    const startPoint = floorNum === 0 ? RECEPTION_POINT : { x: 320, y: 280 }; // Stair location for upper floors
    
    // Simple pathfinding - create a path with waypoints
    const midX = (startPoint.x + destination.x) / 2;
    const midY = (startPoint.y + destination.y) / 2;
    
    return [
      startPoint,
      { x: midX, y: startPoint.y },
      { x: midX, y: midY },
      { x: destination.x, y: midY },
      destination
    ];
  };

  const animatePath = (path: Array<{ x: number; y: number }>) => {
    let step = 0;
    const interval = setInterval(() => {
      if (step < path.length) {
        setAnimationStep(step);
        step++;
      } else {
        clearInterval(interval);
      }
    }, 400);
  };

  const handleFloorChange = (floorNum: number) => {
    setFloor(floorNum);
    if (onFloorChange) {
      onFloorChange(floorNum);
    }
  };

  const floorNames = ['Ground Floor', 'First Floor', 'Second Floor'];

  return (
    <div className="map-navigator">
      {onClose && (
        <button className="map-close-button" onClick={onClose} aria-label="Close map">
          ✕
        </button>
      )}
      
      <div className="floor-selector">
        {[0, 1, 2].map((floorNum) => (
          <button
            key={floorNum}
            className={`floor-button ${floor === floorNum ? 'active' : ''}`}
            onClick={() => handleFloorChange(floorNum)}
          >
            {floorNames[floorNum]}
          </button>
        ))}
      </div>

      <div className="map-container">
        <svg
          ref={svgRef}
          width="600"
          height="500"
          viewBox="0 0 600 500"
          className="map-svg"
        >
          {/* Background grid */}
          <defs>
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e5e7eb" strokeWidth="0.5"/>
            </pattern>
          </defs>
          <rect width="600" height="500" fill="url(#grid)" opacity="0.3" />

          {/* Animated path */}
          {pathPoints.slice(0, animationStep + 1).map((point, index) => (
            <React.Fragment key={index}>
              {index > 0 && (
                <line
                  x1={pathPoints[index - 1].x}
                  y1={pathPoints[index - 1].y}
                  x2={point.x}
                  y2={point.y}
                  stroke="#4CAF50"
                  strokeWidth="4"
                  strokeLinecap="round"
                  className="path-line"
                  markerEnd="url(#arrowhead)"
                />
              )}
              <circle
                cx={point.x}
                cy={point.y}
                r="8"
                fill={index === animationStep ? "#4CAF50" : "#81C784"}
                className="path-point"
              />
            </React.Fragment>
          ))}

          {/* Arrow marker definition */}
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="10"
              refX="9"
              refY="3"
              orient="auto"
            >
              <polygon points="0 0, 10 3, 0 6" fill="#4CAF50" />
            </marker>
          </defs>

          {/* Destination marker */}
          {destinationPoint && floor === (locationData?.floor ?? 0) && (
            <>
              <circle
                cx={destinationPoint.x}
                cy={destinationPoint.y}
                r="20"
                fill="none"
                stroke="#F44336"
                strokeWidth="3"
                className="destination-pulse"
              />
              <g transform={`translate(${destinationPoint.x}, ${destinationPoint.y - 25})`}>
                <path
                  d="M 0 0 L -10 10 L -5 10 L -5 20 L 5 20 L 5 10 L 10 10 Z"
                  fill="#F44336"
                  className="destination-marker"
                />
              </g>
              {locationData && (
                <text
                  x={destinationPoint.x}
                  y={destinationPoint.y - 35}
                  textAnchor="middle"
                  fontSize="12"
                  fill="#F44336"
                  fontWeight="bold"
                  className="destination-label"
                >
                  {locationData.name}
                </text>
              )}
            </>
          )}

          {/* "You are here" marker (reception) */}
          {floor === 0 && (
            <g transform={`translate(${RECEPTION_POINT.x}, ${RECEPTION_POINT.y})`}>
              <circle cx="0" cy="0" r="15" fill="#2196F3" opacity="0.3" className="reception-pulse" />
              <circle cx="0" cy="0" r="8" fill="#2196F3" />
              <text x="0" y="25" textAnchor="middle" fontSize="11" fill="#2196F3" fontWeight="600">
                You are here
              </text>
            </g>
          )}

          {/* Stair/Lift markers for upper floors */}
          {floor !== 0 && (
            <g transform={`translate(320, 280)`}>
              <rect x="-15" y="-15" width="30" height="30" fill="#FF9800" opacity="0.7" rx="4" />
              <text x="0" y="5" textAnchor="middle" fontSize="10" fill="white" fontWeight="bold">
                {floor === 1 ? 'Stairs' : 'Lift'}
              </text>
            </g>
          )}
        </svg>

        {locationData && (
          <div className="location-info">
            <h3>{locationData.name}</h3>
            {locationData.room_number && (
              <p className="room-number">Room {locationData.room_number}</p>
            )}
            <p className="floor-info">{locationData.floor_name}</p>
            <p className="description">{locationData.description}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MapNavigator;

