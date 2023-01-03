const Timer = function(ctx) {

    function draw(time) {

        time /= 1000;
        ctx.save();

        ctx.font = "32px Public Pixel";
        ctx.fillStyle = "white";
        
        const content = (time % 60 < 30 ? "Shroud: " + Math.round(30 - time % 60) : "Shroud closing in!");
        const width = ctx.measureText(content).width;
        const padding = 20;

        ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
        ctx.fillRect( 0, 0, width + padding * 2, 32 + padding * 2)
        ctx.fillStyle = "white";
        ctx.fillText(content, padding, 32 + padding);

        ctx.restore();
    }

    return { draw }
}