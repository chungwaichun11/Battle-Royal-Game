const Entity = function(ctx, x, y, team) {

    // Sprites and animations
    const sequences = {
        idle: [
            { x:   0, y:  0, count: 1, timing: 2000, loop: false },
            { x:  16, y:  0, count: 1, timing: 2000, loop: false },
            { x:  32, y:  0, count: 1, timing: 2000, loop: false },
            { x:  48, y:  0, count: 1, timing: 2000, loop: false },
            { x:  64, y:  0, count: 1, timing: 2000, loop: false },
            { x:  80, y:  0, count: 1, timing: 2000, loop: false },
            { x:  96, y:  0, count: 1, timing: 2000, loop: false },
            { x: 112, y:  0, count: 1, timing: 2000, loop: false }
        ],
        move: [
            { x:  0, y: 16, count: 4, timing: 100, loop: true },
            { x: 64, y: 16, count: 4, timing: 100, loop: true },
            { x:  0, y: 32, count: 4, timing: 100, loop: true },
            { x: 64, y: 32, count: 4, timing: 100, loop: true },
            { x:  0, y: 48, count: 4, timing: 100, loop: true },
            { x: 64, y: 48, count: 4, timing: 100, loop: true },
            { x:  0, y: 64, count: 4, timing: 100, loop: true },
            { x: 64, y: 64, count: 4, timing: 100, loop: true }
        ]
    };

    const spriteSheet = ["sprites/mage-blue.png", "sprites/mage-red.png", "sprites/mage-green.png", "sprites/mage-black.png", "sprites/mage-yellow.png", "sprites/mage-white.png"]

    const sprite = Sprite(ctx, 0, 5);
    sprite.setSequence(sequences.idle[4])
          .useSheet(spriteSheet[team], 16, 16);

    // Player Movement
    const MoveMode = {
        Up: 1,
        Right: 2,
        Down: 4,
        Left: 8
    }
    let moveDirection = 0;

    function getPos() { return { x, y } }

    function move(key) {
        switch(key) {
            case 87: moveDirection |= MoveMode.Up;    break;  // W Key
            case 68: moveDirection |= MoveMode.Right; break;  // D Key
            case 83: moveDirection |= MoveMode.Down;  break;  // S Key
            case 65: moveDirection |= MoveMode.Left;  break;  // A Key
        }
        Socket.setPlayerMovement(moveDirection);
    }

    function stop(key) {
        switch(key) {
            case 87: moveDirection &= ~MoveMode.Up;    break;  // W Key
            case 68: moveDirection &= ~MoveMode.Right; break;  // D Key
            case 83: moveDirection &= ~MoveMode.Down;  break;  // S Key
            case 65: moveDirection &= ~MoveMode.Left;  break;  // A Key
        } 
        Socket.setPlayerMovement(moveDirection);
    }

    function lookAt(targetPos) { Socket.setPlayerLookat(targetPos); }

    function setState(nx, ny, facing, moving, nteam, spectating) {
        x = nx;
        y = ny;
        
        sprite.setAlpha(spectating ? 0.5 : 1);
        sprite.setSequence(moving ? sequences.move[facing] : sequences.idle[facing]);
        if(team != nteam) {
            team = nteam;
            sprite.useSheet(spriteSheet[team], 16, 16);
        }
    }

    return {
        draw: (camPos, scale) => { sprite.draw(x - camPos.x + 160, y - camPos.y + 90, scale); },
        getPos,
        move,
        stop,
        lookAt,
        setState,
        update: sprite.update
    }
};