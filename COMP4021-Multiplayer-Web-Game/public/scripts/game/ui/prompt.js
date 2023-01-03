const Prompt = function(ctx) {
    let message = null;
    const padding = 10;
    const offset = 32;

    const titleFontSize = 20;
    const contentFontSize = 30;

    function set(m) {
        message = m;
    }

    function draw(camPos, drawScale) {
        if(message) {

            ctx.save();
            
            ctx.font = titleFontSize + "px Public Pixel";
            const titleWidth = ctx.measureText(message.name).width;

            ctx.font = contentFontSize + "px Public Pixel";
            const contentWidth = ctx.measureText(message.content).width;

            const width = Math.max(titleWidth, contentWidth);

            ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
            ctx.fillRect(
                (message.pos.x - camPos.x + 160) * drawScale - width / 2 - padding, 
                (message.pos.y - camPos.y + 90) * drawScale - titleFontSize - padding - offset,
                width + padding * 2, titleFontSize + contentFontSize + padding * 2
            )

            ctx.font = titleFontSize + "px Public Pixel";
            ctx.fillStyle = "rgb(200, 200, 200)";;
            
            ctx.fillText(
                message.name, 
                (message.pos.x - camPos.x + 160) * drawScale - width / 2, 
                (message.pos.y - camPos.y + 90) * drawScale - offset
            );

            ctx.font = contentFontSize + "px Public Pixel";
            ctx.fillStyle = "white";

            ctx.fillText(
                message.content, 
                (message.pos.x - camPos.x + 160) * drawScale - width / 2, 
                (message.pos.y - camPos.y + 90) * drawScale + contentFontSize - offset
            );

            ctx.restore();
        }
    }

    return { set, draw }
}