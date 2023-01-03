const Gauges = function(ctx) {

    let health = 100;
    let maxHealth = 100;
    let mana = 100;
    let maxMana = 100;
    
    const sheet = new Image();
    sheet.src = "sprites/gauges.png";

    const isReady = function() {
        return sheet.complete && sheet.naturalHeight != 0;
    };

    function setHealth(h) { health = h; }
    function setMaxHealth(mh) { maxHealth = mh; }
    function setMana(m) { mana = m; }
    function setMaxMana(mm) { maxMana = mm; }

    function draw(scale) { 
        if(!isReady()) return;
        ctx.imageSmoothingEnabled = false;

        // Draw frame
        ctx.drawImage( sheet, 0, 0, 64, 16, 0, 154 * scale, 64 * scale, 16 * scale );
        ctx.drawImage( sheet, 0, 0, 64, 16, 0, 166 * scale, 64 * scale, 16 * scale );

        // Draw bars
        ctx.drawImage( sheet, 66,  0, 59 * health / maxHealth, 16, 2 * scale, 154 * scale, 59 * health / maxHealth * scale, 16 * scale );
        ctx.drawImage( sheet, 66, 16, 59 * mana / maxMana    , 16, 2 * scale, 166 * scale, 59 * mana / maxMana * scale    , 16 * scale );

        // Draw Text
        ctx.font = "20px Public Pixel";
        ctx.fillText(Math.round(Math.max(0, health)) + "/" + Math.round(maxHealth), 4 * scale, 162 * scale);
        ctx.fillText(Math.round(Math.max(0, mana)) + "/" + Math.round(maxMana), 4 * scale, 174 * scale);
    }

    return { draw, setHealth, setMaxHealth, setMana, setMaxMana }
}