// Main game engine for the Multiplayer Car Driving Game

import VehicleManager from './modules/vehicle.js';
import CollectiblesManager from './modules/collectibles.js';
import MultiplayerManager from './modules/multiplayer.js';

class GameEngine {
    constructor() {
        // Initialize THREE.js components
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.2, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.loader = new THREE.GLTFLoader();
        this.clock = new THREE.Clock();
        
        // Initialize managers
        this.vehicleManager = new VehicleManager(this.scene, this.loader);
        this.collectiblesManager = new CollectiblesManager(this.scene, this.loader);
        this.multiplayerManager = new MultiplayerManager(this.scene, this.camera);
        
        // Game state
        this.trees = [];
        this.controlsDisabled = false;
        this.controlsDisabledTimeout = null;
        
        // Keyboard controls - moved from prototype to instance property for better initialization
        this.keys = {
            ArrowUp: false,
            ArrowDown: false,
            ArrowLeft: false,
            ArrowRight: false,
            w: false,
            a: false,
            s: false,
            d: false
        };
        
        // Collision parameters
        this.carCollisionRadius = 1.2;
        this.collisionRecoveryTime = 1000;
        this.collisionBounceStrength = 0.5;
        this.treeCollisionBounceStrength = 0.7;
        
        // Audio
        this.audioContext = null;
        this.hornSound = null;
        this.collisionSound = null;
        
        // Setup event listeners for keyboard controls
        this.setupEventListeners();
        
        // Initialize the game
        this.init();
    }
    
    // Initialize the game
    async init() {
        // Setup renderer
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        document.body.appendChild(this.renderer.domElement);
        
        // Set background color
        this.scene.background = new THREE.Color(0x222222);
        
        // Create ground
        this.createGround();
        
        // Create race track
        this.createRaceTrack();
        
        // Add lighting
        this.setupLighting();
        
        // Initialize audio
        this.initAudio();
        
        // Load vehicles data
        await this.vehicleManager.loadVehiclesData();
        
        // Load collectibles data
        await this.collectiblesManager.loadCollectiblesData();
        
        // Add random trees
        this.addRandomTrees();
        
        // Start animation loop
        this.animate();
        
        // Handle window resize
        window.addEventListener('resize', this.onWindowResize.bind(this));
    }
    
    // Setup event listeners
    setupEventListeners() {
        // Keyboard controls - ensure these are bound to this instance
        window.addEventListener('keydown', this.onKeyDown.bind(this));
        window.addEventListener('keyup', this.onKeyUp.bind(this));
        
        // Custom events from other modules
        document.addEventListener('playHorn', this.playHorn.bind(this));
        document.addEventListener('playerCollision', this.handlePlayerCollision.bind(this));
        document.addEventListener('otherPlayerCollectedItem', this.handleOtherPlayerCollectedItem.bind(this));
    }
    
    // Handle window resize
    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
    
