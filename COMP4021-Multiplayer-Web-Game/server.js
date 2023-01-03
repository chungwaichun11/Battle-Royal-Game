const express = require("express");

const bcrypt = require("bcrypt");
const fs = require("fs");
const session = require("express-session");

const app = express();
app.use(express.static("public"));
app.use(express.json());

const gameSession = session({
    secret: "game",
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: { maxAge: 300000 }
});
app.use(gameSession);

function validateUsername(text) { return /^\w+$/.test(text); }

app.post("/signup", (req, res) => {
    const { username, name, password } = req.body;

    var users = JSON.parse(fs.readFileSync("data/players.json"));

    if(!username) return res.json({ status: "error", error: "Please input username" });
    if(!name) return res.json({ status: "error", error: "Please input display name" });
    if(!password) return res.json({ status: "error", error: "Please input password" });

    if(!validateUsername(username)) return res.json({ status: "error", error: "Username is invalid" });
    if(username in users) return res.json({ status: "error", error: "Username already exists." });

    const hash = bcrypt.hashSync(password, 10);
    users[username] = { name: name, password: hash };

    fs.writeFileSync("data/players.json", JSON.stringify(users, null, 2));
    req.session.user = { username, name };
    res.json({ status: "success", user: req.session.user });
});

app.post("/signin", (req, res) => {
    const { username, password } = req.body;
    const players = JSON.parse(fs.readFileSync("data/players.json"));

    if(!(username in players)) return res.json({ status: "error", error: "Incorrect username or password."});
    
    const user = players[username];
    if(!bcrypt.compareSync(password, user.password)) return res.json({ status: "error", error: "Incorrect username or password."});

    req.session.user = { username, name: user.name };
    res.json({ status: "success", user: req.session.user });
});

app.get("/validate", (req, res) => {
    if(!req.session.user) return res.json({ status: "error", error: "User not logged in."});
    res.json({ status: "success", user: req.session.user });
});

app.get("/signout", (req, res) => {
    req.session.user = null;
    console.log("Player " + username + " left the game.");
    res.json({ status: "success" });
});

const { createServer } = require("http");
const { Server } = require("socket.io");
const httpServer = createServer(app);
const io = new Server(httpServer);

io.use((socket, next) => { gameSession(socket.request, {}, next); });

