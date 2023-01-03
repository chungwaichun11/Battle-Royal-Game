const Sprite = function(ctx, offsetX, offsetY) {

    const sheet = new Image();
    let sequence = { x: 0, y: 0, count: 1, timing: 1000, loop: false };
    let index = 0;
    let lastUpdate = 0;

    let spriteWidth = 0;
    let spriteHeight = 0;
    let alpha = 1;

    const useSheet = function(spriteSheet, width, height) {
        sheet.src = spriteSheet;
        spriteWidth = width;
        spriteHeight = height;
        return this;
    };

    const isReady = function() {
        return sheet.complete && sheet.naturalHeight != 0;
    };

    const setSequence = function(newSequence) {
        if(sequence == newSequence) return this;

        sequence = newSequence;
        index = 0;
        lastUpdate = 0;
        return this;
    };

    const setAlpha = function(a) { alpha = a; }

    function draw(x, y, scale, rotation = 0) {
        if(!isReady()) return;

        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.globalAlpha = alpha;

        const _x = Math.round(x - spriteWidth / 2 - offsetX) * scale;
        const _y = Math.round(y - spriteHeight / 2 - offsetY) * scale;

        ctx.translate(Math.round(x - offsetX) * scale, Math.round(y - offsetY) * scale);
        ctx.rotate(rotation);
        ctx.translate(-Math.round(x - offsetX) * scale, -Math.round(y - offsetY) * scale);

        ctx.drawImage(
            sheet, sequence.x + index * spriteWidth, sequence.y, spriteWidth, spriteHeight, 
            _x, _y, spriteWidth * scale, spriteHeight * scale
        );

        ctx.restore();
    }

    const update = function(time) {
        if (lastUpdate == 0) lastUpdate = time; 

        if(time - lastUpdate >= sequence.timing) {
            index = sequence.loop ? ( index + 1 ) % sequence.count : Math.min(index + 1, sequence.count - 1);
            lastUpdate = time;
        }

        return this;
    };

    return { useSheet, setSequence, setAlpha, draw, update }
};