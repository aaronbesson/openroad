// Vehicle module - handles vehicle loading, selection, and stats

class VehicleManager {
    constructor(scene, loader) {
        this.scene = scene;
        this.loader = loader;
        this.vehiclesData = [];
        this.currentVehicleData = null;
        this.currentCar = null;
        this.headlights = [];
        this.headlightsOn = true;
        
        // Preview-related properties
        this.previewScene = null;
        this.previewCamera = null;
        this.previewRenderer = null;
        this.previewCar = null;
        this.previewAnimationId = null;
        
        // Trail-related properties
        this.planeTrails = []; // Store plane trail particle systems
        
        // DOM Elements
        this.selectElement = document.getElementById('vehicle-select');
        this.speedBar = document.getElementById('speed-bar');
        this.handlingBar = document.getElementById('handling-bar');
        this.accelerationBar = document.getElementById('acceleration-bar');
        this.shieldBar = document.getElementById('shield-bar');
        this.descriptionElement = document.getElementById('description');
        this.previewContainer = document.getElementById('vehicle-preview');
        
        // Bind event listeners
        if (this.selectElement) {
            this.selectElement.addEventListener('change', this.onVehicleChange.bind(this));
        }
        
        // Listen for custom events
        document.addEventListener('checkCarLoaded', this.onCheckCarLoaded.bind(this));
        
        // Initialize preview if container exists
        if (this.previewContainer) {
            this.initPreview();
        }
    }
    
    // Check if car is loaded (used by multiplayer to check status)
    onCheckCarLoaded() {
        if (this.currentCar) {
            // Car is already loaded, dispatch carLoaded event
            const event = new CustomEvent('carLoaded', { 
                detail: { 
                    car: this.currentCar,
                    position: this.currentCar.position,
                    rotation: { y: this.currentCar.rotation.y },
                    vehicleId: this.currentVehicleData ? this.currentVehicleData.id : null
                } 
            });
            document.dispatchEvent(event);
        }
    }
    
    // Load vehicles data from JSON
    async loadVehiclesData() {
        try {
            console.log('Loading vehicles data...');
            const response = await fetch('vehicles.json');
            const data = await response.json();
            this.vehiclesData = data.vehicles;
            
            console.log('Loaded vehicles:', this.vehiclesData);
            
            // Clear loading option
            if (this.selectElement) {
                this.selectElement.innerHTML = '';
                
                // Add options for each vehicle
                this.vehiclesData.forEach(vehicle => {
                    const option = document.createElement('option');
                    option.value = vehicle.id;
                    option.textContent = vehicle.name;
                    this.selectElement.appendChild(option);
                });
                
                // Load the first vehicle by default
                if (this.vehiclesData.length > 0) {
                    this.selectElement.value = this.vehiclesData[0].id;
                    this.updateVehicleStats(this.vehiclesData[0]);
                    this.loadCar(this.vehiclesData[0].file, false); // Don't emit events yet
                    this.loadPreviewCar(this.vehiclesData[0].file); // Load preview model
                }
            }
            
            return this.vehiclesData;
        } catch (error) {
            console.error('Error loading vehicles data:', error);
            return [];
        }
    }
    
    // Handle vehicle selection change
    onVehicleChange(e) {
        const selectedId = e.target.value;
        console.log('Vehicle changed to:', selectedId);
        const selectedVehicle = this.vehiclesData.find(vehicle => vehicle.id === selectedId);
        if (selectedVehicle) {
            this.loadCar(selectedVehicle.file);
            this.loadPreviewCar(selectedVehicle.file);
        }
    }
    
    // Update vehicle stats display
    updateVehicleStats(vehicle) {
        if (!this.speedBar || !this.handlingBar || !this.accelerationBar || !this.shieldBar) {
            console.warn('Some vehicle stat elements not found');
            return;
        }
        
        this.speedBar.style.width = (vehicle.speed * 10) + '%';
        this.handlingBar.style.width = (vehicle.handling * 10) + '%';
        this.accelerationBar.style.width = (vehicle.acceleration * 10) + '%';
        this.shieldBar.style.width = (vehicle.shield * 10) + '%';
        
        if (this.descriptionElement) {
            this.descriptionElement.textContent = vehicle.description;
        }
    }
    
