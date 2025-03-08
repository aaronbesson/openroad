// Main game engine for the Multiplayer Car Driving Game

import VehicleManager from './modules/vehicle.js';
import CollectiblesManager from './modules/collectibles.js';
import MultiplayerManager from './modules/multiplayer.js';

class GameEngine {
    constructor() {
        // Make this instance available globally for other modules
        window.gameEngine = this;
        
        // Initialize THREE.js components
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(33, window.innerWidth / window.innerHeight, 0.2, 1000);
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
        this.startLinePosition = null; // Will store the start/finish line position
        this.canResetCar = false; // Prevents reset at game start
        this.offTrackStartTime = null; // Tracks when car went off track
        
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
        
        // Set timeout to allow car resets after 3 seconds
        setTimeout(() => {
            this.canResetCar = true;
        }, 3000);
    }
    
    // Initialize the game
    async init() {
        // Setup renderer
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        
        // Ensure the renderer's canvas has fixed positioning to prevent viewport issues
        this.renderer.domElement.style.position = 'fixed';
        this.renderer.domElement.style.top = '0';
        this.renderer.domElement.style.left = '0';
        this.renderer.domElement.style.width = '100%';
        this.renderer.domElement.style.height = '100%';
        
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
    
    // Handle window resize properly for all players
    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        
        // Ensure renderer maintains fixed position and proper dimensions
        this.renderer.domElement.style.position = 'fixed';
        this.renderer.domElement.style.top = '0';
        this.renderer.domElement.style.left = '0';
        this.renderer.domElement.style.width = '100%';
        this.renderer.domElement.style.height = '100%';
    }
    
