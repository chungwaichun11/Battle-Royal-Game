const Spell = function(ctx, type, x, y, dir) {

    const sequences = [
        { x:  0, y:  0, count: 4, timing: 100, loop: true },     // Empty
        { x: 64, y:  0, count: 4, timing: 100, loop: true },     // Magic Missile
        { x:  0, y: 16, count: 4, timing: 100, loop: true },     // Killing Curse
        { x: 64, y: 16, count: 4, timing: 100, loop: true },     // Firebolt
        { x:  0, y: 32, count: 4, timing: 100, loop: true },     // Magic Missile
        { x: 64, y: 32, count: 4, timing: 100, loop: true },     // Magic Missile
        { x:  0, y: 48, count: 4, timing: 100, loop: true },     // Magic Missile
        { x: 64, y: 48, count: 4, timing: 100, loop: true },     // Magic Missile
        
        { x:  0, y:  64, count: 4, timing: 100, loop: true },     // Empty
        { x: 64, y:  64, count: 4, timing: 100, loop: true },     // Shield
        { x:  0, y:  80, count: 4, timing: 100, loop: true },     // Empty
        { x: 64, y:  80, count: 4, timing: 100, loop: true },     // Empty
        { x:  0, y:  96, count: 4, timing: 100, loop: true },     // Empty
        { x: 64, y:  96, count: 4, timing: 100, loop: true },     // Empty
        { x:  0, y: 112, count: 4, timing: 100, loop: true },     // Empty
        { x: 64, y: 112, count: 4, timing: 100, loop: true },     // Empty
    ];

    const sprite = Sprite(ctx, 0, 4);
    sprite.useSheet("sprites/spells.png", 16, 16)
          .setSequence(sequences[type]);
    
    return {
        draw: (camPos, scale) => { sprite.draw(x - camPos.x + 160, y - camPos.y + 90, scale, dir); },
        getPos: () => { return { x, y }},
        update: sprite.update,
        setPos: (nx, ny) => { x = nx, y = ny }
    }
}