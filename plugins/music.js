"use strict";

const axios = require("axios");

module.exports = {
  commands: ["play", "music", "spotify"],
  description: "Descarga música de múltiples fuentes (Spotify/YT)",
  permission: "public",
  group: true,
  private: true,

  run: async (sock, message, args, { sender, contextInfo }) => {
    const query = args.join(" ").trim();
    if (!query)
      return sock.sendMessage(
        sender,
        { text: "❌ ¿Qué canción buscamos?" },
        { quoted: message },
      );

    const { key } = await sock.sendMessage(
      sender,
      { text: `🎧 Buscando: *${query}*...` },
      { quoted: message },
    );

    try {
      let trackData = null;

      // --- PASO 1: INTENTAR BÚSQUEDA EN SPOTIFY (Fuente 1) ---
      try {
        const res1 = await axios.get(
          `https://api.siputzx.my.id/api/s/spotify?query=${encodeURIComponent(query)}`,
        );
        if (res1.data?.data?.[0]) {
          const t = res1.data.data[0];
          trackData = {
            title: t.title || t.name,
            artist: t.artist || "Desconocido",
            url: t.url || t.link,
            image: t.image || t.thumbnail,
          };
        }
      } catch (e) {
        console.log("Fuente 1 falló");
      }

      // --- PASO 2: RESPALDO BÚSQUEDA (Fuente 2 - Agatz) ---
      if (!trackData) {
        try {
          const res2 = await axios.get(
            `https://api.agatz.xyz/api/spotify?q=${encodeURIComponent(query)}`,
          );
          if (res2.data?.data?.[0]) {
            const t = res2.data.data[0];
            trackData = {
              title: t.title || t.name,
              artist: t.artist || "Desconocido",
              url: t.url || t.link,
              image: t.thumbnail || t.image,
            };
          }
        } catch (e) {
          console.log("Fuente 2 falló");
        }
      }

      if (!trackData)
        throw new Error("No encontré la canción en ninguna fuente de Spotify.");

      // --- PASO 3: ENVIAR CARD ---
      await sock.sendMessage(
        sender,
        {
          image: {
            url: trackData.image || "https://files.catbox.moe/5uli5p.jpeg",
          },
          caption: `🎵 *${trackData.title}*\n🎤 *Artista:* ${trackData.artist}\n\n_📥 Descargando audio..._`,
          contextInfo,
        },
        { quoted: message },
      );

      // --- PASO 4: DESCARGA (Intentando múltiples descargadores) ---
      let audioUrl = null;
      const dlApis = [
        `https://api.siputzx.my.id/api/d/spotify?url=${encodeURIComponent(trackData.url)}`,
        `https://api.agatz.xyz/api/spotifydl?url=${encodeURIComponent(trackData.url)}`,
        `https://api.zenkey.my.id/api/download/spotify?url=${encodeURIComponent(trackData.url)}&apikey=zenkey`,
      ];

      for (const api of dlApis) {
        try {
          const { data } = await axios.get(api, { timeout: 15000 });
          let dl =
            data?.result?.download ||
            data?.data?.url ||
            data?.result?.url ||
            data?.url ||
            data?.link;

          if (typeof dl === "string" && dl.startsWith("http")) {
            audioUrl = dl;
            break;
          }
        } catch (e) {
          continue;
        }
      }

      if (!audioUrl)
        throw new Error("Servidores de descarga saturados. Intenta de nuevo.");

      // --- PASO 5: ENVIAR RESULTADOS ---
      // Audio nota de voz
      await sock.sendMessage(
        sender,
        {
          audio: { url: audioUrl },
          mimetype: "audio/mpeg",
          ptt: true,
        },
        { quoted: message },
      );

      // Archivo MP3
      const safeTitle = trackData.title.replace(/[^\w\s-]/g, "").slice(0, 30);
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

      await sock.sendMessage(sender, { delete: key });
    } catch (err) {
      console.error("[Music Error]", err.message);
      await sock.sendMessage(
        sender,
        {
          text: `❌ *Error:* ${err.message}`,
        },
        { quoted: message },
      );
    }
  },
};
