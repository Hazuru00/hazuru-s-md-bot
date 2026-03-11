"use strict";

const playdl = require("play-dl");
const axios = require("axios");
const yts = require("yt-search");

// Lista de APIs extendida y actualizada 2026
const FALLBACK_APIS = (link) => [
  `https://api.siputzx.my.id/api/d/ytmp3?url=${encodeURIComponent(link)}`,
  `https://api.zenkey.my.id/api/download/ytmp3?url=${encodeURIComponent(link)}&apikey=zenkey`,
  `https://api.agatz.xyz/api/ytmp3?url=${encodeURIComponent(link)}`,
  `https://api.davidcyriltech.my.id/download/ytmp3?url=${encodeURIComponent(link)}`,
  `https://api.skizo.tech/api/ytmp3?url=${encodeURIComponent(link)}&apikey=batu`,
];

module.exports = {
  commands: ["play", "music"],
  description: "Search and download music with multi-source fallback",
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

    // Mensaje inicial de búsqueda
    const { key } = await sock.sendMessage(
      sender,
      { text: `🔍 Searching: *${query}*...` },
      { quoted: message },
    );

    try {
      // --- PASO 1: BÚSQUEDA ROBUSTA ---
      const search = await yts(query);
      const v = search.videos[0];
      if (!v) throw new Error("No results found.");

      const videoUrl = v.url;
      const title = v.title || "Unknown";
      const safeTitle = title.replace(/[^\w\s-]/g, "").slice(0, 30);

      // --- PASO 2: ENVIAR CARD INFORMATIVA ---
      await sock.sendMessage(
        sender,
        {
          image: { url: v.thumbnail || v.image },
          caption: `🎵 *${title}*\n🎤 *Artist:* ${v.author.name}\n⏱ *Duration:* ${v.timestamp}\n\n_📥 Downloading audio..._`,
          contextInfo,
        },
        { quoted: message },
      );

      let audioSource = null;
      let isBuffer = false;

      // --- PASO 3: MÉTODO A (STREAM DIRECTO REFORZADO) ---
      try {
        // quality: 0 busca solo el stream de audio (m4a/opus) que es más estable
        const stream = await playdl.stream(videoUrl, {
          quality: 0,
          discordPlayerCompatibility: true,
        });

        const chunks = [];
        for await (const chunk of stream.stream) {
          chunks.push(chunk);
        }
        audioSource = Buffer.concat(chunks);
        isBuffer = true;
        console.log(`[Play] Stream exitoso: ${title}`);
      } catch (streamErr) {
        console.warn(`[Play] Stream falló para ${title}, intentando APIs...`);

        // --- PASO 4: MÉTODO B (FALLBACK CON EXTRACTOR UNIVERSAL) ---
        for (const api of FALLBACK_APIS(videoUrl)) {
          try {
            const { data } = await axios.get(api, { timeout: 20000 });

            // Este extractor busca el link en cualquier propiedad común
            const dl =
              data?.result?.downloadUrl ||
              data?.result?.url ||
              data?.result?.link ||
              data?.data?.url ||
              data?.url ||
              data?.link ||
              (typeof data?.result === "string" ? data.result : null);

            if (dl && dl.startsWith("http")) {
              audioSource = dl;
              isBuffer = false;
              break;
            }
          } catch (e) {
            continue;
          }
        }
      }

      if (!audioSource)
        throw new Error("No se pudo obtener el audio de ninguna fuente.");

      // Preparar el objeto de audio (Buffer o URL)
      const audioContent = isBuffer ? audioSource : { url: audioSource };

      // --- PASO 5: ENVIAR COMO AUDIO (PTT / NOTA DE VOZ) ---
      await sock.sendMessage(
        sender,
        {
          audio: audioContent,
          mimetype: "audio/mpeg",
          ptt: true, // Enviado como nota de voz para reproducción inmediata
        },
        { quoted: message },
      );

      // --- PASO 6: ENVIAR COMO DOCUMENTO (PARA DESCARGAR) ---
      await sock.sendMessage(
        sender,
        {
          document: audioContent,
          mimetype: "audio/mpeg",
          fileName: `${safeTitle}.mp3`,
          contextInfo,
        },
        { quoted: message },
      );

      // Opcional: Borrar el mensaje de "Searching..." para limpiar el chat
      await sock.sendMessage(sender, { delete: key });
    } catch (err) {
      console.error("[Play Error]", err);
      await sock.sendMessage(
        sender,
        {
          text: `❌ *Error:* ${err.message || "Servicio no disponible"}`,
        },
        { quoted: message },
      );
    }
  },
};
