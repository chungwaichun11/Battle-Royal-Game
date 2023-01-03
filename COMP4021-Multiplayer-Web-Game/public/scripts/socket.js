const Socket = (function() {
    let socket = null;

    const getSocket = function() { return socket; };

    const connect = function() {
        socket = io();

        socket.on("initialize game", () => {
            Game.initialize();
        });

        socket.on("start game", (time) => {
            Game.start(time);
        });

        socket.on("end game", () => {
            Game.end();
        });

        socket.on("set map", (message) => {
            const info = JSON.parse(message);
            Game.setMap(info);
        });

        socket.on("reset", () => {
            Game.resetRenderer();
        });

        socket.on("update entity state", (message) => {
            const state = JSON.parse(message);
            if(state.hide) Game.hideEntity(state.username);
            else Game.updateEntityState(state.username, state.pos.x, state.pos.y, state.facing, state.moving, state.team, state.spectating);
        });

        socket.on("update interactable state", (message) => {
            const state = JSON.parse(message);
            if(state.hide) Game.hideInteractable(state.id);
            else Game.updateInteractableState(state.id, state.type, state.pos.x, state.pos.y);
        });

        socket.on("set interactable message", (message) => {
            const info = JSON.parse(message);
            if(info.hide) Game.setInteractableMessage(null);
            else Game.setInteractableMessage(info);
        });

        socket.on("update spell state", (message) => {
            const state = JSON.parse(message);
            if(state.hide) Game.hideSpell(state.id);
            else Game.updateSpellState(state.id, state.type, state.pos.x, state.pos.y, state.dir);
        });

        socket.on("update loot state", (message) => {
            const state = JSON.parse(message);
            if(state.hide) Game.hideLoot(state.id);
            else Game.updateLootState(state.id, state.pos.x, state.pos.y);
        });

        socket.on("set announcement", (message) => {
            const info = JSON.parse(message);
            Game.setAnnouncement(info.value, info.time);
        });

        socket.on("play sound effect", (id) => {
            Game.playSoundEffect(id);
        });

        socket.on("set spell", (spell) => {
            Game.setSpell(spell);
        });

        socket.on("set health", (health) => {
            Game.setHealth(health);
        });

        socket.on("set max health", (maxHealth) => {
            Game.setMaxHealth(maxHealth);
        });

        socket.on("set mana", (mana) => {
            Game.setMana(mana);
        });

        socket.on("set max mana", (maxMana) => {
            Game.setMaxMana(maxMana);
        });

        socket.on("show score", (message) => {
            const info = JSON.parse(message);
            ScoreBoard.update(info);
        });
    };

    const setPlayerReady = function(ready) {
        if(socket && socket.connected) {
            socket.emit("set player ready", ready);
        }
    }

    const setPlayerMovement = function(dir) {
        if(socket && socket.connected) {
            socket.emit("set player movement", dir);
        }
    }

    const setPlayerLookat = function(pos) {
        if(socket && socket.connected) {
            socket.emit("set player lookat", JSON.stringify(pos));
        }
    }

    const interact = function() {
        if(socket && socket.connected) {
            socket.emit("interact");
        }
    }

    const setPlayerCasting = function(type, value) {
        if(socket && socket.connected) {
            message = JSON.stringify({type, value});
            socket.emit("set player casting", message);
        }
    }

    const cheat = function() {
        if(socket && socket.connected) {
            socket.emit("cheat");
        }
    }

    const getEntityState = function(entity) {
        if(socket && socket.connected) {
            socket.emit("get player state", entity);
        }
    }

    const getSpellState = function(id) {
        if(socket && socket.connected) {
            socket.emit("get spell state", id);
        }
    }

    const getLootState = function(id) {
        if(socket && socket.connected) {
            socket.emit("get loot state", id);
        }
    }

    const disconnect = function() {
        socket.disconnect();
        socket = null;
    };

    return { 
        getSocket, 
        connect, disconnect, setPlayerReady,
        setPlayerMovement, setPlayerLookat, interact, setPlayerCasting, cheat,
        getEntityState, getSpellState, getLootState
    };
})();