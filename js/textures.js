// Dynamic texture generator for the game

// Function to generate a grass texture canvas that we can use
function generateGrassTexture(width = 256, height = 256) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    
    // Fill with base green
    ctx.fillStyle = '#2a6e2a';
    ctx.fillRect(0, 0, width, height);
    
    // Add some noise and variation for texture
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            // Calculate a noise value
            const noise = Math.random();
            
            // Vary the green color based on noise
            const green = Math.floor(110 + noise * 40);
            const red = Math.floor(42 + noise * 20);
            const blue = Math.floor(42 + noise * 20);
            
            // Draw a tiny grass pixel
            ctx.fillStyle = `rgb(${red}, ${green}, ${blue})`;
            ctx.fillRect(x, y, 1, 1);
        }
    }
    
    // Draw some random small grass blades
    const grassCount = 2000;
    const maxBladeHeight = 4;
    
    ctx.strokeStyle = '#5c9442';
    ctx.lineWidth = 1;
    
    for (let i = 0; i < grassCount; i++) {
        const x = Math.random() * width;
        const y = Math.random() * height;
        const bladeHeight = 1 + Math.random() * maxBladeHeight;
        const angle = Math.random() * Math.PI;
        
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(
            x + Math.sin(angle) * bladeHeight,
            y - Math.cos(angle) * bladeHeight
        );
        ctx.stroke();
    }
    
    return canvas;
}

// Function to load the generated texture into a THREE.js texture
function createGrassTexture() {
    const canvas = generateGrassTexture();
    const texture = new THREE.Texture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.needsUpdate = true;
    return texture;
}

// Export the function for use in the game
window.createGrassTexture = createGrassTexture; 