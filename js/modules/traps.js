class TrapsManager {
    constructor(scene, loader) {
        this.scene = scene;
        this.loader = loader;
        this.trapSpikes = [];
    }

    // Load and place trap spikes randomly on the track
    loadAndPlaceTrapSpikes() {
        console.log('Loading trap spikes...');
        const spikePath = 'objects/trap-spikes-large.glb';
        const spikeCount = Math.floor(Math.random() * 10) + 5; // Random number between 1 and 10
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

        // Load the spike model
        this.loader.load(
            spikePath,
            (gltf) => {
                console.log('Trap spikes model loaded.');
                const spikeModel = gltf.scene;
                spikeModel.scale.set(2, 2, 2); // Scale to 2x2

                for (let i = 0; i < spikeCount; i++) {
                    // Randomly select a point on the track
                    const randomIndex = Math.floor(Math.random() * trackPath.length);
                    const position = trackPath[randomIndex];

                    // Clone the model and set its position
                    const spikeClone = spikeModel.clone();
                    spikeClone.position.set(position[0], position[1], position[2]);

                    // Add to the scene
                    this.scene.add(spikeClone);
                    this.trapSpikes.push({
                        object: spikeClone,
                        position: spikeClone.position.clone(),
                        collisionRadius: 1.0 // Adjust based on model size
                    });
                }
                console.log('Trap spikes placed on track.');
            },
            undefined,
            (error) => {
                console.error('Error loading trap spikes model:', error);
            }
        );
    }

    // Check for collisions with car
    checkCollisions(car) {
        if (!car) return;

        const carPosition = car.position.clone();
        console.log('Checking for trap collisions...');

        this.trapSpikes.forEach(trap => {
            const trapPosition = trap.position;
            const distance = trapPosition.distanceTo(carPosition);

            if (distance < trap.collisionRadius + 1.2) { // Adding car collision radius
                console.log('Trap collision detected!', trap);
                this.handleCollision(trap, car);
            }
        });
    }

    // Handle trap collision
    handleCollision(trap, car) {
        // Play collision sound if available
        if (window.gameEngine.playCollisionSound) {
            window.gameEngine.playCollisionSound();
        }
        
        // Show collision effect if available
        if (window.gameEngine.showCollisionEffect) {
            window.gameEngine.showCollisionEffect();
        }
        
        // Reset car to start position
        if (window.gameEngine.resetCarToStart) {
            window.gameEngine.resetCarToStart(car);
            
            // Ensure position update is sent to server
            if (window.gameEngine.multiplayerManager) {
                window.gameEngine.multiplayerManager.emitPlayerMovement(car);
            }
        }
    }
}

export default TrapsManager; 