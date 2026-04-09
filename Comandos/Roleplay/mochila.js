const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { db } = require('../Automatizaciones/firebase');
const fs = require('fs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mochila')
        .setDescription('🎒 Revisa tus pertenencias, dinero e inventario.'),

    async execute(interaction) {
        const RUTA_LOGO = './attachments/LogoPFP.png';
        
        try {
            const userRef = db.collection('usuarios_rp').doc(interaction.user.id);
            const doc = await userRef.get();

            if (!doc.exists) return interaction.reply({ content: "❌ No tienes DNI.", ephemeral: true });

            const data = doc.data();
            const inv = data.inventario || {}; 

            // --- DICCIONARIO UNIFICADO (MAESTRO) ---
            const DICCIONARIO_MAESTRO = {
                'glock': { nombre: 'Glock-17', emoji: '🔫' },
                'ak47': { nombre: 'AK-47', emoji: '⚔️' },
                'placa_virgen': { nombre: 'Placa Virgen', emoji: '🆔' },
                'ganzua': { nombre: 'Ganzúa Pro', emoji: '🔐' },
                'chaleco_pesado': { nombre: 'Chaleco Pesado', emoji: '🛡️' },
                'inhibidor': { nombre: 'Inhibidor', emoji: '📵' },
                'muni_9mm': { nombre: 'Munición 9mm', emoji: '📦' },
                'muni_762': { nombre: 'Munición 7.62', emoji: '🔥' },
                'celular': { nombre: 'Teléfono Móvil', emoji: '📱' },
                'gps': { nombre: 'GPS', emoji: '🗺️' },
                'radio': { nombre: 'Radio', emoji: '📻' },
                'mochila': { nombre: 'Mochila', emoji: '🎒' },
                'kit_reparacion': { nombre: 'Kit de Reparación', emoji: '🛠️' },
                'botiquin': { nombre: 'Botiquín', emoji: '🩹' },
                'gasolina': { nombre: 'Bidón de Gasolina', emoji: '⛽' },
                'camara': { nombre: 'Cámara Réflex', emoji: '📷' }
            };

            // PROCESAMIENTO DE ITEMS
            const itemsProcesados = Object.entries(inv)
                .filter(([_, cantidad]) => cantidad > 0)
                .map(([id, cantidad]) => {
                    const itemData = DICCIONARIO_MAESTRO[id];
                    if (itemData) {
                        return `> ${itemData.emoji} **${itemData.nombre}** x${cantidad}`;
                    } else {
                        return `> 📦 **${id.replace(/_/g, ' ')}** x${cantidad}`;
                    }
                });

            const listaFinal = itemsProcesados.length > 0 
                ? itemsProcesados.join('\n') 
                : '*No llevas nada en los bolsillos.*';

            // BYPASS DE IMAGEN
            let logo = null;
            const files = [];
            if (fs.existsSync(RUTA_LOGO)) {
                logo = new AttachmentBuilder(RUTA_LOGO);
                files.push(logo);
            }

            const embed = new EmbedBuilder()
                .setAuthor({ 
                    name: `MOCHILA DE ${interaction.user.username}`, 
                    iconURL: logo ? 'attachment://LogoPFP.png' : null 
                })
                .setTitle('🎒 INVENTARIO PERSONAL')
                .setColor('#f1c40f')
                .setThumbnail(interaction.user.displayAvatarURL())
                .addFields(
                    { name: '🗄️ Objetos', value: listaFinal },
                    { name: '💰 Banco', value: `\`${(data.banco || 0).toLocaleString()}€\``, inline: true },
                    { name: '📦 Peso Total', value: `*Calculando...*`, inline: true }
                )
                .setFooter({ text: 'Anda RP - Gestión de Inventario' })
                .setTimestamp();

            return interaction.reply({ embeds: [embed], files: files });

        } catch (error) {
            console.error("Error en Mochila:", error);
            return interaction.reply({ content: "❌ Error al abrir la mochila.", ephemeral: true });
        }
    }
};