    // Load car model
    loadCar(modelFile, emitEvents = true, spawnPoint = null) {
        console.log('Loading car model:', modelFile);
        
        // Find the vehicle data
        const vehicle = this.vehiclesData.find(v => v.file === modelFile);
        if (vehicle) {
            this.currentVehicleData = vehicle;
            this.updateVehicleStats(vehicle);
            
            // Emit event for vehicle change, but only if emitEvents is true
            if (emitEvents) {
                const event = new CustomEvent('vehicleChanged', { 
                    detail: { vehicleId: vehicle.id } 
                });
                document.dispatchEvent(event);
                console.log('Dispatched vehicleChanged event:', vehicle.id);
            }
        } else {
            console.warn('Could not find vehicle data for:', modelFile);
        }
        
        // Remove previous car and its headlights
        if (this.currentCar) {
            this.scene.remove(this.currentCar);
            this.headlights.forEach(light => {
                if (light.parent) {
                    light.parent.remove(light);
                }
            });
            this.headlights = [];
            
            // Remove any existing plane trails
            this.removePlaneTrails();
        }
        
        // If no spawn point provided, generate a random one
        if (!spawnPoint) {
            // Check if this is the airplane to spawn it higher
            const isAirplane = vehicle && vehicle.id === 'airplane';
            spawnPoint = this.getRandomSpawnPoint(isAirplane);
        }
        
        // Check if this is the airplane
        const isAirplane = vehicle && vehicle.id === 'airplane';
        
        this.loader.load(
            'models/' + modelFile,
            (gltf) => {
                if (isAirplane) {
                    // For airplane, create a container to handle rotation properly
                    const container = new THREE.Group();
                    
                    // Add the loaded model to the container
                    container.add(gltf.scene);
                    
                    // Set the container as our current car
                    this.currentCar = container;
                    
                    // Position container at spawn point
                    container.position.copy(spawnPoint.position);
                    container.rotation.y = spawnPoint.rotation;
                    
                    // Rotate the airplane model inside the container
                    // Using a large value to ensure rotation is noticeable
                    gltf.scene.rotation.y = - Math.PI / 2; // 180 degrees
                    
                    console.log("AIRPLANE LOADED - Applied rotation to model in container");
                    
                    // Add trails to the airplane
                    this.addPlaneTrails(container);
                } else {
                    // For normal vehicles
                    this.currentCar = gltf.scene;
                    
                    // Position car at spawn point
                    this.currentCar.position.copy(spawnPoint.position);
                    this.currentCar.rotation.y = spawnPoint.rotation;
                }
                
                this.scene.add(this.currentCar);
                
                // Add headlights to the car
                this.addHeadlights();
                
                // Emit event for car loaded, but only if emitEvents is true
                if (emitEvents) {
                    const event = new CustomEvent('carLoaded', { 
                        detail: { 
                            car: this.currentCar,
                            position: spawnPoint.position,
                            rotation: { y: spawnPoint.rotation },
                            vehicleId: this.currentVehicleData ? this.currentVehicleData.id : null
                        } 
                    });
                    document.dispatchEvent(event);
                    console.log('Dispatched carLoaded event');
                }
            },
            (progress) => {
                // Optional progress callback
                console.log(`Loading progress: ${Math.round(progress.loaded / progress.total * 100)}%`);
            },
            (error) => {
                console.error('Error loading model:', error);
            }
        );
    }
    
