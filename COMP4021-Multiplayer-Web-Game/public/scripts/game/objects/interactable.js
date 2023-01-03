
const Interactable = function(ctx, type, x, y) {

    const sequences = [
        { x:  0, y:  0, count: 1, timing: 2000, loop: false }, // Blue Banner
        { x: 16, y:  0, count: 1, timing: 2000, loop: false }, // Red Banner
        { x: 32, y:  0, count: 1, timing: 2000, loop: false }, // Green Banner
        { x: 48, y:  0, count: 1, timing: 2000, loop: false }, // Black Banner
        { x:  0, y: 32, count: 1, timing: 2000, loop: false }, // Yellow Banner
        { x: 16, y: 32, count: 1, timing: 2000, loop: false }, // White (Spectate) Banner
        { x: 32, y: 32, count: 1, timing: 2000, loop: false }, // Empty Pedestal
    ]

    const spellSequences = [
        { x:  0, y:   0, count: 1, timing: 2000, loop: false }, // Empty Primary
        { x: 16, y:   0, count: 1, timing: 2000, loop: false }, // Magic Missile
        { x: 32, y:   0, count: 1, timing: 2000, loop: false }, // Firebolt
        { x: 48, y:   0, count: 1, timing: 2000, loop: false }, // Empty Primary
        { x:  0, y:  16, count: 1, timing: 2000, loop: false }, // Empty Primary
        { x: 16, y:  16, count: 1, timing: 2000, loop: false }, // Empty Primary
        { x: 32, y:  16, count: 1, timing: 2000, loop: false }, // Empty Primary
        { x: 48, y:  16, count: 1, timing: 2000, loop: false }, // Empty Primary
        
        { x:  0, y:  32, count: 1, timing: 2000, loop: false }, // Empty Secondary
        { x: 16, y:  32, count: 1, timing: 2000, loop: false }, // Shield
        { x: 32, y:  32, count: 1, timing: 2000, loop: false }, // Empty Secondary
        { x: 48, y:  32, count: 1, timing: 2000, loop: false }, // Empty Secondary
        { x:  0, y:  48, count: 1, timing: 2000, loop: false }, // Empty Secondary
        { x: 16, y:  48, count: 1, timing: 2000, loop: false }, // Empty Secondary
        { x: 32, y:  48, count: 1, timing: 2000, loop: false }, // Empty Secondary
        { x: 48, y:  48, count: 1, timing: 2000, loop: false }, // Empty Secondary
    ]

    const sprite = Sprite(ctx, -0.5, 12);
    sprite.setSequence(sequences[Math.min(6, type)])
          .useSheet("sprites/interactables.png", 16, 32);

    const logoSprite = Sprite(ctx, -0.5, -0.5);
    logoSprite.setSequence(spellSequences[Math.max(0, type-6)])
              .useSheet("sprites/spell-logo.png", 16, 16);

    function draw(camPos, scale) {
        sprite.draw(x - camPos.x + 160, y - camPos.y + 90, scale);
        if(type > 6) logoSprite.draw(x - camPos.x + 160, y - camPos.y + 90 - 16 - 4 + 3 * Math.sin(Date.now() / 300), scale);
    }
        
    function getPos() {
        return { x, y }
    }

    return {
        draw,
        update: sprite.update,
        getPos
    }
}