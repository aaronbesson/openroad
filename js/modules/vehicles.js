class VehicleManager {
    constructor(scene, loader, trackInfo) {
        this.scene = scene;
        this.loader = loader;
        this.trackInfo = trackInfo;
        this.vehicles = [];
        this.selectedVehicle = null;
        this.vehicleSelect = document.getElementById('vehicle-select');
        this.modelLoadedCallback = null;
    }

    setModelLoadedCallback(callback) {
        this.modelLoadedCallback = callback;
    }

    async init() {
        try {
            const vehiclesData = await this.loadVehiclesData();
            this.vehicles = vehiclesData;
            
            this.populateVehicleSelect();
            
            this.vehicleSelect.addEventListener('change', this.onVehicleChange.bind(this));
            
            if (this.vehicles.length > 0) {
                await this.selectVehicle(this.vehicles[0].id);
            }
            
            return true;
        } catch (error) {
            console.error('Error initializing vehicle manager:', error);
            return false;
        }
    }

    async loadVehiclesData() {
        try {
            const response = await fetch('/data/vehicles.json');
            return await response.json();
        } catch (error) {
            console.error('Error loading vehicles data:', error);
            return [
                {
                    id: 'sportsCar',
                    name: 'Sports Car',
                    model: 'car.glb',
                    scale: 1.0,
                    speed: 15,
                    acceleration: 1.2,
                    handling: 1.0,
                    description: 'A fast sports car with good handling.',
                    stats: {
                        speed: 80,
                        handling: 70,
                        acceleration: 85,
                        shield: 50
                    }
                },
                {
                    id: 'truck',
                    name: 'Pickup Truck',
                    model: 'truck.glb',
                    scale: 1.2,
                    speed: 12,
                    acceleration: 0.8,
                    handling: 0.7,
                    description: 'A sturdy truck with higher shield capacity.',
                    stats: {
                        speed: 60,
                        handling: 50,
                        acceleration: 55,
                        shield: 85
                    }
                }
            ];
        }
    }

    populateVehicleSelect() {
        this.vehicleSelect.innerHTML = '';
        
        this.vehicles.forEach(vehicle => {
            const option = document.createElement('option');
            option.value = vehicle.id;
            option.textContent = vehicle.name;
            this.vehicleSelect.appendChild(option);
        });
    }

    onVehicleChange(event) {
        const selectedId = event.target.value;
        this.selectVehicle(selectedId);
    }

    async selectVehicle(vehicleId) {
        const vehicleData = this.vehicles.find(v => v.id === vehicleId);
        if (!vehicleData) return false;
        
        if (this.selectedVehicle) {
            this.scene.remove(this.selectedVehicle);
        }
        
        try {
            const vehicle = await this.loadVehicle(vehicleData);
            this.selectedVehicle = vehicle;
            
            this.updateVehicleStats(vehicleData);
            
            return true;
        } catch (error) {
            console.error('Error selecting vehicle:', error);
            return false;
        }
    }

    loadVehicle(vehicleData) {
        return new Promise((resolve, reject) => {
            this.loader.load(
                'objects/' + vehicleData.model,
                (gltf) => {
                    const vehicle = gltf.scene;
                    
                    vehicle.position.copy(this.trackInfo.startPoint);
                    
                    const scale = vehicleData.scale || 1.0;
                    vehicle.scale.set(scale, scale, scale);
                    
                    vehicle.rotation.y = Math.PI;
                    
                    if (this.modelLoadedCallback) {
                        this.modelLoadedCallback(vehicle);
                    }
                    
                    this.scene.add(vehicle);
                    
                    vehicle.userData.vehicleData = vehicleData;
                    
                    resolve(vehicle);
                },
                undefined,
                (error) => {
                    console.error('Error loading vehicle model:', error);
                    reject(error);
                }
            );
        });
    }

    updateVehicleStats(vehicleData) {
        const stats = vehicleData.stats || {
            speed: 50,
            handling: 50,
            acceleration: 50,
            shield: 50
        };
        
        document.getElementById('speed-bar').style.width = `${stats.speed}%`;
        document.getElementById('handling-bar').style.width = `${stats.handling}%`;
        document.getElementById('acceleration-bar').style.width = `${stats.acceleration}%`;
        document.getElementById('shield-bar').style.width = `${stats.shield}%`;
        
        document.getElementById('description').textContent = vehicleData.description || '';
    }

    getCarProperties() {
        if (!this.selectedVehicle) return null;
        
        const vehicleData = this.selectedVehicle.userData.vehicleData;
        
        return {
            car: this.selectedVehicle,
            speed: vehicleData.speed || 10,
            handling: vehicleData.handling || 1.0,
            acceleration: vehicleData.acceleration || 1.0,
            shield: vehicleData.stats?.shield || 50
        };
    }
} 