import * as THREE from 'three';

class Volcano {
    constructor(scene, position = new THREE.Vector3(0, 0, 0)) {
        this.scene = scene;
        this.position = position;
        this.lavaParticles = [];
        this.smokeParticles = [];
        this.lastEruption = 0;
        this.erupting = false;
        this.volcanoHeight = 15;
        
        // Eruption settings
        this.eruptionInterval = 15000; // Erupt every 15 seconds
        this.eruptionDuration = 5000;  // Eruption lasts 5 seconds
        
        // Create volcano elements
        this.createVolcano();
    }
    
    createVolcano() {
        try {
            console.log('Creating volcano at position:', this.position);
            
            // Create volcano cone
            const volcanoRadius = 20;
            const volcanoGeometry = new THREE.ConeGeometry(volcanoRadius, this.volcanoHeight, 32);
            const volcanoMaterial = new THREE.MeshStandardMaterial({
                color: 0x555555,
                roughness: 0.8,
                metalness: 0.2
            });
            
            this.volcano = new THREE.Mesh(volcanoGeometry, volcanoMaterial);
            this.volcano.position.copy(this.position);
            this.volcano.castShadow = true;
            this.volcano.receiveShadow = true;
            this.scene.add(this.volcano);
            
            // Create crater
            const craterRadius = volcanoRadius * 0.4;
            const craterDepth = this.volcanoHeight * 0.2;
            const craterGeometry = new THREE.CylinderGeometry(craterRadius, craterRadius * 0.6, craterDepth, 32);
            const craterMaterial = new THREE.MeshStandardMaterial({
                color: 0x333333,
                roughness: 0.9,
                metalness: 0.1
            });
            
            this.crater = new THREE.Mesh(craterGeometry, craterMaterial);
            this.crater.position.copy(this.position);
            this.crater.position.y += this.volcanoHeight / 2 - craterDepth / 2;
            this.scene.add(this.crater);
            
            // Create lava pool
            const lavaRadius = craterRadius * 0.9;
            const lavaGeometry = new THREE.CircleGeometry(lavaRadius, 32);
            const lavaMaterial = new THREE.MeshStandardMaterial({
                color: 0xff4500,
                emissive: 0xff2000,
                emissiveIntensity: 0.7,
                roughness: 0.5,
                metalness: 0.8
            });
            
            this.lava = new THREE.Mesh(lavaGeometry, lavaMaterial);
            this.lava.position.copy(this.position);
            this.lava.position.y += this.volcanoHeight / 2;
            this.lava.rotation.x = -Math.PI / 2; // Horizontal
            this.scene.add(this.lava);
            
            // Initialize particle systems after the main volcano is created
            this.createLavaParticleSystem();
            this.createSmokeParticleSystem();
            
            console.log('Volcano created successfully');
        } catch (error) {
            console.error('Error creating volcano:', error);
        }
    }
    
    createLavaParticleSystem() {
        try {
            const particleCount = 100;
            const particleGeometry = new THREE.BufferGeometry();
            const particlePositions = new Float32Array(particleCount * 3);
            
            // Initialize all particles at the crater position
            for (let i = 0; i < particleCount * 3; i += 3) {
                particlePositions[i] = this.position.x;
                particlePositions[i + 1] = this.position.y + this.volcanoHeight / 2;
                particlePositions[i + 2] = this.position.z;
            }
            
            particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
            
            // Use correct properties for PointsMaterial (no emissive)
            const particleMaterial = new THREE.PointsMaterial({
                color: 0xff5500,
                size: 0.5,
                transparent: true,
                opacity: 0.8
            });
            
            this.lavaParticleSystem = new THREE.Points(particleGeometry, particleMaterial);
            this.scene.add(this.lavaParticleSystem);
            
            // Create data for each particle
            for (let i = 0; i < particleCount; i++) {
                this.lavaParticles.push({
                    velocity: new THREE.Vector3(
                        (Math.random() - 0.5) * 0.5,
                        Math.random() * 0.5 + 0.5,
                        (Math.random() - 0.5) * 0.5
                    ),
                    active: false
                });
            }
        } catch (error) {
            console.error('Error creating lava particle system:', error);
        }
    }
    
    createSmokeParticleSystem() {
        try {
            const particleCount = 50;
            const particleGeometry = new THREE.BufferGeometry();
            const particlePositions = new Float32Array(particleCount * 3);
            
            // Initialize all particles at the crater position
            for (let i = 0; i < particleCount * 3; i += 3) {
                particlePositions[i] = this.position.x;
                particlePositions[i + 1] = this.position.y + this.volcanoHeight / 2;
                particlePositions[i + 2] = this.position.z;
            }
            
            particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
            
            const particleMaterial = new THREE.PointsMaterial({
                color: 0x888888,
                size: 1.5,
                transparent: true,
                opacity: 0.5
            });
            
            this.smokeParticleSystem = new THREE.Points(particleGeometry, particleMaterial);
            this.scene.add(this.smokeParticleSystem);
            
            // Create data for each particle
            for (let i = 0; i < particleCount; i++) {
                this.smokeParticles.push({
                    velocity: new THREE.Vector3(
                        (Math.random() - 0.5) * 0.2,
                        Math.random() * 0.3 + 0.2,
                        (Math.random() - 0.5) * 0.2
                    ),
                    active: false,
                    size: Math.random() * 2 + 1,
                    opacity: Math.random() * 0.5 + 0.3
                });
            }
        } catch (error) {
            console.error('Error creating smoke particle system:', error);
        }
    }
    
