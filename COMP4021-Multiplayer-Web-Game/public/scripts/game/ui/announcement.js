const Announcement = function(ctx) {

    let value = "";
    let hide = true;
    let hideTimeout = null;

    function draw(scale) {
        if(hide) return;
        
        ctx.save();
        
        ctx.font = "64px Public Pixel";
        ctx.fillStyle = "white";
        const width = ctx.measureText(value).width;
        ctx.fillText(value, 160 * scale - width / 2, 90 * scale);

        ctx.restore();
    }

    function set(x, time) {
        value = x;
        hide = false;
        clearTimeout(hideTimeout);
        hideTimeout = setTimeout(() => { hide = true; }, time);
    }

    return { draw, set }
}