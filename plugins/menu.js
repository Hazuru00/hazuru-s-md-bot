'use strict';

const fs     = require('fs');
const path   = require('path');
const config = require('../config');

// const REPO    = 'https://github.com/SilvaTechB/silva-md-v4';
const WEBSITE = 'https://hazurudev.vercel.app';

const CATEGORIES = [
    {
        icon: '⬇️',
        name: 'Descargadores',
        desc: 'Descarga desde cualquier plataforma',
        cmds: ['yt', 'tiktok', 'instagram', 'facebook', 'apk']
    },
    {
        icon: '🎵',
        name: 'Canciones & Lyrics',
        desc: 'Busca, descarga y busca lyrics',
        cmds: ['play', 'shazam', 'lyrics']
    },
    {
        icon: '🤖',
        name: 'AI & Tools',
        desc: 'Ultilidades con el poder de la IA',
        cmds: ['ai', 'imagine', 'translate', 'define', 'tts', 'calc', 'qrcode', 'base64', 'shorten', 'gitclone']
    },
    {
        icon: '🌍',
        name: 'Busqueda Y info',
        desc: 'Wikipedia, country, IP & more',
        cmds: ['wiki', 'country', 'ip', 'currency', 'time', 'weather', 'numberfact']
    },
    {
        icon: '🖼️',
        name: 'Archivos & Stickers',
        desc: 'Stickers, view-once & media',
        cmds: ['sticker', 'vv']
    },
    {
        icon: '😄',
        name: 'Diversion & Entretenimiento',
        desc: 'Jokes, riddles, facts & games',
        cmds: ['joke', 'fact', 'riddle', 'meme', 'quote', 'advice', 'compliment', 'flip', 'bible', 'hello']
    },
    {
        icon: '🔒',
        name: 'Privacidad & Encriptacion',
        desc: 'Password, morse & encoding tools',
        cmds: ['password', 'morse', 'base64']
    },
    {
        icon: '🛡️',
        name: 'Moderacion Segura',
        desc: 'Moderacion & Proteccion',
        cmds: ['antidemote', 'antidelete', 'antilink', 'afk', 'autoreply', 'anticall', 'blocklist']
    },
    {
        icon: '📰',
        name: 'Channels',
        desc: 'Newsletter management',
        cmds: ['newsletter', 'followchannel', 'unfollowchannel', 'channelinfo']
    },
    {
        icon: '📊',
        name: 'Status',
        desc: 'Status & story tools',
        cmds: ['save']
    },
    {
        icon: 'ℹ️',
        name: 'Info & Miselaneos',
        desc: 'indo del bot & utilidades',
        cmds: ['ping', 'uptime', 'owner', 'getjid', 'spp', 'repo', 'antivv']
    },
];

module.exports = {
    commands:    ['menu', 'help', 'list'],
    description: 'Muestran todos los comandos disponibles',
    permission:  'public',
    group:       true,
    private:     true,

    run: async (sock, message, args, ctx) => {
        const { prefix, contextInfo } = ctx;
        const jid = message.key.remoteJid;

        const plugins  = loadPlugins();
        const allCmds  = new Set(plugins.flatMap(p => p.commands || []));
        const assigned = new Set();

        const now = new Date().toLocaleString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
            hour: '2-digit', minute: '2-digit', hour12: true,
            timeZone: 'Africa/Nairobi'
        });

        const botName  = config.BOT_NAME || 'Silva MD';
        const botNum   = `+${(config.OWNER_NUMBER || '').replace(/\D/g, '')}`;
        const mode     = (config.MODE || 'public').toUpperCase();
        const pfx      = prefix;
        const modeEmoji = mode === 'PUBLIC' ? '🟢' : '🔒';

        // ── Build category blocks ──────────────────────────────────────────
        const catBlocks = [];
        for (const { icon, name, desc, cmds } of CATEGORIES) {
            const found = [...new Set(cmds.filter(c => allCmds.has(c)))];
            if (!found.length) continue;
            found.forEach(c => assigned.add(c));

            const rows = found.map(c => `│  ◈ \`${pfx}${c}\``).join('\n');
            catBlocks.push(
                `╭─「 ${icon} *${name}* 」─\n` +
                `│ _${desc}_\n` +
                `│\n` +
                `${rows}\n` +
                `╰────────────────────`
            );
        }

        // ── Overflow bucket ────────────────────────────────────────────────
        const rest = [...allCmds].filter(c => !assigned.has(c) && !['menu','help','list'].includes(c));
        if (rest.length) {
            const rows = rest.map(c => `│  ◈ \`${pfx}${c}\``).join('\n');
            catBlocks.push(
                `╭─「 🔧 *Otros* 」─\n│ _Comandos extra_\n│\n${rows}\n╰────────────────────`
            );
        }

        // ── Header ────────────────────────────────────────────────────────
        const header = [
            `╔═══════════════════════════╗`,
            `║  ⚡  *${botName.toUpperCase()}*  ⚡  ║`,
            `║     *El bot definitivo*   ║`,
            `╚═══════════════════════════╝`,
            ``,
            `┌─────────────────────────────`,
            `│ 🤖 *Bot:*      ${botName}`,
            `│ 📱 *Numero:*   ${botNum}`,
            `│ 🔑 *Prefix:*   \`${pfx}\``,
            `│ ${modeEmoji} *Mode:*     ${mode}`,
            `│ 📦 *Plugins:*  ${plugins.length} loaded`,
            `│ 🕐 *Time:*     ${now}`,
            `└─────────────────────────────`,
            ``,
            `✦ ✦ ✦  *C O M A N D O S*  ✦ ✦ ✦`,
            ``,
        ].join('\n');

        // ── Footer ────────────────────────────────────────────────────────
        const footer = [
          ``,
          `┌─────────────────────────────`,
          `│ 💡 *Usage:* \`${pfx}help <command>\``,
          `│ 🌐 *Web:*   https://hazurudev.vercel.app`,
          `└─────────────────────────────`,
          ``,
          `> ⚡ _Creditos Para Silva Tech Inc_`,
        ].join("\n");

        const fullText = `${header}${catBlocks.join('\n\n')}\n${footer}`;

        const imgUrl =
          config.ALIVE_IMG || "https://miro.medium.com/v2/resize:fit:640/format:webp/1*vBi4Ycgdn5t3lu2SvQXuog.gif";
        try {
            await sock.sendMessage(jid, {
                image:   { url: imgUrl },
                caption: fullText,
                contextInfo: {
                    ...contextInfo,
                    externalAdReply: {
                        title:               `${botName} — Menu de Comandos`,
                        body:                `${plugins.length} plugins  •  Prefix: ${pfx}  •  ${mode} mode`,
                        thumbnailUrl:        imgUrl,
                        sourceUrl:           WEBSITE,
                        mediaType:           1,
                        renderLargerThumbnail: false
                    }
                }
            }, { quoted: message });
        } catch {
            await sock.sendMessage(jid, {
                text: fullText,
                contextInfo
            }, { quoted: message });
        }
    }
};

function loadPlugins() {
    const dir = path.join(__dirname);
    const out = [];
    for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.js'))) {
        try {
            const p = require(path.join(dir, f));
            if (Array.isArray(p.commands) && p.commands.length) out.push(p);
        } catch { }
    }
    return out;
}
