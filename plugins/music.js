"use strict";

const axios = require("axios");

// APIs de búsqueda y descarga (No requieren Auth)
const SPOTIFY_SEARCH = (q) =>
  `https://api.agatz.xyz/api/spotify?q=${encodeURIComponent(q)}`;
const SPOTIFY_DL = (url) =>
  `https://api.siputzx.my.id/api/d/spotify?url=${encodeURIComponent(url)}`;

module.exports = {
  commands: ["play", "music", "spotify"],
  description: "Descarga música de Spotify sin errores de Auth",
  permission: "public",
  group: true,
  private: true,

  run: async (sock, message, args, { sender, contextInfo }) => {
    const query = args.join(" ").trim();
    if (!query)
      return sock.sendMessage(
        sender,
        { text: "❌ ¿Qué canción buscamos hoy?" },
        { quoted: message },
      );

    const { key } = await sock.sendMessage(
      sender,
      { text: `🎧 Buscando en Spotify...` },
      { quoted: message },
    );

    try {
      // --- PASO 1: BÚSQUEDA ---
      // Usamos una API que ya tiene la autorización de Spotify integrada
      const searchRes = await axios.get(SPOTIFY_SEARCH(query));

      // La API de Agatz devuelve un array en .data
      const track = searchRes.data?.data?.[0];
      if (!track) throw new Error("No encontré la canción en Spotify.");

      const trackUrl = track.url || track.link;
      const title = track.title || track.name;

      // --- PASO 2: ENVIAR CARD ---
      await sock.sendMessage(
        sender,
        {
          image: {
            url:
              track.thumbnail ||
              track.image ||
              "https://files.catbox.moe/5uli5p.jpeg",
          },
          caption: `🎵 *${title}*\n🎤 *Artista:* ${track.artist || "Desconocido"}\n\n_📥 Descargando audio, un momento..._`,
          contextInfo,
        },
        { quoted: message },
      );

      // --- PASO 3: DESCARGA ---
      const dlRes = await axios.get(SPOTIFY_DL(trackUrl));

      // Validamos el link de descarga (evitando el error de 'function link')
      let audioUrl =
        dlRes.data?.result?.download ||
        dlRes.data?.data?.url ||
        dlRes.data?.url;

      if (typeof audioUrl !== "string" || !audioUrl.startsWith("http")) {
        throw new Error(
          "El servidor de descarga está saturado. Intenta de nuevo.",
        );
      }

      // --- PASO 4: ENVIAR AUDIO ---
      await sock.sendMessage(
        sender,
        {
          audio: { url: audioUrl },
          mimetype: "audio/mpeg",
          ptt: true,
        },
        { quoted: message },
      );

      // Enviar como archivo para que lo puedan guardar
      const safeTitle = title.replace(/[^\w\s-]/g, "").slice(0, 30);
      await sock.sendMessage(
        sender,
        {
          document: { url: audioUrl },
          mimetype: "audio/mpeg",
          fileName: `${safeTitle}.mp3`,
          contextInfo,
        },
        { quoted: message },
      );

      // Borramos el mensaje de "Buscando..."
      await sock.sendMessage(sender, { delete: key });
    } catch (err) {
      console.error("[Spotify Error]", err.message);
      await sock.sendMessage(
        sender,
        {
          text: `❌ *Error:* ${err.message || "No se pudo procesar la solicitud."}`,
        },
        { quoted: message },
      );
    }
  },
};
