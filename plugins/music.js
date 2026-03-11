"use strict";

const axios = require("axios");
const playdl = require("play-dl");
const { getPreview } = require("spotify-url-info")(require("node-fetch"));

module.exports = {
  commands: ["play", "music", "spotify"],
  description: "Descarga de Spotify con fallback a Preview de 30s",
  permission: "public",
  group: true,
  private: true,

  run: async (sock, message, args, { sender, contextInfo }) => {
    const query = args.join(" ").trim();
    if (!query)
      return sock.sendMessage(
        sender,
        { text: "❌ Ingresa el nombre de la canción o un link de Spotify." },
        { quoted: message },
      );

    const { key } = await sock.sendMessage(
      sender,
      { text: `🎧 Conectando con Spotify...` },
      { quoted: message },
    );

    try {
      let spotifyUrl = query;

      // --- PASO 1: CONVERTIR BÚSQUEDA A LINK DE SPOTIFY ---
      if (!query.includes("spotify.com")) {
        // Usamos play-dl solo para buscar el texto en Spotify y sacar el link oficial
        const searchRes = await playdl.search(query, {
          source: { spotify: "track" },
          limit: 1,
        });
        if (!searchRes || searchRes.length === 0)
          throw new Error("No encontré esta canción en Spotify.");
        spotifyUrl = searchRes[0].url;
      }

      // --- PASO 2: EXTRAER METADATOS Y PREVIEW ---
      // Aquí usamos la librería que pasaste para obtener toda la info de lujo
      const trackData = await getPreview(spotifyUrl);

      await sock.sendMessage(
        sender,
        {
          image: { url: trackData.image },
          caption: `🎵 *${trackData.title}*\n🎤 *Artista:* ${trackData.artist}\n\n_📥 Intentando descargar canción completa..._`,
          contextInfo,
        },
        { quoted: message },
      );

      // --- PASO 3: INTENTO DE DESCARGA COMPLETA (APIs Modernas) ---
      let finalAudioUrl = null;
      let isPreview = false;

      // Estas APIs son de las más estables y actuales para bots
      const modernApis = [
        `https://api.ryzendesu.vip/api/downloader/spotify?url=${encodeURIComponent(spotifyUrl)}`,
        `https://api.vreden.web.id/api/spotify?url=${encodeURIComponent(spotifyUrl)}`,
        `https://api.dorratz.com/v2/spotify-dl?url=${encodeURIComponent(spotifyUrl)}`,
      ];

      for (const api of modernApis) {
        try {
          const { data } = await axios.get(api, { timeout: 15000 });
          // Buscamos la URL de descarga completa
          let dl =
            data?.url || data?.data?.url || data?.result?.url || data?.download;

          if (typeof dl === "string" && dl.startsWith("http")) {
            finalAudioUrl = dl;
            break; // Si la API funciona, salimos del bucle
          }
        } catch (e) {
          continue; // Si falla, pasamos a la siguiente API
        }
      }

      // --- PASO 4: EL FALLBACK AL PREVIEW (Tu idea) ---
      if (!finalAudioUrl) {
        if (trackData.audio) {
          finalAudioUrl = trackData.audio;
          isPreview = true;

          // Avisamos al usuario que los servidores fallaron y enviaremos el preview
          await sock.sendMessage(
            sender,
            {
              text: `⚠️ *Aviso:* Los servidores gratuitos de descarga completa están saturados ahora mismo.\n\nTe enviaré el **Preview oficial de 30 segundos** en su lugar.`,
            },
            { quoted: message },
          );
        } else {
          throw new Error(
            "Servidores saturados y la canción no tiene preview disponible.",
          );
        }
      }

      // --- PASO 5: ENVIAR EL AUDIO ---
      await sock.sendMessage(
        sender,
        {
          audio: { url: finalAudioUrl },
          mimetype: "audio/mpeg",
          ptt: true, // true para enviarlo como nota de voz
        },
        { quoted: message },
      );

      // Enviar como Documento MP3 (Solo si es la canción completa)
      // No tiene sentido enviar un archivo para descargar si solo dura 30 segundos
      if (!isPreview) {
        const safeTitle = trackData.title.replace(/[^\w\s-]/g, "").slice(0, 30);
        await sock.sendMessage(
          sender,
          {
            document: { url: finalAudioUrl },
            mimetype: "audio/mpeg",
            fileName: `${safeTitle}.mp3`,
            contextInfo,
          },
          { quoted: message },
        );
      }

      // Limpiamos el mensaje de "Conectando..."
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
