"use strict";

const axios = require("axios");

module.exports = {
  commands: ["play", "music", "spotify"],
  description: "Descarga completa con fallback a preview de 30s",
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
      { text: `🎧 Conectando a Spotify...` },
      { quoted: message },
    );

    try {
      // Importación dinámica para evitar que el bot crashee al arrancar
      const { getPreview } = require("spotify-url-info")(require("node-fetch"));

      let trackUrl = query;
      let trackData = null;

      // --- PASO 1: OBTENER EL LINK Y METADATA ---
      if (!query.includes("spotify.com")) {
        const search = await axios.get(
          `https://api.siputzx.my.id/api/s/spotify?query=${encodeURIComponent(query)}`,
        );
        trackUrl = search.data?.data?.[0]?.url || search.data?.data?.[0]?.link;
        if (!trackUrl) throw new Error("No encontré la canción en Spotify.");
      }

      // Sacamos la metadata de spotify-url-info (la que tú querías)
      trackData = await getPreview(trackUrl);

      // --- PASO 2: ENVIAR CARD INFORMATIVA ---
      await sock.sendMessage(
        sender,
        {
          image: { url: trackData.image },
          caption: `🎵 *${trackData.title}*\n🎤 *Artista:* ${trackData.artist}\n\n_📥 Intentando descargar audio completo..._`,
          contextInfo,
        },
        { quoted: message },
      );

      // --- PASO 3: INTENTO DE DESCARGA COMPLETA ---
      let audioUrl = null;
      let isPreview = false;

      const modernApis = [
        `https://api.ryzendesu.vip/api/downloader/spotify?url=${encodeURIComponent(trackUrl)}`,
        `https://api.vreden.web.id/api/spotify?url=${encodeURIComponent(trackUrl)}`,
        `https://api.siputzx.my.id/api/d/spotify?url=${encodeURIComponent(trackUrl)}`,
      ];

      for (const api of modernApis) {
        try {
          const { data } = await axios.get(api, { timeout: 12000 });
          let dl =
            data?.url ||
            data?.data?.url ||
            data?.result?.download ||
            data?.download;
          if (typeof dl === "string" && dl.startsWith("http")) {
            audioUrl = dl;
            break;
          }
        } catch {
          continue;
        }
      }

      // --- PASO 4: LÓGICA DE FALLBACK (TU IDEA) ---
      if (!audioUrl) {
        if (trackData.audio) {
          // trackData.audio es el preview de 30s de spotify-url-info
          audioUrl = trackData.audio;
          isPreview = true;
          await sock.sendMessage(
            sender,
            {
              text: "⚠️ Los servidores de descarga completa fallaron. Enviando *Preview de 30s* para no dejarte sin nada.",
            },
            { quoted: message },
          );
        } else {
          throw new Error(
            "No se pudo obtener ni el audio completo ni el preview.",
          );
        }
      }

      // --- PASO 5: ENVIAR RESULTADO ---
      await sock.sendMessage(
        sender,
        {
          audio: { url: audioUrl },
          mimetype: "audio/mpeg",
          ptt: true,
        },
        { quoted: message },
      );

      if (!isPreview) {
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
