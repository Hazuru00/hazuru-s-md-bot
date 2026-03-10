"use strict";

const playdl = require("play-dl");
const axios = require("axios");
const yts = require("yt-search"); // Asegúrate de tenerlo en package.json

const FALLBACK_APIS = (link) => [
  `https://api.zenkey.my.id/api/download/ytmp3?url=${encodeURIComponent(link)}&apikey=zenkey`,
  `https://api.agatz.xyz/api/ytmp3?url=${encodeURIComponent(link)}`,
  `https://api.siputzx.my.id/api/d/ytmp3?url=${encodeURIComponent(link)}`,
  `https://api.lolhuman.xyz/api/ytaudio2?apikey=GataDios&url=${encodeURIComponent(link)}`, // API Key pública común
  `https://api.skizo.tech/api/ytmp3?url=${encodeURIComponent(link)}&apikey=batu`,
];

module.exports = {
  commands: ["play", "music"],
  description: "Search and download a song from YouTube",
  permission: "public",
  group: true,
  private: true,

  run: async (sock, message, args, { sender, contextInfo }) => {
    const query = args.join(" ").trim();
    if (!query)
      return sock.sendMessage(
        sender,
        { text: "❌ Usage: `.play <song name or link>`" },
        { quoted: message },
      );

    await sock.sendMessage(
      sender,
      { text: `🔍 Searching: *${query}*...` },
      { quoted: message },
    );

    try {
      let videoUrl, title, artist, thumbnail, duration;

      // --- PASO 1: BÚSQUEDA (Usando yt-search para evitar el error browseId) ---
      const search = await yts(query);
      const v = search.videos[0];
      if (!v) throw new Error("No results found.");

      videoUrl = v.url;
      title = v.title || "Unknown";
      artist = v.author.name || "Unknown";
      thumbnail = v.thumbnail || v.image || "";
      duration = v.timestamp || "";

      // --- PASO 2: ENVIAR CARD ---
      await sock.sendMessage(
        sender,
        {
          image: { url: thumbnail },
          caption: `🎵 *${title}*\n🎤 *Artist:* ${artist}\n⏱ *Duration:* ${duration}\n\n_Downloading..._`,
          contextInfo,
        },
        { quoted: message },
      );

      // --- PASO 3: INTENTAR STREAM (play-dl) ---
      let audioBuffer = null;
      try {
        // Forzamos un User-Agent para evitar bloqueos
        const stream = await playdl.stream(videoUrl, { quality: 1 }); // Calidad 1 suele ser más estable para audio
        const chunks = [];
        for await (const chunk of stream.stream) {
          chunks.push(chunk);
        }
        audioBuffer = Buffer.concat(chunks);
      } catch (streamErr) {
        console.warn("[Music] play-dl failed, moving to APIs...");
      }

      // --- PASO 4: FALLBACK APIS ---
      let audioUrl = null;
      if (!audioBuffer) {
        console.log("[Music] Fallback: Intentando con APIs externas...");
        for (const api of FALLBACK_APIS(videoUrl)) {
          try {
            const { data } = await axios.get(api, { timeout: 20000 });

            // Buscador universal de enlaces de descarga en el JSON
            audioUrl =
              data?.result?.download ||
              data?.result?.url ||
              data?.result?.link ||
              data?.data?.url ||
              data?.data?.link ||
              data?.url ||
              data?.link ||
              (typeof data?.result === "string" ? data.result : null);

            if (audioUrl && audioUrl.startsWith("http")) {
              console.log("[Music] Enlace encontrado en:", api);
              break;
            }
          } catch (e) {
            console.error(
              `[Music] API fallida (${api.split("/")[2]}):`,
              e.message,
            );
            continue;
          }
        }
      }

      if (!audioBuffer && !audioUrl) {
        throw new Error(
          "No se pudo obtener el audio. YouTube está bloqueando todas las conexiones. Intenta más tarde.",
        );
      }

      // --- PASO 5: ENVIAR AUDIO ---
      const payload = audioBuffer
        ? { audio: audioBuffer }
        : { audio: { url: audioUrl } };
      await sock.sendMessage(
        sender,
        {
          ...payload,
          mimetype: "audio/mpeg",
          ptt: false, // Cambia a true si lo quieres como nota de voz
        },
        { quoted: message },
      );

      // --- PASO 6: ENVIAR DOCUMENTO (Opcional) ---
      const safeTitle = title.replace(/[^\w\s-]/g, "").slice(0, 30);
      await sock.sendMessage(
        sender,
        {
          document: audioBuffer ? audioBuffer : { url: audioUrl },
          mimetype: "audio/mpeg",
          fileName: `${safeTitle}.mp3`,
          contextInfo,
        },
        { quoted: message },
      );
    } catch (err) {
      console.error(err);
      await sock.sendMessage(
        sender,
        { text: `❌ *Error:* ${err.message}` },
        { quoted: message },
      );
    }
  },
};
