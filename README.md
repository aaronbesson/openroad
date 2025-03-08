# OpenRoad - Multiplayer 3D Driving Game

A real-time multiplayer car driving and racing game where players can join the same world, drive various vehicles, collect items, and interact with each other.

## Features

- **Multiplayer System**
  - Real-time player synchronization via Socket.io
  - Player name displays and connection status
  - In-game player list showing all active drivers

- **Vehicle System**
  - Multiple vehicle types with unique characteristics
  - Vehicle stats: Speed, Handling, Acceleration, Shield
  - Vehicle selection with 3D preview
  - Special vehicles including aircraft with flying controls

- **Gameplay Features**
  - Collectible coins system with different point values
  - Shield/health system with heart power-ups
  - Vehicle collision detection and physics
  - Headlights toggle and horn sound effects
  - Dynamic race track with curves and elevation changes

- **Graphics & Audio**
  - Modern 3D graphics built with Three.js
  - Responsive dynamic lighting system
  - Custom 3D models for vehicles and objects
  - In-game music player with soundtrack selection
  - Sound effects for vehicle interactions

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

For development with auto-restart:

```bash
npm run dev
```

The game will be available at http://localhost:3000

## How to Play

1. Open the game URL in your browser
2. Enter your name and select a vehicle from the available options
3. Click "Join Game" to start playing

### Standard Vehicle Controls
- **W / Up Arrow**: Accelerate
- **S / Down Arrow**: Brake/Reverse
- **A / Left Arrow**: Turn left
- **D / Right Arrow**: Turn right
- **Space**: Toggle headlights
- **H**: Sound horn

### Aircraft Controls
- **Q**: Fly up
- **E**: Fly down
- **R**: Pitch up (nose up)
- **F**: Pitch down (nose down)
- **Z**: Roll left (bank left)
- **C**: Roll right (bank right)

## Game Mechanics

- **Coins System**: Collect coins scattered throughout the map
  - Bronze coins: 10 points
  - Silver coins: 25 points
  - Gold coins: 50 points
  - Jewels: 100 points
  - Hearts: Restore shield protection

- **Collision System**: Realistic vehicle collisions with physics effects
- **Shield System**: Protects your vehicle from damage
- **Real-Time Synchronization**: All game elements synchronized between players

## Technology Stack

- **Frontend**: HTML, CSS, JavaScript, Three.js
- **Backend**: Node.js, Express
- **Real-time Communication**: Socket.io
- **3D Models**: GLTF/GLB format

## Extending the Game

- Add more vehicles by updating the `vehicles.json` file
- Create new collectibles by modifying `coins.json`
- Add game mechanics or features by extending the modular JavaScript architecture
- Customize the track or environment in the `game.js` file 