const ReadyBtn = function(ctx) {

    sequences = [
        { x:   0, y:   0, count: 1, timing: 2000, loop: false },
        { x:  64, y:   0, count: 1, timing: 2000, loop: false },
        { x:   0, y:  32, count: 1, timing: 2000, loop: false },
        { x:  64, y:  32, count: 1, timing: 2000, loop: false },
    ]

    const sprite = Sprite(ctx, 0, 0);
    sprite.useSheet("sprites/ready-btn.png", 64, 32)
          .setSequence(sequences[0]);

    let ready = false;
    let hovering = false;

    function draw(scale) { 
        sprite.draw(160, 164, scale) 
    }

    function hover(mouseX, mouseY) {
        if(!ready) {
            hovering = mouseX >= 129 && mouseX <= 191 && mouseY >= 150 && mouseY <= 166;

            if(hovering) sprite.setSequence(sequences[1]);
            else sprite.setSequence(sequences[0]);

        } else {
            hovering = mouseX >= 143 && mouseX <= 177 && mouseY >= 168 && mouseY <= 177;

            if(hovering) sprite.setSequence(sequences[3]);
            else sprite.setSequence(sequences[2]);
        }
    }

    function click() {
        if(hovering) {
            ready = !ready;
            sprite.setSequence(sequences[2]);
            Socket.setPlayerReady(ready);
        } 
    }

    function reset() {
        ready = false;
        sprite.setSequence(sequences[0]);
    }

    return { draw, hover, click, reset }
}