    // Add headlights to the car
    addHeadlights() {
        if (!this.currentCar) return;
        
        // Create headlight parameters
        const headlightColor = 0xffffcc; // Warm white color
        const headlightIntensity = 8;
        const headlightDistance = 100;
        const headlightAngle = Math.PI / 6;
        const headlightPenumbra = 0.3;
        const headlightDecay = 1.5;
        
        // Adjustable headlight position parameters
        const headlightOffsetX = 0.275;
        const headlightOffsetY = 0.39;
        const headlightOffsetZ = 1.2;
        const headlightTargetZ = 100;
        
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
        leftHeadlight.castShadow = true;
        this.currentCar.add(leftHeadlight);
        leftHeadlight.target.position.set(0, 0, headlightTargetZ);
        this.currentCar.add(leftHeadlight.target);
        
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
        rightHeadlight.castShadow = true;
        this.currentCar.add(rightHeadlight);
        rightHeadlight.target.position.set(0, 0, headlightTargetZ);
        this.currentCar.add(rightHeadlight.target);
        
        // Store headlights for later reference
        this.headlights.push(leftHeadlight, rightHeadlight);
        
        // Add visible headlight objects
        const headlightGeometry = new THREE.SphereGeometry(0.2, 16, 16);
        const headlightMaterial = new THREE.MeshBasicMaterial({ 
            color: headlightColor, 
            emissive: headlightColor,
            emissiveIntensity: 2
        });
        
        const leftHeadlightMesh = new THREE.Mesh(headlightGeometry, headlightMaterial);
        leftHeadlightMesh.position.copy(leftHeadlight.position);
        this.currentCar.add(leftHeadlightMesh);
        
        const rightHeadlightMesh = new THREE.Mesh(headlightGeometry, headlightMaterial);
        rightHeadlightMesh.position.copy(rightHeadlight.position);
        this.currentCar.add(rightHeadlightMesh);
    }
    
    // Toggle headlights
    toggleHeadlights() {
        this.headlightsOn = !this.headlightsOn;
        
        if (this.headlights.length > 0) {
            this.headlights.forEach(light => {
                light.visible = this.headlightsOn;
            });
        }
        
        // Emit event for headlights toggled
        const event = new CustomEvent('headlightsToggled', { 
            detail: { headlightsOn: this.headlightsOn } 
        });
        document.dispatchEvent(event);
        console.log('Dispatched headlightsToggled event:', this.headlightsOn);
        
        return this.headlightsOn;
    }
    
    // Get a random spawn point on the map
    getRandomSpawnPoint(isAirplane = false) {
        // Get starting position
        let position;
        let rotation;
        
        // Check if we have a specific start line position from the game
        if (window.gameEngine && window.gameEngine.startLinePosition) {
            // Use the start line position which is set in the GameEngine
            position = window.gameEngine.startLinePosition.clone();
            rotation = Math.PI / 2; // Vehicle faces 90 degrees counter-clockwise (left) from the Z axis
        } else {
            // Fallback to random position if no start line defined
            const mapSize = 100;
            const padding = 15;
            
            // Random position within the map boundaries
            const randomX = (Math.random() * (mapSize - 2 * padding)) - (mapSize / 2 - padding);
            const randomZ = (Math.random() * (mapSize - 2 * padding)) - (mapSize / 2 - padding);
            
            // Random rotation (facing any direction)
            rotation = Math.random() * Math.PI * 2;
            
            position = new THREE.Vector3(randomX, 0.1, randomZ);
        }
        
        // If this is the airplane, set its Y position higher for flying
        if (isAirplane) {
            position.y = 30; // Start the airplane high in the air
        }
        
        return {
            position: position,
            rotation: rotation
        };
    }
    
    // Get current car properties
    getCarProperties() {
        return {
            car: this.currentCar,
            speed: this.currentVehicleData ? this.currentVehicleData.speed * 2 : 10,
            handling: this.currentVehicleData ? this.currentVehicleData.handling * 0.3 : 0.3,
            acceleration: this.currentVehicleData ? this.currentVehicleData.acceleration * 0.1 : 0.1,
            shield: this.currentVehicleData ? this.currentVehicleData.shield : 0,
            vehicleId: this.currentVehicleData ? this.currentVehicleData.id : null
        };
    }
    
