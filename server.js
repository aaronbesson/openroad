const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');
const port = process.env.PORT || 3000;

// Serve static files
app.use(express.static(path.join(__dirname, '/')));

// Store connected players
const players = {};

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);
    
    // Player joins the game
    socket.on('playerJoin', (playerData) => {
        console.log('Player joined:', socket.id, playerData.vehicleId);
        console.log('Spawn position:', playerData.position.x.toFixed(2), playerData.position.y.toFixed(2), playerData.position.z.toFixed(2), 'Rotation:', playerData.rotation.y.toFixed(2));
        
        // Store this player's information
        players[socket.id] = {
            id: socket.id,
            vehicleId: playerData.vehicleId,
            position: playerData.position || { x: 0, y: 0, z: 0 },
            rotation: playerData.rotation || { y: 0 },
            playerName: playerData.playerName || `Player-${socket.id.substr(0, 4)}`,
            headlightsOn: true // Default headlights on
        };
        
        // Send this player info about all existing players
        socket.emit('currentPlayers', players);
        
        // Send all other players info about this new player
        socket.broadcast.emit('newPlayer', players[socket.id]);
    });
    
    // Handle headlight toggle
    socket.on('headlightsToggle', (data) => {
        if (players[socket.id]) {
            // Update player's headlight state
            players[socket.id].headlightsOn = data.headlightsOn;
            
            // Broadcast headlight state to other players
            socket.broadcast.emit('headlightsToggled', {
                id: socket.id,
                headlightsOn: data.headlightsOn
            });
        }
    });
    
    // Player updates their position/rotation
    socket.on('playerMovement', (movementData) => {
        if (players[socket.id]) {
            players[socket.id].position = movementData.position;
            players[socket.id].rotation = movementData.rotation;
            
            // Broadcast this player's movement to all other players
            socket.broadcast.emit('playerMoved', {
                id: socket.id,
                position: players[socket.id].position,
                rotation: players[socket.id].rotation
            });
        }
    });
    
    // Player changes vehicle
    socket.on('vehicleChange', (vehicleData) => {
        if (players[socket.id]) {
            players[socket.id].vehicleId = vehicleData.vehicleId;
            
            // Broadcast vehicle change to all other players
            socket.broadcast.emit('playerVehicleChanged', {
                id: socket.id,
                vehicleId: vehicleData.vehicleId
            });
        }
    });
    
    // Player honks horn
    socket.on('hornSound', () => {
        if (players[socket.id]) {
            // Broadcast horn sound to all other players
            socket.broadcast.emit('playerHornSound', {
                id: socket.id
            });
        }
    });
    
    // Player disconnects
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        
        // Remove this player
        if (players[socket.id]) {
            delete players[socket.id];
            // Let everyone know this player left
            io.emit('playerLeft', socket.id);
        }
    });
});

// Start the server
http.listen(port, () => {
    console.log(`Server running on port ${port}`);
}); 