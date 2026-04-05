const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { db } = require('../Automatizaciones/firebase');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('blackmarket')
        .setDescription('💀 Mercado negro... acceso restringido.'),

    async execute(interaction) {
        // --- OBJETOS ILEGALES ---
        const ILEGALES = [
            { label: 'Ganzúa Pro', value: 'ganzua', price: 15000, emoji: '🔐', desc: 'Abre vehículos y puertas con facilidad.' },
            { label: 'Cuchillo de Combate', value: 'cuchillo', price: 8000, emoji: '🔪', desc: 'Arma blanca de corto alcance.' },
            { label: 'Chaleco Antibalas', value: 'chaleco_pesado', price: 25000, emoji: '🛡️', desc: 'Protección máxima contra disparos.' },
            { label: 'Inhibidor de Frecuencia', value: 'inhibidor', price: 40000, emoji: '📵', desc: 'Anula las señales de radio cercanas.' },
            { label: 'Draco Compact', value: 'draco', price: 150000, emoji: '🔫', desc: 'Arma de alto calibre. Uso extremadamente peligroso.' }
        ];

        const embed = new EmbedBuilder()
            .setTitle('💀 MERCADO NEGRO - CONTRABANDO')
            .setColor('#1a1a1a') // Negro total
            .setDescription('Aquí no hacemos preguntas. Si tienes el dinero, tienes el equipo.\n\n' +
                ILEGALES.map(i => `${i.emoji} **${i.label}**: \`${i.price.toLocaleString()}€\``).join('\n'))
            .setFooter({ text: 'Toda transacción es bajo tu propio riesgo.' });

        const menu = new StringSelectMenuBuilder()
            .setCustomId('comprar_blackmarket')
            .setPlaceholder('Elige tu "mercancía"...')
            .addOptions(ILEGALES.map(i => ({
                label: i.label,
                description: i.desc,
                value: i.value,
                emoji: i.emoji
            })));

        const row = new ActionRowBuilder().addComponents(menu);

        return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
    },

    async handleBlackmarketInteractions(interaction) {
        if (!interaction.isStringSelectMenu()) return;

        const objetoId = interaction.values[0];
        const userId = interaction.user.id;

        // Precios del mercado negro
        const ITEMS = {
            'ganzua': { nombre: 'Ganzúa Pro', costo: 15000 },
            'cuchillo': { nombre: 'Cuchillo de Combate', costo: 8000 },
            'chaleco_pesado': { nombre: 'Chaleco Antibalas', costo: 25000 },
            'inhibidor': { nombre: 'Inhibidor', costo: 40000 },
            'draco': { nombre: 'Draco Compact', costo: 150000 }
        };

        const item = ITEMS[objetoId];

        try {
            const userRef = db.collection('usuarios_rp').doc(userId);
            const doc = await userRef.get();
            if (!doc.exists) return interaction.update({ content: "❌ No tienes identidad.", embeds: [], components: [] });

            const data = doc.data();
            const saldo = data.banco || 0;

            if (saldo < item.costo) {
                return interaction.update({ content: "💀 No tienes suficiente dinero sucio para esto.", embeds: [], components: [] });
            }

            await userRef.update({
                banco: saldo - item.costo,
                inventario: [...(data.inventario || []), objetoId]
            });

            return interaction.update({ 
                content: `💀 Has adquirido: **${item.nombre}**. Ten cuidado con los Mossos.`, 
                embeds: [], 
                components: [] 
            });

        } catch (error) {
            console.error(error);
            return interaction.update({ content: "❌ Error en la transacción clandestina.", embeds: [], components: [] });
        }
    }
};