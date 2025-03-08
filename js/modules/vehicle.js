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
        }
        
        // If no spawn point provided, generate a random one
        if (!spawnPoint) {
            spawnPoint = this.getRandomSpawnPoint();
        }
        
        this.loader.load(
            'models/' + modelFile,
            (gltf) => {
                this.currentCar = gltf.scene;
                
                // Position car at spawn point
                this.currentCar.position.copy(spawnPoint.position);
                this.currentCar.rotation.y = spawnPoint.rotation;
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
    getRandomSpawnPoint() {
        // Check if we have a specific start line position from the game
        if (window.gameEngine && window.gameEngine.startLinePosition) {
            // Use the start line position which is set in the GameEngine
            return {
                position: window.gameEngine.startLinePosition,
                rotation: Math.PI / 2 // Car faces 90 degrees counter-clockwise (left) from the Z axis
            };
        }
        
        // Fallback to random position if no start line defined
        const mapSize = 100;
        const padding = 15;
        
        // Random position within the map boundaries
        const randomX = (Math.random() * (mapSize - 2 * padding)) - (mapSize / 2 - padding);
        const randomZ = (Math.random() * (mapSize - 2 * padding)) - (mapSize / 2 - padding);
        
        // Random rotation (facing any direction)
        const randomRotation = Math.random() * Math.PI * 2;
        
        return {
            position: new THREE.Vector3(randomX, 0.1, randomZ),
            rotation: randomRotation
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
        
        this.loader.load(
            'models/' + modelFile,
            (gltf) => {
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
                
                // Add car to preview scene
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
}

export default VehicleManager; 