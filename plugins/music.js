"use strict";

const axios = require("axios");
const yts = require("yt-search");

module.exports = {
  commands: ["play", "music", "spotify"],
  description: "Spotify Full + Preview (Fix 404 Búsqueda)",
  permission: "public",

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
      { text: `🎧 Buscando en Spotify...` },
      { quoted: message },
    );

    try {
      const { default: fetch } = await import("node-fetch");
      const { getPreview, getDetails } = require("spotify-url-info")(fetch);

      let trackUrl = "";

      // 1. DETECCIÓN DE LINK O BÚSQUEDA
      if (/https?:\/\/open\.spotify\.com\/track\//.test(query)) {
        trackUrl = query.split("?")[0];
      } else {
        // Si no es link, buscamos el nombre en YouTube para obtener un título limpio
        // Esto evita el error 404 de las APIs de búsqueda de Spotify
        const search = await yts(query);
        const vid = search.videos[0];
        if (!vid) throw new Error("No encontré resultados para esa búsqueda.");

        // Buscamos el link de Spotify usando una API de conversión estable
        const searchApi = await axios.get(
          `https://api.siputzx.my.id/api/s/spotify?query=${encodeURIComponent(vid.title)}`,
        );
        trackUrl =
          searchApi.data?.data?.[0]?.url || searchApi.data?.data?.[0]?.link;
      }

      if (!trackUrl)
        throw new Error("No pude obtener un enlace de Spotify válido.");

      // 2. OBTENER METADATA (Googlebot Trick)
      const data = await getPreview(trackUrl, {
        headers: { "user-agent": "googlebot" },
      });

      await sock.sendMessage(
        sender,
        {
          image: { url: data.image },
          caption: `🎵 *${data.title}*\n🎤 *Artista:* ${data.artist}\n\n_📥 Descargando audio..._`,
          contextInfo,
        },
        { quoted: message },
      );

      let audioBuffer = null;
      let isPreview = false;

      // 3. INTENTO DE DESCARGA COMPLETA (APIs 2026)
      const dlApis = [
        `https://api.siputzx.my.id/api/d/spotify?url=${encodeURIComponent(trackUrl)}`,
        `https://api.ryzendesu.vip/api/downloader/spotify?url=${encodeURIComponent(trackUrl)}`,
        `https://api.vreden.web.id/api/spotify?url=${encodeURIComponent(trackUrl)}`,
      ];

      for (const api of dlApis) {
        try {
          const resDl = await axios.get(api, { timeout: 10000 });
          let dlUrl =
            resDl.data?.url ||
            resDl.data?.data?.url ||
            resDl.data?.download ||
            resDl.data?.result?.download;

          if (dlUrl && dlUrl.startsWith("http")) {
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

      // 4. EL PARACAÍDAS (Audio de 30s de tu JSON)
      if (!audioBuffer && data.audio) {
        const resPreview = await axios.get(data.audio, {
          responseType: "arraybuffer",
        });
        audioBuffer = Buffer.from(resPreview.data, "binary");
        isPreview = true;
        await sock.sendMessage(
          sender,
          { text: "⚠️ Descarga completa fallida. Enviando *Preview de 30s*." },
          { quoted: message },
        );
      }

      if (!audioBuffer)
        throw new Error("No se pudo obtener el audio de ninguna fuente.");

      // 5. ENVÍO
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
