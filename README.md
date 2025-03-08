# Multiplayer Car Driving Game

A 3D multiplayer car driving game where players can join the same scene, drive around a race track, and interact with each other in real-time.

## Features

- Multiplayer gameplay with real-time synchronization
- Multiple vehicle types with different characteristics
- Player name display and connection status
- Modern 3D graphics with Three.js
- Race track with curves and paths
- Vehicle headlights and dynamic lighting

## Setup

### Prerequisites

- Node.js (v14+ recommended)
- npm or yarn

### Installation

1. Clone the repository or download the files
2. Install dependencies:

```bash
npm install
```

### Running the Game

Start the server:

```bash
npm start
```

The game will be available at http://localhost:3000

## How to Play

1. Open the game URL in your browser
2. Enter your name and click "Join Game"
3. Select a vehicle from the dropdown menu
4. Use the arrow keys to drive:
   - Up Arrow: Accelerate
   - Down Arrow: Reverse
   - Left/Right Arrows: Turn left/right

## Multiplayer Features

- See other players in real-time
- Player names are displayed above vehicles
- Connected player list shows everyone in the game
- Vehicle selection is synchronized between players

## Technology Stack

- **Frontend**: HTML, CSS, JavaScript, Three.js
- **Backend**: Node.js, Express
- **Real-time Communication**: Socket.io

## Extending the Game

- Add more vehicles by updating the vehicles.json file
- Modify the track layout in the createFlatRaceTrack function
- Add game mechanics like collisions, scoring, or racing functionality 