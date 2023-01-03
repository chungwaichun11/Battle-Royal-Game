const Loot = function(ctx, x, y) {
    const sprite = Sprite(ctx, -0.5, 0.5);
    sprite.setSequence({ x: 0, y: 0, count: 4, timing: 200, loop: true })
          .useSheet("sprites/loot.png", 16, 16);
          
    return {
        draw: (camPos, scale) => { sprite.draw(x - camPos.x + 160, y - camPos.y + 90, scale); },
        update: sprite.update,
        getY: () => y,
        setPos: (nx, ny) => { x = nx, y = ny }
    }
}