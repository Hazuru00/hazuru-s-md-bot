"use strict";
const axios = require("axios");

module.exports = {
  commands: ["joke", "chiste", "jokes"],
  description: "Recibe un chiste de alta calidad (curados + API)",
  usage: ".joke [category] — categorías: any, programming, dark, pun",
  permission: "public",
  group: true,
  private: true,

  run: async (sock, message, args, ctx) => {
    const { contextInfo } = ctx;
    const jid = message.key.remoteJid;

    // --- BASE DE DATOS LOCAL DE CHISTES "BUENOS" (Humor Latino/Español) ---
    const goldenJokes = [
      {
        setup: "¿Qué hace un mudo bailando?",
        delivery: "¡Se quita las ganas de hablar!",
      },
      { setup: "¿Cómo se dice pañuelo en japonés?", delivery: "Saka-moko." },
      {
        setup: "Había un hombre tan, tan, pero tan calvo...",
        delivery: "¡Que se le resbalaban las ideas!",
      },
      {
        setup: "¿Cómo se llama el campeón de buceo japonés?",
        delivery: "Tokofondo.",
      },
      {
        setup: "¿Qué le dice un jaguar a otro jaguar?",
        delivery: "Jaguar you?",
      },
      {
        setup: "Mamá, en el colegio me llaman distraído...",
        delivery: "Juanito, ¡tu casa es la de al lado!",
      },
      {
        setup: "¿Para qué sirven los bolsillos de los ataúdes?",
        delivery: "Para los que se llevan el secreto a la tumba.",
      },
      {
        setup: "¿Por qué los pájaros vuelan al sur en invierno?",
        delivery: "¡Porque caminando tardarían mucho!",
      },
    ];

    const valid = ["any", "programming", "misc", "dark", "pun", "spooky"];
    const cat =
      args[0] && valid.includes(args[0].toLowerCase())
        ? args[0].toLowerCase()
        : "any";

    try {
      let jokeText = "";

      // Si es 'any' o 'chiste' sin categoría, tenemos 50% de probabilidad de dar uno de la lista "Élite"
      if ((cat === "any" || !args[0]) && Math.random() > 0.5) {
        const randomGolden =
          goldenJokes[Math.floor(Math.random() * goldenJokes.length)];
        jokeText = `🤣 *Chiste de Élite* ✨\n\n❓ ${randomGolden.setup}\n\n💬 ${randomGolden.delivery}`;
      } else {
        // Si no, usamos la API (especialmente buena para programación/dark)
        const res = await axios.get(
          `https://v2.jokeapi.dev/joke/${cat === "any" ? "Any" : cat}?lang=es`,
          {timeout: 5000 },
        );

        const data = res.data;
        if (data.error) throw new Error();

        const emoji = ["😂", "🤣", "💀", "😹", "😆"][
          Math.floor(Math.random() * 5)
        ];
        const categoria = data.category
          .replace("Misc", "Varios")
          .replace("Programming", "Programación");

        jokeText =
          data.type === "twopart"
            ? `${emoji} *Chiste* _(${categoria})_\n\n❓ ${data.setup}\n\n💬 ${data.delivery}`
            : `${emoji} *Chiste* _(${categoria})_\n\n${data.joke}`;
      }

      await sock.sendMessage(
        jid,
        {
          text: jokeText,
          contextInfo: {
            ...contextInfo,
            externalAdReply: {
              title: "¡Zona de Risas!",
              body: "Hazuru~ Jokes Service",
              previewType: "PHOTO",
              thumbnailUrl: "https://files.catbox.moe/5uli5p.jpeg", // Puedes cambiar por un icono de risa
              sourceUrl: "",
            },
          },
        },
        { quoted: message },
      );
    } catch (err) {
      // Fallback de emergencia por si la API falla: enviamos uno de la lista local
      const fallback =
        goldenJokes[Math.floor(Math.random() * goldenJokes.length)];
      await sock.sendMessage(
        jid,
        {
          text: `🤣 *Chiste* (Offline)\n\n❓ ${fallback.setup}\n\n💬 ${fallback.delivery}`,
          contextInfo,
        },
        { quoted: message },
      );
    }
  },
};