    // Initialize 3D preview container
    initPreview() {
        // Create a new scene for the preview
        this.previewScene = new THREE.Scene();
        
        // Set background to #222
        this.previewScene.background = new THREE.Color(0x222222);
        
        // Create camera
        this.previewCamera = new THREE.PerspectiveCamera(25, this.previewContainer.clientWidth / this.previewContainer.clientHeight, 0.1, 100);
        this.previewCamera.position.set(0, 2, 4);
        this.previewCamera.lookAt(0, 0.5, 0);
        
        // Create renderer with alpha enabled for transparency
        this.previewRenderer = new THREE.WebGLRenderer({ 
            antialias: true,
            alpha: true
        });
        this.previewRenderer.setSize(this.previewContainer.clientWidth, this.previewContainer.clientHeight);
        this.previewRenderer.setPixelRatio(window.devicePixelRatio);
        this.previewRenderer.shadowMap.enabled = true;
        this.previewRenderer.setClearColor(0x000000, 0); // Transparent background
        
        // Add renderer to DOM
        this.previewContainer.appendChild(this.previewRenderer.domElement);
        
        // Add lights to preview scene
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
        this.previewScene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(5, 5, 5);
        directionalLight.castShadow = true;
        this.previewScene.add(directionalLight);
        
        const pointLight = new THREE.PointLight(0xffffff, 1);
        pointLight.position.set(-5, 3, -5);
        this.previewScene.add(pointLight);
        

        
        // Start animation loop
        this.animatePreview();
        
        // Handle window resize
        window.addEventListener('resize', this.onPreviewResize.bind(this));
    }
    
    // Handle preview container resize
    onPreviewResize() {
        if (!this.previewContainer || !this.previewCamera || !this.previewRenderer) return;
        
        this.previewCamera.aspect = this.previewContainer.clientWidth / this.previewContainer.clientHeight;
        this.previewCamera.updateProjectionMatrix();
        this.previewRenderer.setSize(this.previewContainer.clientWidth, this.previewContainer.clientHeight);
    }
    
    // Load car model for preview
    loadPreviewCar(modelFile) {
        if (!this.previewScene || !this.loader) return;
        
        // Remove previous preview car if exists
        if (this.previewCar) {
            this.previewScene.remove(this.previewCar);
            this.previewCar = null;
        }
        
        // Check if this is the airplane model
        const isAirplane = modelFile === 'airplane.glb';
        
        this.loader.load(
            'models/' + modelFile,
            (gltf) => {
                if (isAirplane) {
                    // For airplane, create a container to handle rotation properly
                    const container = new THREE.Group();
                    
                    // Clone the loaded model and add to container
                    const model = gltf.scene.clone();
                    container.add(model);
                    
                    // Set the preview car to the container
                    this.previewCar = container;
                    
                    // Scale the container for better visibility
                    const box = new THREE.Box3().setFromObject(model);
                    const size = box.getSize(new THREE.Vector3()).length();
                    const scale = 2.5 / size;
                    container.scale.set(scale, scale, scale);
                    
                    // Center the container
                    container.position.y = 0.05; // Slight lift from ground
                    
                    // Rotate the airplane model inside the container
                    model.rotation.y = Math.PI; // 180 degrees
                    
                    console.log("AIRPLANE PREVIEW LOADED - Applied rotation to model in container");
                } else {
                    // For normal vehicles
                    this.previewCar = gltf.scene.clone();
                    
                    // Scale and position the car for better visibility
                    const box = new THREE.Box3().setFromObject(this.previewCar);
                    const size = box.getSize(new THREE.Vector3()).length();
                    const scale = 2.5 / size;
                    
                    this.previewCar.scale.set(scale, scale, scale);
                    
                    // Center the car
                    box.setFromObject(this.previewCar);
                    box.getCenter(this.previewCar.position);
                    this.previewCar.position.multiplyScalar(-1);
                    this.previewCar.position.y = 0.05; // Slight lift from ground
                }
                
                // Add to preview scene
                this.previewScene.add(this.previewCar);
                
                console.log('Preview car loaded:', modelFile);
            },
            (xhr) => {
                console.log((xhr.loaded / xhr.total * 100) + '% loaded');
            },
            (error) => {
                console.error('Error loading preview car model:', error);
            }
        );
    }
    
