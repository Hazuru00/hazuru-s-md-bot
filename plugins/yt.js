'use strict';

// Importamos la versión de DisTube que acabas de añadir al package.json
const ytdl = require('@distube/ytdl-core');

module.exports = {
    commands:    ['yt', 'youtube'],
    description: 'Download a YouTube video',
    permission:  'public',
    group:       true,
    private:     true,
    run: async (sock, message, args, { sender, contextInfo }) => {
        const url = args[0];

        if (!url || !ytdl.validateURL(url)) {
            return sock.sendMessage(sender, {
                text: '🎬 ¡URL de YouTube inválida!\nEjemplo: .yt https://youtu.be/dQw4w9WgXcQ',
                contextInfo
            }, { quoted: message });
        }

        try {
            // Obtener información del video
            // Usamos un User-Agent genérico para que YouTube no nos bloquee tan rápido
            const info = await ytdl.getInfo(url, {
                requestOptions: {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                    }
                }
            });

            // Elegimos el formato que tenga audio y video juntos (importante para WhatsApp)
            const format = ytdl.chooseFormat(info.formats, { 
                quality: 'highest', 
                filter: 'audioandvideo' 
            });

            if (!format) throw new Error('No se encontró un formato compatible.');

            const details = info.videoDetails;

            await sock.sendMessage(sender, {
                video:   { url: format.url },
                caption: `▶️ *${details.title}*\n👤 ${details.author.name}\n⏱️ Duración: ${Math.floor(details.lengthSeconds / 60)}m ${details.lengthSeconds % 60}s`,
                contextInfo,
                mimetype: 'video/mp4'
            }, { quoted: message });

        } catch (err) {
            console.error('[YT ERROR]', err.message);
            
            let msg = 'Error al procesar el video.';
            if (err.message.includes('410')) msg = 'Error 410: YouTube ha bloqueado esta petición. Intenta con otro video o actualiza el bot.';
            if (err.message.includes('confirm your age')) msg = 'Este video tiene restricción de edad y no puede ser descargado.';

            await sock.sendMessage(sender, {
                text: `❌ ${msg}`,
                contextInfo
            }, { quoted: message });
        }
    }
};