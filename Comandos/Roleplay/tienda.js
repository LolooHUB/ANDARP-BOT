const { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    StringSelectMenuBuilder 
} = require('discord.js');
const { db } = require('../Automatizaciones/firebase');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tienda')
        .setDescription('🛒 Accede al catálogo de suministros de la ciudad.'),

    async execute(interaction) {
        // --- 📦 CATÁLOGO EXTENDIDO ---
        const CATALOGO = [
            // TECNOLOGÍA
            { label: 'Teléfono Móvil', value: 'celular', price: 1500, emoji: '📱', desc: 'Acceso a servicios digitales y llamadas.' },
            { label: 'GPS de Navegación', value: 'gps', price: 800, emoji: '🗺️', desc: 'Evita perderte por las carreteras.' },
            { label: 'Radio Frecuencia', value: 'radio', price: 1200, emoji: '📻', desc: 'Comunicación por canales privados.' },
            
            // EQUIPAMIENTO
            { label: 'Mochila de Cuero', value: 'mochila', price: 3000, emoji: '🎒', desc: 'Espacio extra para tus pertenencias.' },
            { label: 'Chaleco Reflectante', value: 'chaleco', price: 500, emoji: '🦺', desc: 'Seguridad en reparaciones de carretera.' },
            { label: 'Cámara de Fotos', value: 'camara', price: 2500, emoji: '📷', desc: 'Para periodismo o pruebas gráficas.' },

            // MECÁNICA & SUPERVIVENCIA
            { label: 'Kit de Reparación', value: 'kit_reparacion', price: 5000, emoji: '🛠️', desc: 'Repara daños críticos de motor.' },
            { label: 'Bidón de Gasolina', value: 'gasolina', price: 800, emoji: '⛽', desc: '10 litros de combustible extra.' },
            { label: 'Botiquín de Primeros Auxilios', value: 'botiquin', price: 1500, emoji: '🩹', desc: 'Cura heridas leves antes de ir al hospital.' },

            // ILEGALES / ESPECIALES (Opcional, bórralos si no quieres que sean públicos)
            { label: 'Ganzúa de Hierro', value: 'ganzua', price: 7000, emoji: '🔐', desc: 'Útil para abrir cerraduras bloqueadas.' },
            { label: 'Máscara de Gas', value: 'mascara', price: 4500, emoji: '🎭', desc: 'Protección contra humos y gases.' }
        ];

        const embed = new EmbedBuilder()
            .setAuthor({ name: 'BAZAR CENTRAL - GENERALITAT', iconURL: 'https://i.imgur.com/vH8vL4S.png' })
            .setTitle('🛒 Suministros y Equipamiento')
            .setColor('#f1c40f')
            .setDescription('Bienvenido. El pago se procesará directamente desde tu **cuenta bancaria**.\n\n' + 
                CATALOGO.map(i => `${i.emoji} **${i.label}**: \`${i.price.toLocaleString()}€\``).join('\n'))
            .setFooter({ text: 'Usa el menú de abajo para seleccionar un producto.' });

        const menu = new StringSelectMenuBuilder()
            .setCustomId('comprar_tienda')
            .setPlaceholder('¿Qué deseas adquirir hoy?')
            .addOptions(CATALOGO.map(i => ({
                label: i.label,
                description: i.desc,
                value: i.value,
                emoji: i.emoji
            })));

        const row = new ActionRowBuilder().addComponents(menu);

        return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
    },

    async handleTiendaInteractions(interaction) {
        if (!interaction.isStringSelectMenu()) return;

        const objetoId = interaction.values[0];
        const userId = interaction.user.id;

        // Diccionario de precios (debe estar sincronizado con el catálogo)
        const ITEMS = {
            'celular': { nombre: 'Teléfono Móvil', costo: 1500 },
            'gps': { nombre: 'GPS de Navegación', costo: 800 },
            'radio': { nombre: 'Radio Frecuencia', costo: 1200 },
            'mochila': { nombre: 'Mochila de Cuero', costo: 3000 },
            'chaleco': { nombre: 'Chaleco Reflectante', costo: 500 },
            'camara': { nombre: 'Cámara de Fotos', costo: 2500 },
            'kit_reparacion': { nombre: 'Kit de Reparación', costo: 5000 },
            'gasolina': { nombre: 'Bidón de Gasolina', costo: 800 },
            'botiquin': { nombre: 'Botiquín de Primeros Auxilios', costo: 1500 },
            'ganzua': { nombre: 'Ganzúa de Hierro', costo: 7000 },
            'mascara': { nombre: 'Máscara de Gas', costo: 4500 }
        };

        const item = ITEMS[objetoId];

        try {
            const userRef = db.collection('usuarios_rp').doc(userId);
            const doc = await userRef.get();

            if (!doc.exists) return interaction.update({ content: "❌ No tienes DNI.", embeds: [], components: [] });

            const data = doc.data();
            const saldo = data.banco || 0;
            const inv = data.inventario || [];

            // Validación de saldo
            if (saldo < item.costo) {
                return interaction.update({ 
                    content: `❌ Fondos insuficientes. El coste es de **${item.costo.toLocaleString()}€** y solo tienes **${saldo.toLocaleString()}€**.`, 
                    embeds: [], components: [] 
                });
            }

            // Actualizar Firebase
            await userRef.update({
                banco: saldo - item.costo,
                inventario: [...inv, objetoId]
            });

            // Log para el Staff (Opcional: puedes enviar esto a un canal de logs)
            console.log(`🛒 COMPRA: ${interaction.user.tag} compró ${item.nombre}`);

            return interaction.update({ 
                content: `✅ Compra realizada: **${item.nombre}**. Se han descontado **${item.costo.toLocaleString()}€** de tu cuenta.`, 
                embeds: [], components: [] 
            });

        } catch (error) {
            console.error(error);
            return interaction.update({ content: "❌ Error en el sistema de transacciones.", embeds: [], components: [] });
        }
    }
};