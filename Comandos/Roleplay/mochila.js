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
            // IMPORTANTE: Aseguramos que inv sea un objeto {} y no un array []
            const inv = data.inventario || {}; 
            
            const nombresItems = {
                'celular': '📱 Teléfono Móvil',
                'mochila': '🎒 Mochila de Cuero',
                'kit_reparacion': '🛠️ Kit de Reparación',
                'gasolina': '⛽ Bidón de Gasolina',
                'radio': '📻 Radio Frecuencia',
                'gps': '🗺️ GPS',
                'botiquin': '🩹 Botiquín',
                'camara': '📷 Cámara Réflex',
                'glock': '🔫 Glock-17 (Ilegal)',
                'ak47': '⚔️ AK-47 Kalashnikov',
                'placa_virgen': '🆔 Placa de Matrícula Virgen',
                'ganzua': '🔐 Ganzúa Profesional',
                'chaleco_pesado': '🛡️ Chaleco Antibalas Pesado',
                'inhibidor': '📵 Inhibidor de Señal',
                'muni_9mm': '📦 Munición 9mm',
                'muni_762': '🔥 Munición 7.62'
            };

            // Convertimos el objeto en una lista legible
            const itemsProcesados = Object.entries(inv)
                .filter(([_, cantidad]) => cantidad > 0) // Solo mostrar lo que tenemos
                .map(([id, cantidad]) => {
                    const nombreBonito = nombresItems[id] || `📦 ${id.replace(/_/g, ' ')}`;
                    return `**x${cantidad}** | ${nombreBonito}`;
                });

            const listaFinal = itemsProcesados.length > 0 
                ? itemsProcesados.join('\n') 
                : '*Tu mochila está vacía.*';

            // --- BYPASS DE IMAGEN ---
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
                .setTitle('🎒 OBJETOS EN POSESIÓN')
                .setColor(itemsProcesados.some(i => i.includes('Ilegal')) ? '#2b2d31' : '#a67c52')
                .setThumbnail(interaction.user.displayAvatarURL())
                .addFields(
                    { name: '📥 Artículos', value: listaFinal },
                    { name: '💳 Banco', value: `\`${(data.banco || 0).toLocaleString()}€\``, inline: true },
                    { name: '⚖️ Registro', value: itemsProcesados.some(i => i.includes('Ilegal')) ? '⚠️ SOSPECHOSO' : '✅ LIMPIO', inline: true }
                )
                .setFooter({ text: 'Sistema de Pertenencias Anda RP' })
                .setTimestamp();

            return interaction.reply({ embeds: [embed], files: files });

        } catch (error) {
            console.error("Error en Mochila:", error);
            return interaction.reply({ content: "❌ Error al acceder a la mochila.", ephemeral: true });
        }
    }
};