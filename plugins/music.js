"use strict";

const axios = require("axios");

// Función de descarga inspirada en la lógica de Spooty
async function downloadSpotify(url) {
  // Intentamos con el servidor más estable de ese ecosistema
  const endpoints = [
    `https://spotifyapi.caliphdev.com/api/download/track?url=${encodeURIComponent(url)}`,
    `https://api.siputzx.my.id/api/d/spotify?url=${encodeURIComponent(url)}`,
    `https://api.fabdl.com/spotify/get?url=${encodeURIComponent(url)}`,
  ];

  for (const api of endpoints) {
    try {
      const res = await axios.get(api, { timeout: 20000 });
      // El endpoint de caliphdev a veces devuelve el buffer directo o un JSON con el link
      let dlUrl =
        res.data?.result?.download ||
        res.data?.data?.url ||
        res.data?.url ||
        (typeof res.data === "string" ? api : null);

      if (dlUrl) {
        const audio = await axios.get(dlUrl, { responseType: "arraybuffer" });
        return Buffer.from(audio.data, "binary");
      }
    } catch {
      continue;
    }
  }
  return null;
}

module.exports = {
  commands: ["play", "music", "spotify"],
  description: "Spotify Full + Preview (Inspirado en Spooty)",
  permission: "public",

  run: async (sock, message, args, { sender, contextInfo }) => {
    const query = args.join(" ").trim();
    if (!query)
      return sock.sendMessage(
        sender,
        { text: "❌ ¿Qué buscamos hoy?" },
        { quoted: message },
      );

    const { key } = await sock.sendMessage(
      sender,
      { text: `🎧 Buscando en la base de Spotify...` },
      { quoted: message },
    );

    try {
      const { default: fetch } = await import("node-fetch");
      const { getPreview } = require("spotify-url-info")(fetch);

      let trackUrl = query;

      // 1. Validar Link o buscar (Usando un buscador rápido de tracks)
      if (!/https?:\/\/open\.spotify\.com\/track\//.test(query)) {
        const search = await axios.get(
          `https://spotifyapi.caliphdev.com/api/search/tracks?q=${encodeURIComponent(query)}`,
        );
        trackUrl = search.data?.[0]?.url;
        if (!trackUrl) throw new Error("No encontré la canción.");
      }

      // 2. Metadata con Googlebot (Tu truco esencial)
      const data = await getPreview(trackUrl, {
        headers: { "user-agent": "googlebot" },
      });

      await sock.sendMessage(
        sender,
        {
          image: { url: data.image },
          caption: `🎵 *${data.title}*\n🎤 *Artista:* ${data.artist}\n\n_📥 Descargando audio completo..._`,
          contextInfo,
        },
        { quoted: message },
      );

      // 3. Descarga con la nueva función basada en Spooty
      let audioBuffer = await downloadSpotify(trackUrl);
      let isPreview = false;

      // 4. Paracaídas de 30 segundos (Si la descarga estilo Spooty falla)
      if (!audioBuffer && data.audio) {
        const resPreview = await axios.get(data.audio, {
          responseType: "arraybuffer",
        });
        audioBuffer = Buffer.from(resPreview.data, "binary");
        isPreview = true;
        await sock.sendMessage(
          sender,
          {
            text: "⚠️ Descarga completa fallida. Usando *Preview de 30s* de respaldo.",
          },
          { quoted: message },
        );
      }

      if (!audioBuffer) throw new Error("No se pudo obtener el audio.");

      // 5. Envío
      await sock.sendMessage(
        sender,
        {
          audio: audioBuffer,
          mimetype: "audio/mpeg",
          ptt: true,
        },
        { quoted: message },
      );

      if (!isPreview) {
        const safeTitle = data.title.replace(/[^\w\s-]/g, "").slice(0, 30);
        await sock.sendMessage(
          sender,
          {
            document: audioBuffer,
            mimetype: "audio/mpeg",
            fileName: `${safeTitle}.mp3`,
            contextInfo,
          },
          { quoted: message },
        );
      }

      await sock.sendMessage(sender, { delete: key });
    } catch (err) {
      console.error("[Spotify Error]", err.message);
      await sock.sendMessage(
        sender,
        { text: `❌ *Error:* ${err.message}` },
        { quoted: message },
      );
    }
  },
};