    // Animation loop for preview car rotation
    animatePreview() {
        if (!this.previewScene || !this.previewCamera || !this.previewRenderer) return;
        
        this.previewAnimationId = requestAnimationFrame(this.animatePreview.bind(this));
        
        // Rotate the car slowly
        if (this.previewCar) {
            this.previewCar.rotation.y += 0.01;
        }
        
        // Render the scene
        this.previewRenderer.render(this.previewScene, this.previewCamera);
    }
    
    // Clean up preview resources
    disposePreview() {
        if (this.previewAnimationId) {
            cancelAnimationFrame(this.previewAnimationId);
        }
        
        if (this.previewRenderer && this.previewContainer) {
            this.previewContainer.removeChild(this.previewRenderer.domElement);
        }
        
        this.previewScene = null;
        this.previewCamera = null;
        this.previewRenderer = null;
        this.previewCar = null;
    }
    
    // Add trails to airplane
    addPlaneTrails(plane) {
        // Create two trail particle systems (one for each wing)
        const trailColors = [
            new THREE.Color(0x00a0ff), // Blue trail
            new THREE.Color(0xffffff)  // White trail
        ];
        
        // Wing positions (relative to plane center)
        const wingPositions = [
            new THREE.Vector3(-2, 0, 0), // Left wing
            new THREE.Vector3(2, 0, 0)   // Right wing
        ];
        
        // Create trails for each wing
        for (let i = 0; i < 2; i++) {
            // Create a trail particle system
            const trailGeometry = new THREE.BufferGeometry();
            const particleCount = 150; // Increased particle count for denser trails
            
            // Arrays to store particle data
            const positionArray = new Float32Array(particleCount * 3);
            const colorArray = new Float32Array(particleCount * 3);
            const sizeArray = new Float32Array(particleCount);
            const opacityArray = new Float32Array(particleCount);
            const timeArray = new Float32Array(particleCount);
            
            // Colors for particles (gradient effect)
            const startColor = trailColors[i].clone();
            const endColor = i === 0 ? new THREE.Color(0x0040aa) : new THREE.Color(0xaaccff);
            const tempColor = new THREE.Color();
            
            // Initialize particle arrays
            for (let j = 0; j < particleCount; j++) {
                const j3 = j * 3;
                
                // Start all particles at the wing position
                positionArray[j3] = wingPositions[i].x;
                positionArray[j3 + 1] = wingPositions[i].y;
                positionArray[j3 + 2] = wingPositions[i].z;
                
                // Set color gradient from start to end color
                const ratio = j / particleCount;
                tempColor.copy(startColor).lerp(endColor, ratio);
                tempColor.toArray(colorArray, j3);
                
                // Start with smaller particles that get bigger
                sizeArray[j] = 0.1 + (j / particleCount) * 0.6;
                
                // Start with fully transparent particles
                opacityArray[j] = 0;
                
                // Time offset for animation
                timeArray[j] = j / particleCount;
            }
            
            // Set geometry attributes
            trailGeometry.setAttribute('position', new THREE.BufferAttribute(positionArray, 3));
            trailGeometry.setAttribute('color', new THREE.BufferAttribute(colorArray, 3));
            trailGeometry.setAttribute('size', new THREE.BufferAttribute(sizeArray, 1));
            trailGeometry.setAttribute('opacity', new THREE.BufferAttribute(opacityArray, 1));
            trailGeometry.setAttribute('time', new THREE.BufferAttribute(timeArray, 1));
            
            // Create particle material
            const trailMaterial = new THREE.PointsMaterial({
                size: 0.6,
                transparent: true,
                blending: THREE.AdditiveBlending,
                vertexColors: true,
                depthWrite: false, // Prevents particles from occluding each other
                sizeAttenuation: true
            });
            
            // Create particle system
            const trail = new THREE.Points(trailGeometry, trailMaterial);
            
            // Store reference to particle data for animation
            trail.userData = {
                positionArray,
                sizeArray,
                opacityArray,
                timeArray,
                wingPosition: wingPositions[i].clone(),
                color: trailColors[i].clone(),
                endColor: endColor.clone(),
                lifetime: 3.0, // Increased lifetime for longer trails
                lastPosition: new THREE.Vector3(),
                animationOffset: Math.random() * Math.PI * 2 // Random offset for animation
            };
            
            // Add to scene (not as child of plane so that they stay behind when plane moves)
            this.scene.add(trail);
            
            // Add to trails array
            this.planeTrails.push(trail);
        }
    }
    
