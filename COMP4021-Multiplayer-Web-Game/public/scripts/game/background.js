const Background = function(ctx) {
    
    const sheet = new Image();
    sheet.src = "sprites/tiles.png";

    let tiles = [];
    let offsetX = 0, offsetY = 0;
    function setTiles(ntiles, minX, minY) {
        tiles = ntiles;
        offsetX = minX;
        offsetY = minY;
    }

    const isReady = function() {
        return sheet.complete && sheet.naturalHeight != 0;
    };

    function draw(camPos, scale) {
        if(!isReady()) return;

        // i, j: Game coords of top left screen
        for(let i = camPos.x - 160; i < camPos.x + 176; i += 16) {
            for(let j = camPos.y - 90; j < camPos.y + 106; j += 16) {
                const ix = Math.floor((i - offsetX) / 16);
                const iy = Math.floor((j - offsetY) / 16);

                if(iy < 0 || iy >= tiles.length) continue;
                if(ix < 0 || ix >= tiles[iy].length) continue;

                const index = tiles[iy][ix];

                ctx.save();
                ctx.imageSmoothingEnabled = false;

                ctx.drawImage(
                    sheet, (index % 8) * 16, Math.floor(index / 8) * 16, 16, 16, 
                    (Math.floor(i / 16) * 16 - camPos.x + 160) * scale, (Math.floor(j / 16) * 16 - camPos.y + 90) * scale, 16 * scale, 16 * scale
                );

                ctx.restore();
            }
        }
    }

    return { setTiles, draw }
}