    // Create a simple flat ground
    createGround() {
        console.log('Creating a simple flat ground...');
        
        // Simple large flat ground
        const groundSize = 500;
        const groundGeometry = new THREE.PlaneGeometry(groundSize, groundSize);
        const groundMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x2a6e2a,
            roughness: 0.8,
            metalness: 0.1
        });
        
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);
        
        // Add a distant skybox
        this.addSkybox();
    }
    
    // Add a skybox for better atmosphere
    addSkybox() {
        const skyboxSize = 900;
        const skyboxGeometry = new THREE.BoxGeometry(skyboxSize, skyboxSize, skyboxSize);
        
        // Simple gradient skybox materials
        const skyboxMaterials = [];
        
        // Sky color at top
        const topColor = new THREE.Color(0x6699FF);
        // Horizon color
        const bottomColor = new THREE.Color(0xBBDDFF);
        
        // Create materials for each face with gradients
        const directions = ['px', 'nx', 'py', 'ny', 'pz', 'nz'];
        
        for (let i = 0; i < 6; i++) {
            // Create canvas for this face
            const canvas = document.createElement('canvas');
            canvas.width = 512;
            canvas.height = 512;
            const context = canvas.getContext('2d');
            
            // Create gradient
            let gradient;
            
            if (i === 2) { // top face (py)
                gradient = context.createRadialGradient(
                    256, 256, 0,
                    256, 256, 512
                );
                gradient.addColorStop(0, topColor.getStyle());
                gradient.addColorStop(1, bottomColor.getStyle());
            } else if (i === 3) { // bottom face (ny)
                context.fillStyle = '#2a6e2a'; // Ground color
                context.fillRect(0, 0, 512, 512);
                skyboxMaterials.push(new THREE.MeshBasicMaterial({
                    map: new THREE.CanvasTexture(canvas),
                    side: THREE.BackSide
                }));
                continue;
            } else { // side faces
                gradient = context.createLinearGradient(0, 0, 0, 512);
                gradient.addColorStop(0, topColor.getStyle());
                gradient.addColorStop(1, bottomColor.getStyle());
            }
            
            context.fillStyle = gradient;
            context.fillRect(0, 0, 512, 512);
            
            skyboxMaterials.push(new THREE.MeshBasicMaterial({
                map: new THREE.CanvasTexture(canvas),
                side: THREE.BackSide
            }));
        }
        
        const skybox = new THREE.Mesh(skyboxGeometry, skyboxMaterials);
        this.scene.add(skybox);
    }
    
    // Create a flat race track without elevation
    createRaceTrack() {
        console.log('Creating flat race track...');
        
        // Track points with zero elevation (y=0)
        const trackPath = [
            [-60, 0.1, -60],     // Start point
            [60, 0.1, -60],      // Long straight section
            [80, 0.1, -40],      // Turn 1
            [90, 0.1, -10],      // Turn 2
            [80, 0.1, 20],       // Turn 3
            [60, 0.1, 40],       // Turn 4
            [20, 0.1, 60],       // Turn 5
            [-20, 0.1, 70],      // Turn 6
            [-50, 0.1, 60],      // Turn 7
            [-80, 0.1, 40],      // Turn 8
            [-90, 0.1, 10],      // Turn 9
            [-80, 0.1, -20],     // Turn 10
            [-70, 0.1, -40],     // Turn 11
            [-60, 0.1, -60]      // Turn 12 and back to start
        ];
        
        // Create smooth curve from control points
        const curvePoints = [];
        trackPath.forEach(point => {
            curvePoints.push(new THREE.Vector3(point[0], point[1], point[2]));
        });
        
        // Create a closed curve that passes through all points
        const curve = new THREE.CatmullRomCurve3(curvePoints);
        curve.closed = true;
        
        // Track properties
        const trackWidth = 8;  // Wider track
        const trackColor = 0x333333; // Dark gray
        
        // Create vertices for a ribbon following the curve, including elevation
        const numPoints = 300; // Points for smooth curve
        const points = curve.getPoints(numPoints);
        const trackGeometry = new THREE.BufferGeometry();
        
        // Create vertices for both sides of the track
        const vertices = [];
        const normals = [];
        const indices = [];
        const uvs = [];
        
        // For each point along the curve
        for (let i = 0; i <= numPoints; i++) {
            const index = i % numPoints; // For closed loop
            const nextIndex = (i + 1) % numPoints;
            
            const currentPoint = points[index];
            const nextPoint = points[nextIndex];
            
            // Calculate the direction vector
            const direction = new THREE.Vector3();
            direction.subVectors(nextPoint, currentPoint).normalize();
            
            // Calculate the up vector (always straight up)
            const up = new THREE.Vector3(0, 1, 0);
            
            // Calculate the right vector (perpendicular to direction and up)
            const right = new THREE.Vector3().crossVectors(direction, up).normalize();
            
            // Create left and right vertices for the track
            const leftPoint = new THREE.Vector3().copy(currentPoint).addScaledVector(right, trackWidth/2);
            const rightPoint = new THREE.Vector3().copy(currentPoint).addScaledVector(right, -trackWidth/2);
            
            // Add vertices with proper elevation
            vertices.push(leftPoint.x, leftPoint.y, leftPoint.z);  // Left side of track
            vertices.push(rightPoint.x, rightPoint.y, rightPoint.z); // Right side of track
            
            // Add normals pointing up
            normals.push(0, 1, 0);
            normals.push(0, 1, 0);
            
            // Add UVs for texturing
            const uCoord = i / numPoints;
            uvs.push(uCoord, 0);
            uvs.push(uCoord, 1);
            
            // Create triangles
            if (i < numPoints) {
                const vertIndex = i * 2;
                indices.push(vertIndex, vertIndex + 1, vertIndex + 2); // First triangle
                indices.push(vertIndex + 1, vertIndex + 3, vertIndex + 2); // Second triangle
            }
        }
        
        // Set geometry attributes
        trackGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        trackGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
        trackGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        trackGeometry.setIndex(indices);
        trackGeometry.computeBoundingSphere();
        
        // Create track material
        const trackMaterial = new THREE.MeshStandardMaterial({
            color: trackColor,
            roughness: 0.9,
            metalness: 0.2,
            side: THREE.DoubleSide,
            flatShading: true
        });
        
        // Create the track mesh
        const track = new THREE.Mesh(trackGeometry, trackMaterial);
        track.receiveShadow = true;
        track.castShadow = true;
        
        this.scene.add(track);
        
        // Add start/finish line
        const startLinePosition = this.addStartFinishLine(trackPath[0], trackWidth, curve, points);
        
        // Return track info with updated start position
        return {
            startPoint: startLinePosition, // Use the start line position for car spawning
            trackPath: trackPath,
            curve: curve
        };
    }
    
    // Create a start/finish line at the specified track position
    addStartFinishLine(startPoint, trackWidth, curve, trackPoints) {
        // Find the track direction at the straight section
        // We know from trackPath that the first straight section is between points [0] and [1]
        const p1 = new THREE.Vector3(-63.5, 0.1, -63.5); // Start point
        const p2 = new THREE.Vector3(63.5, 0.1, -63.5);  // End of long straight section
        
        // Calculate the middle of the straight section
        const midpoint = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
        
        // Calculate track direction along the straight
        const direction = new THREE.Vector3().subVectors(p2, p1).normalize();
        
        // Calculate the right vector (perpendicular to direction and up)
        const up = new THREE.Vector3(0, 1, 0);
        const right = new THREE.Vector3().crossVectors(direction, up).normalize();
        
        // Create start/finish line dimensions
        const width = 2; // Make it wider than the track
        const length = 8; // Length of the start/finish line
        const height = 0.03; // Slightly raised above the track
        
        // Create a plane for the start/finish line
        const lineGeometry = new THREE.PlaneGeometry(width, length);
        
        // Create solid white material for the line
        const lineMaterial = new THREE.MeshStandardMaterial({
            color: 0xFFFFFF,
            side: THREE.DoubleSide,
            roughness: 0.7,
            metalness: 0.2
        });
        
        // Create mesh
        const line = new THREE.Mesh(lineGeometry, lineMaterial);
        
        // Position at the middle of the straight section
        line.position.copy(midpoint);
        line.position.y += height; // Raise slightly above track
        
        // Rotate to cross the track perpendicularly (90 degrees to track direction)
        // This line should be perpendicular to the track direction
        line.up = new THREE.Vector3(0, 1, 0);
        
        // First align with track direction
        const lookTarget = new THREE.Vector3().copy(midpoint).add(direction);
        line.lookAt(lookTarget);
        
        // Then rotate 90 degrees to be perpendicular to track
        line.rotateY(Math.PI / 2);
        
        // Lay flat on the ground
        line.rotateX(-Math.PI / 2);
        
        // Add to scene
        line.castShadow = true;
        line.receiveShadow = true;
        this.scene.add(line);
        
        // Create START text using TextSprite (simpler than TextGeometry which requires font loading)
        const startTextPosition = new THREE.Vector3().copy(midpoint);
        startTextPosition.y += 5; // Position the text above the line
        
        // Create a canvas for the text
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 512;
        canvas.height = 128;
        
        // Draw the text
        context.fillStyle = '#000000';  // Black background
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        // Save the current state
        context.save();
        
        // Set up a transform that mirrors horizontally
        context.scale(-1, 1);
        context.translate(-canvas.width, 0);
        
        // Draw the text (normally)
        context.font = 'bold 72px Arial';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillStyle = '#FFFFFF';  // White text
        context.fillText('START', canvas.width / 2, canvas.height / 2);
        
        // Restore the original state
        context.restore();
        
        // Create a texture from the canvas
        const texture = new THREE.CanvasTexture(canvas);
        
        // Create a material using the texture
        const textMaterial = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            side: THREE.DoubleSide
        });
        
        // Create a plane for the text
        const textGeometry = new THREE.PlaneGeometry(10, 2.5);  // Adjust size as needed
        const textMesh = new THREE.Mesh(textGeometry, textMaterial);
        
        // Position the text
        textMesh.position.copy(startTextPosition);
        
        // Rotate to face the approaching direction
        textMesh.lookAt(new THREE.Vector3().copy(textMesh.position).add(new THREE.Vector3(1, 0, 0)));
        
        // Add to scene
        this.scene.add(textMesh);
        
        // Save the start/finish line position to the game instance
        this.startLinePosition = new THREE.Vector3(
            midpoint.x, 
            0.5,  // Slightly above the ground for the car
            midpoint.z - 2 // Position the car a few units before the line, facing it
        );
        
        // Return the position where the car should start
        return this.startLinePosition;
    }
    

    // Setup lighting
    setupLighting() {
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.15);
        directionalLight.position.set(1, 1, 1).normalize();
        this.scene.add(directionalLight);
        
        const ambientLight = new THREE.AmbientLight(0xFFFFFF, 0.2);
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
    
    // Add random trees with improved placement
    addRandomTrees() {
        console.log('Adding simple trees to the scene...');
        
        // Clear existing trees array
        this.trees = [];
        
        // Tree generation parameters
        const treeCount = 500;
        const minDistanceFromTrack = 10; // Keep trees further away from track
        const treePath = 'objects/tree.glb';
        
        // Function to check if position is too close to track
        const isTooCloseToTrack = (x, z) => {
            // Simple check - approximate track area
            const trackCenterX = 0;
            const trackCenterZ = 0;
            const trackRadius = 120; // Larger track area to avoid intersections
            
            // Distance from track center
            const distanceFromCenter = Math.sqrt(
                Math.pow(x - trackCenterX, 2) + 
                Math.pow(z - trackCenterZ, 2)
            );
            
            return distanceFromCenter < trackRadius && distanceFromCenter > trackRadius - minDistanceFromTrack;
        };
        
        // Generate and place trees
        let treesPlaced = 0;
        let attempts = 0;
        const maxAttempts = 100;
        
        while (treesPlaced < treeCount && attempts < maxAttempts) {
            attempts++;
            
            // Generate random position
            const x = Math.random() * 400 - 200; // -200 to 200
            const z = Math.random() * 400 - 200; // -200 to 200
            
            // Skip if too close to track
            if (isTooCloseToTrack(x, z)) {
                continue;
            }
            
            // Random scale
            const scale = 2 + Math.random() * 3;
            
            // Load tree model
            this.loader.load(
                treePath,
                (gltf) => {
                    const tree = gltf.scene;
                    
                    // Position tree on ground
                    tree.position.set(x, 0, z);
                    tree.scale.set(scale, scale, scale);
                    tree.rotation.y = Math.random() * Math.PI * 3;
                    
                    this.scene.add(tree);
                    
                    // Add to trees array for collision detection
                    this.trees.push({
                        object: tree,
                        position: new THREE.Vector3(x, 0, z),
                        radius: 0.4 * scale
                    });
                    
                    treesPlaced++;
                },
                undefined,
                (error) => {
                    console.error('Error loading tree model:', error);
                    treesPlaced++; // Skip to next tree
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
            
            // Always adjust car height, even when not moving
            this.adjustCarHeight(car);
            
            // Check if car is on track or off track
            if (this.canResetCar) {
                const isOnTrack = this.isCarOnTrack(car);
                
                if (!isOnTrack) {
                    // Car is off track - start or continue the timer
                    if (this.offTrackStartTime === null) {
                        // First time off track - start the timer
                        this.offTrackStartTime = Date.now();
                        console.log("Car went off track, timer started");
                    } else {
                        // Already off track - check the timer
                        const offTrackDuration = Date.now() - this.offTrackStartTime;
                        
                        // If off track for more than 1 second, reset car
                        if (offTrackDuration > 1000) {
                            console.log("Car off track for 1+ second, resetting to start");
                            this.resetCarToStart(car);
                            this.offTrackStartTime = null; // Reset timer
                            // Ensure position update is sent to server
                            this.multiplayerManager.emitPlayerMovement(car);
                        }
                    }
                } else {
                    // Car is back on track - reset the timer
                    if (this.offTrackStartTime !== null) {
                        console.log("Car back on track, timer reset");
                        this.offTrackStartTime = null;
                    }
                }
            }
            
            // If car moved, send update to server
            if (hasMoved) {
                this.multiplayerManager.emitPlayerMovement(car);
            }
            
            // Improved camera with height offset
            const cameraHeight = 15;
            const cameraDistance = 20;
            
            // Position camera above and behind car
            const cameraOffset = new THREE.Vector3(
                0,
                cameraHeight,
                -cameraDistance
            );
            
            // Calculate desired camera position based on car position and rotation
            const cameraQuat = new THREE.Quaternion().copy(car.quaternion);
            cameraOffset.applyQuaternion(cameraQuat);
            const cameraPosition = new THREE.Vector3().copy(car.position).add(cameraOffset);
            
            // Apply camera position with slight smoothing
            this.camera.position.lerp(cameraPosition, 0.1);
            
            // Look at car with slight height offset for better view
            const lookAtPos = new THREE.Vector3(
                car.position.x,
                car.position.y + 1, // Look slightly above car
                car.position.z
            );
            this.camera.lookAt(lookAtPos);
            
            // Check for collisions with objects
            this.checkTreeCollisions();
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
    
    // Update with improved car height adjustment for smooth transitions
    adjustCarHeight(car) {
        // Updated track data with flattened elevation
        const trackPath = [
            [-60, 0, -60],     // Start point
            [60, 0, -60],      // Long straight section
            [80, 0, -40],      // Turn 1
            [90, 0, -10],      // Turn 2
            [80, 0, 20],       // Turn 3
            [60, 0, 40],       // Turn 4
            [20, 0, 60],       // Turn 5
            [-20, 0, 70],      // Turn 6
            [-50, 0, 60],      // Turn 7
            [-80, 0, 40],      // Turn 8
            [-90, 0, 10],      // Turn 9
            [-80, 0, -20],     // Turn 10
            [-70, 0, -40],     // Turn 11
            [-60, 0, -60]      // Turn 12 and back to start
        ];
        
        // Create a curve for interpolation
        const spline = new THREE.CatmullRomCurve3(
            trackPath.map(p => new THREE.Vector3(p[0], p[1], p[2]))
        );
        spline.closed = true;
        
        // Get car's horizontal position
        const carPos = car.position;
        
        // Find closest point on track
        let minDistance = Infinity;
        let closestY = 0;
        
        // Sample points along the track
        const samples = 100;
        for (let i = 0; i < samples; i++) {
            const t = i / samples;
            const trackPoint = spline.getPointAt(t);
            
            // Calculate horizontal distance only
            const distance = Math.sqrt(
                Math.pow(carPos.x - trackPoint.x, 2) + 
                Math.pow(carPos.z - trackPoint.z, 2)
            );
            
            if (distance < minDistance) {
                minDistance = distance;
                closestY = trackPoint.y;
            }
        }
        
        // Default ground height 
        const groundHeight = 1.0;
        
        // Create a smooth transition between track and ground
        // Higher transition distance for smoother change
        const transitionDistance = 30;
        
        let targetHeight;
        
        if (minDistance < transitionDistance) {
            // Calculate blend factor (0 to 1) for smooth transition
            const blendFactor = Math.max(0, minDistance / transitionDistance);
            
            // Blend between track height and ground height
            // Significantly increased car offset to 2.0 to ensure headlights are above track
            const trackHeight = closestY; // Higher track height with increased car offset
            targetHeight = trackHeight * (1 - blendFactor) + groundHeight * blendFactor;
        } else {
            // Off track - use ground height
            targetHeight = groundHeight;
        }
        
        // Smooth the transition even more with lerp
        car.position.y = car.position.y * 0.9 + targetHeight * 0.1;
    }
    
    // Reset car to the start position
    resetCarToStart(car) {
        // Use coordinates that exactly match the track path to avoid off-track detection
        const p1 = new THREE.Vector3(-60, 0.1, -60); // Match exact track path start point
        const p2 = new THREE.Vector3(60, 0.1, -60);  // Match exact track path straight section
        
        // Calculate the middle of the straight section (this is where the start/finish line is)
        const midpoint = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
        
        // Position slightly above ground to avoid clipping
        midpoint.y = 0.5;
        
        // Reset to start position at the middle of the straight section
        car.position.copy(midpoint);
        
        // Rotate 90 degrees CCW to face along the track (toward the first turn)
        car.rotation.set(0, Math.PI/2, 0);
        
        // Disable track checking for a longer time (3 seconds) to prevent restart loops
        this.canResetCar = false;
        console.log("Car reset - disabling off-track detection temporarily");
        
        setTimeout(() => {
            this.canResetCar = true;
            console.log("Off-track detection re-enabled after reset");
        }, 3000);
        
        // Clear the off-track timer immediately to prevent loop
        this.offTrackStartTime = null;
        
        // Visual feedback
        this.showResetEffect();
    }
    
    // Visual effect for car reset
    showResetEffect() {
        // Create a quick flash effect
        const flash = document.createElement('div');
        flash.style.position = 'fixed';
        flash.style.top = '0';
        flash.style.left = '0';
        flash.style.width = '100%';
        flash.style.height = '100%';
        flash.style.backgroundColor = 'rgba(255, 255, 255, 0.3)';
        flash.style.pointerEvents = 'none';
        flash.style.transition = 'opacity 0.5s';
        flash.style.zIndex = '1000';
        
        document.body.appendChild(flash);
        
        // Fade out and remove
        setTimeout(() => {
            flash.style.opacity = '0';
            setTimeout(() => {
                document.body.removeChild(flash);
            }, 500);
        }, 100);
    }
    
    // Check if the car is on the track
    isCarOnTrack(car) {
        // Track points with zero elevation
        const trackPath = [
            [-60, 0.1, -60],     // Start point
            [60, 0.1, -60],      // Long straight section
            [80, 0.1, -40],      // Turn 1
            [90, 0.1, -10],      // Turn 2
            [80, 0.1, 20],       // Turn 3
            [60, 0.1, 40],       // Turn 4
            [20, 0.1, 60],       // Turn 5
            [-20, 0.1, 70],      // Turn 6
            [-50, 0.1, 60],      // Turn 7
            [-80, 0.1, 40],      // Turn 8
            [-90, 0.1, 10],      // Turn 9
            [-80, 0.1, -20],     // Turn 10
            [-70, 0.1, -40],     // Turn 11
            [-60, 0.1, -60]      // Turn 12 and back to start
        ];
        
        // Create curve for distance calculation
        const curvePoints = [];
        trackPath.forEach(point => {
            curvePoints.push(new THREE.Vector3(point[0], point[1], point[2]));
        });
        const curve = new THREE.CatmullRomCurve3(curvePoints);
        curve.closed = true;
        
        // Track width plus margin
        const trackWidth = 8;
        const trackMargin = 1.5;
        const maxDistanceFromTrack = trackWidth/2 + trackMargin;
        
        // Get closest point on track to car
        const carPosition = new THREE.Vector3(car.position.x, 0.1, car.position.z);
        let minDistance = Infinity;
        const numSamples = 100;
        
        for (let i = 0; i < numSamples; i++) {
            const t = i / numSamples;
            const pointOnCurve = curve.getPoint(t);
            const distance = carPosition.distanceTo(pointOnCurve);
            if (distance < minDistance) {
                minDistance = distance;
            }
        }
        
        // Return true if on track, false if off-track
        return minDistance <= maxDistanceFromTrack;
    }
}

// Create and start game when DOM content loaded
document.addEventListener('DOMContentLoaded', () => {
    new GameEngine();
});

export default GameEngine; 