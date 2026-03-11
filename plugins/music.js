"use strict";

const axios = require("axios");

module.exports = {
  commands: ["play", "music", "spotify"],
  description: "Spotify Full + Preview con Node-Fetch v3",
  permission: "public",
  group: true,
  private: true,

  run: async (sock, message, args, { sender, contextInfo }) => {
    const query = args.join(" ").trim();
    if (!query)
      return sock.sendMessage(
        sender,
        { text: "❌ Escribe el nombre o pega un link." },
        { quoted: message },
      );

    const { key } = await sock.sendMessage(
      sender,
      { text: `🎧 Conectando con Spotify...` },
      { quoted: message },
    );

    try {
      // --- FIX PARA NODE-FETCH V3 (IMPORTACIÓN DINÁMICA) ---
      const { default: fetch } = await import("node-fetch");
      const spotify = require("spotify-url-info")(fetch);

      let trackUrl = query;

      // 1. Validar si es link o búsqueda
      if (!query.includes("spotify.com")) {
        const search = await axios.get(
          `https://api.agatz.xyz/api/spotify?q=${encodeURIComponent(query)}`,
        );
        trackUrl = search.data?.data?.[0]?.url || search.data?.data?.[0]?.link;
        if (!trackUrl) throw new Error("No encontré la canción en Spotify.");
      }

      // 2. Obtener Metadata y el JSON que me mostraste
      // Usamos getPreview porque es el más rápido para traer el campo "audio"
      const details = await spotify.getPreview(trackUrl);

      await sock.sendMessage(
        sender,
        {
          image: { url: details.image },
          caption: `🎵 *${details.title}*\n🎤 *Artista:* ${details.artist}\n\n_📥 Buscando canción completa..._`,
          contextInfo,
        },
        { quoted: message },
      );

      let audioUrl = null;
      let isPreview = false;

      // 3. Intento de descarga completa (APIs Actualizadas)
      const dlApis = [
        `https://api.ryzendesu.vip/api/downloader/spotify?url=${encodeURIComponent(trackUrl)}`,
        `https://api.vreden.web.id/api/spotify?url=${encodeURIComponent(trackUrl)}`,
        `https://api.siputzx.my.id/api/d/spotify?url=${encodeURIComponent(trackUrl)}`,
      ];

      for (const api of dlApis) {
        try {
          const { data } = await axios.get(api, { timeout: 15000 });
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

      // 4. EL PARACAÍDAS: Si falla la completa, usamos el audio de 30s del JSON
      if (!audioUrl) {
        if (details.audio) {
          // Este es el link que viste en tu JSON
          audioUrl = details.audio;
          isPreview = true;
          await sock.sendMessage(
            sender,
            {
              text: "⚠️ No se pudo obtener la canción completa. Enviando *Preview de 30s* de Spotify.",
            },
            { quoted: message },
          );
        } else {
          throw new Error("No se pudo obtener ningún tipo de audio.");
        }
      }

      // 5. Envío del Audio
      await sock.sendMessage(
        sender,
        {
          audio: { url: audioUrl },
          mimetype: "audio/mpeg",
          ptt: true, // Se envía como nota de voz
        },
        { quoted: message },
      );

      // Solo enviamos el archivo MP3 si es la canción completa
      if (!isPreview) {
        const safeTitle = details.title.replace(/[^\w\s-]/g, "").slice(0, 30);
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
      console.error("[Spotify Error]", err);
      await sock.sendMessage(
        sender,
        { text: `❌ *Error:* ${err.message}` },
        { quoted: message },
      );
    }
  },
};
