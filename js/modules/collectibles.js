// Collectibles module - handles coin and item spawning, collection and effects

class CollectiblesManager {
    constructor(scene, loader) {
        this.scene = scene;
        this.loader = loader;
        this.collectiblesData = [];
        this.spawnedCollectibles = [];
        this.playerScore = 0;
        this.playerShield = 0;
        
        // Collection effects DOM elements
        this.coinEffect = document.getElementById('coin-effect');
        this.shieldEffect = document.getElementById('shield-effect');
        this.scoreDisplay = document.getElementById('score-display');
        
        // Audio context for sound effects
        this.audioContext = null;
        this.coinSound = null;
        this.powerupSound = null;
        
        this.initAudio();
    }
    
    // Initialize audio for collectible sounds
    async initAudio() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Load coin sound
            const coinResponse = await fetch('/soundfx/coin.mp3');
            const coinArrayBuffer = await coinResponse.arrayBuffer();
            this.coinSound = await this.audioContext.decodeAudioData(coinArrayBuffer);
            
            // Load powerup sound
            const powerupResponse = await fetch('/soundfx/powerup.mp3');
            const powerupArrayBuffer = await powerupResponse.arrayBuffer();
            this.powerupSound = await this.audioContext.decodeAudioData(powerupArrayBuffer);
        } catch (error) {
            console.error('Error initializing collectibles audio:', error);
        }
    }
    
    // Load collectibles data from JSON
    async loadCollectiblesData() {
        try {
            const response = await fetch('coins.json');
            const data = await response.json();
            this.collectiblesData = data.collectibles;
            
            // Create score display if it doesn't exist
            if (!this.scoreDisplay) {
                this.scoreDisplay = document.createElement('div');
                this.scoreDisplay.id = 'score-display';
                this.scoreDisplay.className = 'score-display';
                document.body.appendChild(this.scoreDisplay);
            }
            
            // Create coin effect if it doesn't exist
            if (!this.coinEffect) {
                this.coinEffect = document.createElement('div');
                this.coinEffect.id = 'coin-effect';
                document.body.appendChild(this.coinEffect);
            }
            
            // Create shield effect if it doesn't exist
            if (!this.shieldEffect) {
                this.shieldEffect = document.createElement('div');
                this.shieldEffect.id = 'shield-effect';
                document.body.appendChild(this.shieldEffect);
            }
            
            // Update score display
            this.updateScoreDisplay();
            
            // If there are spawn points, spawn collectibles
            if (data.coinSpawnPoints && data.coinSpawnPoints.length > 0) {
                this.spawnCollectibles(data.coinSpawnPoints);
            }
            
            return data;
        } catch (error) {
            console.error('Error loading collectibles data:', error);
            return null;
        }
    }
    
    // Spawn collectibles at defined spawn points
    spawnCollectibles(spawnPoints) {
        spawnPoints.forEach((spawnPoint, index) => {
            const collectibleType = spawnPoint.type;
            const position = new THREE.Vector3(...spawnPoint.position);
            
            // Adjust height to ensure collectible is above track
            position.y += 1.5; // Float 1.5 units above the track
            
            // Find collectible data
            const collectibleData = this.collectiblesData.find(c => c.id === collectibleType);
            if (!collectibleData) {
                console.error(`Collectible type ${collectibleType} not found`);
                return;
            }
            
            this.spawnCollectible(collectibleData, position, index);
        });
    }
    
    // Spawn a single collectible
    spawnCollectible(collectibleData, position, id) {
        // Load collectible model
        this.loader.load(
            'objects/' + collectibleData.model,
            (gltf) => {
                const collectible = gltf.scene;
                
                // Scale the collectible
                const scale = collectibleData.scale || 1.0;
                collectible.scale.set(scale, scale, scale);
                
                // Position the collectible
                collectible.position.copy(position);
                
                // Adjust height based on track position
                this.adjustCollectibleHeight(collectible);
                
                // Store id in userData for identification
                collectible.userData = collectible.userData || {};
                collectible.userData.id = id;
                collectible.userData.type = collectibleData.id;
                
                // Add to scene
                this.scene.add(collectible);
                
                // Store collectible data for collision detection and effects
                const collectibleInfo = {
                    id: id,
                    type: collectibleData.id,
                    object: collectible,
                    position: collectible.position.clone(), // Use adjusted position
                    collisionRadius: scale * 0.5, // Adjust based on model size
                    collected: false,
                    respawnTime: collectibleData.respawnTime || 10000,
                    rotationSpeed: collectibleData.rotationSpeed || 1.0,
                    data: collectibleData,
                    baseY: collectible.position.y // Store base Y for floating animation
                };
                
                this.spawnedCollectibles.push(collectibleInfo);
                
                console.log(`Spawned collectible ${collectibleData.name} at`, collectible.position);
            },
            undefined,
            (error) => {
                console.error('Error loading collectible model:', error);
            }
        );
    }
    
    // New method to adjust collectible height based on track position
    adjustCollectibleHeight(collectible) {
        // Updated track data with higher elevation - match game.js
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
        
        // Get collectible's horizontal position
        const pos = collectible.position;
        
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
                Math.pow(pos.x - trackPoint.x, 2) + 
                Math.pow(pos.z - trackPoint.z, 2)
            );
            
            if (distance < minDistance) {
                minDistance = distance;
                closestY = trackPoint.y;
            }
        }
        
        // Default ground height (match car ground height)
        const groundHeight = 1.0;
        // Height of collectibles above surface
        const collectibleOffset = 1.2;
        
        // Only place collectibles on or near the track
        if (minDistance < 25) {
            // Set collectible height based on track height plus offset
            collectible.position.y = closestY + collectibleOffset;
        } else {
            // Off track collectibles placed at default ground height
            collectible.position.y = groundHeight + collectibleOffset;
        }
    }
    
    // Update collectibles (rotation, respawn)
    update(delta) {
        // Update each collectible
        this.spawnedCollectibles.forEach(collectible => {
            if (collectible.collected) {
                return; // Skip collected items
            }
            
            const object = collectible.object;
            
            // Rotate the collectible
            object.rotation.y += collectible.rotationSpeed * delta;
            
            // Floating animation
            if (collectible.baseY) {
                const floatSpeed = 1.5; // Speed of floating
                const floatHeight = 0.2; // Height of float
                
                // Float up and down
                object.position.y = collectible.baseY + Math.sin(performance.now() * 0.001 * floatSpeed) * floatHeight;
            }
        });
    }
    
    // Check for collisions with car
    checkCollisions(car) {
        if (!car) return;
        
        const carPosition = car.position.clone();
        // Lower the vertical check position to match where collectibles are
        carPosition.y = carPosition.y - 0.3;
        
        this.spawnedCollectibles.forEach(collectible => {
            // Skip if already collected
            if (collectible.collected || (collectible.object && !collectible.object.visible)) return;

            // Get the collectible position (either directly or from object)
            const collectiblePosition = collectible.object ? collectible.object.position : collectible.position;
            
            // More lenient collision radius for easier collection
            const collisionDistance = collectible.collisionRadius * 2.0;
            const distance = collectiblePosition.distanceTo(carPosition);
            
            // More lenient height check
            const heightDiff = Math.abs(collectiblePosition.y - carPosition.y);
            const maxHeightDiff = 2.0; // Increased height tolerance
            
            if (distance < collisionDistance && heightDiff < maxHeightDiff) {
                console.log('Collectible collision detected!', collectible);
                this.collectItem(collectible);
            }
        });
    }
    
    // Handle collectible collection
    collectItem(collectible) {
        // Skip if already collected
        if (collectible.collected) return;
        
        // Mark as collected
        collectible.collected = true;
        
        // Get the collectible object
        const collectibleObject = collectible.object || collectible;
        
        // Find the collectible data
        const collectibleData = collectible.data || 
                               this.collectiblesData.find(c => c.type === collectible.type || 
                                                            c.id === collectible.type ||
                                                            (collectibleObject.userData && c.type === collectibleObject.userData.type));
        
        if (collectibleData) {
            // Apply effects (score, shield, etc)
            this.applyCollectibleEffects(collectibleData);
            
            // Play collection sound
            this.playCollectSound(collectibleData);
            
            // Show collection effect
            this.showCollectionEffect(collectibleData);
            
            // Hide the collectible
            if (collectibleObject.visible !== undefined) {
                collectibleObject.visible = false;
            } else if (collectible.object) {
                collectible.object.visible = false;
            }
            
            // Set collectible ID for server sync
            const collectibleId = collectible.id || 
                                 (collectibleObject.userData && collectibleObject.userData.id) || 
                                 'collectible-' + Math.floor(Math.random() * 10000);
            
            // Notify the server of this collection if we have multiplayer
            if (window.gameEngine?.multiplayerManager?.socket) {
                window.gameEngine.multiplayerManager.socket.emit('collectibleCollected', {
                    itemId: collectibleId,
                    type: collectibleData.type || collectibleData.id,
                    position: collectibleObject.position || collectible.position
                });
            }
            
            // Dispatch event for UI updates and other modules
            const event = new CustomEvent('collectibleCollected', {
                detail: {
                    type: collectibleData.type || collectibleData.id,
                    value: collectibleData.value,
                    position: collectibleObject.position || collectible.position,
                    itemId: collectibleId
                }
            });
            document.dispatchEvent(event);
            
            // Schedule respawn if it's set to respawn
            if (collectibleData.respawn) {
                setTimeout(() => {
                    this.respawnCollectible(collectible);
                }, collectibleData.respawnTime || 10000);
            }
        } else {
            console.error('Could not find collectible data for', collectible);
        }
    }
    
    // Respawn a collected item
    respawnCollectible(collectible) {
        // Reset collected state
        collectible.collected = false;
        
        // Make visible again
        if (collectible.object) {
            collectible.object.visible = true;
        } else if (collectible.visible !== undefined) {
            collectible.visible = true;
        }
        
        console.log(`Respawned collectible`, collectible);
    }
    
    // Apply effects based on collectible type
    applyCollectibleEffects(collectibleData) {
        // Award points
        if (collectibleData.points) {
            this.playerScore += collectibleData.points;
            this.updateScoreDisplay();
        }
        
        // Apply special effects
        if (collectibleData.effect === 'shield') {
            // Increase shield
            this.playerShield += collectibleData.effectValue || 10;
            
            // Update shield display
            const shieldBar = document.getElementById('shield-bar');
            if (shieldBar) {
                // Cap shield at 100%
                const shieldValue = Math.min(this.playerShield, 100);
                shieldBar.style.width = shieldValue + '%';
            }
        }
    }
    
    // Play sound effect for collectible
    playCollectSound(collectibleData) {
        if (this.audioContext) {
            // Determine which sound to play
            let soundBuffer = this.coinSound;
            
            // Use powerup sound for special items
            if (collectibleData.effect) {
                soundBuffer = this.powerupSound;
            }
            
            if (soundBuffer) {
                const source = this.audioContext.createBufferSource();
                source.buffer = soundBuffer;
                
                // Create gain node to control volume
                const gainNode = this.audioContext.createGain();
                gainNode.gain.value = 0.5; // 50% volume
                
                source.connect(gainNode);
                gainNode.connect(this.audioContext.destination);
                source.start(0);
            }
        }
    }
    
    // Show visual effect when collecting an item, with optional opacity
    showCollectionEffect(collectibleData, opacity = 1.0) {
        // Choose appropriate effect based on collectible type
        let effectElement = this.coinEffect;
        
        if (collectibleData.effect === 'shield') {
            effectElement = this.shieldEffect;
        }
        
        if (effectElement) {
            // Set opacity if provided
            if (opacity !== 1.0) {
                effectElement.style.opacity = opacity;
            } else {
                effectElement.style.opacity = 1.0;
            }
            
            // Reset animation
            effectElement.style.animation = 'none';
            effectElement.offsetHeight; // Trigger reflow
            
            // Show and animate
            effectElement.style.display = 'block';
            effectElement.style.animation = 'flash 0.5s';
            
            // Hide after animation completes
            setTimeout(() => {
                effectElement.style.display = 'none';
            }, 500);
        }
    }
    
    // Update score display
    updateScoreDisplay() {
        if (this.scoreDisplay) {
            // Format with leading zeros for arcade feel
            const formattedScore = this.playerScore.toString().padStart(6, '0');
            this.scoreDisplay.textContent = `SCORE: ${formattedScore}`;
        }
    }
    
    // Get player stats
    getPlayerStats() {
        return {
            score: this.playerScore,
            shield: this.playerShield
        };
    }
    
    // Mark a collectible as collected by another player
    markCollected(collectibleId, playerId) {
        // Find the collectible in our spawned items
        const collectible = this.spawnedCollectibles.find(c => 
            (c.id === collectibleId) || 
            (c.object && c.object.userData && c.object.userData.id === collectibleId)
        );
        
        if (collectible) {
            console.log(`Marking collectible ${collectibleId} as collected by ${playerId}`);
            
            // Mark as collected
            collectible.collected = true;
            collectible.collectedBy = playerId;
            
            // Hide the collectible
            if (collectible.object) {
                collectible.object.visible = false;
            } else if (collectible.visible !== undefined) {
                collectible.visible = false;
            }
            
            // Show a distant collection effect with reduced opacity
            const collectibleData = collectible.data || 
                this.collectiblesData.find(c => 
                    c.id === collectible.type || 
                    (collectible.object && collectible.object.userData && c.type === collectible.object.userData.type)
                );
                
            if (collectibleData) {
                this.showCollectionEffect(collectibleData, 0.4); // Reduced opacity for remote collection
            
                // Schedule respawn if needed
                if (collectibleData.respawn) {
                    setTimeout(() => {
                        this.respawnCollectible(collectible);
                    }, collectibleData.respawnTime || 10000);
                }
            }
        }
    }
}

export default CollectiblesManager; 