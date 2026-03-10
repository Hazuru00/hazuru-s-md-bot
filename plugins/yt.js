"use strict";

const axios = require("axios");

module.exports = {
  commands: ["yt", "youtube"],
  description: "Download a YouTube video via API",
  permission: "public",
  group: true,
  private: true,
  run: async (sock, message, args, { sender, contextInfo }) => {
    const url = args[0];

    if (!url) {
      return sock.sendMessage(
        sender,
        {
          text: "🎬 ¡Envia la URL de YouTube!\nEjemplo: .yt https://youtu.be/dQw4w9WgXcQ",
          contextInfo,
        },
        { quoted: message },
      );
    }

    try {
      await sock.sendMessage(
        sender,
        { text: "⏳ Descargando video, por favor espera..." },
        { quoted: message },
      );

      // Usamos una API de descarga confiable (puedes usar ddownr o similares)
      // En este caso, usaremos un servicio de bypass común para bots
      const response = await axios.get(
        `https://api.sandipbaruwal.com.np/ytdl?url=${encodeURIComponent(url)}`,
      );

      if (!response.data || !response.data.video_url) {
        throw new Error("No se pudo obtener el enlace de descarga.");
      }

      const videoData = response.data;

      await sock.sendMessage(
        sender,
        {
          video: { url: videoData.video_url },
          caption: `▶️ *${videoData.title}*\n⏱️ Calidad: ${videoData.quality || "Auto"}`,
          contextInfo,
          mimetype: "video/mp4",
        },
        { quoted: message },
      );
    } catch (err) {
      console.error("[YT API ERROR]", err.message);

      await sock.sendMessage(
        sender,
        {
          text: `❌ Error al procesar el video. YouTube está bloqueando las conexiones directas del servidor.`,
          contextInfo,
        },
        { quoted: message },
      );
    }
  },
};
