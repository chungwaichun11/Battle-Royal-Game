const SpellSlot = function(ctx, x, y) {

    const sequences = [
        { x:     0, y:   0, count: 1, timing: 2000, loop: false }, // Empty Primary
        { x:    32, y:   0, count: 1, timing: 2000, loop: false }, // Magic Missile
        { x:    64, y:   0, count: 1, timing: 2000, loop: false }, // Killing Curse
        { x:    96, y:   0, count: 1, timing: 2000, loop: false }, // Firebolt
        { x:   128, y:   0, count: 1, timing: 2000, loop: false }, // Empty Primary
        { x:   160, y:   0, count: 1, timing: 2000, loop: false }, // Empty Primary
        { x:   192, y:   0, count: 1, timing: 2000, loop: false }, // Empty Primary
        { x:   224, y:   0, count: 1, timing: 2000, loop: false }, // Empty Primary

        { x:     0, y:  32, count: 1, timing: 2000, loop: false }, // Empty Secondary
        { x:    32, y:  32, count: 1, timing: 2000, loop: false }, // Shield
        { x:    64, y:  32, count: 1, timing: 2000, loop: false }, // Heal
        { x:    96, y:  32, count: 1, timing: 2000, loop: false }, // Empty Secondary
        { x:   128, y:  32, count: 1, timing: 2000, loop: false }, // Empty Secondary
        { x:   160, y:  32, count: 1, timing: 2000, loop: false }, // Empty Secondary
        { x:   192, y:  32, count: 1, timing: 2000, loop: false }, // Empty Secondary
        { x:   224, y:  32, count: 1, timing: 2000, loop: false }  // Empty Secondary
    ]

    const sprite = Sprite(ctx, 0, 0);
    sprite.useSheet("sprites/spellslots.png", 32, 32)
          .setSequence(sequences[0]);

    function setSpellIndex(index) { 
        sprite.setSequence(sequences[index]); 
        return this;
    }

    function draw(scale) {
        sprite.draw(x, y, scale);
    }

    return { setSpellIndex, draw }
}