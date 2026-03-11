"use strict";

const axios = require("axios");

module.exports = {
  commands: ["play", "music", "spotify"],
  description: "Spotify Full + Preview (Detección de Link y Nombre)",
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

      // 2. LÓGICA DE DETECCIÓN MEJORADA (RegEx para Links)
      const spotifyLinkRegex =
        /https?:\/\/open\.spotify\.com\/track\/[a-zA-Z0-9]+/;
      const isLink = spotifyLinkRegex.test(query);

      if (isLink) {
        // ES UN LINK: Lo extraemos y limpiamos
        trackUrl = query.match(spotifyLinkRegex)[0];
      } else {
        // ES NOMBRE/TEXTO: Buscamos el link oficial
        try {
          // Fuente 1: Vreden (Más estable para búsqueda)
          const searchRes = await axios.get(
            `https://api.vreden.web.id/api/spotifysearch?query=${encodeURIComponent(query)}`,
          );
          trackUrl =
            searchRes.data?.result?.[0]?.link ||
            searchRes.data?.result?.[0]?.url;

          // Fallback: Agatz
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
        throw new Error("No encontré resultados para esa búsqueda.");

      // 3. OBTENER METADATA (Googlebot Trick)
      const data = await getPreview(trackUrl, {
        headers: { "user-agent": "googlebot" },
      });

      await sock.sendMessage(
        sender,
        {
          image: { url: data.image },
          caption: `🎵 *${data.title}*\n🎤 *Artista:* ${data.artist}\n\n_📥 Procesando audio..._`,
          contextInfo,
        },
        { quoted: message },
      );

      let audioBuffer = null;
      let isPreview = false;

      // 4. INTENTO DE DESCARGA COMPLETA
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

      // 5. FALLBACK AL PREVIEW (30 Segundos)
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
        throw new Error("Servidores saturados. No se pudo obtener el audio.");

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