const Game = (function() {

    function Map(width, height) {

        // Width and Height must be multiple of 16

        const tiles = [];
        for(let j = 0; j < height / 16; j++) {
            tiles.push([]);
            for(let i = 0; i < width / 16; i++) {
                const rng = Math.random();
                if(rng > 0.8) {
                    tiles[j].push(1); // Grass
                } else if(rng > 0.75) {
                    tiles[j].push(2); // Flower
                } else {
                    tiles[j].push(0); // Plain
                }
            }
        }

        function valid(x, y) {
            if(x <  -width / 2 || x >=  width / 2) return false;
            if(y < -height / 2 || y >= height / 2) return false;

            return true;
        }

        function state() {
            return {
                bounds: {
                    minX: -width / 2,
                    minY: -height / 2,
                    maxX: width / 2,
                    maxY: height / 2
                },
                tiles: tiles
            }
        }

        function setTile(x, y, n) { tiles[y][x] = n; }

        function getWidth() {  return width; }
        function getHeight() { return height; }

        return { valid, state, setTile, getWidth, getHeight }
    }

    // Movement Variables
    const playerAcceleration = 400;
    const playerDeceleration = 600;
    const playerMaxVelocity = 150;

    const playerManaRegeneration = 20;

    // Collision
    const playerRadius = 4;

    // Visibility Variables
    const magnetRadius = 48;
    const visibleRange = 200;

    // Map informations
    let map = Map(320, 180);
    let shroudDamage = 5;

    const playerStates = {};
    const aiCore = {};

    let interactableStates = {};
    let currentInteractableID = 0;

    let teamElim = [];

    const spellStates = {};
    const shieldStates = [];
    let currentSpellID = 0;

    let lootStates = {};
    let currentLootID = 0;

    // Game State: False if in lobby, True if in Game
    let gameStarted = false;
    let gameEnded = false;
    let startTime = 0;

    // Helper functions

    function generatePlayerState(player) {
        if(!(player in playerStates)) return { username: player, hide: true };

        return {
            username: player,
            pos: {
                x: playerStates[player].pos.x, 
                y: playerStates[player].pos.y 
            },
            facing: playerStates[player].facing,
            moving: playerStates[player].velocity.x * playerStates[player].velocity.x + playerStates[player].velocity.y * playerStates[player].velocity.y > 0,
            team: playerStates[player].team,
            spectating: playerStates[player].spectating
        }
    }

    function generateInteractableState(id) {
        if(!(id in interactableStates)) return { id: id, hide: true }
        
        return {
            id: id,
            pos: interactableStates[id].pos,
            type: interactableStates[id].type
        }
    }

    function generateSpellState(id) {
        if(!(id in spellStates)) return { id: id, hide: true }

        return {
            id: id,
            pos: spellStates[id].pos,
            type: spellStates[id].type,
            dir: spellStates[id].dir
        }
    }

    function generateLootState(id) {
        if(!(id in lootStates)) return { id: id, hide: true }

        return {
            id: id,
            pos: {
                x: lootStates[id].pos.x,
                y: lootStates[id].pos.y
            }
        }
    }
    // Setting up game maps
    function startLobby() {
        gameStarted = false;

        // Load map
        map = Map(320, 180);

        // Spawn flags
        for(id in interactableStates) io.emit("update interactable state", JSON.stringify({ id: id, hide: true }));
        interactableStates = {};
        interactableStates[currentInteractableID++] = { type: 0, pos: { x: -80, y: -50 }, reach: 16, size: 1, name: "Banner", prompt: "Join blue team",   reject: "Blue Team is full",   disabled: false };
        interactableStates[currentInteractableID++] = { type: 1, pos: { x: -40, y: -50 }, reach: 16, size: 1, name: "Banner", prompt: "Join red team",    reject: "Red Team is full",    disabled: false };
        interactableStates[currentInteractableID++] = { type: 2, pos: { x:   0, y: -50 }, reach: 16, size: 1, name: "Banner", prompt: "Join green team",  reject: "Green Team is full",  disabled: false };
        interactableStates[currentInteractableID++] = { type: 3, pos: { x:  40, y: -50 }, reach: 16, size: 1, name: "Banner", prompt: "Join black team",  reject: "Black Team is full",  disabled: false };
        interactableStates[currentInteractableID++] = { type: 4, pos: { x:  80, y: -50 }, reach: 16, size: 1, name: "Banner", prompt: "Join yellow team", reject: "Yellow Team is full", disabled: false };
        interactableStates[currentInteractableID++] = { type: 5, pos: { x:   0, y:  50 }, reach: 16, size: 1, name: "Banner", prompt: "Spectate",         reject: "Cannot spectate",     disabled: false };

        // Remove loots
        for(id in lootStates) io.emit("update loot state", JSON.stringify({id: id, hide: true}));
        lootStates = {};

        // Spawn players
        for(player in playerStates) if(playerStates[player].isBot) delete playerStates[player];
        for(player in playerStates) {
            playerStates[player].health = 100;
            playerStates[player].maxHealth = 100;
            playerStates[player].mana = 100;
            playerStates[player].maxMana = 100;
            playerStates[player].dead = false;
            playerStates[player].ready = false;

            playerStates[player].kills = 0,
            playerStates[player].damage = 0,
            playerStates[player].friendlyfire = 0,
            playerStates[player].heals = 0,
            playerStates[player].level = 1,
            
            playerStates[player].spectating = playerStates[player].team == 5;

            playerStates[player].pos = { x: 0, y: 0 };
            playerStates[player].spells = [0, 8];

            resetPlayer(player);
        }
    }

    function startGame() {
        gameStarted = true;
        gameEnded = false;
        startTime = Date.now();
        teamElim = [];


        // Load Map
        const mapWidth = 3200;
        const mapHeight = 1440;
        map = Map(mapWidth, mapHeight);
        shroudDamage = 0;

        const spawnSize = 32;
        const possibleSpawn = [
            { x: -(mapWidth/2-50), y: -(mapHeight/2-50) }, 
            { x:                0, y: -(mapHeight/2-50) }, 
            { x:  (mapWidth/2-50), y: -(mapHeight/2-50) }, 
            { x: -(mapWidth/2-50), y:    0              }, 
            { x:  (mapWidth/2-50), y:    0              }, 
            { x: -(mapWidth/2-50), y:  (mapHeight/2-50) }, 
            { x:                0, y:  (mapHeight/2-50) }, 
            { x:  (mapWidth/2-50), y:  (mapHeight/2-50) }
        ]

        // Remove loots
        for(id in lootStates) io.emit("update loot state", JSON.stringify({id: id, hide: true}));
        lootStates = {};

        // Spawn interactables & Loots
        for(id in interactableStates) io.emit("update interactable state", JSON.stringify({ id: id, hide: true }));
        interactableStates = {};
        const pedestals = [
            { type: 7, pos: { x: 0, y: 0 }, reach: 16, size: 4, name: "Magic Missile", prompt: "Equip", reject: "The spell is already taken", disabled: false },
            { type: 9, pos: { x: 0, y: 0 }, reach: 16, size: 4, name: "Fire Bolt",     prompt: "Equip", reject: "The spell is already taken", disabled: false },
            { type: 15, pos: { x: 0, y: 0 }, reach: 16, size: 4, name: "Shield", prompt: "Equip", reject: "The spell is already taken", disabled: false },
        ];
        for(let i = 1; i < 9; i++) {
            for(let j = 1; j < 7; j++) {
                if( i == 5 && j == 4) continue; // Skip the middle screen

                const centerX = (i-5)*320;
                const centerY = (j-4)*180;

                const rng = Math.random();
                if(rng <= 0.3) {
                    if(rng <= 0.02) {          // 4 spells
                        interactableStates[currentInteractableID] = { ...pedestals[Math.floor(Math.random() * pedestals.length)] }
                        interactableStates[currentInteractableID++].pos = { x: centerX+20, y: centerY+20 }
                        interactableStates[currentInteractableID] = { ...pedestals[Math.floor(Math.random() * pedestals.length)] }
                        interactableStates[currentInteractableID++].pos = { x: centerX+20, y: centerY-20 }
                        interactableStates[currentInteractableID] = { ...pedestals[Math.floor(Math.random() * pedestals.length)] }
                        interactableStates[currentInteractableID++].pos = { x: centerX-20, y: centerY+20 }
                        interactableStates[currentInteractableID] = { ...pedestals[Math.floor(Math.random() * pedestals.length)] }
                        interactableStates[currentInteractableID++].pos = { x: centerX-20, y: centerY-20 }
                    } else if(rng <= 0.04) {    // 3 spells
                        interactableStates[currentInteractableID] = { ...pedestals[Math.floor(Math.random() * pedestals.length)] }
                        interactableStates[currentInteractableID++].pos = { x: centerX+20, y: centerY+20 }
                        interactableStates[currentInteractableID] = { ...pedestals[Math.floor(Math.random() * pedestals.length)] }
                        interactableStates[currentInteractableID++].pos = { x: centerX, y: centerY-20 }
                        interactableStates[currentInteractableID] = { ...pedestals[Math.floor(Math.random() * pedestals.length)] }
                        interactableStates[currentInteractableID++].pos = { x: centerX-20, y: centerY+20 }
                    } else if(rng <= 0.1) {    // 2 Spells
                        interactableStates[currentInteractableID] = { ...pedestals[Math.floor(Math.random() * pedestals.length)] }
                        interactableStates[currentInteractableID++].pos = { x: centerX+20, y: centerY }
                        interactableStates[currentInteractableID] = { ...pedestals[Math.floor(Math.random() * pedestals.length)] }
                        interactableStates[currentInteractableID++].pos = { x: centerX-20, y: centerY }
                    } else {                    // 1 spells
                        interactableStates[currentInteractableID] = { ...pedestals[Math.floor(Math.random() * pedestals.length)] }
                        interactableStates[currentInteractableID++].pos = { x: centerX, y: centerY }
                    }
                } else if(rng <= 0.8) {
                    if(rng - 0.2 <= 0.05) {           // Shitload of Loots
                        for(let i = 0; i < 50; i++) {
                            const spd = Math.random() * 500;
                            const dir = (Math.random() - 0.5) * 2 * Math.PI;
                            lootStates[currentLootID] = { 
                                pos: { x: centerX, y: centerY }, 
                                velocity: { x: Math.cos(dir) * spd, y: Math.sin(dir) * spd }, 
                                lastUpdate: Date.now() }

                            currentLootID++;
                        }
                    } else if (rng - 0.2 <= 0.1) {   // A lot of loots
                        for(let i = 0; i < 20; i++) {
                            const spd = Math.random() * 500;
                            const dir = (Math.random() - 0.5) * 2 * Math.PI;
                            lootStates[currentLootID] = { 
                                pos: { x: centerX, y: centerY }, 
                                velocity: { x: Math.cos(dir) * spd, y: Math.sin(dir) * spd }, 
                                lastUpdate: Date.now() }

                            currentLootID++;
                        }
                    } else {                            // Some Loots
                        for(let i = 0; i < 5; i++) {
                            const spd = Math.random() * 500;
                            const dir = (Math.random() - 0.5) * 2 * Math.PI;
                            lootStates[currentLootID] = { 
                                pos: { x: centerX, y: centerY }, 
                                velocity: { x: Math.cos(dir) * spd, y: Math.sin(dir) * spd }, 
                                lastUpdate: Date.now() }

                            currentLootID++;
                        }
                    }
                }
            }
        }
        for(let i = 0; i < 8; i++) {
            for(let j = 0; j < 4; j++) {
                interactableStates[currentInteractableID] = { ...pedestals[Math.floor(Math.random() * pedestals.length)] };
                interactableStates[currentInteractableID++].pos = { x: possibleSpawn[i].x - 100 * Math.sign(possibleSpawn[i].x) + ((j % 2) - 0.5) * 40, y: possibleSpawn[i].y - 100 * Math.sign(possibleSpawn[i].y) + (j > 1 ? 20 : -20) }
            }
        }

        // Add brick tiles in center
        for(let i = 96; i < 104; i++) {
            map.setTile(i, 41, 4);     // Upper Tile
            map.setTile(i, 48, 20);    // Bottom Tile
            for(let j = 42; j < 48; j++) {
                map.setTile(i, j, 12);  // Center Tile
            }
        }
        for(let j = 42; j < 48; j++) {
            map.setTile(96, j, 11);    // Left Tile
            map.setTile(104, j, 13);    // Right Tile
        }
        map.setTile(96, 41, 3);       // Upper Left Tile
        map.setTile(104, 41, 5);       // Upper Right Tile
        map.setTile(96, 48, 19);      // Lower Left Tile
        map.setTile(104, 48, 21);      // Lower Right Tile


        // Determine team spawn
        for(let i = 0; i < 5; i++) {
            const r = Math.floor(i + Math.random() * (8-i));
            const tmp = possibleSpawn[r];
            possibleSpawn[r] = possibleSpawn[i];
            possibleSpawn[i] = tmp;
        }

        for(player in playerStates) {
            playerStates[player].health = 100;
            playerStates[player].maxHealth = 100;
            playerStates[player].mana = 100;
            playerStates[player].maxMana = 100;
            playerStates[player].dead = false;
            playerStates[player].ready = false;

            playerStates[player].kills = 0,
            playerStates[player].damage = 0,
            playerStates[player].friendlyfire = 0,
            playerStates[player].heals = 0,

            playerStates[player].level = 1,
            playerStates[player].exp = 0,

            playerStates[player].spells = [0, 8];

            // Spawn players according to their team
            playerStates[player].pos.x = possibleSpawn[playerStates[player].team].x + (Math.random() - 0.5) * spawnSize;
            playerStates[player].pos.y = possibleSpawn[playerStates[player].team].y + (Math.random() - 0.5) * spawnSize;

            resetPlayer(player);
        }


        // Spawn in Bots
        const teams = getTeams();
        const botNames = [
            "Banjo", "Tom", "Timmy", "John", "Jimmy",
            "Johan", "Juan",  "Crhistopher", "Adeline", "Ryan",
            "Brian", "Cleverbot", "Smartypants", "Steve", "Genius",
            "Marksman",  "Notdumb",  "Paul",  "Logan", "Jake",
            "Hans",  "Chantal",    "Natasha",     "Vladimir"
        ];
        for(let i = 0; i < 15; i++) {
            const r = Math.floor(i + Math.random() * (15-i));
            const tmp = botNames[r];
            botNames[r] = botNames[i];
            botNames[i] = tmp;
        }
        let botNumber = 0;
        for(i in teams) {
            for(let j = teams[i].length; j < 3; j++) {
                playerStates["Bot " + botNumber] = {
                    name: botNames[botNumber],

                    health: 100,
                    maxHealth: 100,
                    mana: 100,
                    maxMana: 100,

                    pos: {
                        x: possibleSpawn[i].x + (Math.random() - 0.5) * spawnSize, 
                        y: possibleSpawn[i].y + (Math.random() - 0.5) * spawnSize 
                    },
                    velocity: { x: 0, y: 0 },
                    movement: 0,
                    facing: 4,

                    visible: {
                        players: new Set(),
                        interactables: new Set(),
                        spells: new Set(),
                        loots: new Set()
                    },

                    spells: [0, 8],
                    cooldown: 0,
                    interactable: -1,

                    isBot: true,
                    ready: false,
                    spectating: false,
                    team: i,

                    kills: 0,
                    damage: 0,
                    friendlyfire: 0,
                    heals: 0,

                    level: 1,
                    exp: 0,

                    reactionTimeMin: 200 + Math.random() * 100,
                    reactionTimeMax: 300 + Math.random() * 200,

                    dead: false,
                    lastUpdate: Date.now()
                };
                aiCore["Bot " + botNumber] = {
                    target: null,
                    laziness: 1,            // Bias to stay still
                    inertia: 1,             // Bias to keep moving at the current direction
                    shroudAversion: 40,      // Priority of moving towards center
                    teamCoherence: 20,       // Priority to follow teammates
                    prioritizeSpells: 2000,    // Priority to get spell when empty handed
                    greediness: 1,          // Priority to get loot
                    chaotic: 5,             // Random score
                }

                const curBot = botNumber;
                setTimeout(() => { botAction("Bot " + curBot); }, 3000 + playerStates["Bot " + botNumber].reactionTimeMin + Math.random() * playerStates["Bot " + botNumber].reactionTimeMax);
                botNumber++;
            }
        }

        io.emit("start game", startTime);
        io.emit("set announcement", JSON.stringify({ value: "Start!", time: 1000 }));
        console.log("Game Starts");
    }

    let countdownRef = null;
    function gameStartCountdown(time) {
        if(time <= 0) {
            startGame();
            countdownRef = null;
        } else {
            console.log(time + "...");
            io.emit("set announcement", JSON.stringify({ value: time, time: 1000 }));
            countdownRef = setTimeout(() => gameStartCountdown(time - 1), 1000);
        }
    }

    startLobby();

    function generateGameScore() {
        const rank = teamElim.indexOf(playerStates[player].team) == -1 ? 1 : 5 - teamElim.indexOf(playerStates[player].team);
        const scores = {
            teamrank: rank,
            individual: []
        }
        for(player in playerStates) {
            scores.individual.push({
                name: playerStates[player].name,
                kills: playerStates[player].kills,
                damage: playerStates[player].damage,
                friendlyfire: playerStates[player].friendlyfire,
                heals: playerStates[player].heals,
                level: playerStates[player].level,

                score: playerStates[player].kills * 100 + playerStates[player].damage - playerStates[player].friendlyfire + playerStates[player].heals + playerStates[player].level * 10
            });
        }
        scores.individual.sort((a, b) => { return a.score > b.score ? -1 : b.score > a.score ? 1 : 0 });
        return scores;
    }

    function EndGame() {
        gameEnded = true;

        console.log("The game has ended");
        io.emit("set announcement", JSON.stringify({ value: "GAME!", time: 3000 }));
        setTimeout(() => {
            // Generate Scores
            for(player in playerStates) {
                if(playerStates[player].isBot) continue;

                playerStates[player].socket.emit("show score", JSON.stringify(generateGameScore()));
            }
            
            // Remove all Bots
            for(player in playerStates) {
                if(playerStates[player].isBot) delete playerStates[player];
            }

            // Return players to lobby
            io.emit("end game");
            startLobby();
        }, 3000);
    }

    // Update loop
    function update() {
        for(player in playerStates) updatePlayerState(player, true);
        for(spell in spellStates) updateSpellState(spell);

        shroudDamage += 0.2;

        setTimeout(update, 1000);
    }

    update();

    // Export functions
    function hasStarted() { return gameStarted; }
    function getTeams() {
        const teams = [[], [], [], [], []];
        for(let user in playerStates) if(playerStates[user].team >= 0 && playerStates[user].team < 5) teams[playerStates[user].team].push(user);
        return teams;
    }

    function getStartTime() {
        if(!gameStarted) return 0;
        return startTime;
    }

    function addPlayer(player, name, socket) {
        const teams = getTeams();
        const avail = [];
        for(i in teams) if(teams[i].length < 3) avail.push(i);

        playerStates[player] = {
            name: name,
            socket: socket,

            health: 100,
            maxHealth: 100,
            mana: 100,
            maxMana: 100,

            castingPrimary: false,
            castingSecondary: false,

            pos: { x: 0, y: 0 },
            velocity: { x: 0, y: 0 },
            movement: 0,

            dir: 0,
            facing: 4,

            visible: {
                players: new Set(),
                interactables: new Set(),
                spells: new Set(),
                loots: new Set()
            },

            spells: [0, 8],
            cooldown: 0,

            interactable: -1,

            isBot: false,
            ready: false,
            team: (gameStarted || avail.length == 0) ? 5 : avail[Math.floor(Math.random() * avail.length)],
            spectating: (gameStarted || avail.length == 0),

            kills: 0,
            damage: 0,
            friendlyfire: 0,
            heals: 0,

            level: 1,
            exp: 0,

            dead: false,
            lastUpdate: Date.now(),
        }
        if(playerStates[player].team == 5) console.log(name + " is spectating.");
        else console.log(name + " joined team " + playerStates[player].team);
    }

    function resetPlayer(player, socket) {
        if(socket) playerStates[player].socket = socket;
        playerStates[player].ready = false;

        playerStates[player].visible.players.clear();
        playerStates[player].visible.interactables.clear();
        playerStates[player].visible.spells.clear();
        playerStates[player].socket.emit("reset");

        playerStates[player].socket.emit("update entity state", JSON.stringify(getPlayerState(player, player)));

        playerStates[player].socket.emit("set map", JSON.stringify(map.state()));
        playerStates[player].socket.emit("set spell", playerStates[player].spells[0]);
        playerStates[player].socket.emit("set spell", playerStates[player].spells[1]);
        
        playerStates[player].socket.emit("set health", playerStates[player].health);
        playerStates[player].socket.emit("set max health", playerStates[player].maxHealth);
        playerStates[player].socket.emit("set mana", playerStates[player].mana);
        playerStates[player].socket.emit("set max mana", playerStates[player].maxMana);
    }

    function hasPlayer(player) { return (player in playerStates); }

    // Player inputs and actions

    function setPlayerReady(player, ready) {
        if(gameStarted) return;
        if(!(player in playerStates)) return;

        playerStates[player].ready = ready;
        
        let readyCount = 0, playerCount = 0;
        for(id in playerStates) {
            if(playerStates[id].ready) readyCount++;
            playerCount++;
        }
        
        if(ready) {
            console.log(playerStates[player].name + " is ready (" + readyCount + "/" + playerCount + ")");
            if(playerStates[player].interactable != -1) {
                playerStates[player].socket.emit("set interactable message", JSON.stringify({ hide: true }));
                playerStates[player].interactable = -1;
            }
        } else {
            console.log(playerStates[player].name + " cancelled (" + readyCount + "/" + playerCount + ")");
            clearTimeout(countdownRef);
            countdownRef = null;
        }

        if(readyCount == playerCount) {
            console.log("All players are ready. Starting Game in");
            gameStartCountdown(3);
        }
    }

    function setPlayerMovement(player, dir) { playerStates[player].movement = dir; }

    function setPlayerLookat(player, pos) {
        const _x = pos.x - playerStates[player].pos.x;
        const _y = pos.y - playerStates[player].pos.y;
        
        playerStates[player].dir = Math.atan2(_y, _x);
        playerStates[player].facing = Math.round(((playerStates[player].dir * 180 / Math.PI + 450) % 360) / 45) % 8;
    }

    function setPlayerCasting(player, button, value) {
        if(!value) {
            playerStates[player].castingPrimary = false;
            playerStates[player].castingSecondary = false;
        } else {
            if(playerStates[player].cooldown == 0) castSpell(player, button, playerStates[player].dir);
            if(button == 1) playerStates[player].castingPrimary = true;
            if(button == 2) playerStates[player].castingSecondary = true;
        }
    }

    const spells = [
        { empty: true },                                                                                                // Empty
        { velocity: 500, life: 1, damage: 30, spread: 10, knockback: 150, recoil: 100, cooldown: 0.2,  cost: 10 },      // Magic Missile
        { velocity: 300, life: 1, damage: 69420, spread:  0, knockback: 150, recoil:  10, cooldown: 0.05, cost: 5 },    // Killing Curse
        { velocity: 200, life: 3, damage: 15, spread: 15, knockback:  50, recoil:  50, cooldown: 0.1,  cost: 1  },      // Fire Bolt
        { empty: true },                                                                                                // Empty
        { empty: true },                                                                                                // Empty
        { empty: true },                                                                                                // Empty
        { empty: true },                                                                                                // Empty
        
        { empty: true },                                                                                                // Empty
        { velocity: 10, life: 4, damage:  0, spread: 0, knockback:   0, recoil:  20, cooldown: 1, cost: 50 },           // Shield
    ];
    function castSpell(player, button, dir) {
        if(button != 1 && button != 2) return;
        if(playerStates[player].cooldown > 0) return;

        const spellIndex = playerStates[player].spells[button-1];
        if(spells[spellIndex].empty) return;

        if(playerStates[player].mana < spells[spellIndex].cost) return;
        playerStates[player].mana -= spells[spellIndex].cost;
        if(!playerStates[player].isBot) playerStates[player].socket.emit("set mana", playerStates[player].mana);

        spellStates[currentSpellID] = {
            type: spellIndex,
            caster: player,
            pos: { 
                x: playerStates[player].pos.x + 8 * Math.cos(dir), 
                y: playerStates[player].pos.y + 8 * Math.sin(dir)
            },
            dir: dir + (Math.random() - 0.5) * (spells[spellIndex].spread * Math.PI / 180),
            velocity: spells[spellIndex].velocity,
            damage: spells[spellIndex].damage,
            knockback: spells[spellIndex].knockback,
            life: spells[spellIndex].life,
            lastUpdate: Date.now(),
        }
        if(spellIndex == 9) shieldStates.push(currentSpellID);
        currentSpellID++;
        playerStates[player].velocity.x -= spells[spellIndex].recoil * Math.cos(dir);
        playerStates[player].velocity.y -= spells[spellIndex].recoil * Math.sin(dir);
        playerStates[player].cooldown = spells[spellIndex].cooldown;

        switch(spellIndex) {
            case 1: // Magic missiles
                for(id in playerStates) {
                    if(playerStates[id].isBot) continue;
                    if(playerStates[id].visible.players.has(player) || id == player) playerStates[id].socket.emit("play sound effect", 2);
                }
                break;
            case 2: // Killing curse
                for(id in playerStates) {
                    if(playerStates[id].isBot) continue;
                    if(playerStates[id].visible.players.has(player) || id == player) playerStates[id].socket.emit("play sound effect", 4);
                }
                break;
            case 3: // Firebolt
                for(id in playerStates) {
                    if(playerStates[id].isBot) continue;
                    if(playerStates[id].visible.players.has(player) || id == player) playerStates[id].socket.emit("play sound effect", 3);
                }
                break;
                
        }
    }

    function tryInteract(player) {
        if(!(player in playerStates)) return;
        if(playerStates[player].interactable == -1) return;
        if(!(playerStates[player].interactable in interactableStates)) return;

        const type = interactableStates[playerStates[player].interactable].type
        if(type >= 0 && type <= 4) {
            const teams = getTeams();
            if(teams[type].length < 3 && playerStates[player].team != type) {
                playerStates[player].team = type;
                playerStates[player].spectating = false;
                playerStates[player].socket.emit("update entity state", JSON.stringify(Game.getPlayerState(player)));
                console.log(playerStates[player].name + " joined team " + playerStates[player].team);
            }
        } else if(type == 5) {
            if(playerStates[player].team != type) {
                playerStates[player].team = type;
                playerStates[player].spectating = true;
                playerStates[player].socket.emit("update entity state", JSON.stringify(Game.getPlayerState(player)));
                console.log(playerStates[player].name + " is spectating.");
            }
        } else if(type >= 7 && type <= 14) {    // Primary Pedestal

            // Return if player has the same spell already
            if(playerStates[player].spells[0] == type-6) return;

            // Switch the player skill onto the pedestal
            interactableStates[playerStates[player].interactable].type = playerStates[player].spells[0] + 6; 
            if(interactableStates[playerStates[player].interactable].type == 6) {
                interactableStates[playerStates[player].interactable].name = "Empty Pedestal"
                interactableStates[playerStates[player].interactable].disabled = true;
            } else {
                switch(interactableStates[playerStates[player].interactable].type - 6) {
                    case 1: interactableStates[playerStates[player].interactable].name = "Magic Missile"; break;
                    case 2: interactableStates[playerStates[player].interactable].name = "Killing Curse"; break;
                    case 3: interactableStates[playerStates[player].interactable].name = "Fire Bolt"; break;
                }
            }

            // Set new player skill
            playerStates[player].spells[0] = type-6;
            if(!playerStates[player].isBot) playerStates[player].socket.emit("set spell", type - 6);

            // Announce pedestal change
            for(id in playerStates) {
                if(playerStates[id].isBot) continue;
                if(playerStates[id].visible.interactables.has(playerStates[player].interactable)) {
                    playerStates[id].socket.emit("update interactable state", JSON.stringify(generateInteractableState(playerStates[player].interactable)));
                    const message = {
                        disabled: true,
                        name: interactableStates[playerStates[player].interactable].name,
                        content: interactableStates[playerStates[player].interactable].disabled ? interactableStates[playerStates[player].interactable].reject : interactableStates[playerStates[player].interactable].prompt,
                        pos: interactableStates[playerStates[player].interactable].pos,
                    }
                    if(playerStates[id].interactable == playerStates[player].interactable) playerStates[id].socket.emit("set interactable message", JSON.stringify(message));
                }
            }

        } else if(type <= 22) { // Secondary Pedestal

            // Return if player has the same spell already
            if(playerStates[player].spells[1] == type-6) return;

            // Switch the player skill onto the pedestal
            interactableStates[playerStates[player].interactable].type = playerStates[player].spells[1] + 6; 
            if(interactableStates[playerStates[player].interactable].type == 14) {
                interactableStates[playerStates[player].interactable].type = 6;
                interactableStates[playerStates[player].interactable].name = "Empty Pedestal";
                interactableStates[playerStates[player].interactable].disabled = true;
            } else {
                switch(interactableStates[playerStates[player].interactable].type - 6) {
                    case 9: interactableStates[playerStates[player].interactable].name = "Shield"; break;
                }
            }

            // Set new player skill
            playerStates[player].spells[1] = type-6;
            if(!playerStates[player].isBot) playerStates[player].socket.emit("set spell", type - 6);

            // Announce pedestal change
            for(id in playerStates) {
                if(playerStates[id].isBot) continue;
                if(playerStates[id].visible.interactables.has(playerStates[player].interactable)) {
                    playerStates[id].socket.emit("update interactable state", JSON.stringify(generateInteractableState(playerStates[player].interactable)));
                    const message = {
                        disabled: true,
                        name: interactableStates[playerStates[player].interactable].name,
                        content: interactableStates[playerStates[player].interactable].disabled ? interactableStates[playerStates[player].interactable].reject : interactableStates[playerStates[player].interactable].prompt,
                        pos: interactableStates[playerStates[player].interactable].pos,
                    }
                    if(playerStates[id].interactable == playerStates[player].interactable) playerStates[id].socket.emit("set interactable message", JSON.stringify(message));
                }
            }
        }
    }

    function activateCheat(player) {
        if(!gameStarted) return;
        if(playerStates[player].spectating) return;

        playerStates[player].spells[0] = 2;
        playerStates[player].socket.emit("set spell", 2);
    }

    // Visibility checks
    function isPlayerVisible(p1, p2) {
        if(!(p1 in playerStates) || !(p2 in playerStates)) return false;

        const _x = playerStates[p1].pos.x - playerStates[p2].pos.x;
        const _y = playerStates[p1].pos.y - playerStates[p2].pos.y;
        
        if(_x * _x + _y * _y <= visibleRange * visibleRange) return true;
        else return false;
    }

    function isInteractableVisible(player, index) {
        if(!(index in interactableStates)) return false;
        if(!(player in playerStates)) return false;

        const _x = playerStates[player].pos.x - interactableStates[index].pos.x;
        const _y = playerStates[player].pos.y - interactableStates[index].pos.y;
        
        if(_x * _x + _y * _y <= visibleRange * visibleRange) return true;
        else return false;
    }

    function isSpellVisible(player, index) {
        if(!(index in spellStates)) return false;
        if(!(player in playerStates)) return false;

        const _x = playerStates[player].pos.x - spellStates[index].pos.x;
        const _y = playerStates[player].pos.y - spellStates[index].pos.y;

        if(_x * _x + _y * _y <= visibleRange * visibleRange) return true;
        else return false;
    }

    function isLootVisible(player, id) {
        if(!(id in lootStates)) return false;
        if(!(player in playerStates)) return false;

        const _x = playerStates[player].pos.x - lootStates[id].pos.x;
        const _y = playerStates[player].pos.y - lootStates[id].pos.y;
        
        if(_x * _x + _y * _y <= visibleRange * visibleRange) return true;
        else return false;
    }

    function isInShroud(x, y) {
        const time = (Date.now() - startTime) / 1000;
        const mapWidth = map.getWidth();
        const mapHeight = map.getHeight();
        let cornerX = 0;
        let cornerY = 0;

        if(time <= 30) return false;
        else if(time <= 60) { // Full to Half
            cornerX = mapWidth  / 4 + ( mapWidth / 4 ) * (60 - time) / 30;
            cornerY = mapHeight / 4 + ( mapWidth / 4 ) * (60 - time) / 30;
        } else if(time <= 90) {
            cornerX = mapWidth  / 4;
            cornerY = mapHeight / 4;
        } else if(time <= 120) { // Half to arena
            cornerX = 160 + ( mapWidth  / 4 - 160 ) * (120 - time) / 30;
            cornerY =  90 + ( mapHeight / 4 -  90 ) * (120 - time) / 30;
        } else if(time <= 150) {
            cornerX = 160;
            cornerY = 90;
        } else if(time <= 180) {
            cornerX = 160 * (180 - time) / 30;
            cornerY =  90 * (180 - time) / 30;
        }

        if(x < -cornerX || x >= cornerX) return true;
        if(y < -cornerY || y >= cornerY) return true;

        return false;
    }

    // State Updates
    function updatePlayerState(player, mainUpdate = false) {

        // In case player has logged out, disconnected, etc
        if(!(player in playerStates)) return;

        // Get Time since last update, skip update if last update was less than 10ms ago
        const deltaTime = ( Date.now() - playerStates[player].lastUpdate ) / 1000;
        playerStates[player].lastUpdate = Date.now();

        // Regenerate Mana
        if(playerStates[player].cooldown == 0) {
            playerStates[player].mana = Math.min(playerStates[player].maxMana, playerStates[player].mana + playerManaRegeneration * deltaTime);
            if(!playerStates[player].isBot) playerStates[player].socket.emit("set mana", playerStates[player].mana);
        }

        // Cooldown & Spell casting
        playerStates[player].cooldown = Math.max(0, playerStates[player].cooldown - deltaTime);
        if(playerStates[player].castingPrimary) castSpell(player, 1, playerStates[player].dir);


        updatePlayerPos(player);
        if(mainUpdate) updatePlayerVisibility(player);
        updatePlayerVelocity(player);
            
        // Shroud Damage
        if(gameStarted && isInShroud(playerStates[player].pos.x, playerStates[player].pos.y)) {
            DamagePlayer(player, shroudDamage * deltaTime, null);
        }

        function updatePlayerPos(player) {

            function checkValid(x, y) {
                if(!map.valid(x, y)) return false;

                for(id in interactableStates) {
                    const _x = interactableStates[id].pos.x - x;
                    const _y = interactableStates[id].pos.y - y;
                    const _r = interactableStates[id].size + playerRadius;
                    if(_x * _x + _y * _y <= _r * _r) return false;
                }

                return true;
            }

            // Collision checking
            if(!checkValid(playerStates[player].pos.x + playerStates[player].velocity.x * deltaTime, playerStates[player].pos.y + playerStates[player].velocity.y * deltaTime)) {
                playerStates[player].velocity.x = -playerStates[player].velocity.x;
                playerStates[player].velocity.y = -playerStates[player].velocity.y;
            }

            playerStates[player].pos.x += playerStates[player].velocity.x * deltaTime;
            playerStates[player].pos.y += playerStates[player].velocity.y * deltaTime;
        }
        
        function updatePlayerVisibility(player) {

            // Update visibility of other players
            for(id in playerStates) {
                if(player == id) continue;
                if(isPlayerVisible(player, id)) {
                    if(!playerStates[player].visible.players.has(id)) {
                        playerStates[player].visible.players.add(id);
                        if(!playerStates[player].isBot) playerStates[player].socket.emit("update entity state", JSON.stringify(generatePlayerState(id)));
                    }
                } else {
                    if(playerStates[player].visible.players.has(id)) {
                        playerStates[player].visible.players.delete(id);
                        if(!playerStates[player].isBot) playerStates[player].socket.emit("update entity state", JSON.stringify({ username: id, hide: true }));
                    }
                }
            }

            // Update visibility of surrounding interactables
            for(id in interactableStates) {
                if(isInteractableVisible(player, id)) {
                    if(!playerStates[player].visible.interactables.has(id)) {
                        playerStates[player].visible.interactables.add(id);
                        if(!playerStates[player].isBot) playerStates[player].socket.emit("update interactable state", JSON.stringify(generateInteractableState(id)));
                    }
                } else {
                    if(playerStates[player].visible.interactables.has(id)) {
                        playerStates[player].visible.interactables.delete(id);
                        if(!playerStates[player].isBot) playerStates[player].socket.emit("update interactable state", JSON.stringify({ id: id, hide: true }));
                    }
                }
            }

            // Update visibility of spells
            for(id in spellStates) {
                if(isSpellVisible(player, id)) {
                    if(!playerStates[player].visible.spells.has(id)) {
                        playerStates[player].visible.spells.add(id);
                        if(!playerStates[player].isBot) playerStates[player].socket.emit("update spell state", JSON.stringify(generateSpellState(id)));
                    }
                } else {
                    if(playerStates[player].visible.spells.has(id)) {
                        playerStates[player].visible.spells.delete(id);
                        if(!playerStates[player].isBot) playerStates[player].socket.emit("update spell state", JSON.stringify({ id: id, hide: true }));
                    }
                }
            }

            // Update visibility of loots
            for(id in lootStates) {
                if(isLootVisible(player, id)) {
                    if(!playerStates[player].visible.loots.has(id)) {
                        playerStates[player].visible.loots.add(id);
                        if(!playerStates[player].isBot) playerStates[player].socket.emit("update loot state", JSON.stringify(generateLootState(id)));
                    }   
                } else {
                    if(playerStates[player].visible.loots.has(id)) {
                        playerStates[player].visible.loots.delete(id);
                        if(!playerStates[player].isBot) playerStates[player].socket.emit("update loot state", JSON.stringify({ id: id, hide: true }));
                    }
                }
            }

            // Check interactables in reach
            if(playerStates[player].interactable == -1) {
                if(playerStates[player].ready == false && (!gameStarted || playerStates[player].spectating == false)) {
                    playerStates[player].visible.interactables.forEach(id => {
                        if(id in interactableStates) {
                            const _x = playerStates[player].pos.x - interactableStates[id].pos.x;
                            const _y = playerStates[player].pos.y - interactableStates[id].pos.y;
            
                            if(_x * _x + _y * _y <= interactableStates[id].reach * interactableStates[id].reach) {
                                const message = {
                                    disabled: interactableStates[id].disabled,
                                    name: interactableStates[id].name,
                                    content: interactableStates[id].disabled ? interactableStates[id].reject : interactableStates[id].prompt,
                                    pos: interactableStates[id].pos,
                                }
                                playerStates[player].interactable = id;
                                if(!playerStates[player].isBot) playerStates[player].socket.emit("set interactable message", JSON.stringify(message));
                            }
                        }
                    });
                }
            } else {
                if(playerStates[player].interactable in interactableStates) {
                    const _x = playerStates[player].pos.x - interactableStates[playerStates[player].interactable].pos.x;
                    const _y = playerStates[player].pos.y - interactableStates[playerStates[player].interactable].pos.y;
    
                    if(_x * _x + _y * _y > interactableStates[playerStates[player].interactable].reach * interactableStates[playerStates[player].interactable].reach) {
                        if(!playerStates[player].isBot) playerStates[player].socket.emit("set interactable message", JSON.stringify({ hide: true }));
                        playerStates[player].interactable = -1;
                    }
                }
            }
        }

        function updatePlayerVelocity(player) {

            // Generate Vector for acceleration
            const accelerateDir = { x: 0, y: 0 }
            if(playerStates[player].movement & 1) accelerateDir.y -= 1;
            if(playerStates[player].movement & 2) accelerateDir.x += 1;
            if(playerStates[player].movement & 4) accelerateDir.y += 1;
            if(playerStates[player].movement & 8) accelerateDir.x -= 1;
            
            // Normalize acceleration Vector
            const normalLength = Math.sqrt(accelerateDir.x * accelerateDir.x + accelerateDir.y * accelerateDir.y);
            if(normalLength) {
                accelerateDir.x /= normalLength;
                accelerateDir.y /= normalLength;
            }

            // Decelerate Player if not accelerating towards moving direction
            let velocityMagnituide = Math.sqrt(playerStates[player].velocity.x * playerStates[player].velocity.x + playerStates[player].velocity.y * playerStates[player].velocity.y);
            if(velocityMagnituide) {
                const normalizeVelocity = { x: playerStates[player].velocity.x / velocityMagnituide, y: playerStates[player].velocity.y / velocityMagnituide }
                const dot = normalizeVelocity.x * accelerateDir.x + normalizeVelocity.y * accelerateDir.y;
                if(dot <= 0.5) {
                    playerStates[player].velocity.x = Math.abs(playerDeceleration * normalizeVelocity.x * deltaTime) > Math.abs(playerStates[player].velocity.x) ? 0 : playerStates[player].velocity.x - playerDeceleration * normalizeVelocity.x * deltaTime;
                    playerStates[player].velocity.y = Math.abs(playerDeceleration * normalizeVelocity.y * deltaTime) > Math.abs(playerStates[player].velocity.y) ? 0 : playerStates[player].velocity.y - playerDeceleration * normalizeVelocity.y * deltaTime;
                }
            }

            // Accelerate Player
            const targetVelocity = { x: accelerateDir.x * playerMaxVelocity, y: accelerateDir.y * playerMaxVelocity };
            const offset = { x: targetVelocity.x - playerStates[player].velocity.x, y: targetVelocity.y - playerStates[player].velocity.y };
            const offsetMagnitude = Math.sqrt(offset.x * offset.x + offset.y * offset.y);
            
            if(offsetMagnitude) {
                offset.x /= offsetMagnitude;
                offset.y /= offsetMagnitude;
            }

            playerStates[player].velocity.x += offset.x * playerAcceleration * deltaTime;
            playerStates[player].velocity.y += offset.y * playerAcceleration * deltaTime;

            // Cap player velocity
            velocityMagnituide = Math.sqrt(playerStates[player].velocity.x * playerStates[player].velocity.x + playerStates[player].velocity.y * playerStates[player].velocity.y);
            if(velocityMagnituide > playerMaxVelocity) {
                playerStates[player].velocity.x = playerStates[player].velocity.x / velocityMagnituide * playerMaxVelocity;
                playerStates[player].velocity.y = playerStates[player].velocity.y / velocityMagnituide * playerMaxVelocity;
            }
        }
    }

    function updateSpellState(id) {
        if(id < 0 || id >= spellStates.length) return;

        // Get Time since last update, skip update if last update was less than 10ms ago
        const deltaTime = ( Date.now() - spellStates[id].lastUpdate ) / 1000;
        spellStates[id].lastUpdate = Date.now();

        // Remove expired spell
        spellStates[id].life -= deltaTime;
        if(spellStates[id].life <= 0) return delete spellStates[id];

        // Check collision
        const bullet = { x: spellStates[id].velocity * Math.cos(spellStates[id].dir) * deltaTime, y: spellStates[id].velocity * Math.sin(spellStates[id].dir) * deltaTime }
        const mid = { x: spellStates[id].pos.x + bullet.x / 2, y: spellStates[id].pos.y + bullet.y / 2 }

        for(player in playerStates) {
            if(player == spellStates[id].caster) continue;
            if(playerStates[player].dead) continue;

            const distance = { x: playerStates[player].pos.x - spellStates[id].pos.x, y: playerStates[player].pos.y - spellStates[id].pos.y }

            const segLength = (distance.x * bullet.x + distance.y * bullet.y) / (bullet.x * bullet.x + bullet.y * bullet.y);
            const proj = { x: spellStates[id].pos.x + segLength * bullet.x, y: spellStates[id].pos.y + segLength * bullet.y }

            const _mx = mid.x - proj.x;
            const _my = mid.y - proj.y;

            if(_mx * _mx + _my * _my > bullet.x * bullet.x + bullet.y * bullet.y) continue;

            const _x = proj.x - playerStates[player].pos.x;
            const _y = proj.y - playerStates[player].pos.y;

            if(_x * _x + _y * _y <= playerRadius * playerRadius) {
                return spellHit(id, player);
            }
        }
        
        
        for(shield in shieldStates) {
            if(!(shieldStates[shield] in spellStates)) {
                shieldStates.splice(shield, 1);
            }
        }

        for(shield in shieldStates) {
            if(id == shieldStates[shield]) continue;
            if(spellStates[id].caster == spellStates[shieldStates[shield]].caster) continue;

            const _x = spellStates[id].pos.x + spellStates[id].velocity * Math.cos(spellStates[id].dir) * deltaTime - spellStates[shieldStates[shield]].pos.x;
            const _y = spellStates[id].pos.y + spellStates[id].velocity * Math.sin(spellStates[id].dir) * deltaTime - spellStates[shieldStates[shield]].pos.y;

            if(_x * _x + _y * _y <= 8 * 8) {
                if(spellStates[id].type == 9) delete spellStates[shieldStates[shield]];
                return delete spellStates[id];
            }
        }

        // Move spell
        spellStates[id].pos.x += spellStates[id].velocity * Math.cos(spellStates[id].dir) * deltaTime;
        spellStates[id].pos.y += spellStates[id].velocity * Math.sin(spellStates[id].dir) * deltaTime;

    }

    function updateLootState(id) {
        
        const deltaTime = ( Date.now() - lootStates[id].lastUpdate ) / 1000;
        lootStates[id].lastUpdate = Date.now();

        // Handle pickup
        let magneted = false;
        for(player in playerStates) {
            if(playerStates[player].spectating) continue;
            if(playerStates[player].dead) continue;

            const _x = lootStates[id].pos.x - playerStates[player].pos.x;
            const _y = lootStates[id].pos.y - playerStates[player].pos.y ;

            if(_x * _x + _y * _y <= 16 * 16) {
                playerStates[player].exp += 1;
                if(playerStates[player].exp >= playerStates[player].level * 10) {

                    playerStates[player].exp -= playerStates[player].level * 2;
                    playerStates[player].level += 1;

                    playerStates[player].maxHealth += 20;
                    playerStates[player].health = Math.min(playerStates[player].maxHealth, playerStates[player].health + 30);

                    playerStates[player].maxMana += 20;
                    playerStates[player].mana = playerStates[player].maxMana;

                    if(!playerStates[player].isBot) {
                        playerStates[player].socket.emit("set max health", playerStates[player].maxHealth);
                        playerStates[player].socket.emit("set max mana", playerStates[player].maxMana);
                    }
                }
                playerStates[player].health = Math.min(playerStates[player].maxHealth, playerStates[player].health + 5);
                playerStates[player].mana += Math.min(playerStates[player].maxMana, playerStates[player].mana + 5);
                if(!playerStates[player].isBot) {
                    
                    playerStates[player].socket.emit("set health", playerStates[player].health);
                    playerStates[player].socket.emit("set mana", playerStates[player].mana);
                }

                return delete lootStates[id];
            }

            if(_x * _x + _y * _y <= magnetRadius * magnetRadius) {
                magneted = true;
                lootStates[id].velocity.x -= _x * 20 * deltaTime;
                lootStates[id].velocity.y -= _y * 20 * deltaTime;
            }
        }

        // Deceleration
        if(!magneted) {
            const velocityMagnituide = Math.sqrt(lootStates[id].velocity.x * lootStates[id].velocity.x + lootStates[id].velocity.y * lootStates[id].velocity.y);
            const normalizeVelocity = { x: lootStates[id].velocity.x / velocityMagnituide, y: lootStates[id].velocity.y / velocityMagnituide };
    
            lootStates[id].velocity.x -= normalizeVelocity.x * 600 * deltaTime;
            lootStates[id].velocity.y -= normalizeVelocity.y * 600 * deltaTime;
        }

        // Move Loot by velocity
        lootStates[id].pos.x += lootStates[id].velocity.x * deltaTime;
        lootStates[id].pos.y += lootStates[id].velocity.y * deltaTime;
    }

    function botAction(player) {

        function weightedRandom(weights) {
            let sum = 0;
            for(i in weights) weights[i] = Math.max(0, weights[i]);
            for(i in weights) sum += weights[i];
            let rand = Math.random() * sum;
            for(i in weights) {
                if(rand < weights[i]) return i;
                rand -= weights[i];
            }
            return weights[0];
        }

        function getTeamCenter(team) {
            const teams = getTeams();
            let sumX = 0, sumY = 0;
            for(let i = 0; i < 3; i++) {
                sumX += playerStates[teams[team][i]].pos.x;
                sumY += playerStates[teams[team][i]].pos.y;
            }
            return { x: sumX / 3, y: sumY / 3 }
        }

        function normalizeDot(va, vb) {
            const ma = Math.sqrt(va.x * va.x + va.y * va.y);
            const mb = Math.sqrt(vb.x * vb.x + vb.y * vb.y);

            if(ma == 0 || mb == 0) return 0;

            const nva = { x: va.x / ma, y: va.y / ma }
            const nvb = { x: vb.x / mb, y: vb.y / mb }

            return nva.x * nvb.x + nva.y * nvb.y;
        }

        if(gameEnded) return;
        if(!(player in playerStates)) return;
        if(!playerStates[player].isBot) return;
        if(playerStates[player].dead) return;

        // Update states to get accurate visible objects
        updatePlayerState(player, true);

        // Decide movement
        const scores = {
            0:  1,  // Stop
            1:  1,  // Up
            3:  1,  // Up-right
            2:  1,  // Right
            6:  1,  // Down-right
            4:  1,  // Down
            12: 1,  // Down-left
            8:  1,  // Left
            9:  1,  // Up-left
        };

        scores[0] += aiCore[player].laziness;
        if(playerStates[player].movement in scores) scores[playerStates[player].movement] += aiCore[player].inertia;
        for(i in scores) {
            let dir = { x: (i & 2) / 2 - (i & 8) / 8, y: (i & 4) / 4 - (i & 1) / 1};
            const dot = normalizeDot(dir, playerStates[player].pos);

            scores[i] -= dot * aiCore[player].shroudAversion;
        }

        const teamCenter = getTeamCenter(playerStates[player].team);
        const toTeamCenter = { x: teamCenter.x - playerStates[player].pos.x, y: teamCenter.y - playerStates[player].pos.y }
        for(i in scores) {
            let dir = { x: (i & 2) / 2 - (i & 8) / 8, y: (i & 4) / 4 - (i & 1) / 1};
            const dot = normalizeDot(dir, toTeamCenter);

            scores[i] += dot * aiCore[player].teamCoherence;
        }

        // Pick ups and Interactable
        if(playerStates[player].spells[0] == 0) {
            if(playerStates[player].interactable != -1 && interactableStates[playerStates[player].interactable].type >= 7 && interactableStates[playerStates[player].interactable].type <= 14) tryInteract(player);
            

            const potentialSpell = Array.from(playerStates[player].visible.interactables).filter(e => (interactableStates[e].type >= 7 && interactableStates[e].type <= 14));
            if(potentialSpell.length > 0) {
                const targetSpell = potentialSpell[Math.floor(Math.random() * potentialSpell.length)];
                const toTargetSpell = { x: interactableStates[targetSpell].pos.x - playerStates[player].pos.x, y: interactableStates[targetSpell].pos.y - playerStates[player].pos.y };

                for(i in scores) {
                    let dir = { x: (i & 2) / 2 - (i & 8) / 8, y: (i & 4) / 4 - (i & 1) / 1};
                    const dot = normalizeDot(dir, toTargetSpell);
        
                    scores[i] += dot * aiCore[player].prioritizeSpells;
                }
            }
        } 
        if(playerStates[player].spells[1] == 8){
            if(playerStates[player].interactable != -1 && interactableStates[playerStates[player].interactable].type >= 15 && interactableStates[playerStates[player].interactable].type <= 22) tryInteract(player);
            
            const potentialSpell = Array.from(playerStates[player].visible.interactables).filter(e => (interactableStates[e].type >= 15 && interactableStates[e].type <= 22));
            if(potentialSpell.length > 0) {
                const targetSpell = potentialSpell[Math.floor(Math.random() * potentialSpell.length)];
                const toTargetSpell = { x: interactableStates[targetSpell].pos.x - playerStates[player].pos.x, y: interactableStates[targetSpell].pos.y - playerStates[player].pos.y };

                for(i in scores) {
                    let dir = { x: (i & 2) / 2 - (i & 8) / 8, y: (i & 4) / 4 - (i & 1) / 1};
                    const dot = normalizeDot(dir, toTargetSpell);
        
                    scores[i] += dot * aiCore[player].prioritizeSpells;
                }
            }
        }

        for(i in scores) {
            scores[i] += aiCore[player].chaotic;
        }

        // Cast spells at enemies
        if(aiCore[player].target && (playerStates[aiCore[player].target].dead || playerStates[aiCore[player].target].spectating)) aiCore[player].target = null;
        if(playerStates[player].visible.players.has(aiCore[player].target)) {
            // Look at target
            setPlayerLookat(player, { x: playerStates[aiCore[player].target].pos.x, y: playerStates[aiCore[player].target].pos.y })
            setPlayerCasting(player, 1, true);


        } else {
            // Stop casting and change target
            setPlayerCasting(player, 1, false);
            aiCore[player].target = null;
            const targetList = Array.from(playerStates[player].visible.players).filter((potentialTarget) => { return playerStates[potentialTarget].team != playerStates[player].team; });
            if(targetList.length > 0) aiCore[player].target = targetList[Math.floor(Math.random() * targetList.length)];
        }

        setPlayerMovement(player, weightedRandom(scores));

        setTimeout(() => { botAction(player); }, playerStates[player].reactionTimeMin + Math.random() * playerStates[player].reactionTimeMax);
    }

    function spellHit(id, player) {

        // Generic spell hit
        playerStates[player].velocity.x += spellStates[id].knockback * Math.cos(spellStates[id].dir);
        playerStates[player].velocity.y += spellStates[id].knockback * Math.sin(spellStates[id].dir);
        DamagePlayer(player, spellStates[id].damage, spellStates[id].caster);
        
        // remove spell from existence
        delete spellStates[id];
    }

    function DamagePlayer(player, damage, source) {
        if(gameEnded) return;
        if(!gameStarted) return;
        if(playerStates[player].spectating) return;
        if(playerStates[player].dead) return;

        playerStates[player].health -= damage;
        if(source) {
            if(playerStates[player].team == playerStates[source].team) playerStates[source].friendlyfire += damage;
            else playerStates[source].damage += damage;
        }
        if(!playerStates[player].isBot) playerStates[player].socket.emit("set health", playerStates[player].health);
        if(playerStates[player].health <= 0) KillPlayer(player, source);
    }

    function HealPlayer(player, heal, source) {

    }

    function KillPlayer(player, killer) {
        if(gameEnded) return;

        playerStates[player].dead = true;
        playerStates[player].spectating = true;
        playerStates[player].spells = [0, 0];
        if(killer) playerStates[killer].kills += 1;

        // Spawn loots
        for(let i = 0; i < 10 + playerStates[player].level * 5; i++) {
            const spd = Math.random() * 300;
            const dir = (Math.random() - 0.5) * 2 * Math.PI;
            lootStates[currentLootID] = { 
                pos: { x: playerStates[player].pos.x, y: playerStates[player].pos.y }, 
                velocity: { x: Math.cos(dir) * spd, y: Math.sin(dir) * spd }, 
                lastUpdate: Date.now() }
            lootStates[currentLootID].velocity.x += playerStates[player].velocity.x;
            lootStates[currentLootID].velocity.y += playerStates[player].velocity.y;

            currentLootID++;
        }

        // Get a list of surviving players
        const teams = getTeams();
        const remain = [];

        let wipe = true;
        for(i in teams) {
            for(j in teams[i]) {
                if(!playerStates[teams[i][j]].dead) {
                    remain.push(teams[i][j]);
                    if(i == playerStates[player].team) wipe = false;
                }
            }
        }

        console.log(playerStates[player].name + " is killed by " + ( killer ? playerStates[killer].name : "the shroud" ) + ". " + remain.length + "/15 players remaining.");
        for(id in playerStates) {
            if(playerStates[id].isBot) continue;
            if(playerStates[id].visible.players.has(player) || id == player) playerStates[id].socket.emit("play sound effect", 5);
        }

        if(wipe) {
            teamElim.push(playerStates[player].team);
            console.log("Team " + (Number(playerStates[player].team) + 1) + " is eliminated. " + (5 - teamElim.length) + "/5 teams left.");
        }

        // End the game if all surviving players are of the same team
        let end = (() => {
            if(remain.length <= 3) {
                for(i in remain) {
                    if(playerStates[remain[i]].team != playerStates[remain[0]].team) return false;
                }
                return true;
            }
            return false;
        })();

        if(end) {
            EndGame();
        }
    }

    // Lazy getters
    function getPlayerState(caller, player) {
        if(caller == player) updatePlayerState(player, true);
        if(!isPlayerVisible(caller, player)) return { username: player, hide: true }
        updatePlayerState(player);

        return generatePlayerState(player);
    }

    function getSpellState(caller, id) {
        if(!isSpellVisible(caller, id)) return { id: id, hide: true };
        updateSpellState(id);
        return generateSpellState(id);
    }

    function getLootState(caller, id) {
        if(!isLootVisible(caller, id)) return { id: id, hide: true };
        updateLootState(id);
        return generateLootState(id);
    }

    // Disconnection
    function removePlayer(player) {
        delete playerStates[player];
        for(player in playerStates) {
            playerStates[player].visible.players.delete(player);
        }
    }

    return { 
        hasStarted, getTeams, getStartTime,
        addPlayer, hasPlayer, resetPlayer, setPlayerReady,
        setPlayerMovement, setPlayerLookat, setPlayerCasting, tryInteract, activateCheat,
        getPlayerState, getSpellState, getLootState,
        removePlayer
    }
})();

