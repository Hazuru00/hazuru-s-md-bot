"use strict";

const axios = require("axios");
const fetch = require("node-fetch");
const spotify = require("spotify-url-info")(fetch);

module.exports = {
  commands: ["play", "music", "spotify"],
  description: "Descarga de Spotify usando dependencias oficiales",
  permission: "public",
  group: true,
  private: true,

  run: async (sock, message, args, { sender, contextInfo }) => {
    const query = args.join(" ").trim();
    if (!query)
      return sock.sendMessage(
        sender,
        { text: "❌ Escribe el nombre de la canción o un link." },
        { quoted: message },
      );

    const { key } = await sock.sendMessage(
      sender,
      { text: `🎧 Conectando con Spotify...` },
      { quoted: message },
    );

    try {
      let trackUrl = query;
      let trackData = null;

      // --- PASO 1: VALIDAR LINK O BUSCAR ---
      if (!query.includes("spotify.com")) {
        // Si no es link, buscamos el enlace oficial rápido con una API
        const search = await axios.get(
          `https://api.agatz.xyz/api/spotify?q=${encodeURIComponent(query)}`,
        );
        trackUrl = search.data?.data?.[0]?.url || search.data?.data?.[0]?.link;
        if (!trackUrl) throw new Error("No encontré la canción en Spotify.");
      }

      // --- PASO 2: OBTENER METADATA Y PREVIEW (De la dependencia) ---
      // Usamos getDetails para tener el objeto completo que me mostraste antes
      const details = await spotify.getDetails(trackUrl);
      trackData = {
        title: details.preview.title,
        artist: details.preview.artist,
        image: details.preview.image,
        preview: details.preview.audio, // Aquí está tu audio de 30s
        url: trackUrl,
      };

      // --- PASO 3: ENVIAR CARD ---
      await sock.sendMessage(
        sender,
        {
          image: { url: trackData.image },
          caption: `🎵 *${trackData.title}*\n🎤 *Artista:* ${trackData.artist}\n\n_📥 Intentando descargar canción completa..._`,
          contextInfo,
        },
        { quoted: message },
      );

      let audioUrl = null;
      let isPreview = false;

      // --- PASO 4: INTENTO DE DESCARGA COMPLETA ---
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

      // --- PASO 5: FALLBACK AL PREVIEW (Tu lógica) ---
      if (!audioUrl) {
        if (trackData.preview) {
          audioUrl = trackData.preview;
          isPreview = true;
          await sock.sendMessage(
            sender,
            {
              text: "⚠️ Servidores de descarga completa saturados. Enviando *Preview de 30s* de respaldo.",
            },
            { quoted: message },
          );
        } else {
          throw new Error(
            "No se pudo obtener el audio completo ni el preview.",
          );
        }
      }

      // --- PASO 6: ENVÍO FINAL ---
      // Nota de voz
      await sock.sendMessage(
        sender,
        {
          audio: { url: audioUrl },
          mimetype: "audio/mpeg",
          ptt: true,
        },
        { quoted: message },
      );

      // Documento (Solo si es completa)
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
