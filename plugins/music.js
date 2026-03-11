"use strict";

const axios = require("axios");
const yts = require("yt-search");

module.exports = {
  commands: ["play", "music"],
  description: "Ultra-stable YouTube Downloader",
  run: async (sock, message, args, { sender, contextInfo }) => {
    const query = args.join(" ").trim();
    if (!query) return sock.sendMessage(sender, { text: "❌ ¿Qué quieres escuchar?" }, { quoted: message });

    await sock.sendMessage(sender, { text: `🔍 Buscando: *${query}*...` }, { quoted: message });

    try {
      const search = await yts(query);
      const v = search.videos[0];
      if (!v) throw new Error("No encontré resultados.");

      const videoUrl = v.url;
      const title = v.title;

      await sock.sendMessage(sender, {
        image: { url: v.thumbnail },
        caption: `🎵 *${title}*\n⏱️ Duración: ${v.timestamp}\n\n_Intentando descargar por túnel seguro..._`,
        contextInfo,
      }, { quoted: message });

      let audioUrl = null;

      // --- INTENTO 1: COBALT (El estándar de oro actual) ---
      try {
        const cobaltResponse = await axios.post('https://api.cobalt.tools/api/json', {
          url: videoUrl,
          downloadMode: 'audio',
          audioFormat: 'mp3',
          contentType: 'audio'
        }, {
          headers: {
            'accept': 'application/json',
            'content-type': 'application/json',
            'referer': 'https://cobalt.tools/'
          }
        });

        if (cobaltResponse.data && cobaltResponse.data.url) {
          audioUrl = cobaltResponse.data.url;
          console.log("[Play] Éxito con Cobalt");
        }
      } catch (e) {
        console.warn("[Play] Cobalt falló, intentando APIs de respaldo...");
      }

      // --- INTENTO 2: APIs DE RESPALDO ACTUALIZADAS ---
      if (!audioUrl) {
        const backupApis = [
          `https://api.siputzx.my.id/api/d/ytmp3?url=${encodeURIComponent(videoUrl)}`,
          `https://api.zenkey.my.id/api/download/ytmp3?url=${encodeURIComponent(videoUrl)}&apikey=zenkey`,
          `https://api.agatz.xyz/api/ytmp3?url=${encodeURIComponent(videoUrl)}`,
          `https://nexus-api-001.vercel.app/api/ytmp3?url=${encodeURIComponent(videoUrl)}`
        ];

        for (const api of backupApis) {
          try {
            const { data } = await axios.get(api, { timeout: 15000 });
            audioUrl = data?.result?.download || data?.result?.url || data?.data?.url || data?.url || data?.link;
            if (audioUrl) break;
          } catch (err) { continue; }
        }
      }

      if (!audioUrl) throw new Error("YouTube está bloqueando todas las vías. Intenta más tarde o con otro video.");

      // --- PASO FINAL: ENVIAR ---
      // Enviamos el audio
      await sock.sendMessage(sender, {
        audio: { url: audioUrl },
        mimetype: "audio/mpeg",
        ptt: false
      }, { quoted: message });

      // Enviamos el documento
      const safeTitle = title.replace(/[^\w\s-]/g, "").slice(0, 30);
      await sock.sendMessage(sender, {
        document: { url: audioUrl },
        mimetype: "audio/mpeg",
        fileName: `${safeTitle}.mp3`
      }, { quoted: message });

    } catch (err) {
      console.error(err);
      await sock.sendMessage(sender, { text: `❌ *Error:* ${err.message}` }, { quoted: message });
    }
  },
};