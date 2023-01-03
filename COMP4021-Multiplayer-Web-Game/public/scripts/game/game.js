const Game = (function() {

    let canPlaySound = false;

    let started = false;
    let gameStartTime = 0;
    let timeSinceStart = 0;

    // Canvas
    const cv = $("canvas").get(0);
    cv.width = 320;
    cv.height = 180;

    const ctx = cv.getContext("2d");

    // Music and Audio
    const sounds = [
        new Audio("sounds/Lobby.mp3"),
        new Audio("sounds/Battle.mp3"),
        new Audio("sounds/missile.mp3"),
        new Audio("sounds/firebolt.mp3"),
        new Audio("sounds/trap.mp3"),
        new Audio("sounds/kill.mp3")
    ]

    // Camera and Rendering
    const camera = Camera(0, 0);
    let entities = {};
    let interactables = {};
    let spells = {};
    let loots = {};
    let player = null;

    const bg = Background(ctx);
    const shroud = Shroud(ctx);

    // User interfaces
    const prompt = Prompt(ctx);

    const spellSlotLeft  = SpellSlot(ctx, 272, 164).setSpellIndex(0);
    const spellSlotRight = SpellSlot(ctx, 304, 164).setSpellIndex(8);
    const gauges = Gauges(ctx);
    const readyBtn = ReadyBtn(ctx);
    const timer = Timer(ctx);
    const announcement = Announcement(ctx);

    function setMap(mapInfo) {
        shroud.setMapSize(mapInfo.bounds.maxX - mapInfo.bounds.minX, mapInfo.bounds.maxY - mapInfo.bounds.minY);
        camera.setBounds(mapInfo.bounds.minX, mapInfo.bounds.minY, mapInfo.bounds.maxX, mapInfo.bounds.maxY);
        bg.setTiles(mapInfo.tiles, mapInfo.bounds.minX, mapInfo.bounds.minY);
    }

    function resetRenderer() {
        entities = {};
        interactables = {};
        spells = {};
        loots = {};
    }
    
    function updateEntityState(id, x, y, facing, moving, team, spectating) {
        if(id == Authentication.getUser().username) {
            if(!player) player = Entity(ctx, x, y, team);
            else player.setState(x, y, facing, moving, team, spectating);
        } else {
            if(spectating) hideEntity(id);
            else if(!(id in entities)) entities[id] = Entity(ctx, x, y, team);
            else entities[id].setState(x, y, facing, moving, team);
        }
    }

    function hideEntity(id) {
        delete entities[id];
    }

    function updateInteractableState(id, type, x, y) {
        interactables[id] = Interactable(ctx, type, x, y);
    }

    function hideInteractable(id) {
        delete interactables[id];
    }

    function updateSpellState(id, type, x, y, dir) {
        if(id in spells) spells[id].setPos(x, y);
        else spells[id] = Spell(ctx, type, x, y, dir);
    }

    function hideSpell(id) {
        delete spells[id];
    }

    function updateLootState(id, x, y) {
        if(id in loots) loots[id].setPos(x, y);
        else loots[id] = Loot(ctx, x, y);
    }

    function hideLoot(id) {
        delete loots[id];
    }

    function setInteractableMessage(message) {
        prompt.set(message);
    }

    function setSpell(spell) {
        if(spell <= 0) return;
        if(spell <= 7) return spellSlotLeft.setSpellIndex(spell);
        if(spell <= 15) return spellSlotRight.setSpellIndex(spell);
    }

    let drawScale = 1;
    function draw() {

        // Resize Canvas if needed
        drawScale = Math.floor(Math.min($(window).width(), $(window).height() * 16 / 9) / 320);
        $("#game-canvas").css("width", drawScale * 320);
        cv.width = drawScale * 320;
        cv.height = drawScale * 180;

        // Clear Canvas
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, cv.width, cv.height);

        // TODO: Draw background tiles
        bg.draw(camera.getPos(), drawScale);

        // Draw visible objects
        const drawQueue = [];

        // Buffer Entities Draw Call
        Socket.getEntityState(Authentication.getUser().username);
        drawQueue.push({ draw: player.draw, y: player.getPos().y });

        for(entity in entities) {
            Socket.getEntityState(entity);
            drawQueue.push({ draw: entities[entity].draw, y: entities[entity].getPos().y });
        }

        // Buffer Interactables Draw Call
        for(id in interactables) {
            drawQueue.push({ draw: interactables[id].draw, y: interactables[id].getPos().y });
        }

        // Buffer Spells Draw Call
        for(id in spells) {
            Socket.getSpellState(id);
            drawQueue.push({ draw: spells[id].draw, y: spells[id].getPos().y });
        }

        for(id in loots) {
            Socket.getLootState(id);
            drawQueue.push({ draw: loots[id].draw, y: loots[id].getY() });
        }

        // Sort Draw Queue according to y-axis and draw
        drawQueue.sort((a, b) => { return a.y > b.y ? 1 : b.y > a.y ? -1 : 0; });
        for(i in drawQueue) {
            drawQueue[i].draw(camera.getPos(), drawScale);
        }

        if(started) shroud.draw(camera.getPos(), drawScale, timeSinceStart);

        // User interface and prompts
        prompt.draw(camera.getPos(), drawScale);

        spellSlotLeft.draw(drawScale);
        spellSlotRight.draw(drawScale);
        gauges.draw(drawScale);

        announcement.draw(drawScale);
        
        if(!started) readyBtn.draw(drawScale);
        else timer.draw(timeSinceStart);
    }

    function update(now) {
        timeSinceStart = Date.now() - gameStartTime;

        player.update(now);
        for(entity in entities) entities[entity].update(now);
        for(interactable in interactables) interactables[interactable].update(now);
        for(spell in spells) spells[spell].update(now); 
        for(loot in loots) loots[loot].update(now);  

        camera.lerp(player.getPos());
        player.lookAt(camera.getMouseCoord());

        draw();

        requestAnimationFrame(update);
    }

    function initialize() { 
        requestAnimationFrame(update); 

        $(document).on("keydown", (e) => {
            if(e.keyCode == 46) Socket.cheat();
            if(e.keyCode == 69) Socket.interact();
            player?.move(e.keyCode);
        });

        $(document).on("keyup", (e) => {
            player?.stop(e.keyCode);
        });

        $("#game-canvas").on("mousemove", (e) => { 
            camera.setMousePos(e.offsetX / drawScale, e.offsetY / drawScale); 
            if(!started) readyBtn.hover(e.offsetX / drawScale, e.offsetY / drawScale);
        });

        $("#game-canvas").on("mousedown", (e) => { Socket.setPlayerCasting(e.buttons, true); });
        $("#game-canvas").on("mouseup", (e) => { Socket.setPlayerCasting(e.buttons, false); });

        $("#game-canvas").on("click", () => {
            if(!started) readyBtn.click();
        });

        $('#game-canvas').bind('contextmenu', (e) => { return false; }); 
    }

    function start(time) {
        started = true;
        gameStartTime = time;

        if(canPlaySound) playBattleBgm();
    }

    function end() {
        started = false;
        readyBtn.reset();
        spellSlotLeft.setSpellIndex(0);
        spellSlotRight.setSpellIndex(8);

        if(canPlaySound) playLobbyBgm();
    }

    function playBgm() {
        if(!canPlaySound) return;
        if(started) playBattleBgm();
        else playLobbyBgm();
    }

    function playLobbyBgm() {
        if(!canPlaySound) return;
        sounds[1].pause();
        sounds[0].currentTime = 0;
        sounds[0].play();
    }

    function playBattleBgm() {
        if(!canPlaySound) return;
        sounds[0].pause();
        sounds[1].currentTime = 0;
        sounds[1].play();
    }

    function playSoundEffect(id) {
        if(!canPlaySound) return;
        sounds[id].pause();
        sounds[id].currentTime = 0;
        sounds[id].play();
    }

    function allowSound() {
        canPlaySound = true;
    }

    return {
        setMap, resetRenderer, 
        updateEntityState, hideEntity,
        updateInteractableState, hideInteractable,
        updateSpellState, hideSpell,
        updateLootState, hideLoot,
        setInteractableMessage, setSpell,
        setHealth: gauges.setHealth, setMaxHealth: gauges.setMaxHealth, setMana: gauges.setMana, setMaxMana: gauges.setMaxMana,
        initialize, start, end,
        playBgm, playLobbyBgm, playBattleBgm, playSoundEffect, allowSound,
        setAnnouncement: announcement.set
    };
})();