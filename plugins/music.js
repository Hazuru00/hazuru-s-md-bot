"use strict";

const playdl = require("play-dl");
const axios = require("axios");

// APIs especializadas en Spotify (Descarga directa)
const SPOTIFY_APIS = (query) => [
  `https://api.siputzx.my.id/api/d/spotify?url=${encodeURIComponent(query)}`,
  `https://api.agatz.xyz/api/spotify?url=${encodeURIComponent(query)}`,
  `https://api.zenkey.my.id/api/download/spotify?url=${encodeURIComponent(query)}&apikey=zenkey`,
  `https://api.davidcyriltech.my.id/spotifydl?url=${encodeURIComponent(query)}`,
];

module.exports = {
  commands: ["play", "music", "spotify"],
  description: "Busca y descarga música de Spotify",
  permission: "public",
  group: true,
  private: true,

  run: async (sock, message, args, { sender, contextInfo }) => {
    const query = args.join(" ").trim();
    if (!query)
      return sock.sendMessage(
        sender,
        { text: "❌ Uso: `.play <nombre de la canción o link de Spotify>`" },
        { quoted: message },
      );

    const { key } = await sock.sendMessage(
      sender,
      { text: `🎧 Buscando en Spotify: *${query}*...` },
      { quoted: message },
    );

    try {
      let trackInfo = {
        title: "Unknown",
        artist: "Unknown",
        thumbnail: "https://files.catbox.moe/5uli5p.jpeg",
        url: "",
      };

      // --- PASO 1: BÚSQUEDA EN SPOTIFY ---
      if (query.includes("spotify.com")) {
        const data = await playdl.spotify(query);
        trackInfo.title = data.name;
        trackInfo.artist = data.artists.map((a) => a.name).join(", ");
        trackInfo.thumbnail = data.thumbnail?.url || trackInfo.thumbnail;
        trackInfo.url = query;
      } else {
        const search = await playdl.search(query, {
          source: { spotify: "track" },
          limit: 1,
        });
        if (search.length === 0)
          throw new Error("No encontré nada en Spotify.");
        const track = search[0];
        trackInfo.title = track.name;
        trackInfo.artist = track.artists.map((a) => a.name).join(", ");
        trackInfo.thumbnail = track.thumbnail?.url || trackInfo.thumbnail;
        trackInfo.url = track.url;
      }

      // --- PASO 2: ENVIAR CARD ---
      await sock.sendMessage(
        sender,
        {
          image: { url: trackInfo.thumbnail },
          caption: `🎵 *${trackInfo.title}*\n🎤 *Artista:* ${trackInfo.artist}\n\n_📥 Descargando desde servidor Spotify..._`,
          contextInfo,
        },
        { quoted: message },
      );

      let audioUrl = null;

      // --- PASO 3: DESCARGA CON FALLBACK DE APIs ---
      for (const api of SPOTIFY_APIS(trackInfo.url)) {
        try {
          const { data } = await axios.get(api, { timeout: 20000 });

          // Extractor de enlaces ultra-seguro
          let dl =
            data?.result?.download ||
            data?.result?.url ||
            data?.data?.url ||
            data?.url ||
            data?.link;

          // Validamos que sea un string y no la función .link()
          if (typeof dl === "string" && dl.startsWith("http")) {
            audioUrl = dl;
            break;
          }
        } catch (e) {
          continue; // Si una API falla, vamos a la siguiente
        }
      }

      if (!audioUrl)
        throw new Error(
          "No se pudo obtener el audio de Spotify. Intenta con otro nombre.",
        );

      // --- PASO 4: ENVIAR AUDIO Y DOCUMENTO ---
      const audioPayload = { url: audioUrl };
      const safeTitle = trackInfo.title.replace(/[^\w\s-]/g, "").slice(0, 30);

      // Enviar como Nota de Voz
      await sock.sendMessage(
        sender,
        {
          audio: audioPayload,
          mimetype: "audio/mpeg",
          ptt: true,
        },
        { quoted: message },
      );

      // Enviar como Archivo MP3
      await sock.sendMessage(
        sender,
        {
          document: audioPayload,
          mimetype: "audio/mpeg",
          fileName: `${safeTitle}.mp3`,
          contextInfo,
        },
        { quoted: message },
      );

      // Limpiar mensaje de búsqueda
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
