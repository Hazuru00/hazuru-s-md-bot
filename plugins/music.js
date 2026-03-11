"use strict";

const axios = require("axios");
const yts = require("yt-search");

// APIs probadas y con validación de tipo
const FALLBACK_APIS = (link) => [
  `https://api.siputzx.my.id/api/d/ytmp3?url=${encodeURIComponent(link)}`,
  `https://api.zenkey.my.id/api/download/ytmp3?url=${encodeURIComponent(link)}&apikey=zenkey`,
  `https://api.agatz.xyz/api/ytmp3?url=${encodeURIComponent(link)}`,
  `https://api.davidcyriltech.my.id/download/ytmp3?url=${encodeURIComponent(link)}`,
];

module.exports = {
  commands: ["play", "music"],
  description: "Download music with string-validation fix",
  run: async (sock, message, args, { sender, contextInfo }) => {
    const query = args.join(" ").trim();
    if (!query)
      return sock.sendMessage(
        sender,
        { text: "❌ Escribe el nombre de la canción." },
        { quoted: message },
      );

    await sock.sendMessage(
      sender,
      { text: `🔍 Buscando: *${query}*...` },
      { quoted: message },
    );

    try {
      const search = await yts(query);
      const v = search.videos[0];
      if (!v) throw new Error("No se encontró el video.");

      const videoUrl = v.url;

      await sock.sendMessage(
        sender,
        {
          image: { url: v.thumbnail },
          caption: `🎵 *${v.title}*\n⏱️ Duración: ${v.timestamp}\n\n_Descargando audio, por favor espera..._`,
          contextInfo,
        },
        { quoted: message },
      );

      let audioUrl = null;

      // --- CICLO DE APIs CON VALIDACIÓN ANT-ERROR ---
      for (const api of FALLBACK_APIS(videoUrl)) {
        try {
          const { data } = await axios.get(api, { timeout: 15000 });

          // Extraemos el link con cuidado
          let rawUrl =
            data?.result?.download ||
            data?.result?.url ||
            data?.data?.url ||
            data?.url ||
            data?.link ||
            data?.result;

          // FIX CRÍTICO: Verificamos que sea un STRING y que empiece con HTTP
          // Esto evita el error "Received function link"
          if (typeof rawUrl === "string" && rawUrl.startsWith("http")) {
            audioUrl = rawUrl;
            break;
          }
        } catch (e) {
          continue;
        }
      }

      if (!audioUrl)
        throw new Error("No se pudo obtener un enlace válido de ninguna API.");

      // --- ENVÍO SEGURO ---
      // 1. Como Audio
      await sock.sendMessage(
        sender,
        {
          audio: { url: audioUrl },
          mimetype: "audio/mpeg",
          ptt: false,
        },
        { quoted: message },
      );

      // 2. Como Documento
      const safeTitle = v.title.replace(/[^\w\s-]/g, "").slice(0, 30);
      await sock.sendMessage(
        sender,
        {
          document: { url: audioUrl },
          mimetype: "audio/mpeg",
          fileName: `${safeTitle}.mp3`,
        },
        { quoted: message },
      );
    } catch (err) {
      console.error("[PLAY ERROR]", err.message);
      await sock.sendMessage(
        sender,
        { text: `❌ *Error:* ${err.message}` },
        { quoted: message },
      );
    }
  },
};
