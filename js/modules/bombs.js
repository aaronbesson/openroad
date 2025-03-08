// Simple bomb module
import * as THREE from 'three';

class BombsManager {
    constructor(scene, loader) {
        this.scene = scene;
        this.loader = loader;
        this.bombModel = null;
    }

    // Load bomb model
    async loadBombModel() {
        return new Promise((resolve, reject) => {
            this.loader.load(
                '/objects/bomb.glb',
                (gltf) => {
                    this.bombModel = gltf.scene;
                    console.log('Bomb model loaded successfully');
                    resolve();
                },
                undefined,
                (error) => {
                    console.error('Error loading bomb model:', error);
                    reject(error);
                }
            );
        });
    }

    // Throw a bomb from the car
    throwBomb(car) {
        if (!car || !this.bombModel) return;
        
        console.log('Throwing bomb');
        
        // Clone the bomb model
        const bomb = this.bombModel.clone();
        
        // Set initial position in front of the car
        const carDirection = new THREE.Vector3(0, 0, 1).applyQuaternion(car.quaternion);
        const bombPosition = car.position.clone().add(carDirection.multiplyScalar(3));
        bombPosition.y += 1; // Raise slightly above ground
        bomb.position.copy(bombPosition);
        
        // Set initial rotation to match car
        bomb.quaternion.copy(car.quaternion);
        
        // Add to scene
        this.scene.add(bomb);
    }
}

export default BombsManager; 