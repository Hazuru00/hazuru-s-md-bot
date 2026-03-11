"use strict";

const axios = require("axios");

module.exports = {
  commands: ["play", "music", "spotify"],
  description: "Spotify Full + Preview (Fix de Búsqueda y Link)",
  permission: "public",

  run: async (sock, message, args, { sender, contextInfo }) => {
    const query = args.join(" ").trim();
    if (!query)
      return sock.sendMessage(
        sender,
        {
          text: "❌ Escribe el nombre de la canción o pega un link de Spotify.",
        },
        { quoted: message },
      );

    const { key } = await sock.sendMessage(
      sender,
      { text: `🎧 Conectando con Spotify...` },
      { quoted: message },
    );

    try {
      // 1. IMPORTACIÓN DINÁMICA (Node-Fetch v3)
      const { default: fetch } = await import("node-fetch");
      const { getPreview } = require("spotify-url-info")(fetch);

      let trackUrl = "";

      // 2. LÓGICA DE DETECCIÓN (Link vs Búsqueda)
      if (query.includes("spotify.com")) {
        // Es un link, lo usamos directamente
        trackUrl = query.split("?")[0]; // Limpiamos parámetros extras del link
      } else {
        // Es texto, buscamos el link primero
        try {
          const searchApi = await axios.get(
            `https://api.vreden.web.id/api/spotifysearch?query=${encodeURIComponent(query)}`,
          );
          trackUrl =
            searchApi.data?.result?.[0]?.link ||
            searchApi.data?.result?.[0]?.url;

          // Fallback de búsqueda si la primera falla
          if (!trackUrl) {
            const backupSearch = await axios.get(
              `https://api.agatz.xyz/api/spotify?q=${encodeURIComponent(query)}`,
            );
            trackUrl = backupSearch.data?.data?.[0]?.url;
          }
        } catch (e) {
          console.error("Error en búsqueda:", e.message);
        }
      }

      if (!trackUrl)
        throw new Error(
          "No pude encontrar un enlace válido para esta canción.",
        );

      // 3. OBTENER METADATA CON TU TRUCO DE GOOGLEBOT
      const data = await getPreview(trackUrl, {
        headers: { "user-agent": "googlebot" },
      });

      await sock.sendMessage(
        sender,
        {
          image: { url: data.image },
          caption: `🎵 *${data.title}*\n🎤 *Artista:* ${data.artist}\n\n_📥 Descargando audio, espera un momento..._`,
          contextInfo,
        },
        { quoted: message },
      );

      let audioBuffer = null;
      let isPreview = false;

      // 4. INTENTO DE DESCARGA COMPLETA (APIs que funcionan en 2026)
      const dlApis = [
        `https://api.ryzendesu.vip/api/downloader/spotify?url=${encodeURIComponent(trackUrl)}`,
        `https://api.shizuka.site/spotify?url=${encodeURIComponent(trackUrl)}`,
        `https://api.vreden.web.id/api/spotify?url=${encodeURIComponent(trackUrl)}`,
      ];

      for (const api of dlApis) {
        try {
          const resDl = await axios.get(api, { timeout: 15000 });
          let dlUrl =
            resDl.data?.url ||
            resDl.data?.data?.url ||
            resDl.data?.result?.download ||
            resDl.data?.download;

          if (dlUrl && typeof dlUrl === "string" && dlUrl.startsWith("http")) {
            const resAudio = await axios.get(dlUrl, {
              responseType: "arraybuffer",
            });
            audioBuffer = Buffer.from(resAudio.data, "binary");
            break;
          }
        } catch {
          continue;
        }
      }

      // 5. FALLBACK AL PREVIEW (Usando el JSON de spotify-url-info)
      if (!audioBuffer && data.audio) {
        const resPreview = await axios.get(data.audio, {
          responseType: "arraybuffer",
        });
        audioBuffer = Buffer.from(resPreview.data, "binary");
        isPreview = true;
        await sock.sendMessage(
          sender,
          {
            text: "⚠️ Descarga completa no disponible. Enviando *Preview oficial* (30s).",
          },
          { quoted: message },
        );
      }

      if (!audioBuffer)
        throw new Error(
          "No se pudo obtener el archivo de audio. Los servidores están saturados.",
        );

      // 6. ENVÍO FINAL
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
