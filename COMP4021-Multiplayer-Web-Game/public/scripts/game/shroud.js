const Shroud = function(ctx) {

    let mapWidth = 0;
    let mapHeight = 0;

    function setMapSize(width, height) {
        mapWidth = width;
        mapHeight = height;
    }

    function draw(camPos, scale, time) {
        time /= 1000;
        let cornerX = 0;
        let cornerY = 0;

        if(time <= 30) return;
        else if(time <= 60) { // Full to Half
            cornerX = mapWidth  / 4 + ( mapWidth / 4 ) * (60 - time) / 30;
            cornerY = mapHeight / 4 + ( mapHeight / 4 ) * (60 - time) / 30;
        } else if(time <= 90) {
            cornerX = mapWidth  / 4;
            cornerY = mapHeight / 4;
        } else if(time <= 120) { // Half to arena
            cornerX = 160 + ( mapWidth  / 4 - 160 ) * (120 - time) / 30;
            cornerY =  90 + ( mapHeight / 4 -  90 ) * (120 - time) / 30;
        } else if(time <= 150) {
            cornerX = 160;
            cornerY = 90;
        } else if(time <= 180) {
            cornerX = 160 * (180 - time) / 30;
            cornerY =  90 * (180 - time) / 30;
        }

        ctx.save();

        ctx.fillStyle = "black";
        ctx.globalAlpha = 0.85;

        function gamePointToCam(x, y) {

            function clamp(min, x, max) {
                return Math.min(max, Math.max(min, x));
            }

            return {
                x: clamp(0, x - camPos.x + 160, 320),
                y: clamp(0, y - camPos.y + 90, 180)
            }
        }

        function drawRect(x1, y1, x2, y2) {
            const p1 = gamePointToCam(x1, y1);
            const p2 = gamePointToCam(x2, y2);
            ctx.rect(p1.x * scale, p1.y * scale, (p2.x-p1.x) * scale, (p2.y-p1.y) * scale);
        }

        drawRect(-mapWidth/2, -mapHeight/2, mapWidth/2,    -cornerY);
        drawRect(-mapWidth/2,      cornerY, mapWidth/2, mapHeight/2);
        drawRect(-mapWidth/2,     -cornerY,   -cornerX,     cornerY);
        drawRect(    cornerX,     -cornerY, mapWidth/2, mapHeight/2);

        ctx.fill();
        
        ctx.restore();
    }

    return { setMapSize, draw }
}