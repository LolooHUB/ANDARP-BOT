const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { db } = require('../Automatizaciones/firebase');
const fs = require('fs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mochila')
        .setDescription('🎒 Revisa tus pertenencias, dinero e inventario ilegal.'),

    async execute(interaction) {
        const RUTA_LOGO = './attachments/LogoPFP.png';
        
        try {
            const userRef = db.collection('usuarios_rp').doc(interaction.user.id);
            const doc = await userRef.get();

            if (!doc.exists) return interaction.reply({ content: "❌ No tienes DNI. Regístrate primero.", ephemeral: true });

            const data = doc.data();
            const inv = data.inventario || {}; // Firebase guarda esto como objeto { id: cantidad }
            
            // Diccionario extendido (Tienda + Blackmarket)
            const nombresItems = {
                // Legales
                'celular': '📱 Teléfono Móvil',
                'mochila': '🎒 Mochila de Cuero',
                'kit_reparacion': '🛠️ Kit de Reparación',
                'gasolina': '⛽ Bidón de Gasolina',
                'radio': '📻 Radio Frecuencia',
                'gps': '🗺️ GPS',
                'botiquin': '🩹 Botiquín',
                'camara': '📷 Cámara Réflex',
                // Blackmarket / Ilegales
                'glock': '🔫 Glock-17 (Ilegal)',
                'ak47': '⚔️ AK-47 Kalashnikov',
                'placa_virgen': '🆔 Placa de Matrícula Virgen',
                'ganzua': '🔐 Ganzúa Profesional',
                'chaleco_pesado': '🛡️ Chaleco Antibalas Pesado',
                'inhibidor': '📵 Inhibidor de Señal',
                'muni_9mm': '📦 Munición 9mm',
                'muni_762': '🔥 Munición 7.62'
            };

            // Construir lista con formato profesional
            let itemsTexto = "";
            const entradas = Object.entries(inv);

            if (entradas.length > 0) {
                itemsTexto = entradas
                    .filter(([_, cantidad]) => cantidad > 0)
                    .map(([id, cantidad]) => {
                        const info = nombresItems[id] || `📦 ${id.replace(/_/g, ' ')}`;
                        return `> **x${cantidad}** | ${info}`;
                    }).join('\n');
            } else {
                itemsTexto = "*Tu mochila está vacía actualmente.*";
            }

            // Bypass de imagen
            let logo = null;
            const files = [];
            if (fs.existsSync(RUTA_LOGO)) {
                logo = new AttachmentBuilder(RUTA_LOGO);
                files.push(logo);
            }

            const embed = new EmbedBuilder()
                .setAuthor({ 
                    name: `INVENTARIO: ${interaction.user.username}`, 
                    iconURL: logo ? 'attachment://LogoPFP.png' : null 
                })
                .setTitle('🎒 PERTENENCIAS PERSONALES')
                .setColor(entradas.some(([id]) => ['glock', 'ak47', 'inhibidor'].includes(id)) ? '#2f3136' : '#a67c52')
                .setThumbnail(interaction.user.displayAvatarURL())
                .addFields(
                    { name: '📂 ARTÍCULOS EN POSESIÓN', value: itemsTexto },
                    { name: '💰 CAPITAL DISPONIBLE', value: `\`${(data.banco || 0).toLocaleString()}€\``, inline: true },
                    { name: '⚖️ ESTADO', value: entradas.some(([id]) => ['glock', 'ak47'].includes(id)) ? '⚠️ *Portando Ilegal*' : '✅ *Limpio*', inline: true }
                )
                .setFooter({ text: 'Anda RP - Sistema de Gestión de Ciudadano' })
                .setTimestamp();

            return interaction.reply({ embeds: [embed], files: files });

        } catch (error) {
            console.error("Error en Mochila Execute:", error);
            return interaction.reply({ content: "❌ Error al abrir la mochila.", ephemeral: true });
        }
    }
};