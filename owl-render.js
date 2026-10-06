// Модуль отрисовки совы и фавиконки
const OwlRenderer = {
    drawOwl(ctx, owlInstance, frameCount) {
        if (!owlInstance.visible) return;
        ctx.save();
        ctx.translate(owlInstance.x, owlInstance.y);
        ctx.rotate(owlInstance.rotation);
        ctx.scale(1.26, 1.26);

        // Тело совы
        ctx.fillStyle = '#782CE9';
        ctx.beginPath(); ctx.arc(0, 0, owlInstance.radius, 0, Math.PI * 2); ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = '#1D0542'; ctx.stroke();
        
        // Глаза
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath(); ctx.arc(6, -4, 7, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#140326';
        ctx.beginPath(); ctx.arc(8, -4, 3, 0, Math.PI * 2); ctx.fill();
        
        // Клюв
        ctx.fillStyle = '#FE7600';
        ctx.beginPath(); ctx.moveTo(14, -1); ctx.lineTo(20, 2); ctx.lineTo(14, 5); ctx.fill();
        
        ctx.restore();
    },

    setDynamicFavicon() {
        const favCanvas = document.createElement('canvas');
        favCanvas.width = 128; favCanvas.height = 128;
        const fctx = favCanvas.getContext('2d');
        fctx.translate(64, 64);
        fctx.scale(3.1, 3.1);
        this.drawOwl(fctx, { x: 0, y: 0, rotation: 0, visible: true }, 0);
        
        const dataUrl = favCanvas.toDataURL('image/png');
        let link = document.querySelector("link[rel~='icon']");
        if (!link) {
            link = document.createElement('link');
            link.rel = 'icon';
            document.head.appendChild(link);
        }
        link.href = dataUrl;
    }
};