    // Create ground
    createGround() {
        const groundGeometry = new THREE.PlaneGeometry(300, 300);
        const groundMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x2a6e2a,
            roughness: 0.8,
            metalness: 0.1
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);
    }
    
    // Create race track
    createRaceTrack() {
        // Track points for a race track with 7 turns
        const trackPath = [
            [-25, -25], // Start point
            [25, -25],  // Straight section
            [30, -15],  // Turn 1
            [15, -5],   // Turn 2
            [20, 15],   // Turn 3
            [0, 25],    // Turn 4
            [-20, 15],  // Turn 5
            [-30, -5],  // Turn 6
            [-25, -25]  // Turn 7 and back to start
        ];
        
        // Create smooth curve from control points
        const curvePoints = [];
        trackPath.forEach(point => {
            curvePoints.push(new THREE.Vector3(point[0], 0, point[1]));
        });
        
        // Create a closed curve that passes through all points
        const curve = new THREE.CatmullRomCurve3(curvePoints);
        curve.closed = true;
        
        // Track properties
        const trackWidth = 10;
        const trackColor = 0x212121; // Dark gray
        
        // Create vertices for a flat ribbon following the curve
        const numPoints = 200;
        const points = curve.getPoints(numPoints);
        const trackGeometry = new THREE.BufferGeometry();
        
        // Create vertices for both sides of the track
        const vertices = [];
        const normals = [];
        const indices = [];
        const uvs = []; // Add UVs for better material rendering
        
        // For each point along the curve
        for (let i = 0; i <= numPoints; i++) {
            const index = i % numPoints; // For closed loop
            const nextIndex = (i + 1) % numPoints;
            
            const currentPoint = points[index];
            const nextPoint = points[nextIndex];
            
            // Calculate the direction vector
            const direction = new THREE.Vector3();
            direction.subVectors(nextPoint, currentPoint).normalize();
            
            // Calculate the perpendicular vector on the horizontal plane
            const perpendicular = new THREE.Vector3(-direction.z, 0, direction.x).normalize();
            
            // Create left and right vertices for the track
            const leftPoint = new THREE.Vector3().copy(currentPoint).addScaledVector(perpendicular, trackWidth/2);
            const rightPoint = new THREE.Vector3().copy(currentPoint).addScaledVector(perpendicular, -trackWidth/2);
            
            // Add vertices - keeping them flat by maintaining the same y value
            vertices.push(leftPoint.x, 0.01, leftPoint.z);  // Left side of track
            vertices.push(rightPoint.x, 0.01, rightPoint.z); // Right side of track
            
            // Add normals (pointing up)
            normals.push(0, 1, 0, 0, 1, 0);
            
            // Add UVs for texturing - map U along track length and V across width
            const uCoord = i / numPoints;
            uvs.push(uCoord, 0);
            uvs.push(uCoord, 1);
            
            // Create triangles (two per track segment)
            if (i < numPoints) {
                const vertIndex = i * 2;
                indices.push(vertIndex, vertIndex + 1, vertIndex + 2); // First triangle
                indices.push(vertIndex + 1, vertIndex + 3, vertIndex + 2); // Second triangle
            }
        }
        
        // Set geometry attributes
        trackGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        trackGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
        trackGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); // Add UVs
        trackGeometry.setIndex(indices);
        trackGeometry.computeBoundingSphere();
        
        // Create track material that responds to light like the ground
        const trackMaterial = new THREE.MeshStandardMaterial({
            color: trackColor,
            roughness: 2,
            metalness: 0.1,
            emissive: 0x000000,
            side: THREE.DoubleSide,
            flatShading: true
        });
        
        // Create the track mesh - flat on the ground
        const track = new THREE.Mesh(trackGeometry, trackMaterial);
        track.receiveShadow = true;
        
        // Ensure the track is slightly above the ground to prevent z-fighting
        track.position.y = 0.02;
        
        this.scene.add(track);
        
        return {
            startPoint: new THREE.Vector3(trackPath[0][0], 0.1, trackPath[0][1])
        };
    }
    
    // Setup lighting
    setupLighting() {
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.85);
        directionalLight.position.set(1, 1, 1).normalize();
        this.scene.add(directionalLight);
        
        const ambientLight = new THREE.AmbientLight(0xFFFFFF, 0.5);
        this.scene.add(ambientLight);
    }
    
    // Initialize audio
    async initAudio() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Load horn sound
            const hornResponse = await fetch('/soundfx/horn.mp3');
            const hornArrayBuffer = await hornResponse.arrayBuffer();
            this.hornSound = await this.audioContext.decodeAudioData(hornArrayBuffer);
            
            // Load collision sound
            const collisionResponse = await fetch('/soundfx/collision.mp3');
            const collisionArrayBuffer = await collisionResponse.arrayBuffer();
            this.collisionSound = await this.audioContext.decodeAudioData(collisionArrayBuffer);
            
        } catch (error) {
            console.error('Error loading audio:', error);
            // Create fallback audio context if fetch fails
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
    }
    
    // Add random trees for obstacles and decoration
    addRandomTrees() {
        console.log('Adding random trees to the scene...');
        
        // Clear existing trees array
        this.trees = [];
        
        // Tree generation parameters
        const treeCount = 20;
        const minDistanceFromTrack = 8;
        const trackWidth = 10;
        const safeDistance = minDistanceFromTrack + trackWidth/2;
        const treePath = 'objects/tree.glb';
        
        // Track points from createRaceTrack function
        const trackPath = [
            [-25, -25], // Start point
            [25, -25],  // Straight section
            [30, -15],  // Turn 1
            [15, -5],   // Turn 2
            [20, 15],   // Turn 3
            [0, 25],    // Turn 4
            [-20, 15],  // Turn 5
            [-30, -5],  // Turn 6
            [-25, -25]  // Turn 7 and back to start
        ];
        
        // Convert track points to Vector3 for distance calculations
        const trackPoints = trackPath.map(point => new THREE.Vector3(point[0], 0, point[1]));
        
        // Function to check if position is too close to track
        const isTooCloseToTrack = (position) => {
            // Check minimum distance to any track segment
            for (let i = 0; i < trackPoints.length - 1; i++) {
                const start = trackPoints[i];
                const end = trackPoints[i + 1];
                
                // Create a line from start to end
                const line = new THREE.Line3(start, end);
                
                // Get closest point on line to position
                const closestPoint = new THREE.Vector3();
                line.closestPointToPoint(position, true, closestPoint);
                
                // Calculate distance to closest point
                const distance = position.distanceTo(closestPoint);
                
                // If too close to any segment, return true
                if (distance < safeDistance) {
                    return true;
                }
            }
            return false;
        };
        
        // Generate and place trees
        let treesPlaced = 0;
        let attempts = 0;
        const maxAttempts = 100; // Limit attempts to prevent infinite loop
        
        while (treesPlaced < treeCount && attempts < maxAttempts) {
            attempts++;
            
            // Generate random position within ground boundaries
            const x = Math.random() * 280 - 140; // -140 to 140
            const z = Math.random() * 280 - 140; // -140 to 140
            
            // Create position vector
            const position = new THREE.Vector3(x, 0, z);
            
            // Skip if too close to track
            if (isTooCloseToTrack(position)) {
                continue;
            }
            
            // Random scale variation
            const scale = 2 + Math.random() * 3; // Scale between 2 and 5
            
            // Load tree model
            this.loader.load(
                treePath,
                (gltf) => {
                    const tree = gltf.scene;
                    
                    // Position the tree
                    tree.position.set(x, 0, z);
                    tree.scale.set(scale, scale, scale);
                    
                    // Random rotation for variety
                    tree.rotation.y = Math.random() * Math.PI * 2;
                    
                    // Add collision data to tree
                    tree.userData.isTree = true;
                    tree.userData.collisionRadius = 1.5 * scale; // Scale-based collision radius
                    
                    // Add to scene
                    this.scene.add(tree);
                    
                    // Add to trees array for collision detection
                    this.trees.push({
                        object: tree,
                        position: new THREE.Vector3(x, 0, z),
                        radius: 0.3 * scale // Reduced collision radius for more accuracy
                    });
                    
                    treesPlaced++;
                },
                undefined,
                (error) => {
                    console.error('Error loading tree model:', error);
                    
                    // Create fallback tree if model fails to load
                    const geometry = new THREE.ConeGeometry(2, 5, 8);
                    const material = new THREE.MeshStandardMaterial({ color: 0x009900 });
                    const cone = new THREE.Mesh(geometry, material);
                    cone.position.set(x, 2.5, z);
                    cone.castShadow = true;
                    this.scene.add(cone);
                    
                    // Add fallback tree to trees array
                    this.trees.push({
                        object: cone,
                        position: new THREE.Vector3(x, 0, z),
                        radius: 1.0 // Reduced fixed collision radius for fallback trees
                    });
                    
                    treesPlaced++;
                }
            );
        }
        
        console.log(`Placed ${treesPlaced} trees after ${attempts} attempts`);
    }
    
    // Key down event handler
    onKeyDown(event) {
        // Check if key is in the keys object before setting its state
        if (event.key in this.keys) {
            this.keys[event.key] = true;
        }
        
        // Toggle headlights with spacebar
        if (event.code === 'Space') {
            this.vehicleManager.toggleHeadlights();
        }
        
        // Sound horn with 'H' key
        if (event.code === 'KeyH') {
            this.playHorn();
            this.multiplayerManager.emitHornSound();
        }
        
        // For debugging only - log to verify key events are being captured
        console.log('Key down:', event.key, this.keys);
    }
    
    // Key up event handler
    onKeyUp(event) {
        // Check if key is in the keys object before setting its state
        if (event.key in this.keys) {
            this.keys[event.key] = false;
        }
        
        // For debugging only - log to verify key events are being captured
        console.log('Key up:', event.key, this.keys);
    }
    
    // Play horn sound
    playHorn() {
        if (this.audioContext && this.hornSound) {
            const source = this.audioContext.createBufferSource();
            source.buffer = this.hornSound;
            source.connect(this.audioContext.destination);
            source.start(0);
        }
    }
    
    // Play collision sound
    playCollisionSound() {
        if (this.audioContext) {
            if (this.collisionSound) {
                const source = this.audioContext.createBufferSource();
                source.buffer = this.collisionSound;
                source.connect(this.audioContext.destination);
                source.start(0);
            } else {
                // Fallback sound
                const oscillator = this.audioContext.createOscillator();
                const gainNode = this.audioContext.createGain();
                
                oscillator.type = 'sawtooth';
                oscillator.frequency.setValueAtTime(100, this.audioContext.currentTime);
                oscillator.frequency.exponentialRampToValueAtTime(30, this.audioContext.currentTime + 0.2);
                
                gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.2);
                
                oscillator.connect(gainNode);
                gainNode.connect(this.audioContext.destination);
                
                oscillator.start();
                oscillator.stop(this.audioContext.currentTime + 0.2);
            }
        }
    }
    
    // Show visual collision effect
    showCollisionEffect() {
        const collisionEffect = document.getElementById('collision-effect');
        
        if (collisionEffect) {
            // Reset animation
            collisionEffect.style.animation = 'none';
            collisionEffect.offsetHeight; // Trigger reflow
            
            // Show and animate
            collisionEffect.style.display = 'block';
            collisionEffect.style.animation = 'flash 0.5s';
            
            // Hide after animation completes
            setTimeout(() => {
                collisionEffect.style.display = 'none';
            }, 500);
        }
    }
    
    // Disable controls temporarily
    disableControls() {
        this.controlsDisabled = true;
        
        // Clear any existing timeout
        if (this.controlsDisabledTimeout) {
            clearTimeout(this.controlsDisabledTimeout);
        }
        
        // Re-enable controls after recovery time
        this.controlsDisabledTimeout = setTimeout(() => {
            this.controlsDisabled = false;
        }, this.collisionRecoveryTime);
    }
    
    // Function to handle player collision event received from server
    handlePlayerCollision(event) {
        const carProperties = this.vehicleManager.getCarProperties();
        const car = carProperties.car;
        
        if (car) {
            // Get the other player's position
            const otherPos = new THREE.Vector3(
                event.detail.position.x,
                event.detail.position.y,
                event.detail.position.z
            );
            
            // Calculate collision response (pushes away from other car)
            const pushDirection = new THREE.Vector3().subVectors(car.position, otherPos).normalize();
            
            // Apply "bounce" force to our car
            car.position.add(pushDirection.multiplyScalar(this.collisionBounceStrength));
            
            // Disable controls
            this.disableControls();
            
            // Play collision sound
            this.playCollisionSound();
            
            // Show visual collision effect
            this.showCollisionEffect();
            
            // Update server with our new position
            this.multiplayerManager.emitPlayerMovement(car);
            
            console.log('Handled collision from server event');
        }
    }
    
    // Check for collisions with trees
    checkTreeCollisions() {
        const carProperties = this.vehicleManager.getCarProperties();
        const car = carProperties.car;
        
        if (!car) return;
        
        // Get player car's position
        const playerPos = car.position.clone();
        
        // Check collision with each tree
        for (const tree of this.trees) {
            const treePos = tree.position;
            
            // Calculate distance between car and tree
            const distance = playerPos.distanceTo(treePos);
            
            // If distance is less than combined radius, we have a collision
            if (distance < (this.carCollisionRadius + tree.radius)) {
                // Handle tree collision
                this.handleTreeCollision(car, treePos);
                
                // Only process one collision at a time
                break;
            }
        }
    }
    
    // Handle collision with a tree
    handleTreeCollision(car, treePos) {
        if (this.controlsDisabled) return; // Already handling a collision
        
        // Calculate collision response (pushes away from tree)
        const pushDirection = new THREE.Vector3().subVectors(car.position, treePos).normalize();
        
        // Apply "bounce" force to the player's car - stronger for trees
        car.position.add(pushDirection.multiplyScalar(this.treeCollisionBounceStrength));
        
        // Disable controls
        this.disableControls();
        
        // Play collision sound
        this.playCollisionSound();
        
        // Show visual collision effect
        this.showCollisionEffect();
        
        // Update server with new position
        this.multiplayerManager.emitPlayerMovement(car);
    }
    
    // Update game state
    update(delta) {
        const carProperties = this.vehicleManager.getCarProperties();
        const car = carProperties.car;
        
        if (car) {
            // Get vehicle-specific characteristics
            const carSpeed = carProperties.speed;
            const turnSpeed = carProperties.handling;
            const acceleration = carProperties.acceleration;
            
            let hasMoved = false;
            
            // For debugging only - log to verify control state
            // console.log('Control state:', this.controlsDisabled, this.keys);
            
            // Only process controls if not disabled from a collision
            if (!this.controlsDisabled) {
                // Forward movement with either W or ArrowUp
                if (this.keys.ArrowUp || this.keys.w) {
                    car.translateZ(carSpeed * acceleration * delta); // Move forward with acceleration
                    hasMoved = true;
                }
                // Backward movement with either S or ArrowDown
                if (this.keys.ArrowDown || this.keys.s) {
                    car.translateZ(-carSpeed * 0.7 * delta); // Move backward (slower than forward)
                    hasMoved = true;
                }
                // Left turn with either A or ArrowLeft
                if (this.keys.ArrowLeft || this.keys.a) {
                    car.rotation.y += turnSpeed * delta; // Turn left
                    hasMoved = true;
                }
                // Right turn with either D or ArrowRight
                if (this.keys.ArrowRight || this.keys.d) {
                    car.rotation.y -= turnSpeed * delta; // Turn right
                    hasMoved = true;
                }
            }
            
            // If car moved, send update to server
            if (hasMoved) {
                this.multiplayerManager.emitPlayerMovement(car);
            }
            
            // Update camera to follow the car
            const cameraOffset = new THREE.Vector3(0, 15, -20); // Position camera above and behind car
            const cameraPosition = new THREE.Vector3().copy(car.position).add(cameraOffset);
            this.camera.position.lerp(cameraPosition, 0.1); // Smooth camera movement
            this.camera.lookAt(car.position.x, 0, car.position.z); // Look at car
            
            // Check for collisions with objects
            this.checkTreeCollisions();
            
            // Check for collisions with other players' cars - this was missing!
            this.checkPlayerCollisions(car);
            
            // Check for collisions with collectibles
            this.collectiblesManager.checkCollisions(car);
        }
        
        // Update other players
        this.multiplayerManager.update();
        
        // Update collectibles (rotation, floating animation)
        this.collectiblesManager.update(delta);
    }
    
    // Animation loop
    animate() {
        requestAnimationFrame(this.animate.bind(this));
        const delta = this.clock.getDelta();
        this.update(delta);
        this.renderer.render(this.scene, this.camera);
    }
    
    // Add this method to check for collisions with other players' cars
    checkPlayerCollisions(car) {
        if (!car || !this.multiplayerManager) return;
        
        const playerPos = car.position.clone();
        const otherPlayers = this.multiplayerManager.getOtherPlayers();
        
        // Check collision with each other player
        for (const id in otherPlayers) {
            const otherPlayer = otherPlayers[id];
            const otherPos = otherPlayer.position.clone();
            
            // Calculate distance between cars
            const distance = playerPos.distanceTo(otherPos);
            
            // If distance is less than the combined collision radius, we have a collision
            if (distance < this.carCollisionRadius * 2) {
                // Handle the collision
                this.handlePlayerCollision(car, otherPos);
                
                // Notify server about collision
                this.multiplayerManager.emitCarCollision(id, car.position);
                
                // Only handle one collision at a time
                break;
            }
        }
    }
    
    // Handle collision between player car and another car
    handlePlayerCollision(car, otherPos) {
        if (this.controlsDisabled) return; // Already handling a collision
        
        // Calculate collision response direction (pushes away from other car)
        const pushDirection = new THREE.Vector3().subVectors(car.position, otherPos).normalize();
        
        // Apply "bounce" force to the player's car
        car.position.add(pushDirection.multiplyScalar(this.collisionBounceStrength));
        
        // Temporarily disable car controls
        this.disableControls();
        
        // Play collision sound
        this.playCollisionSound();
        
        // Show visual collision effect
        this.showCollisionEffect();
    }
    
    // Handle when another player collects an item
    handleOtherPlayerCollectedItem(event) {
        const data = event.detail;
        console.log('Handling other player collectible:', data);
        // Tell collectibles manager to mark this item as collected by remote player
        this.collectiblesManager.markCollected(data.itemId, data.playerId);
    }
}

// Create and start game when DOM content loaded
document.addEventListener('DOMContentLoaded', () => {
    new GameEngine();
});

export default GameEngine; 