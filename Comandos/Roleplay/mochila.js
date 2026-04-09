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

            if (!doc.exists) return interaction.reply({ content: "❌ No tienes DNI registrado.", ephemeral: true });

            const data = doc.data();
            const inv = data.inventario || {}; 

            // --- DICCIONARIO MAESTRO (TIENDA + BLACKMARKET) ---
            const CATALOGO_TOTAL = {
                // Legales
                'celular': { n: 'Teléfono Móvil', e: '📱', p: 0.2 },
                'gps': { n: 'GPS', e: '🗺️', p: 0.1 },
                'radio': { n: 'Radio', e: '📻', p: 0.5 },
                'mochila': { n: 'Mochila', e: '🎒', p: 0.0 },
                'kit_reparacion': { n: 'Kit de Reparación', e: '🛠️', p: 5.0 },
                'botiquin': { n: 'Botiquín', e: '🩹', p: 1.2 },
                'gasolina': { n: 'Bidón de Gasolina', e: '⛽', p: 10.0 },
                'camara': { n: 'Cámara Réflex', e: '📷', p: 1.5 },
                // Ilegales
                'glock': { n: 'Glock-17', e: '🔫', p: 1.5 },
                'ak47': { n: 'AK-47', e: '⚔️', p: 4.3 },
                'placa_virgen': { n: 'Placa Virgen', e: '🆔', p: 0.5 },
                'ganzua': { n: 'Ganzúa Pro', e: '🔐', p: 0.3 },
                'chaleco_pesado': { n: 'Chaleco Pesado', e: '🛡️', p: 8.0 },
                'inhibidor': { n: 'Inhibidor', e: '📵', p: 2.0 },
                'muni_9mm': { n: 'Munición 9mm', e: '📦', p: 0.8 },
                'muni_762': { n: 'Munición 7.62', e: '🔥', p: 1.2 }
            };

            let itemsLista = [];
            let pesoTotal = 0;

            // Procesamos el inventario (sea Objeto o Array)
            const entradas = Object.entries(inv);

            if (entradas.length > 0) {
                entradas.forEach(([id, cantidad]) => {
                    if (cantidad > 0) {
                        const item = CATALOGO_TOTAL[id] || { n: id.replace(/_/g, ' '), e: '📦', p: 1.0 };
                        pesoTotal += (item.p * cantidad);
                        itemsLista.push(`> ${item.e} **${item.n}** x${cantidad} \`(${item.p * cantidad}kg)\``);
                    }
                });
            }

            const tieneMochila = inv['mochila'] > 0;
            const capacidadMax = tieneMochila ? 35.0 : 20.0;
            const listaFinal = itemsLista.length > 0 ? itemsLista.join('\n') : '*La mochila está vacía.*';

            // Bypass de Imagen
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
                .setTitle('🎒 ESTADO DEL INVENTARIO')
                .setColor(pesoTotal > capacidadMax ? '#e74c3c' : '#f1c40f')
                .setThumbnail(interaction.user.displayAvatarURL())
                .addFields(
                    { name: '📥 Objetos y Carga', value: listaFinal },
                    { name: '📊 Peso Total', value: `\`${pesoTotal.toFixed(2)} / ${capacidadMax} kg\``, inline: true },
                    { name: '💳 Banco', value: `\`${(data.banco || 0).toLocaleString()}€\``, inline: true }
                )
                .setFooter({ text: 'Anda RP - Sistema de Suministros' })
                .setTimestamp();

            return interaction.reply({ embeds: [embed], files: files });

        } catch (error) {
            console.error("Error en Mochila:", error);
            return interaction.reply({ content: "❌ Error al abrir la mochila.", ephemeral: true });
        }
    }
};