    update(delta) {
        try {
            if (!this.lava || !this.lavaParticleSystem || !this.smokeParticleSystem) {
                return; // Safety check for initialization
            }
            
            // Pulse lava glow effect
            const time = performance.now() * 0.001;
            this.lava.material.emissiveIntensity = 0.7 + Math.sin(time * 2) * 0.2;
            
            // Check if it's time for an eruption
            const now = performance.now();
            if (!this.erupting && now - this.lastEruption > this.eruptionInterval) {
                this.startEruption();
            }
            
            // End eruption after duration
            if (this.erupting && now - this.lastEruption > this.eruptionDuration) {
                this.stopEruption();
            }
            
            // Update lava particles
            const positions = this.lavaParticleSystem.geometry.attributes.position.array;
            
            for (let i = 0; i < this.lavaParticles.length; i++) {
                const particle = this.lavaParticles[i];
                const idx = i * 3;
                
                if (particle.active) {
                    // Apply velocity
                    positions[idx] += particle.velocity.x * delta * 10;
                    positions[idx + 1] += particle.velocity.y * delta * 10;
                    positions[idx + 2] += particle.velocity.z * delta * 10;
                    
                    // Apply gravity
                    particle.velocity.y -= 0.01 * delta * 10;
                    
                    // Reset if below volcano or too high
                    if (positions[idx + 1] < this.position.y || 
                        positions[idx + 1] > this.position.y + 40 ||
                        Math.abs(positions[idx] - this.position.x) > 30 ||
                        Math.abs(positions[idx + 2] - this.position.z) > 30) {
                        this.resetParticle(positions, idx, particle);
                        particle.active = this.erupting;
                    }
                }
            }
            
            // Update smoke particles
            const smokePositions = this.smokeParticleSystem.geometry.attributes.position.array;
            
            for (let i = 0; i < this.smokeParticles.length; i++) {
                const particle = this.smokeParticles[i];
                const idx = i * 3;
                
                if (particle.active) {
                    // Apply velocity
                    smokePositions[idx] += particle.velocity.x * delta * 5;
                    smokePositions[idx + 1] += particle.velocity.y * delta * 5;
                    smokePositions[idx + 2] += particle.velocity.z * delta * 5;
                    
                    // Slow down as they rise
                    particle.velocity.y *= 0.99;
                    
                    // Reset if too high or far away
                    if (smokePositions[idx + 1] > this.position.y + 50 ||
                        Math.abs(smokePositions[idx] - this.position.x) > 40 ||
                        Math.abs(smokePositions[idx + 2] - this.position.z) > 40) {
                        this.resetSmokeParticle(smokePositions, idx, particle);
                        particle.active = true; // Smoke continuously active
                    }
                } else if (Math.random() < 0.02) { // Occasionally activate new smoke particles
                    particle.active = true;
                }
            }
            
            this.lavaParticleSystem.geometry.attributes.position.needsUpdate = true;
            this.smokeParticleSystem.geometry.attributes.position.needsUpdate = true;
        } catch (error) {
            console.error('Error updating volcano:', error);
        }
    }
    
    startEruption() {
        this.erupting = true;
        this.lastEruption = performance.now();
        
        // Activate all lava particles
        for (let i = 0; i < this.lavaParticles.length; i++) {
            this.lavaParticles[i].active = true;
            
            // Randomize velocities for more dramatic eruption
            this.lavaParticles[i].velocity.set(
                (Math.random() - 0.5) * 1.5,
                Math.random() * 1.5 + 1.5,
                (Math.random() - 0.5) * 1.5
            );
        }
        
        // Make the lava brighter during eruption
        this.lava.material.emissiveIntensity = 1.5;
    }
    
    stopEruption() {
        this.erupting = false;
    }
    
    resetParticle(positions, idx, particle) {
        // Reset position to crater
        positions[idx] = this.position.x + (Math.random() - 0.5) * 2; // Small random offset
        positions[idx + 1] = this.position.y + this.volcanoHeight / 2;
        positions[idx + 2] = this.position.z + (Math.random() - 0.5) * 2; // Small random offset
        
        // Reset velocity
        particle.velocity.set(
            (Math.random() - 0.5) * (this.erupting ? 1.5 : 0.5),
            Math.random() * (this.erupting ? 1.5 : 0.5) + (this.erupting ? 1.5 : 0.5),
            (Math.random() - 0.5) * (this.erupting ? 1.5 : 0.5)
        );
    }
    
    resetSmokeParticle(positions, idx, particle) {
        // Reset position to crater with offset
        positions[idx] = this.position.x + (Math.random() - 0.5) * 3;
        positions[idx + 1] = this.position.y + this.volcanoHeight / 2;
        positions[idx + 2] = this.position.z + (Math.random() - 0.5) * 3;
        
        // Reset velocity
        particle.velocity.set(
            (Math.random() - 0.5) * 0.2,
            Math.random() * 0.3 + 0.2,
            (Math.random() - 0.5) * 0.2
        );
    }
}

export default Volcano; 