const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { db } = require('../Automatizaciones/firebase');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mochila')
        .setDescription('🎒 Revisa los objetos y pertenencias que llevas contigo.'),

    async execute(interaction) {
        try {
            const userRef = db.collection('usuarios_rp').doc(interaction.user.id);
            const doc = await userRef.get();

            if (!doc.exists) return interaction.reply({ content: "❌ No tienes DNI. Regístrate primero.", ephemeral: true });

            const data = doc.data();
            const inv = data.inventario || [];
            
            // Diccionario para poner nombres bonitos y emojis a los IDs técnicos
            const nombresItems = {
                'celular': '📱 Teléfono Móvil',
                'mochila': '🎒 Mochila de Cuero',
                'kit_reparacion': '🛠️ Kit de Reparación',
                'gasolina': '⛽ Bidón de Gasolina',
                'ganzua': '🔐 Ganzúa de Hierro',
                'radio': '📻 Radio Frecuencia',
                'gps': '🗺️ GPS',
                'botiquin': '🩹 Botiquín',
                'cuchillo': '🔪 Cuchillo de Combate',
                'draco': '🔫 Fusil Draco (Ilegal)',
                'chaleco_pesado': '🛡️ Chaleco Antibalas'
            };

            const listaItems = inv.length > 0 
                ? inv.map(id => nombresItems[id] || `📦 ${id.replace(/_/g, ' ')}`).join('\n')
                : 'La mochila está vacía.';

            const embed = new EmbedBuilder()
                .setTitle(`🎒 Mochila de ${interaction.user.username}`)
                .setColor('#a67c52') // Color cuero
                .setThumbnail(interaction.user.displayAvatarURL())
                .addFields(
                    { name: '📦 Objetos Guardados', value: listaItems },
                    { name: '💳 Cuenta Bancaria', value: `\`${(data.banco || 0).toLocaleString()}€\``, inline: true }
                )
                .setFooter({ text: 'Anda RP - Sistema de Inventario' })
                .setTimestamp();

            return interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error(error);
            return interaction.reply({ content: "❌ Error al abrir la mochila.", ephemeral: true });
        }
    }
};