io.on("connection", (socket) => {
    if(!socket.request.session.user) return;

    const username = socket.request.session.user.username;
    const name = socket.request.session.user.name;
    
    if(Game.hasPlayer(username)) console.log(name + " has reconnected.");
    else Game.addPlayer(username, name, socket);

    Game.resetPlayer(username, socket);

    socket.emit("initialize game");
    if(Game.hasStarted()) socket.emit("start game", Game.getStartTime());

    socket.on("set player ready", (ready) => { Game.setPlayerReady(username, ready); });
    socket.on("set player movement", (dir) => { Game.setPlayerMovement(username, dir); });
    socket.on("set player lookat", (pos) => { Game.setPlayerLookat(username,  JSON.parse(pos)); });

    socket.on("set player casting", (message) => { 
        const info = JSON.parse(message);
        Game.setPlayerCasting(username, info.type, info.value); 
    });

    socket.on("interact", () => { Game.tryInteract(username); });
    socket.on("cheat", () => { Game.activateCheat(username); });

    socket.on("get player state", (id) => { socket.emit("update entity state", JSON.stringify(Game.getPlayerState(username, id))); });
    socket.on("get spell state", (id) => { socket.emit("update spell state", JSON.stringify(Game.getSpellState(username, id))); });
    socket.on("get loot state", (id) => { socket.emit("update loot state", JSON.stringify(Game.getLootState(username, id))); });

    socket.on("disconnect", () => {
        if(Game.hasStarted()) {
            console.log(name + " disconnected.");
        } else {
            Game.removePlayer(username);    
            console.log(name + " left the game.");
        }
    });
});

httpServer.listen(8000, () => {
    console.log("Starting game server...");
});