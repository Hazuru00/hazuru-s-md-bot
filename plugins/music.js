"use strict";

const axios = require("axios");

module.exports = {
  commands: ["play", "music", "spotify"],
  description: "Spotify con Googlebot User-Agent y Fallback",
  permission: "public",

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
      { text: `🎧 Preparando descarga...` },
      { quoted: message },
    );

    try {
      // 1. IMPORTACIÓN DINÁMICA (Node-Fetch v3)
      const { default: fetch } = await import("node-fetch");
      const { getPreview } = require("spotify-url-info")(fetch);

      let trackUrl = query;

      // 2. BÚSQUEDA (Si no es link, conseguimos uno oficial)
      if (!/https?:\/\/open\.spotify\.com\/track\//.test(query)) {
        const search = await axios.get(
          `https://api.agatz.xyz/api/spotify?q=${encodeURIComponent(query)}`,
        );
        trackUrl = search.data?.data?.[0]?.url || search.data?.data?.[0]?.link;
        if (!trackUrl) throw new Error("No encontré la canción en Spotify.");
      }

      // 3. TU TRUCO: getPreview con Googlebot User-Agent
      const data = await getPreview(trackUrl, {
        headers: {
          "user-agent": "googlebot",
        },
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
        `https://api.vreden.web.id/api/spotify?url=${encodeURIComponent(trackUrl)}`,
        `https://api.siputzx.my.id/api/d/spotify?url=${encodeURIComponent(trackUrl)}`,
      ];

      for (const api of dlApis) {
        try {
          const resDl = await axios.get(api, { timeout: 15000 });
          let dlUrl =
            resDl.data?.url ||
            resDl.data?.data?.url ||
            resDl.data?.result?.download;

          if (dlUrl && typeof dlUrl === "string") {
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

      // 5. FALLBACK AL PREVIEW (Usando la info de tu truco)
      if (!audioBuffer && data.audio) {
        const resPreview = await axios.get(data.audio, {
          responseType: "arraybuffer",
        });
        audioBuffer = Buffer.from(resPreview.data, "binary");
        isPreview = true;
        await sock.sendMessage(
          sender,
          {
            text: "⚠️ Servidores saturados. Enviando *Preview de 30s* obtenido vía Googlebot.",
          },
          { quoted: message },
        );
      }

      if (!audioBuffer) throw new Error("No se pudo descargar el audio.");

      // 6. ENVÍO DE AUDIO COMO BUFFER (Evita el error de 'No disponible')
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
      console.error("[Spotify Error]", err);
      await sock.sendMessage(
        sender,
        { text: `❌ *Error:* ${err.message}` },
        { quoted: message },
      );
    }
  },
};