    // Remove plane trails
    removePlaneTrails() {
        this.planeTrails.forEach(trail => {
            if (trail.parent) {
                trail.parent.remove(trail);
            }
            
            // Dispose geometry and material
            if (trail.geometry) trail.geometry.dispose();
            if (trail.material) trail.material.dispose();
        });
        
        this.planeTrails = [];
    }
    
    // Update plane trails - call this in the game update loop
    updatePlaneTrails(delta) {
        if (!this.currentCar || this.planeTrails.length === 0) return;
        
        // Check if the current vehicle is an airplane
        if (this.currentVehicleData && this.currentVehicleData.id === 'airplane') {
            const car = this.currentCar;
            
            // Always consider the plane as flying if it's the airplane model
            const isFlying = true;
            
            // Update each trail
            this.planeTrails.forEach((trail, index) => {
                // Get wing position in world space
                const wingLocal = trail.userData.wingPosition.clone();
                const wingWorld = wingLocal.clone().applyMatrix4(car.matrixWorld);
                
                // Always create trails when flying, regardless of movement
                if (isFlying) {
                    // Update animation time offset for pulsing effect
                    trail.userData.animationOffset += delta * 2;
                    
                    // Update particle positions
                    const positions = trail.geometry.attributes.position.array;
                    const sizes = trail.geometry.attributes.size.array;
                    const opacities = trail.geometry.attributes.opacity.array;
                    const times = trail.geometry.attributes.time.array;
                    
                    // Shift all particles one position back
                    for (let i = positions.length / 3 - 1; i > 0; i--) {
                        const i3 = i * 3;
                        const prev3 = (i - 1) * 3;
                        
                        // Copy position from previous particle
                        positions[i3] = positions[prev3];
                        positions[i3 + 1] = positions[prev3 + 1];
                        positions[i3 + 2] = positions[prev3 + 2];
                        
                        // Update time
                        times[i] = times[i - 1] + delta;
                        
                        // Calculate lifetime ratio (0 to 1)
                        const lifeRatio = times[i] / trail.userData.lifetime;
                        
                        // Fade out based on time with pulsing effect
                        const pulse = 0.2 * Math.sin(times[i] * 10 + trail.userData.animationOffset);
                        opacities[i] = Math.max(0, (1.0 - lifeRatio) + pulse);
                        
                        // Make particles grow with age and add subtle wobble
                        const wobble = 0.1 * Math.sin(times[i] * 5 + trail.userData.animationOffset * 0.7);
                        sizes[i] = 0.1 + Math.min(1.0, times[i] * 0.5) + wobble;
                        
                        // Add subtle sideways drift to particles for more natural look
                        if (i % 3 === 0) { // Only apply to some particles
                            positions[i3] += Math.sin(times[i] * 2) * 0.02;
                            positions[i3 + 2] += Math.cos(times[i] * 2) * 0.02;
                        }
                    }
                    
                    // Set the first particle to current wing position
                    positions[0] = wingWorld.x;
                    positions[1] = wingWorld.y;
                    positions[2] = wingWorld.z;
                    times[0] = 0;
                    opacities[0] = 1.0;
                    sizes[0] = 0.1;
                    
                    // Mark attributes for update
                    trail.geometry.attributes.position.needsUpdate = true;
                    trail.geometry.attributes.size.needsUpdate = true;
                    trail.geometry.attributes.opacity.needsUpdate = true;
                    trail.geometry.attributes.time.needsUpdate = true;
                    
                    // Update last position
                    trail.userData.lastPosition.copy(wingWorld);
                }
            });
        }
    }
}

export default VehicleManager; 