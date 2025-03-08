// Multiplayer module - handles socket.io connections and player synchronization

class MultiplayerManager {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        this.socket = null;
        this.playerID = null;
        this.playerName = "Player";
        this.otherPlayers = {};
        this.otherPlayersData = {};
        this.nameLabels = {};
        this.otherPlayersHeadlights = {};
        this.connected = false;
        
        // Update rate limiting
        this.lastUpdateTime = 0;
        this.updateInterval = 100; // Send updates every 100ms
        
        // DOM Elements
        this.playerList = document.getElementById('player-list');
        this.playerCount = document.getElementById('player-count');
        this.connectionScreen = document.getElementById('connection-screen');
        this.joinButton = document.getElementById('join-button');
        this.playerNameInput = document.getElementById('player-name');
        
        // Bind event listeners
        if (this.joinButton) {
            this.joinButton.addEventListener('click', this.connectToServer.bind(this));
        }
        
        if (this.playerNameInput) {
            this.playerNameInput.addEventListener('keyup', (e) => {
                if (e.key === 'Enter') {
                    this.connectToServer();
                }
            });
        }
        
        // Setup custom event listeners
        document.addEventListener('carLoaded', this.onCarLoaded.bind(this));
        document.addEventListener('vehicleChanged', this.onVehicleChanged.bind(this));
        document.addEventListener('headlightsToggled', this.onHeadlightsToggled.bind(this));
        document.addEventListener('collectibleCollected', this.onCollectibleCollected.bind(this));
    }
    
    // Connect to socket.io server
    connectToServer() {
        this.playerName = this.playerNameInput.value || "Player";
        
        if (this.connectionScreen) {
            this.connectionScreen.style.display = 'none';
        }
        
        // Initialize Socket.io connection
        this.socket = io();
        
        // Setup socket connection event handlers
        this.setupSocketHandlers();
    }
    
    // Setup all socket event handlers
    setupSocketHandlers() {
        if (!this.socket) return;
        
        this.socket.on('connect', () => {
            this.playerID = this.socket.id;
            this.connected = true;
            console.log('Connected to server with ID:', this.playerID);
        });
        
        // When we receive the current players list
        this.socket.on('currentPlayers', (players) => {
            Object.keys(players).forEach((id) => {
                // Add all players except ourself
                if (id !== this.playerID) {
                    this.addOtherPlayer(players[id]);
                }
            });
            this.updatePlayerList();
        });
        
        // When a new player joins
        this.socket.on('newPlayer', (playerInfo) => {
            this.addOtherPlayer(playerInfo);
            this.updatePlayerList();
        });
        
        // When a player moves
        this.socket.on('playerMoved', (moveData) => {
            if (this.otherPlayers[moveData.id]) {
                // Smoothly move the player
                const player = this.otherPlayers[moveData.id];
                
                // Create target position and rotation
                const targetPos = new THREE.Vector3(
                    moveData.position.x,
                    moveData.position.y,
                    moveData.position.z
                );
                
                // Store target values for interpolation
                player.targetPosition = targetPos;
                player.targetRotation = { y: moveData.rotation.y };
                
                // Update the name label position
                this.updateNameLabel(moveData.id);
            }
        });
        
        // When a player changes vehicle
        this.socket.on('playerVehicleChanged', (changeData) => {
            if (this.otherPlayers[changeData.id]) {
                // Remove the old vehicle
                this.scene.remove(this.otherPlayers[changeData.id]);
                
                // Clean up headlights
                if (this.otherPlayersHeadlights[changeData.id]) {
                    delete this.otherPlayersHeadlights[changeData.id];
                }
                
                // Load the new vehicle
                const playerData = this.otherPlayersData[changeData.id];
                playerData.vehicleId = changeData.vehicleId;
                
                this.loadOtherPlayerCar(changeData.id, playerData);
                this.updatePlayerList();
            }
        });
        
        // When a player toggles headlights
        this.socket.on('headlightsToggled', (data) => {
            if (this.otherPlayers[data.id] && this.otherPlayersHeadlights[data.id]) {
                // Toggle the visibility of the other player's headlights
                this.otherPlayersHeadlights[data.id].forEach(light => {
                    light.visible = data.headlightsOn;
                });
            }
        });
        
        // When a player honks their horn
        this.socket.on('playerHornSound', (data) => {
            if (this.otherPlayers[data.id]) {
                // Play horn sound for another player
                const event = new CustomEvent('playHorn');
                document.dispatchEvent(event);
            }
        });
        
        // When another player collides with you
        this.socket.on('playerCollidedWithYou', (data) => {
            const event = new CustomEvent('playerCollision', { 
                detail: { 
                    playerId: data.id,
                    position: data.position
                } 
            });
            document.dispatchEvent(event);
        });
        
        // When two other players collide (for visual and sound effects)
        this.socket.on('playersCollided', (data) => {
            if (this.otherPlayers[data.player1] && this.otherPlayers[data.player2]) {
                const event = new CustomEvent('otherPlayersCollision');
                document.dispatchEvent(event);
            }
        });
        
        // When a player shares a collectible update
        this.socket.on('playerCollectedItem', (data) => {
            // Dispatch event to handle collectible sync in main game
            const event = new CustomEvent('otherPlayerCollectedItem', {
                detail: data
            });
            document.dispatchEvent(event);
        });
        
        // When a player leaves
        this.socket.on('playerLeft', (id) => {
            if (this.otherPlayers[id]) {
                // Remove their car
                this.scene.remove(this.otherPlayers[id]);
                delete this.otherPlayers[id];
                
                // Clean up headlights
                if (this.otherPlayersHeadlights[id]) {
                    delete this.otherPlayersHeadlights[id];
                }
                
                // Remove their data
                delete this.otherPlayersData[id];
                
                // Remove their name label
                if (this.nameLabels[id]) {
                    document.body.removeChild(this.nameLabels[id]);
                    delete this.nameLabels[id];
                }
                
                this.updatePlayerList();
            }
        });
        
        this.socket.on('disconnect', () => {
            console.log('Disconnected from server');
            this.connected = false;
            
            // Clear other players
            Object.keys(this.otherPlayers).forEach(id => {
                this.scene.remove(this.otherPlayers[id]);
                
                // Clean up headlights
                if (this.otherPlayersHeadlights[id]) {
                    delete this.otherPlayersHeadlights[id];
                }
                
                if (this.nameLabels[id]) {
                    document.body.removeChild(this.nameLabels[id]);
                }
            });
            
            this.otherPlayers = {};
            this.otherPlayersData = {};
            this.nameLabels = {};
            this.otherPlayersHeadlights = {};
            
            this.updatePlayerList();
            
            // Show connection screen again so user can reconnect
            if (this.connectionScreen) {
                this.connectionScreen.style.display = 'flex';
            }
        });
    }
    
    // Handle when local player's car is loaded
    onCarLoaded(event) {
        if (this.socket && this.socket.connected && this.playerID) {
            const carData = event.detail;
            
            this.joinGame(carData);
        }
    }
    
    // Handle when local player changes vehicle
    onVehicleChanged(event) {
        if (this.socket && this.socket.connected) {
            const vehicleId = event.detail.vehicleId;
            this.socket.emit('vehicleChange', { vehicleId: vehicleId });
        }
    }
    
    // Handle when local player toggles headlights
    onHeadlightsToggled(event) {
        if (this.socket && this.socket.connected) {
            const headlightsOn = event.detail.headlightsOn;
            this.socket.emit('headlightsToggle', { headlightsOn });
        }
    }
    
    // Handle when local player collects an item
    onCollectibleCollected(event) {
        if (this.socket && this.socket.connected) {
            const collectibleData = event.detail.collectible;
            
            // Send only necessary data to avoid bandwidth issues
            this.socket.emit('collectItem', {
                itemId: collectibleData.id,
                itemType: collectibleData.type,
                score: event.detail.score
            });
        }
    }
    
    // Join the game after car is loaded
    joinGame(carData) {
        // Get car position and rotation
        const position = carData.position;
        const rotation = carData.rotation;
        
        // Join as a player
        this.socket.emit('playerJoin', {
            vehicleId: carData.vehicleId || this.getSelectedVehicleId(),
            position: { x: position.x, y: position.y, z: position.z },
            rotation: { y: rotation.y },
            playerName: this.playerName
        });
    }
    
    // Get the currently selected vehicle ID
    getSelectedVehicleId() {
        const selectElement = document.getElementById('vehicle-select');
        return selectElement ? selectElement.value : '';
    }
    
    // Add another player to the game
    addOtherPlayer(playerInfo) {
        // Store player data
        this.otherPlayersData[playerInfo.id] = playerInfo;
        
        // Load their car
        this.loadOtherPlayerCar(playerInfo.id, playerInfo);
        
        // Create name label
        this.createNameLabel(playerInfo.id, playerInfo.playerName);
    }
    
    // Load another player's car
    loadOtherPlayerCar(playerId, playerInfo) {
        const loader = new THREE.GLTFLoader();
        
        // First, try to find the vehicle in the main game's vehicle data
        const vehicleSelect = document.getElementById('vehicle-select');
        let vehicleId = playerInfo.vehicleId;
        let modelFile = '';
        
        // If we have access to the select element, find the model file
        if (vehicleSelect) {
            // Try to get the option with the matching value
            const option = Array.from(vehicleSelect.options).find(opt => opt.value === vehicleId);
            
            if (option) {
                // This is a bit of a hack - we're assuming the option value (ID) matches the start of the filename
                modelFile = vehicleId + '.glb';
            } else {
                console.error('Could not find vehicle model for ID:', vehicleId);
                return;
            }
        } else {
            // Fallback to a default model if we can't determine it
            modelFile = 'default_car.glb';
        }
        
        loader.load(
            'models/' + modelFile,
            (gltf) => {
                const car = gltf.scene;
                
                // Position at player's location
                car.position.set(
                    playerInfo.position.x,
                    playerInfo.position.y,
                    playerInfo.position.z
                );
                
                car.rotation.y = playerInfo.rotation.y;
                
                // Store reference to this player's car
                this.otherPlayers[playerId] = car;
                
                // Add the car to the scene
                this.scene.add(car);
                
                // Add headlights to other player's car
                this.addHeadlightsToOtherPlayer(car, playerId);
                
                // Update the name label
                this.updateNameLabel(playerId);
                
                console.log(`Loaded other player ${playerInfo.playerName} at position:`, 
                    playerInfo.position.x.toFixed(2), 
                    playerInfo.position.y.toFixed(2), 
                    playerInfo.position.z.toFixed(2),
                    'Rotation:', playerInfo.rotation.y.toFixed(2));
            },
            undefined,
            (error) => {
                console.error('Error loading other player model:', error);
            }
        );
    }
    
    // Add headlights to other players' cars
    addHeadlightsToOtherPlayer(car, playerId) {
        // Create array to store this player's headlights
        this.otherPlayersHeadlights[playerId] = [];
        
        // Get player data
        const playerData = this.otherPlayersData[playerId];
        const initialHeadlightState = playerData.headlightsOn !== undefined ? playerData.headlightsOn : true;
        
        // Create headlight parameters - similar to the player's headlights but less intense
        const headlightColor = 0xffffcc; // Warm white color
        const headlightIntensity = 4; // Reduced intensity for other players
        const headlightDistance = 50; // Reduced distance for other players
        const headlightAngle = Math.PI / 6;
        const headlightPenumbra = 0.3;
        const headlightDecay = 1.5;
        
        // Adjustable headlight position parameters
        const headlightOffsetX = 0.275;  // Distance from center (left/right)
        const headlightOffsetY = 0.39;   // Height from car
        const headlightOffsetZ = 1.2;    // Forward position from car center
        const headlightTargetZ = 50;     // How far forward the light points
        
        // Create left headlight
        const leftHeadlight = new THREE.SpotLight(
            headlightColor, 
            headlightIntensity,
            headlightDistance,
            headlightAngle,
            headlightPenumbra,
            headlightDecay
        );
        
        // Position left headlight relative to car
        leftHeadlight.position.set(headlightOffsetX, headlightOffsetY, headlightOffsetZ);
        leftHeadlight.castShadow = false; // Disable shadow casting for performance
        car.add(leftHeadlight);
        leftHeadlight.target.position.set(0, 0, headlightTargetZ); // Point forward
        car.add(leftHeadlight.target);
        
        // Create right headlight
        const rightHeadlight = new THREE.SpotLight(
            headlightColor, 
            headlightIntensity,
            headlightDistance,
            headlightAngle,
            headlightPenumbra,
            headlightDecay
        );
        
        // Position right headlight relative to car
        rightHeadlight.position.set(-headlightOffsetX, headlightOffsetY, headlightOffsetZ);
        rightHeadlight.castShadow = false; // Disable shadow casting for performance
        car.add(rightHeadlight);
        rightHeadlight.target.position.set(0, 0, headlightTargetZ); // Point forward
        car.add(rightHeadlight.target);
        
        // Store headlights for cleanup later
        this.otherPlayersHeadlights[playerId].push(leftHeadlight, rightHeadlight);
        
        // Add visible headlight objects
        const headlightGeometry = new THREE.SphereGeometry(0.2, 16, 16);
        const headlightMaterial = new THREE.MeshBasicMaterial({ 
            color: headlightColor, 
            emissive: headlightColor,
            emissiveIntensity: 2
        });
        
        const leftHeadlightMesh = new THREE.Mesh(headlightGeometry, headlightMaterial);
        leftHeadlightMesh.position.copy(leftHeadlight.position);
        car.add(leftHeadlightMesh);
        
        const rightHeadlightMesh = new THREE.Mesh(headlightGeometry, headlightMaterial);
        rightHeadlightMesh.position.copy(rightHeadlight.position);
        car.add(rightHeadlightMesh);
        
        // Set initial visibility based on player's headlight state
        leftHeadlight.visible = initialHeadlightState;
        rightHeadlight.visible = initialHeadlightState;
    }
    
    // Create a name label for another player
    createNameLabel(playerId, name) {
        const label = document.createElement('div');
        label.className = 'player-name';
        label.textContent = name;
        document.body.appendChild(label);
        
        this.nameLabels[playerId] = label;
        
        // Position the label
        this.updateNameLabel(playerId);
    }
    
    // Update the position of a player's name label
    updateNameLabel(playerId) {
        if (!this.nameLabels[playerId] || !this.otherPlayers[playerId]) return;
        
        // Get screen position for the player's car
        const position = new THREE.Vector3();
        position.setFromMatrixPosition(this.otherPlayers[playerId].matrixWorld);
        position.y += 1.5; // Position above the car
        
        // Convert 3D position to screen coordinates
        const screenPosition = position.clone();
        screenPosition.project(this.camera);
        
        // Convert to CSS coordinates
        const x = (screenPosition.x * 0.5 + 0.5) * window.innerWidth;
        const y = (-(screenPosition.y * 0.5) + 0.5) * window.innerHeight;
        
        // Update label position
        this.nameLabels[playerId].style.left = x + 'px';
        this.nameLabels[playerId].style.top = y + 'px';
        
        // Only show if in front of camera
        if (screenPosition.z > 1) {
            this.nameLabels[playerId].style.display = 'none';
        } else {
            this.nameLabels[playerId].style.display = 'block';
        }
    }
    
    // Update the player list UI
    updatePlayerList() {
        if (!this.playerList || !this.playerCount) return;
        
        // Clear current list
        this.playerList.innerHTML = '';
        
        // Add self
        const selfItem = document.createElement('div');
        selfItem.className = 'player-item';
        selfItem.textContent = this.playerName + ' (You)';
        this.playerList.appendChild(selfItem);
        
        // Add other players
        Object.keys(this.otherPlayersData).forEach(id => {
            const playerData = this.otherPlayersData[id];
            const playerItem = document.createElement('div');
            playerItem.className = 'player-item';
            playerItem.textContent = playerData.playerName;
            this.playerList.appendChild(playerItem);
        });
        
        // Update count
        const count = 1 + Object.keys(this.otherPlayersData).length;
        this.playerCount.textContent = count;
    }
    
    // Update other players (called in animation loop)
    update() {
        // Update other players (interpolate movement)
        for (const id in this.otherPlayers) {
            const player = this.otherPlayers[id];
            
            if (player.targetPosition) {
                // Interpolate position for smooth movement
                player.position.lerp(player.targetPosition, 0.1);
                
                // Interpolate rotation
                if (player.targetRotation) {
                    // Find shortest path for rotation
                    let targetY = player.targetRotation.y;
                    let currentY = player.rotation.y;
                    
                    // Calculate the difference
                    let diff = targetY - currentY;
                    
                    // Normalize to [-PI, PI]
                    if (diff > Math.PI) diff -= 2 * Math.PI;
                    if (diff < -Math.PI) diff += 2 * Math.PI;
                    
                    // Apply a portion of the rotation
                    player.rotation.y += diff * 0.1;
                }
                
                // Update name label position
                this.updateNameLabel(id);
            }
        }
    }
    
    // Send player movement to server
    emitPlayerMovement(car) {
        if (!this.socket || !this.socket.connected || !car) return;
        
        const currentTime = Date.now();
        if (currentTime - this.lastUpdateTime > this.updateInterval) {
            this.socket.emit('playerMovement', {
                position: {
                    x: car.position.x,
                    y: car.position.y,
                    z: car.position.z
                },
                rotation: {
                    y: car.rotation.y
                }
            });
            this.lastUpdateTime = currentTime;
        }
    }
    
    // Notify server about collision
    emitCarCollision(otherPlayerId, position) {
        if (!this.socket || !this.socket.connected) return;
        
        this.socket.emit('carCollision', { 
            collidedWithId: otherPlayerId,
            position: {
                x: position.x,
                y: position.y,
                z: position.z
            }
        });
    }
    
    // Emit horn sound
    emitHornSound() {
        if (!this.socket || !this.socket.connected) return;
        
        this.socket.emit('hornSound', {});
    }
}

export default MultiplayerManager; 